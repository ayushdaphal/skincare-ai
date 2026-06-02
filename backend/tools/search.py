import os
import pickle
import json
import re
import numpy as np
from sentence_transformers import SentenceTransformer, CrossEncoder
import chromadb
from tavily import TavilyClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env"))

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "embed", "chroma_persistent_storage")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# ── Load models + indices once at import time ──
print("Loading embedding model...")
embedder = SentenceTransformer("all-MiniLM-L6-v2")

print("Loading cross-encoder reranker...")
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

print("Loading ChromaDB...")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
# This prevents crashes if the DB is blank; it creates an empty collection instead
collection = chroma_client.get_or_create_collection("knowledge_base")

print("Loading BM25 indices...")
with open(os.path.join(DATA_DIR, "product_bm25.pkl"), "rb") as f:
    product_bm25_data = pickle.load(f)
with open(os.path.join(DATA_DIR, "blog_bm25.pkl"), "rb") as f:
    blog_bm25_data = pickle.load(f)

product_bm25 = product_bm25_data["bm25"]
product_docs = product_bm25_data["docs"]
blog_bm25 = blog_bm25_data["bm25"]
blog_docs = blog_bm25_data["docs"]

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

# ── Query cache ──
_cache = {}

def _get_embedding(text: str) -> np.ndarray:
    return embedder.encode(text, convert_to_numpy=True)

def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

def _normalize_query(query: str) -> str:
    q = query.lower().strip()
    q = re.sub(r'[^\w\s₹]', ' ', q)
    q = ' '.join(sorted(q.split()))
    return q

def _check_cache(query: str):
    normalized = _normalize_query(query)
    emb = _get_embedding(normalized)
    for cached_emb, result in _cache.items():
        cached_arr = np.frombuffer(cached_emb, dtype=np.float32)
        if _cosine_sim(emb, cached_arr) >= 0.90:
            print(f"[CACHE HIT] {query}")
            return result, emb
    print(f"[CACHE MISS] {query}")
    return None, emb

def _store_cache(emb: np.ndarray, result):
    key = emb.astype(np.float32).tobytes()
    _cache[key] = result

# ── Reciprocal Rank Fusion ──
def _hybrid_search(query: str, source: str, bm25, docs: list, n: int = 5) -> list:
    # Dense search via ChromaDB
    dense_results = collection.query(
        query_texts=[query],
        n_results=n * 2,
        where={"source": source},
        include=["documents", "metadatas"]
    )
    dense_docs = dense_results["documents"][0]
    dense_metas = dense_results["metadatas"][0]

    # Sparse search via BM25
    tokens = query.lower().split()
    bm25_scores = bm25.get_scores(tokens)
    top_sparse_idx = np.argsort(bm25_scores)[::-1][:n * 2].tolist()

    # RRF merge
    dense_pool = {i: (dense_docs[i], dense_metas[i]) for i in range(len(dense_docs))}
    sparse_pool = {i: (docs[i], {}) for i in top_sparse_idx}

    all_texts = {}
    for i, (doc, meta) in dense_pool.items():
        all_texts[doc] = {"doc": doc, "meta": meta, "dense_rank": i}
    for i, (doc, meta) in sparse_pool.items():
        if doc not in all_texts:
            all_texts[doc] = {"doc": doc, "meta": meta, "sparse_rank": i}
        else:
            all_texts[doc]["sparse_rank"] = i

    scored = []
    for text, info in all_texts.items():
        score = 0
        if "dense_rank" in info:
            score += 1 / (60 + info["dense_rank"])
        if "sparse_rank" in info:
            score += 1 / (60 + info["sparse_rank"])
        scored.append((score, info))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [item["doc"] for _, item in scored[:n]]

# ── Cross-encoder reranker ──
def _rerank(query: str, docs: list, top_n: int = 5) -> list:
    if not docs:
        return docs
    # Use first 512 chars of each doc to keep it fast
    pairs = [(query, doc[:512]) for doc in docs]
    scores = reranker.predict(pairs)
    scored = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
    print(f"[RERANK] top score: {scored[0][0]:.3f} | bottom: {scored[-1][0]:.3f}")
    return [doc for _, doc in scored[:top_n]]


