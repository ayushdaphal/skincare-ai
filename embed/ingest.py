import os
import json
import uuid
import time
import pandas as pd
import requests
from tqdm import tqdm
import chromadb

# ===============================
# CONFIG
# ===============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "knowledge.csv")
BLOGS_DIR = os.path.join(BASE_DIR, "data", "blogs")

CHROMA_PATH = os.getenv("CHROMA_SERVER_PATH", os.path.join(BASE_DIR, "chroma_persistent_storage"))
COLLECTION_NAME = "knowledge_base"

# API Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
EMBEDDING_MODEL = "nomic-embed-text-v1_5"

# Batch size optimized for Groq API processing bounds
BATCH_SIZE = 32  

if not GROQ_API_KEY:
    print("[WARNING] GROQ_API_KEY environment variable is missing! Seeding will fail if API is unauthenticated.")

print("Initializing Persistent ChromaDB Network Client...")
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)

# ===============================
# EXTERNAL API EMBEDDING PIPELINE
# ===============================
def embed_batch_via_api(texts):
    """
    Sends batch texts to Hugging Face's free serverless Inference API.
    Maintains a 0MB local system memory profile by outsourcing compute.
    """
    # Using your exact original model, but hosted completely on the cloud
    url = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
    
    payload = {"inputs": texts, "options": {"wait_for_model": True}}
    
    for retry in range(3):
        try:
            response = requests.post(url, json=payload, timeout=30)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 503:
                # Model is loading on HF servers, wait and retry
                print("\n[INFO] Hugging Face model is booting up, retrying in 5s...")
                time.sleep(5)
            else:
                raise Exception(f"Hugging Face API Error: {response.text}")
        except requests.RequestException as e:
            if retry == 2:
                raise Exception(f"Network failure reaching Hugging Face pools: {str(e)}")
            time.sleep(2)
    
    raise Exception("Failed to fetch vector representations from Hugging Face pool.")

def store_batch(documents, metadatas):
    if not documents:
        return
    
    # Request vector matrix map directly over the network wire
    embeddings = embed_batch_via_api(documents)
    
    collection.add(
        ids=[str(uuid.uuid4()) for _ in documents],
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings
    )

# ===============================
# EXCEL / CSV INGESTION
# ===============================
def ingest_excel():
    print("Processing CSV catalog via ultra-fast memory slicing mode...")
    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] Product catalog asset not found at path context: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH, encoding="latin1")
    total_rows = len(df)
    
    docs = []
    metas = []
    
    for skip in tqdm(range(0, total_rows, BATCH_SIZE), desc="Embedding Catalog"):
        df_chunk = df.iloc[skip : skip + BATCH_SIZE]
        
        for idx, row in df_chunk.iterrows():
            row_text = "\n".join([f"{col}: {str(row[col])}" for col in df_chunk.columns if pd.notna(row[col])])
            
            docs.append(row_text)
            metas.append({
                "source": "excel",
                "row_index": int(skip + len(docs) - 1)
            })
            
        store_batch(docs, metas)
        docs, metas = [], []  # Explicitly flush temporary list variables

# ===============================
# BLOG INGESTION
# ===============================
def chunk_text(text, chunk_size=2000, overlap=300):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def ingest_blogs():
    print("Processing blogs...")
    if not os.path.exists(BLOGS_DIR):
        print("[WARNING] Blogs directory not found, skipping.")
        return
        
    docs = []
    metas = []

    for folder in os.listdir(BLOGS_DIR):
        blog_path = os.path.join(BLOGS_DIR, folder)
        if not os.path.isdir(blog_path):
            continue

        metadata_path = os.path.join(blog_path, "metadata.json")
        content_path = os.path.join(blog_path, "content_plain.txt")

        metadata = {}
        content = ""

        if os.path.exists(metadata_path):
            with open(metadata_path, "r", encoding="utf-8") as f:
                try:
                    metadata = json.load(f)
                except Exception:
                    pass

        if os.path.exists(content_path):
            with open(content_path, "r", encoding="utf-8") as f:
                content = f.read()

        if not content.strip():
            continue

        chunks = chunk_text(content)
        for chunk_idx, chunk in enumerate(chunks):
            combined_text = f"Metadata:\n{json.dumps(metadata)}\n\nContent:\n{chunk}"
            safe_metadata = {
                "source": "blog",
                "blog_name": folder,
                "chunk_index": chunk_idx
            }
            for k, v in metadata.items():
                if isinstance(v, (str, int, float, bool)):
                    safe_metadata[k] = v

            docs.append(combined_text)
            metas.append(safe_metadata)

            if len(docs) >= BATCH_SIZE:
                store_batch(docs, metas)
                docs, metas = [], []

    store_batch(docs, metas)

# ===============================
# MAIN ENTRYPOINT
# ===============================
def main():
    if not GROQ_API_KEY:
        print("[CRITICAL] Aborting ingestion sequence. GROQ_API_KEY environment variable is required.")
        return
    
    start_time = time.time()
    ingest_excel()
    ingest_blogs()
    duration = time.time() - start_time
    print(f"\nDone. Ingestion completed under light memory bounds in {duration:.2f} seconds.")

if __name__ == "__main__":
    main()