import sqlite3
import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sessions.db")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def _get_conn():
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

def _summarize_messages(messages: list, old_summary: str = "") -> str:
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
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "Summarize this skincare conversation in 2-3 sentences. Focus on: skin type, allergies, concerns mentioned, and products discussed. Be very concise."
                },
                {
                    "role": "user",
                    "content": f"{prefix}Conversation:\n{conversation}"
                }
            ],
            max_tokens=100,
            temperature=0,
        )
        summary = response.choices[0].message.content.strip()
        print(f"[SUMMARY] {summary}")
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
    """Load messages and summary without injecting summary as system message."""
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

    messages.append({"role": "user", "content": user_message})
    messages.append({"role": "assistant", "content": assistant_reply})

    new_summary = old_summary

    # Keep last 5 turns (10 messages)
    # When exceeded, summarize the overflow and roll it into the summary
    if len(messages) > 10:
        to_summarize = messages[:-10]   # everything older than last 5 turns
        messages = messages[-10:]        # keep only last 5 turns
        new_summary = _summarize_messages(to_summarize, old_summary)

    save_history(session_id, messages, new_summary)

def clear_session(session_id: str):
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()    