FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose port (Railway sets PORT env var at runtime)
EXPOSE 8000

# Set environment to use the installed packages
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PORT=8000

# Run the application with PORT from environment
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4 --app-dir backend"]
