# Deployment Checklist - Skincare AI

## Pre-Deployment Verification ✓

### Local Environment
- [x] Python 3.13.3 available
- [x] Node.js v22.17.0 available
- [x] npm 10.9.2 available
- [x] Virtual environment active (venv)
- [x] All dependencies installed (backend: requirements.txt, frontend: package.json)
- [x] ChromaDB vectors present at `embed/chroma_persistent_storage/`
- [x] BM25 indices built: `backend/data/blog_bm25.pkl`, `backend/data/product_bm25.pkl`
- [x] API keys configured in `.env` (GROQ_API_KEY, TAVILY_API_KEY)
- [x] GitHub repository configured: https://github.com/ayushdaphal/skincare-ai

### Configuration Files
- [x] `Procfile` created for Railway deployment
- [x] `.env.example` properly formatted with all required keys
- [x] `frontend/.env.example` created with API URL template
- [x] `.gitignore` properly excludes: `.env`, `venv/`, `embed/chroma_persistent_storage/`, BM25 pickle files
- [x] `backend/main.py` CORS configured for deployment

---

## Deployment Steps

### Phase 1: Backend Deployment (Railway)

#### 1. Create Railway Project
- [ ] Go to https://railway.app
- [ ] Sign in with GitHub account
- [ ] Click "New Project" → Select "GitHub Repo"
- [ ] Search and select: `ayushdaphal/skincare-ai`
- [ ] Select deployment region (choose closest to users)
- [ ] Click "Deploy"

#### 2. Configure Backend Environment
In Railway Dashboard:
- [ ] Go to Project Settings → Variables
- [ ] Add variable: `GROQ_API_KEY` = (your Groq API key)
- [ ] Add variable: `TAVILY_API_KEY` = (your Tavily API key)
- [ ] Add variable: `PYTHONUNBUFFERED` = `1` (for live logs)

#### 3. Set Start Command (if needed)
In Railway → Settings → Networking:
- [ ] Verify Start Command is set to: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4`
- [ ] If not set, manually configure in Service Settings

#### 4. Deploy and Verify Backend
- [ ] Wait for build to complete (typically 2-5 minutes)
- [ ] Copy the Railway App URL (e.g., `https://skincare-ai-prod-xyz.up.railway.app`)
- [ ] Test health endpoint: `curl https://<railway-url>/health`
  - Expected response: `{"status":"ok"}`
- [ ] Monitor Railway logs for errors
- [ ] Verify no CORS errors in logs

---

### Phase 2: Frontend Deployment (Vercel)

#### 1. Create Vercel Project
- [ ] Go to https://vercel.com
- [ ] Sign in with GitHub account
- [ ] Click "New Project" → Import Git Repository
- [ ] Search and select: `ayushdaphal/skincare-ai`
- [ ] Select project root directory: `/`

#### 2. Configure Build Settings
In Vercel → Project Settings:
- [ ] Root Directory: `/` (or keep default)
- [ ] Build Command: `npm run build` (from `frontend/package.json`)
- [ ] Output Directory: `frontend/dist`
- [ ] Install Command: `npm install --prefix frontend`

#### 3. Set Environment Variables
In Vercel → Settings → Environment Variables:
- [ ] Add variable: `VITE_API_URL` = `https://<railway-url-from-phase-1>`
  - Example: `https://skincare-ai-prod-xyz.up.railway.app`

#### 4. Deploy and Verify Frontend
- [ ] Click "Deploy"
- [ ] Wait for build to complete (typically 1-2 minutes)
- [ ] Copy the Vercel URL (e.g., `https://skincare-ai.vercel.app`)
- [ ] Open Vercel URL in browser
- [ ] Check browser console for errors (should be none)
- [ ] Test chat widget:
  - [ ] Type test query (e.g., "best skincare routine")
  - [ ] Verify response streams back in real-time
  - [ ] Check latency is acceptable (<2 seconds typical)

