import sys
import os
import json
import asyncio
import subprocess
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Force root directory into path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

app = FastAPI(title="Skincare AI API")

# ── PRODUCTION CORS CONFIGURATION ──
FRONTEND_URL = os.getenv("FRONTEND_PRODUCTION_URL", "http://localhost:5173")
origins = ["http://localhost:5173", "http://localhost:3000", FRONTEND_URL]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    
    # Lazy import inside the function so it doesn't crash if files are missing on boot
    from agent import run_agent
    from memory import load_history, append_turn

    try:
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database or index not initialized yet. Please seed the volume. Error: {str(e)}")

@app.get("/chat/stream")
async def chat_stream(message: str, session_id: str):
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Lazy import to keep boot safe
    from agent import run_agent_stream
    from memory import load_history, append_turn

    async def generate():
        try:
            history = load_history(session_id)
            async for chunk in run_agent_stream(message, history=history):
                if chunk["type"] == "token":
                    data = json.dumps({'token': chunk['content']})
                    yield f"data: {data}\n\n"
                    await asyncio.sleep(0)
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
            yield f"data: {json.dumps({'error': True, 'message': 'Engine loading or missing database files.'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/chat/clear")
def clear(req: ClearRequest):
    from memory import clear_session
    clear_session(req.session_id)
    return {"status": "cleared", "session_id": req.session_id}

# ── PRODUCTION DATABASE SEEDING ENDPOINT ──
@app.post("/api/admin/seed-database-volume")
def seed_database_volume(background_tasks: BackgroundTasks):
    def run_seeding_sequence():
        try:
            print("--- Starting Production Data Volume Seeding ---")
            subprocess.run(["python", "embed/ingest.py"], check=True)
            subprocess.run(["python", "backend/build_bm25.py"], check=True)
            print("--- Production Data Volume Seeding Completed ---")
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Database seeding sequence failed: {e}")

    background_tasks.add_task(run_seeding_sequence)
    return {"status": "seeding sequence initialized in the background"}

@app.get("/api/admin/debug-paths")
def debug_paths():
    import os
    base_path = "/app"
    
    def scan_dir(path):
        if not os.path.exists(path):
            return f"{path} does not exist"
        try:
            return os.listdir(path)
        except Exception as e:
            return str(e)

    return {
        "current_working_dir": os.getcwd(),
        "app_contents": scan_dir(base_path),
        "embed_contents": scan_dir(f"{base_path}/embed"),
        "data_contents": scan_dir(f"{base_path}/embed/data")
    }