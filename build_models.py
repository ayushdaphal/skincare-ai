import os
from sentence_transformers import SentenceTransformer, CrossEncoder

print("=== Pre-downloading HuggingFace Models for Production Cache ===")

# Force cache tracking directory paths inside the container bundle space
os.environ["HF_HOME"] = "/app/.hf_cache"

print("Downloading SentenceTransformer model...")
SentenceTransformer("all-MiniLM-L6-v2")

print("Downloading CrossEncoder model...")
CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

print("=== Model caching phase complete! ===")