---

### Phase 3: Post-Deployment Verification

#### Backend Health Checks
- [ ] Health endpoint returns 200: `curl https://<railway-url>/health`
- [ ] Railway logs show: "INFO: Application startup complete"
- [ ] No errors in Railway logs for API key initialization
- [ ] ChromaDB vector search working (check logs for successful loads)

#### Frontend Functionality Tests
- [ ] Frontend loads without errors
- [ ] Chat widget appears and is interactive
- [ ] API calls reach backend (check Network tab in DevTools)
- [ ] Streaming responses work (text appears gradually)
- [ ] Responses are contextually relevant (using ChromaDB knowledge base)

#### Performance Baselines
- [ ] First response: 1-3 seconds (includes LLM inference)
- [ ] Subsequent responses: <500ms (may be cached)
- [ ] No network timeouts or 5xx errors

#### Monitoring Setup
- [ ] Monitor Railway logs for errors
- [ ] Monitor Vercel build logs for failures
- [ ] Set up alerts for failed deployments (Railway/Vercel)

---

## Configuration Summary

### API Endpoints Deployed
- **Backend**: `https://<railway-url>/`
  - `GET /health` — health check
  - `POST /chat` — synchronous chat
  - `GET /chat/stream` — SSE streaming chat (recommended)

### Environment Variables Deployed
- **Railway Backend**:
  - `GROQ_API_KEY` ✓
  - `TAVILY_API_KEY` ✓
  - `PYTHONUNBUFFERED=1` ✓

- **Vercel Frontend**:
  - `VITE_API_URL=https://<railway-url>` ✓

### Data & Storage
- **ChromaDB**: Embedded in deployment from `embed/chroma_persistent_storage/`
- **BM25 Indices**: Included from `backend/data/`
- **Sessions DB**: Created at runtime in `backend/sessions.db`

---

## Troubleshooting

### Backend Won't Start (Railway)
1. Check Railway logs for Python errors
2. Verify API keys are set correctly in Railway dashboard
3. Check that Procfile syntax is correct
4. Verify `cd backend && uvicorn ...` command is used

### Frontend Shows "Cannot reach API"
1. Verify `VITE_API_URL` environment variable is set in Vercel
2. Check frontend Network tab for actual API requests
3. Verify Railway backend health: `curl https://<railway-url>/health`
4. Check CORS errors in browser console (backend should have CORS enabled)
5. Verify Railway URL doesn't have trailing slash

### Chat Widget Not Streaming
1. Verify SSE endpoint `/chat/stream` is being called
2. Check backend logs for streaming errors
3. Verify browser supports EventSource API
4. Check for connection timeouts in logs

### Slow Responses
1. This is expected for first query (1-3 seconds)
2. Verify Groq API is responsive: check Groq dashboard
3. Check Railway resource usage (CPU, memory)
4. Verify network latency to Railway server

---

## Rollback Plan

If deployment has critical issues:

1. **Frontend Rollback (Vercel)**
   - Go to Vercel dashboard → Deployments
   - Click "Rollback" on previous stable deployment

2. **Backend Rollback (Railway)**
   - Go to Railway dashboard → Deployments
   - Select previous stable deployment
   - Click "Revert"

---

## Post-Deployment Enhancements (Optional Future)

- [ ] Set up custom domain (instead of railway.app / vercel.app)
- [ ] Add error tracking (Sentry)
- [ ] Add analytics (Vercel Analytics, LogRocket)
- [ ] Set up automated backups for ChromaDB
- [ ] Add GitHub Actions for automated testing
- [ ] Migrate to PostgreSQL for production database

---

## Support Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **FastAPI Deployment**: https://fastapi.tiangolo.com/deployment/
- **React + Vite Deployment**: https://vitejs.dev/guide/ssr.html
- **Project Documentation**: See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

**Status**: ✅ Ready for production deployment

Last Updated: June 1, 2026