# ── Tool: search_products ──
def search_products(query: str, max_price: float = None, n: int = 5) -> dict:
    cached, emb = _check_cache(f"products:{query}:{max_price}")
    if cached:
        return cached

    # Step 1: Hybrid search — get broad candidates
    results = _hybrid_search(query, "excel", product_bm25, product_docs, n=n * 3)

    # Step 2: Price + skin type filter
    skin_type_filters = []
    query_lower = query.lower()
    if "oily" in query_lower:
        skin_type_filters = ["oily", "acne", "oil control", "mattif"]
    elif "dry" in query_lower:
        skin_type_filters = ["dry", "hydrat", "moisture"]
    elif "sensitive" in query_lower:
        skin_type_filters = ["sensitive", "gentle", "fragrance-free"]
    elif "combination" in query_lower:
        skin_type_filters = ["combination"]

    if max_price is not None or skin_type_filters:
        filtered = []
        for doc in results:
            doc_lower = doc.lower()
            price_ok = True
            skin_ok = True

            for line in doc.split("\n"):
                if "Variant Price:" in line:
                    try:
                        price = float(line.split(":")[-1].strip())
                        if max_price is not None and price > max_price:
                            price_ok = False
                    except:
                        pass
                    break

            if skin_type_filters:
                skin_ok = any(kw in doc_lower for kw in skin_type_filters)

            if price_ok and skin_ok:
                filtered.append(doc)

        results = filtered if filtered else results

    # Step 3: Cross-encoder rerank
    results = _rerank(query, results[:n * 2], top_n=n)

    # Step 4: Extract key fields
    products = []
    for doc in results:
        p = {}
        for line in doc.split("\n"):
            if line.startswith("Title:"):
                p["name"] = line.replace("Title:", "").strip()
            elif line.startswith("D:"):
                p["description"] = line.replace("D:", "").strip()[:200]
            elif "Variant Price:" in line:
                try:
                    p["price"] = float(line.split(":")[-1].strip())
                except:
                    pass
            elif line.startswith("URL:"):
                p["url"] = line.replace("URL:", "").strip()
            elif "key_benefits_list" in line:
                p["benefits"] = line.split("]:")[-1].strip()[:200]
            elif "key_ingredients_list" in line:
                p["ingredients"] = line.split("]:")[-1].strip()[:200]
            elif "custom.skin_concerns" in line:
                p["skin_concerns"] = line.split("]:")[-1].strip()
            elif line.startswith("Image Src:"):
                p["image"] = line.replace("Image Src:", "").strip()
        products.append(p)

    result = {"source": "products", "results": products}
    _store_cache(emb, result)
    return result


# ── Tool: search_blogs ──
def search_blogs(query: str, n: int = 3) -> dict:
    cached, emb = _check_cache(f"blogs:{query}")
    if cached:
        return cached

    # Step 1: Hybrid search
    results = _hybrid_search(query, "blog", blog_bm25, blog_docs, n=n * 3)

    # Step 2: Cross-encoder rerank
    results = _rerank(query, results, top_n=n)

    # Step 3: Extract metadata
    blogs = []
    for doc in results:
        b = {"excerpt": doc[:300]}
        meta_match = re.search(r'Metadata:\s*(\{.*?\})', doc, re.DOTALL)
        if meta_match:
            try:
                meta = json.loads(meta_match.group(1))
                b["title"] = meta.get("title", "")
                b["link"] = meta.get("link", "")
                b["tags"] = meta.get("tags", "")
            except:
                pass
        blogs.append(b)

    result = {"source": "blogs", "results": blogs}
    _store_cache(emb, result)
    return result


# ── Tool: web_search ──
def web_search(query: str) -> dict:
    cached, emb = _check_cache(f"web:{query}")
    if cached:
        return cached

    try:
        response = tavily.search(query=query, max_results=3)
        results = [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", "")[:500]
            }
            for r in response.get("results", [])
        ]
        result = {"source": "web", "results": results}
    except Exception as e:
        result = {"source": "web", "results": [], "error": str(e)}

    _store_cache(emb, result)
    return result