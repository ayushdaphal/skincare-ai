import os
import json
import uuid
import time
import pandas as pd
from tqdm import tqdm
import chromadb
from chromadb.utils import embedding_functions

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "knowledge.csv")

# Force look at the absolute container path where Railway mounts the Volume
CHROMA_PATH = os.getenv("CHROMA_SERVER_PATH", "/app/embed/chroma_persistent_storage")
COLLECTION_NAME = "knowledge_base"
BATCH_SIZE = 32

# Dynamic path resolution checks environment variable first, then standard fallbacks
def get_blogs_directory():
    env_path = os.getenv("BLOGS_DATA_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
        
    # Check fallback variations in the container layout
    fallbacks = [
        "/app/embed/data/blogs",
        "/app/data/blogs",
        os.path.join(BASE_DIR, "data", "blogs")
    ]
    for path in fallbacks:
        if os.path.exists(path):
            return path
            
    # Return default if none exist yet to prevent crashing
    return env_path if env_path else fallbacks[0]

print("Initializing Fast Native ONNX Embedding Function...")
onnx_ef = embedding_functions.ONNXMiniLM_L6_V2()

print("Initializing Persistent ChromaDB Client...")
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(
    name=COLLECTION_NAME, 
    embedding_function=onnx_ef
)

def store_batch(documents, metadatas):
    if not documents:
        return
    
    collection.add(
        ids=[str(uuid.uuid4()) for _ in documents],
        documents=documents,
        metadatas=metadatas
    )

# ===============================
# PRODUCT INGESTION
# ===============================
def ingest_excel():
    print("Checking existing product vector collection layers...")
    
    # Query specifically for product sources to check isolation status
    existing_products = collection.get(where={"source": "excel"}, limit=1)
    if existing_products and existing_products["ids"]:
        print("[INFO] Product catalog vectors already exist. Skipping heavy product embedding loop.")
        return

    print("Processing CSV catalog via ultra-fast native memory slicing...")
    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] Product catalog asset not found at: {CSV_PATH}")
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
        docs, metas = [], []

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
    print("Checking existing blog vector collection layers...")
    
    # Query specifically for blog sources to allow isolated ingestion
    existing_blogs = collection.get(where={"source": "blog"}, limit=1)
    if existing_blogs and existing_blogs["ids"]:
        print("[INFO] Blog vectors already exist. Skipping blog embedding loop.")
        return

    # Call the dynamic checker to locate the active folder path
    active_blogs_dir = get_blogs_directory()
    print(f"Processing blogs directory text assets at: {active_blogs_dir}")
    
    if not os.path.exists(active_blogs_dir):
        print(f"[WARNING] Blogs directory not found at {active_blogs_dir}, skipping.")
        return
        
    docs = []
    metas = []

    # Use the active directory variable for the loop
    for folder in os.listdir(active_blogs_dir):
        blog_path = os.path.join(active_blogs_dir, folder)
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
# ENTRYPOINT
# ===============================
def main():
    start_time = time.time()
    ingest_excel()
    ingest_blogs()
    duration = time.time() - start_time
    print(f"\nDone. Native Ingestion completed successfully in {duration:.2f} seconds.")

if __name__ == "__main__":
    main()