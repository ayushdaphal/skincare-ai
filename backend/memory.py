import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sessions.db")

def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            messages TEXT NOT NULL DEFAULT '[]',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn

def load_history(session_id: str) -> list:
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT messages FROM sessions WHERE session_id = ?",
            (session_id,)
        ).fetchone()
        if row:
            return json.loads(row[0])
        return []
    finally:
        conn.close()

def save_history(session_id: str, messages: list):
    conn = _get_conn()
    try:
        conn.execute("""
            INSERT INTO sessions (session_id, messages, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                messages = excluded.messages,
                updated_at = CURRENT_TIMESTAMP
        """, (session_id, json.dumps(messages)))
        conn.commit()
    finally:
        conn.close()

def append_turn(session_id: str, user_message: str, assistant_reply: str):
    history = load_history(session_id)
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": assistant_reply})
    # Keep last 10 turns (20 messages) to avoid token overflow
    if len(history) > 20:
        history = history[-20:]
    save_history(session_id, history)

def clear_session(session_id: str):
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()