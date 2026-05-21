# Clinikally AI - Deployment Guide

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Backend Deployment (Railway)](#backend-deployment-railway)
3. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- Git

### Backend Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create .env file
cat > .env << 'EOF'
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
EOF

# 6. Start development server
uvicorn main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

### Frontend Setup

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Create .env.local
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:8000
EOF

# 4. Start development server
npm run dev
```

**Expected Output:**
```
  VITE v8.0.12  ready in 523 ms

  ➜  Local:   http://localhost:5173/
```

### Data Preparation

```bash
# 1. Navigate to embed directory
cd embed

# 2. Prepare data
# Ensure blogs are in data/blogs/
# Ensure products Excel is in data/knowledge.xlsx

# 3. Build BM25 indices
python build_bm25.py

# 4. Ingest into ChromaDB
python ingest.py

# 5. Verify storage
ls -lh chroma_persistent_storage/
```

---

## Backend Deployment (Railway)

### Step 1: Prepare Repository

```bash
# Ensure Procfile exists in root
cat > Procfile << 'EOF'
web: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4
EOF

# Ensure requirements.txt is in root or backend/
cd backend
pip freeze > ../requirements.txt
```

### Step 2: Create Railway Project

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init

# Link to GitHub repo (optional but recommended)
railway link
```

### Step 3: Set Environment Variables

```bash
# Via CLI
railway variables set GROQ_API_KEY=your_key
railway variables set TAVILY_API_KEY=your_key

# Via Railway Dashboard:
# 1. Go to Settings → Variables
# 2. Add each key-value pair
# 3. Click "Deploy" to redeploy
```

### Step 4: Deploy

```bash
# Push to deploy
git push railway main

# Or trigger via dashboard
# Railway auto-deploys on push to main
```

### Step 5: Verify Deployment

```bash
# Get logs
railway logs

# Health check
curl https://your-railway-app.up.railway.app/health

# Expected: {"status": "healthy"}
```

**Railway Configuration:**
- **Instance Type:** Shared CPU
- **Memory:** 2GB (Auto-upgrade on usage)
- **Build Command:** Automatic
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4`
- **Port:** 8000 → 443 (HTTPS)

---

## Frontend Deployment (Vercel)

### Step 1: Build Frontend

```bash
cd frontend

# Build for production
npm run build

# Expected output:
# dist/
# ├── index.html
# ├── assets/
# │   ├── main.HASH.js
# │   └── main.HASH.css
```

### Step 2: Connect to Vercel

**Option A: Via Vercel CLI**
```bash
npm i -g vercel
vercel deploy --prod
```

**Option B: Via Vercel Dashboard**
1. Go to vercel.com
2. Click "New Project"
3. Import GitHub repository
4. Configure build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### Step 3: Configure Environment Variables

In Vercel Dashboard:
```
Settings → Environment Variables

Variable: VITE_API_URL
Value: https://your-railway-app.up.railway.app
Environments: Production, Preview, Development
```

### Step 4: Deploy

```bash
# Automatic on push to main branch
git push origin main

# Or manual deployment
vercel deploy --prod
```

### Step 5: Verify Deployment

```
Frontend: https://clinikally.vercel.app
- Check Network tab for API calls to backend
- Verify CORS headers are correct
```

---

## Environment Configuration

### Backend (.env)

```env
# LLM Provider
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Get from: https://console.groq.com/keys

# Web Search
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Get from: https://tavily.com/

# Optional: Database URL (for production PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/clinikally

# Optional: Logging level
LOG_LEVEL=INFO

# Optional: Cache TTL (seconds)
CACHE_TTL=3600
```

### Frontend (.env.local)

```env
# API Endpoint
VITE_API_URL=http://localhost:8000

# Optional: Analytics key
VITE_ANALYTICS_KEY=your_analytics_key
```

---

## Database Setup

### Local SQLite (Development)

```bash
# Automatic creation on first request
# Located at: backend/data/sessions.db

# Manual initialization
python << 'EOF'
import sqlite3
conn = sqlite3.connect('backend/data/sessions.db')
conn.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        messages TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")
conn.commit()
print("Database initialized")
EOF
```

### Production PostgreSQL (Optional)

```bash
# 1. Create database
createdb clinikally

# 2. Connect with SQLAlchemy
# Update requirements.txt:
# psycopg2-binary==2.9.9
# SQLAlchemy==2.0.23

# 3. Update backend/memory.py
# Change DB_PATH to DATABASE_URL

# 4. Run migrations
alembic upgrade head
```

### ChromaDB Setup

```bash
# Automatic persistent storage
# Located at: embed/chroma_persistent_storage/

# Manual verification
python << 'EOF'
import chromadb
client = chromadb.PersistentClient(
    path='./embed/chroma_persistent_storage'
)
collection = client.get_collection('knowledge_base')
print(f"Docs in collection: {collection.count()}")
EOF
```

---

## Monitoring & Logs

### Railway Logs

```bash
# View real-time logs
railway logs -f

# View specific service logs
railway logs [service_name]

# Download logs
railway logs > logs.txt
```

### Vercel Analytics

Dashboard: vercel.com/dashboard/analytics

Metrics:
- Response times by route
- Error rates
- Web Vitals (LCP, FID, CLS)

### Application Logging

```python
# backend/main.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.post("/chat")
def chat(req: ChatRequest):
    logger.info(f"Chat request: {req.message[:50]}...")
    # ...
```

---

## Troubleshooting

### Backend Issues

**Problem: ImportError: No module named 'groq'**
```bash
# Solution: Install requirements
pip install -r requirements.txt
```

**Problem: CORS error in browser**
```
Error: Access to XMLHttpRequest blocked by CORS policy

Solution: Update CORS in main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://clinikally.vercel.app"],
    # ... other settings
)
```

**Problem: ChromaDB initialization fails**
```bash
# Solution: Reinitialize ChromaDB
rm -rf embed/chroma_persistent_storage/
cd embed
python ingest.py
```

### Frontend Issues

**Problem: 404 on API calls**
```
Error: POST http://localhost:8000/chat 404

