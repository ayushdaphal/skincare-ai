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
# Absolute directory containing this script (e.g., /app/embed)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Securely resolves to /app/embed/data/knowledge.xlsx on the cloud
EXCEL_PATH = os.path.join(BASE_DIR, "data", "knowledge.xlsx")

# Securely resolves to /app/embed/data/blogs
BLOGS_DIR = os.path.join(BASE_DIR, "data", "blogs")

CHROMA_PATH = os.getenv("CHROMA_SERVER_PATH", os.path.join(os.path.dirname(__file__), "chroma_persistent_storage"))
COLLECTION_NAME = "knowledge_base"

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 300
BATCH_SIZE = 128

# ===============================
# EMBEDDING MODEL
# ===============================
print("Loading embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")

# ===============================
# CHROMA SETUP
# ===============================
client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = client.get_or_create_collection(
    name=COLLECTION_NAME
)

# ===============================
# HELPERS
# ===============================
def chunk_text(text, chunk_size=2000, overlap=300):
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap

    return chunks


def embed_batch(texts):
    return model.encode(
        texts,
        batch_size=64,
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
# EXCEL INGESTION
# ===============================
def ingest_excel():
    print("Processing Excel...")

    df = pd.read_excel(EXCEL_PATH)

    docs = []
    metas = []

    for idx, row in tqdm(df.iterrows(), total=len(df)):
        row_text = "\n".join(
            [f"{col}: {str(row[col])}" for col in df.columns]
        )

        docs.append(row_text)

        metas.append({
            "source": "excel",
            "row_index": int(idx)
        })

        if len(docs) >= BATCH_SIZE:
            store_batch(docs, metas)
            docs, metas = [], []

    store_batch(docs, metas)

# ===============================
# BLOG INGESTION
# ===============================
def ingest_blogs():
    print("Processing blogs...")

    docs = []
    metas = []

    for folder in tqdm(os.listdir(BLOGS_DIR)):
        blog_path = os.path.join(BLOGS_DIR, folder)

        if not os.path.isdir(blog_path):
            continue

        metadata_path = os.path.join(blog_path, "metadata.json")
        content_path = os.path.join(blog_path, "content_plain.txt")

        metadata = {}
        content = ""

        if os.path.exists(metadata_path):
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)

        if os.path.exists(content_path):
            with open(content_path, "r", encoding="utf-8") as f:
                content = f.read()

        if not content.strip():
            continue

        chunks = chunk_text(content)

        for chunk_idx, chunk in enumerate(chunks):
            combined_text = f"""
Metadata:
{json.dumps(metadata)}

Content:
{chunk}
"""

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
# MAIN
# ===============================
def main():
    ingest_excel()
    ingest_blogs()

    print("\nDone.")
    print(f"Persistent Chroma storage created at: {CHROMA_PATH}")

if __name__ == "__main__":
    main()