FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
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
ENV PYTHONPATH=/app:/app/backend

# Expose port
EXPOSE 8000

# Run the application - change to backend and run uvicorn from there
CMD ["sh", "-c", "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4"]
