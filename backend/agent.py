import sys
import os
import json
from groq import Groq
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from tools.search import search_products, search_blogs, web_search

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are a helpful skincare assistant for Clinikally, an Indian skincare platform.

You have access to three tools:
1. search_products — search the product catalog (use for product recommendations, price queries, ingredient-based product search)
2. search_blogs — search skincare blog articles (use for ingredient explanations, skincare routines, how-to questions)
3. web_search — search the web (use for general skincare questions, medical/dermatology topics not covered in blogs)

Rules:
- Always use a tool before answering. Never answer from memory alone.
- For product queries: use search_products. If the user mentions a price limit, pass it as max_price.
- For ingredient/routine/blog queries: use search_blogs.
- For general skincare/dermatology questions: use web_search.
- For queries that need both products AND blog info (e.g. "best niacinamide products for acne"): use BOTH search_products and search_blogs.
- Prices are in Indian Rupees (₹). Always mention price when recommending products.
- Keep responses concise, helpful, and grounded in the retrieved data.
- If no results found, say so honestly and provide general guidance.
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Search the Clinikally product catalog for skincare products. Use this for product recommendations, finding products by skin type, concern, ingredient, or price.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query e.g. 'moisturiser for oily skin' or 'vitamin C serum'"
                    },
                    "max_price": {
                        "type": "number",
                        "description": "Maximum price in INR. Only include if user specifies a budget."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_blogs",
            "description": "Search skincare blog articles. Use this for questions about ingredients, skincare routines, skin concerns, how products work, or general skincare advice.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query e.g. 'niacinamide benefits' or 'summer skincare routine'"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for general skincare and dermatology information not covered in the product catalog or blogs. Use for medical questions, conditions, treatments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query e.g. 'how to treat hormonal acne' or 'what causes dark circles'"
                    }
                },
                "required": ["query"]
            }
        }
    }
]

TOOL_MAP = {
    "search_products": search_products,
    "search_blogs": search_blogs,
    "web_search": web_search,
}

def run_agent(user_message: str, history: list = None) -> dict:
    if history is None:
        history = []

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    tools_used = []
    source = "unknown"

    # Agentic loop
    while True:
        # Retry up to 3 times on tool_use_failed
        response = None
        for attempt in range(3):
            try:
                response = client.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    max_tokens=1024,
                )
                break
            except Exception as e:
                if "tool_use_failed" in str(e) and attempt < 2:
                    print(f"[RETRY] Tool use failed, retrying ({attempt+1}/3)...")
                    continue
                raise

        if response is None:
            return {
                "reply": "Sorry, I encountered an error. Please try again.",
                "tools_used": [],
                "source": "error"
            }

        msg = response.choices[0].message

        # No tool call — final answer
        if not msg.tool_calls:
            return {
                "reply": msg.content,
                "tools_used": tools_used,
                "source": source,
            }

        # Execute tool calls
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in msg.tool_calls
            ]
        })

        for tc in msg.tool_calls:
            tool_name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except:
                args = {}

            print(f"[TOOL CALL] {tool_name}({args})")
            tools_used.append(tool_name)

            if tool_name in TOOL_MAP:
                result = TOOL_MAP[tool_name](**args)
                source = result.get("source", tool_name)
            else:
                result = {"error": f"Unknown tool: {tool_name}"}

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result)
            })

        # If multiple tools used, set source to "mixed"
        if len(set(tools_used)) > 1:
            source = "mixed"