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

from agent import run_agent
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

    # Load conversation history
    history = load_history(req.session_id)

    # Run agent
    result = run_agent(req.message, history=history)

    # Save turn to memory
    append_turn(req.session_id, req.message, result["reply"])

    return {
        "reply": result["reply"],
        "source": result["source"],
        "tools_used": result["tools_used"],
        "session_id": req.session_id,
    }

@app.get("/chat/stream")
async def chat_stream(message: str, session_id: str):
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    async def generate():
        # Load history
        history = load_history(session_id)

        # Run agent in thread (it's sync)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, lambda: run_agent(message, history=history)
        )

        # Save turn
        append_turn(session_id, message, result["reply"])

        # Stream reply word by word
        words = result["reply"].split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'token': chunk})}\n\n"
            await asyncio.sleep(0.03)

        # Send metadata at end
        yield f"data: {json.dumps({'done': True, 'source': result['source'], 'tools_used': result['tools_used']})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )

@app.post("/chat/clear")
def clear(req: ClearRequest):
    clear_session(req.session_id)
    return {"status": "cleared", "session_id": req.session_id}