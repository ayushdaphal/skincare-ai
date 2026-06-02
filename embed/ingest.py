import os
import json
import uuid
import pandas as pd
from tqdm import tqdm
import chromadb
from sentence_transformers import SentenceTransformer

# ===============================
# CONFIG
# ===============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, "data", "knowledge.xlsx")
BLOGS_DIR = os.path.join(BASE_DIR, "data", "blogs")

# Use absolute paths or fallback to system configuration
CHROMA_PATH = os.getenv("CHROMA_SERVER_PATH", os.path.join(BASE_DIR, "chroma_persistent_storage"))
COLLECTION_NAME = "knowledge_base"

# Aggressive batch tuning for lower memory environments
BATCH_SIZE = 32  

print("Loading embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)

def embed_batch(texts):
    return model.encode(
        texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=False,
        convert_to_numpy=True
    ).tolist()

def store_batch(documents, metadatas):
    if not documents:
        return
    embeddings = embed_batch(documents)
    collection.add(
        ids=[str(uuid.uuid4()) for _ in documents],
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings
    )

# ===============================
# LOW-MEMORY EXCEL INGESTION
# ===============================
def ingest_excel():
    print("Processing Excel in low-memory chunk modes...")
    
    # Check total row count smoothly without loading values
    total_rows = len(pd.read_excel(EXCEL_PATH, usecols=[0]))
    
    docs = []
    metas = []
    
    # Process the spreadsheet in chunks of 32 rows to stay well under the 512MB RAM cap
    for skip in tqdm(range(0, total_rows, BATCH_SIZE), desc="Embedding Catalog"):
        df_chunk = pd.read_excel(EXCEL_PATH, skiprows=range(1, skip + 1) if skip > 0 else None, nrows=BATCH_SIZE)
        
        for idx, row in df_chunk.iterrows():
            row_text = "\n".join([f"{col}: {str(row[col])}" for col in df_chunk.columns if pd.notna(row[col])])
            
            docs.append(row_text)
            metas.append({
                "source": "excel",
                "row_index": int(skip + idx)
            })
            
        store_batch(docs, metas)
        docs, metas = [], []  # Force clear arrays from memory instantly

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

def main():
    ingest_excel()
    ingest_blogs()
    print("\nDone. Ingestion completed under low memory bounds.")

if __name__ == "__main__":
    main()