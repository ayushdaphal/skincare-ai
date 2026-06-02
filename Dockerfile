# 1. Swapped to 3.11-slim for stable binary wheels compatibility (ChromaDB, Numpy, Pandas)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# 2. Installed build-essential and g++ so database native binaries compile smoothly
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with verbose output
RUN pip install --no-cache-dir -r requirements.txt && \
    python -c "from groq import Groq; print('✓ groq installed successfully')" && \
    python -c "import chromadb; print('✓ chromadb installed successfully')" && \
    python -c "import uvicorn; print('✓ uvicorn installed successfully')"

# Copy the rest of the application
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000
# Ensures modules under root, backend, and tools folders resolve effortlessly
ENV PYTHONPATH=/app:/app/backend:/app/tools

# Expose port
EXPOSE 8000


# Start Uvicorn directly from the root workspace folder, maintaining full environment variables scope
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]