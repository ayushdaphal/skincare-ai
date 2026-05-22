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

Import the repository into your local environment. <br>
git clone https://github.com/ayushdaphal/skincare-ai.git <br><br>

Install the requirements.<br>
pip install -r requirements.txt<br><br>

Setup env <br>
GROQ_API_KEY=gsk_your_groq_production_key_here<br>
TAVILY_API_KEY=tvly-your_tavily_search_key_here<br><br>

Initlize the data embedding model. (required data folder : contact contributer)<br>
cd embed<br>
python -m venv venv<br>
python ingest.py<br><br>

Run the fastapi server.<br>
cd backend<br>
python -m venv venv<br>
source venv/bin/activate (on windows : venv\Scripts\activate)<br>
uvicorn main:app --reload --port 8000<br><br>

Run the frontend server.<br>
cd frontend <br>
npm install<br>
npm run dev<br><br>


Detailed product document :