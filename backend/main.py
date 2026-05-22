import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import asyncio

from agent import run_agent, run_agent_stream  # Added run_agent_stream import
from memory import load_history, append_turn, clear_session

app = FastAPI(title="Skincare AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
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

# ── REFACTORED: TRUE ASYNCHRONOUS ZERO-WAIT STREAMING ENDPOINT ──
@app.get("/chat/stream")
async def chat_stream(message: str, session_id: str):
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    async def generate():
        try:
            history = load_history(session_id)

            # Consumes token bits natively over the generator line without slicing delays
            async for chunk in run_agent_stream(message, history=history):
                if chunk["type"] == "token":
                    # Immediately pass raw token chunks forward into the frontend stream canvas
                    data = json.dumps({'token': chunk['content']})
                    yield f"data: {data}\n\n"
                    # Ensure tokens are flushed immediately
                    await asyncio.sleep(0)
                elif chunk["type"] == "metadata":
                    # Save transaction securely to memory history at the absolute end of generation
                    append_turn(session_id, message, chunk["reply"])
                    
                    # Push execution state vectors for layout structures
                    data = json.dumps({'done': True, 'source': chunk['source'], 'tools_used': chunk['tools_used'], 'products': chunk['products']})
                    yield f"data: {data}\n\n"
        
        except Exception as server_error:
            # Captures global pipeline failures (e.g., database locks, total network dropouts)
            print(f"[CRITICAL ENDPOINT FAILURE] Stream severed: {server_error}")
            
            # Emit a structured error event payload down the active socket connection channel
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
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )

@app.post("/chat/clear")
def clear(req: ClearRequest):
    clear_session(req.session_id)
    return {"status": "cleared", "session_id": req.session_id}