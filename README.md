cat > README.md << 'EOF'
# Skincare AI Agent

An intelligent skincare assistant built with Grok, FastAPI, and React.


## Stack
- **Backend:** FastAPI + Python
- **LLM:** Grok
- **Vector DB:** ChromaDB + BM25 hybrid search
- **Web Search:** Tavily API
- **Frontend:** React + Vite

## Setup Guide

Import the repository into your local environment.
git clone https://github.com/ayushdaphal/skincare-ai.git

Install the requirements.
pip install -r requirements.txt

Setup env 
GROQ_API_KEY=gsk_your_groq_production_key_here
TAVILY_API_KEY=tvly-your_tavily_search_key_here

Initlize the data embedding model. (required data folder : contact contributer)
cd embed
python -m venv venv
python ingest.py

Run the fastapi server.
cd backend
python -m venv venv
source venv/bin/activate (on windows : venv\Scripts\activate)
uvicorn main:app --reload --port 8000

Run the frontend server.
cd frontend 
npm install
npm run dev


Detailed product document :