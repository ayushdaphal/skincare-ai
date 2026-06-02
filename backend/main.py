import sys
import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Force root directory into path so imports like 'agent' and 'memory' resolve smoothly in Docker
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
# Look for .env file at the root directory level
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from agent import run_agent, run_agent_stream  
from memory import load_history, append_turn, clear_session

app = FastAPI(title="Skincare AI API")

# ── PRODUCTION CORS CONFIGURATION ──
# Read your deployed frontend URL from environment variables; fallback to local Vite dev server
FRONTEND_URL = os.getenv("FRONTEND_PRODUCTION_URL", "http://localhost:5173")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    FRONTEND_URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # Critical for secure session handshakes
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str

class ClearRequest(BaseModel):
    session_id: str

@app.get("/")
def root():
    return {"status": "ok", "service": "skincare-ai"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/chat")
def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    history = load_history(req.session_id)
    result = run_agent(req.message, history=history)
    append_turn(req.session_id, req.message, result["reply"])

    return {
        "reply": result["reply"],
        "source": result["source"],
        "tools_used": result["tools_used"],
        "products": result.get("products", []),
        "session_id": req.session_id,
    }

# ── TRUE ASYNCHRONOUS ZERO-WAIT STREAMING ENDPOINT ──
@app.get("/chat/stream")
async def chat_stream(message: str, session_id: str):
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    async def generate():
        try:
            history = load_history(session_id)

            async for chunk in run_agent_stream(message, history=history):
                if chunk["type"] == "token":
                    data = json.dumps({'token': chunk['content']})
                    yield f"data: {data}\n\n"
                    await asyncio.sleep(0) # Yields control instantly to allow flushing
                elif chunk["type"] == "metadata":
                    append_turn(session_id, message, chunk["reply"])
                    
                    data = json.dumps({
                        'done': True, 
                        'source': chunk['source'], 
                        'tools_used': chunk['tools_used'], 
                        'products': chunk['products']
                    })
                    yield f"data: {data}\n\n"
        
        except Exception as server_error:
            print(f"[CRITICAL ENDPOINT FAILURE] Stream severed: {server_error}")
            error_packet = {
                "error": True,
                "type": "SERVER_PIPELINE_DEGRADED",
                "message": "We encountered minor engine friction, re-routing optimization paths..."
            }
            yield f"data: {json.dumps(error_packet)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no", # Critical for cloud proxies like Nginx/Cloudflare to not buffer your stream
            "Connection": "keep-alive",
        }
    )

@app.post("/chat/clear")
def clear(req: ClearRequest):
    clear_session(req.session_id)
    return {"status": "cleared", "session_id": req.session_id}