Solution: 
1. Check backend is running
2. Verify VITE_API_URL is correct
3. Rebuild frontend: npm run build
```

**Problem: HTTPS mixed content error in production**
```
Error: Mixed Content: The page was loaded over HTTPS, 
       but requested an insecure XMLHttpRequest

Solution: Use HTTPS for API_URL
VITE_API_URL=https://your-railway-app.up.railway.app
```

### Deployment Issues

**Problem: Railway build fails**
```
Error: No procfile or package.json found

Solution:
1. Ensure Procfile in repository root
2. Ensure requirements.txt is present
3. Check file permissions: chmod +x Procfile
```

**Problem: Vercel build fails**
```
Error: npm ERR! code ERESOLVE

Solution:
1. Clear node_modules: rm -rf node_modules package-lock.json
2. Reinstall: npm install
3. Try: npm install --legacy-peer-deps
```

---

## Production Checklist

- [ ] API keys configured securely
- [ ] CORS configured for production domain
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Error monitoring configured
- [ ] Database backups scheduled
- [ ] CDN caching configured
- [ ] Rate limiting enabled
- [ ] Input validation enabled
- [ ] Security headers set

---

## Rollback Procedure

**In case of critical issue:**

```bash
# Railway: View deployment history
railway deployments

# Rollback to previous version
railway deployments rollback [deployment_id]

# Vercel: Similar rollback via Dashboard
# Vercel → Deployments → [Previous] → Promote to Production
```

---

## Performance Tuning

### Backend

```python
# Increase worker count
uvicorn main:app --workers 8  # On multi-core instances

# Enable response compression
from fastapi.middleware.gzip import GZIPMiddleware
app.add_middleware(GZIPMiddleware, minimum_size=1000)
```

### Frontend

```typescript
// Enable service worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

// Lazy load components
import { lazy, Suspense } from 'react';
const ChatWidget = lazy(() => import('./ChatWidget'));
```

---

## Scaling Strategy

**Current Architecture:** Single instance
**Recommended:** 2-3 instances with load balancer at 50+ concurrent users

```yaml
# docker-compose.yml for local multi-instance testing
version: '3'
services:
  api1:
    build: ./backend
    ports: [8001:8000]
    environment: [GROQ_API_KEY=..., TAVILY_API_KEY=...]
  
  api2:
    build: ./backend
    ports: [8002:8000]
    environment: [GROQ_API_KEY=..., TAVILY_API_KEY=...]
  
  nginx:
    image: nginx
    ports: [8000:80]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

