import sqlite3
import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

# --- PRODUCTION PERSISTENCE CONFIGURATION ---
# Check if a cloud persistent volume path exists; fallback to local file system if not
PERSISTENT_VOLUME_PATH = os.getenv("CHROMA_SERVER_PATH") 

if PERSISTENT_VOLUME_PATH:
    # Production: Store sessions.db inside the mounted network volume
    DB_PATH = os.path.join(PERSISTENT_VOLUME_PATH, "sessions.db")
else:
    # Local Development: Keeps your exact original setup intact
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sessions.db")

# Ensure the parent directory directory path exists before creating the sqlite connection
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
# --------------------------------------------

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
SUMMARY_MODEL = "llama-3.1-8b-instant"

def _get_conn():
    # Connects safely to either local path or cloud volume path
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            messages TEXT NOT NULL DEFAULT '[]',
            summary TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn

def _summarize(messages: list, old_summary: str = "") -> str:
    if not messages:
        return old_summary
    try:
        conversation = "\n".join([
            f"{m['role'].upper()}: {m['content'][:150]}"
            for m in messages
            if m.get("role") in ("user", "assistant")
        ])
        prefix = f"Previous context: {old_summary}\n\n" if old_summary else ""
        response = groq_client.chat.completions.create(
            model=SUMMARY_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "Summarize this skincare conversation in 2-3 sentences. Focus on: skin type, allergies, concerns mentioned, budget, and products discussed. Be very concise."
                },
                {
                    "role": "user",
                    "content": f"{prefix}Conversation:\n{conversation}"
                }
            ],
            max_tokens=120,
            temperature=0,
        )
        summary = response.choices[0].message.content.strip()
        return summary
    except Exception as e:
        print(f"[SUMMARY ERROR] {e}")
        return old_summary

def load_history(session_id: str) -> list:
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT messages, summary FROM sessions WHERE session_id = ?",
            (session_id,)
        ).fetchone()
        if row:
            messages = json.loads(row[0])
            summary = row[1] or ""
            if summary:
                return [{"role": "system", "content": f"Earlier in this conversation: {summary}"}] + messages
            return messages
        return []
    finally:
        conn.close()

def _load_raw(session_id: str):
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT messages, summary FROM sessions WHERE session_id = ?",
            (session_id,)
        ).fetchone()
        if row:
            return json.loads(row[0]), row[1] or ""
        return [], ""
    finally:
        conn.close()

def save_history(session_id: str, messages: list, summary: str = ""):
    conn = _get_conn()
    try:
        conn.execute("""
            INSERT INTO sessions (session_id, messages, summary, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                messages = excluded.messages,
                summary = excluded.summary,
                updated_at = CURRENT_TIMESTAMP
        """, (session_id, json.dumps(messages), summary))
        conn.commit()
    finally:
        conn.close()

def append_turn(session_id: str, user_message: str, assistant_reply: str):
    messages, old_summary = _load_raw(session_id)

    # Add new turn
    messages.append({"role": "user", "content": user_message})
    messages.append({"role": "assistant", "content": assistant_reply})

    total_turns = len(messages) // 2

    print(f"\n{'='*50}")
    print(f"[MEMORY] session: {session_id[:8]}...")
    print(f"[MEMORY] total turns so far: {total_turns}")
    print(f"[MEMORY] current summary: {old_summary[:100] + '...' if len(old_summary) > 100 else old_summary or 'none'}")

    if total_turns == 1:
        print(f"[MEMORY] turn 1 — storing, no summary yet")
        save_history(session_id, messages, "")

    elif total_turns <= 5:
        print(f"[MEMORY] turns 2-5 — summarizing all {total_turns} turns")
        new_summary = _summarize(messages)
        print(f"[MEMORY] new summary: {new_summary}")
        save_history(session_id, messages, new_summary)

    else:
        dropped = messages[:-10]
        keep = messages[-10:]
        dropped_turns = len(dropped) // 2
        print(f"[MEMORY] turn {total_turns} — dropping {dropped_turns} old turn(s), keeping last 5")
        print(f"[MEMORY] dropped content: {dropped[0]['content'][:80]}...")
        new_summary = _summarize(dropped, old_summary)
        print(f"[MEMORY] updated summary: {new_summary}")
        save_history(session_id, keep, new_summary)

    print(f"[MEMORY] stored turns: {min(total_turns, 5)}/5")
    print(f"{'='*50}\n")

def clear_session(session_id: str):
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()