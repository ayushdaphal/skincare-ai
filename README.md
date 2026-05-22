# Clinikally AI — Intelligent Agentic Skincare Assistant

An intelligent, full-stack agentic AI system designed to act as a virtual dermatologist assistant for Clinikally, an Indian skincare platform. The system routes user queries at runtime, extracts complex parameters (such as skin concerns and budgets in Indian Rupees), handles context-aware clarification to break conversational loops, and delivers token-by-token streaming text natively alongside structured product recommendation cards.

---

## Core System Highlights
* **LLM-Based Intent Routing:** Dynamic multi-label classification gateway maps intents at runtime across local catalogs, educational blogs, and external medical research grids.
* **Advanced Hybrid Search Retrieval:** Integrates semantic vector lookups (ChromaDB) with lexical keyword matching (BM25 Okapi) using Reciprocal Rank Fusion (RRF) and Cross-Encoder semantic reranking.
* **Context-Aware Dynamic Memory:** Utilizes sliding-window token management paired with background recursive LLM summarization to preserve persistent user skin profiles without context bloating.
* **True SSE Streaming Pipeline:** Uses Server-Sent Events (SSE) to stream raw token bits directly into the client canvas with zero proxy buffering delays.
* **Stateful Session Database Sync:** Built upon an asynchronous, thread-safe SQLite persistence layer featuring a dedicated front-end cache invalidation trigger.

---

## Core Technology Stack
* **Backend Framework:** FastAPI + Python (Uvicorn ASGI)
* **LLM Inference Provider:** Groq API (llama-3.1-8b-instant)
* **Dense Embedding Model:** SentenceTransformers (all-MiniLM-L6-v2)
* **Reranking Engine:** Cross-Encoder (ms-marco-MiniLM-L-6-v2)
* **Vector Database:** Local ChromaDB Persistence Instance
* **Sparse Lexical Search:** Tokenized BM25 Okapi Data Indices
* **Web Search Gateway:** Tavily API Integration
* **Frontend Web Stack:** React (v19) + TypeScript + Vite

---

## Repository Workspace Structure

```text
.
├── backend/
│   ├── main.py              # FastAPI server configuration, endpoint routers, and CORS setups
│   ├── agent.py             # Context-aware query rewriter, intent class routing, and system prompts
│   ├── memory.py            # Async thread-safe SQLite history tracking & recursive summarization
│   └── tools/
│       └── search.py        # Sub-10ms semantic query cache, hybrid RRF search & Cross-Encoder reranking
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Client web entry container
│   │   └── ChatWidget.tsx   # SSE stream chunk reader, micro-animations, and e-commerce grid cards
├── embed/
│   ├── ingest.py            # Heavy vector token ingestion pipeline into ChromaDB collections
│   └── build_bm25.py        # Sparse keyword dictionary builder and .pkl matrix serialization
└── README.md                # Technical system documentation map

## Links to document and video demo
Doc : https://drive.google.com/file/d/1CtqGtM41hlaqFFB-QGFz2EaObc6FlbJv/view?usp=drive_link
Video Demo :

Setup Guide
1. Repository Initialization
Clone the repository to your local workspace environment:

Bash
git clone [https://github.com/ayushdaphal/skincare-ai.git](https://github.com/ayushdaphal/skincare-ai.git)
cd skincare-ai

2. Environment Configuration
Create a .env file within your backend/ directory and include your API authentication keys:

Code snippet
GROQ_API_KEY=gsk_your_groq_production_key_here
TAVILY_API_KEY=tvly-your_tavily_search_key_here

3. Initialize & Embed Knowledge Data
Prepare the local knowledge vector base and tokenized sparse matrices (Ensure your raw catalog sheets and blog folders are mounted in your workspace):

Bash
cd embed
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
python build_bm25.py
python ingest.py
deactivate
cd ..

4. Boot the FastAPI Server
Launch your local backend engine with multi-worker hot reload tracking:

Bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
Verify the server instance status via browser execution at http://localhost:8000/health.

5. Launch the Frontend Canvas
Open a separate terminal window and compile the React development user interface:

Bash
cd frontend
npm install
npm run dev
Open your browser canvas and navigate to http://localhost:5173/ to interact with the assistant.