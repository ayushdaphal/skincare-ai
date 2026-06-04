import os
import json
import time
import pandas as pd
import numpy as np
from tqdm import tqdm
import faiss
from chromadb.utils import embedding_functions

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "knowledge.csv")

# Ensure target directories exist cleanly 
EMBED_DIR = os.path.join(BASE_DIR, "embed")
os.makedirs(EMBED_DIR, exist_ok=True)

FAISS_INDEX_PATH = os.path.join(EMBED_DIR, "compressed_index.faiss")
METADATA_MAP_PATH = os.path.join(EMBED_DIR, "metadata.json")

BATCH_SIZE = 32

# Lists to hold all compiled documents, metadatas, and raw vector arrays locally
all_documents = []
all_metadatas = []
all_embeddings = []

def get_blogs_directory():
    env_path = os.getenv("BLOGS_DATA_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
        
    fallbacks = [
        "/app/embed/data/blogs",
        "/app/data/blogs",
        os.path.join(BASE_DIR, "data", "blogs")
    ]
    for path in fallbacks:
        if os.path.exists(path):
            return path
            
    return env_path if env_path else fallbacks[0]

print("Initializing Fast Native ONNX Embedding Function...")
onnx_ef = embedding_functions.ONNXMiniLM_L6_V2()

# Intermediate collector replacing the dynamic database add methods
def collect_batch(documents, metadatas):
    if not documents:
        return
    
    global all_documents, all_metadatas, all_embeddings
    
    # Generate raw 384-dimensional floating point embeddings via your native ONNX engine
    embeddings = onnx_ef(documents)
    
    all_documents.extend(documents)
    all_metadatas.extend(metadatas)
    all_embeddings.extend(embeddings)

# ===============================
# PRODUCT INGESTION
# ===============================
def ingest_excel():
    print("\nProcessing CSV catalog via ultra-fast native memory slicing...")
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
            
        collect_batch(docs, metas)
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
    print("\nProcessing blogs directory text assets...")
    active_blogs_dir = get_blogs_directory()
    print(f"Targeting path at: {active_blogs_dir}")
    
    if not os.path.exists(active_blogs_dir):
        print(f"[WARNING] Blogs directory not found at {active_blogs_dir}, skipping.")
        return
        
    docs = []
    metas = []

    blog_folders = [f for f in os.listdir(active_blogs_dir) if os.path.isdir(os.path.join(active_blogs_dir, f))]
    print(f"[INFO] Found {len(blog_folders)} blog assets to process.")

    for folder in blog_folders:
        blog_path = os.path.join(active_blogs_dir, folder)
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
        print(f"  -> Processing: '{folder}' ({len(chunks)} chunks discovered)")

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
                collect_batch(docs, metas)
                docs, metas = [], []

    if docs:
        collect_batch(docs, metas)

# ===============================
# METRICS & COMPRESSION COMPILER
# ===============================
def compile_quantized_index():
    global all_embeddings, all_documents, all_metadatas
    
    if not all_embeddings:
        print("[ERROR] No vectors generated to compile.")
        return

    print("\n--- Initiating Index Structural Compression Layer ---")
    
    # Form mathematical matrix layout
    embeddings_matrix = np.array(all_embeddings).astype('float32')
    total_vectors, dimension = embeddings_matrix.shape
    print(f"Total Vectors Captured: {total_vectors} | Native Vector Dimensions: {dimension}")

    print("Building 8-bit Scalar Quantization index mapping...")
    # Quantize vectors to 8-bit integers while preserving Inner Product (Cosine Similarity for normalized text metrics)
    quantizer = faiss.IndexFlatIP(dimension)
    index = faiss.IndexScalarQuantizer(dimension, faiss.ScalarQuantizer.QT_8bit, faiss.METRIC_INNER_PRODUCT)
    
    print("Calibrating quantization parameters...")
    index.train(embeddings_matrix)
    
    print("Injecting and compressing vector matrix layers...")
    index.add(embeddings_matrix)

    print(f"Writing compressed binary index asset to: {FAISS_INDEX_PATH}")
    faiss.write_index(index, FAISS_INDEX_PATH)

    print(f"Compiling secondary structural text map at: {METADATA_MAP_PATH}")
    # Anchor the vector index index offsets seamlessly to the string document text strings
    compiled_metadata_map = {}
    for i in range(total_vectors):
        compiled_metadata_map[str(i)] = {
            "document": all_documents[i],
            "metadata": all_metadatas[i]
        }
        
    with open(METADATA_MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(compiled_metadata_map, f, ensure_ascii=False, indent=2)

    print("🎉 Quantization Phase Completed. System footings optimized successfully.")

# ===============================
# ENTRYPOINT
# ===============================
def main():
    print("\n--- Starting Production Data Volume Seeding ---")
    start_time = time.time()
    
    ingest_excel()
    ingest_blogs()
    compile_quantized_index()
    
    duration = time.time() - start_time
    print(f"\n--- Production Data Volume Seeding Completed ---")
    print(f"Native Quantized Ingestion completed successfully in {duration:.2f} seconds.\n")

if __name__ == "__main__":
    main()