import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pickle
import chromadb
from rank_bm25 import BM25Okapi
from tqdm import tqdm

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "..", "embed", "chroma_persistent_storage")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")

os.makedirs(OUTPUT_DIR, exist_ok=True)

def fetch_all(collection, source, batch_size=500):
    print(f"Fetching all {source} documents...")
    all_docs = []
    offset = 0
    while True:
        result = collection.get(
            where={"source": source},
            limit=batch_size,
            offset=offset,
            include=["documents"]
        )
        docs = result["documents"]
        if not docs:
            break
        all_docs.extend(docs)
        offset += len(docs)
        print(f"   fetched {offset} so far...")
        if len(docs) < batch_size:
            break
    return all_docs

def build_bm25(docs, name):
    # Guard clause to keep empty lists from causing crashes
    if not docs:
        print(f"[INFO] No documents fetched for {name}. Skipping BM25 index compilation.")
        return None
        
    print(f"Building BM25 for {name} ({len(docs)} docs)...")
    tokenized = [doc.lower().split() for doc in tqdm(docs)]
    bm25 = BM25Okapi(tokenized)
    out_path = os.path.join(OUTPUT_DIR, f"{name}_bm25.pkl")
    with open(out_path, "wb") as f:
        pickle.dump({"bm25": bm25, "docs": docs}, f)
    print(f"Saved to {out_path}")
    return bm25

def main():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    
    # Cleaned up indentation block ensures 'client' stays safely within local function scopes
    try:
        collection = client.get_collection("knowledge_base")
    except Exception:
        print("[INFO] Collection not initialized in journal layers yet. Fetching or creating schema...")
        collection = client.get_or_create_collection("knowledge_base")  
        
    print(f"Total items in collection: {collection.count()}")

    product_docs = fetch_all(collection, "excel")
    build_bm25(product_docs, "product")

    blog_docs = fetch_all(collection, "blog")
    build_bm25(blog_docs, "blog")

    print("\nDone! BM25 indices saved to backend/data/")

if __name__ == "__main__":
    main()