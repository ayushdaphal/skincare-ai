import sys
import os
import json
import re
from groq import Groq
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from tools.search import search_products, search_blogs, web_search

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.1-8b-instant"
ROUTER_MODEL = "llama-3.1-8b-instant"

SYSTEM_PROMPT = """You are a skincare assistant for Clinikally, an Indian skincare platform.
Write a helpful, accurate response based ONLY on the provided results.

Response rules:
- Keep responses SHORT — 2-3 sentences maximum
- Never mention blog titles, article names, or source URLs
- Never use markdown formatting like **bold** or bullet points with dashes
- Just answer naturally like a knowledgeable dermatologist

- When recommending products:
  ONLY IF there is a section titled 'PRODUCTS FROM CLINIKALLY CATALOG' present in the search results below, write 1 sentence about what suits the user and why, followed EXACTLY by the phrase: "Here are my top picks for you:".
  If that product section is missing or empty, DO NOT write that phrase and DO NOT recommend any items.
  Do NOT describe or name any products in your text response — the structured cards will handle the visual representation.
"""

ROUTER_PROMPT = """You are a query router and context interpreter for a skincare assistant.
Classify the user's intent into exactly one or more of these sources: "product", "blog", or "web".

Strict Definitions:
- "product": The user explicitly wants to buy something, wants options, asks for a recommendation list, or specifies a budget/product class (e.g., "show me a sunscreen", "recommend a cleanser").
- "blog": The user is asking an educational, explanatory, or informational question about an ingredient, a routine, or how something works (e.g., "what does niacinamide do", "how to use retinol"). DO NOT route to product unless they ask to buy or want options.
- "web": The user asks about severe medical conditions, diseases, deep chronic issues, or underlying physiological causes.

Return a JSON object exactly matching this schema:
{
  "sources": ["product" | "blog" | "web"],
  "standalone_query": "rewritten independent search string"
}
"""

def route_query_llm(message: str, last_user_msg: str = "", last_reply: str = "") -> dict:
    context = f"Current User Message: {message}"
    if last_user_msg:
        context = f"Previous User Message: {last_user_msg}\nPrevious Assistant Reply: {last_reply}\n\nCurrent User Message: {message}"

    try:
        response = client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[
                {"role": "system", "content": ROUTER_PROMPT},
                {"role": "user", "content": context}
            ],
            max_tokens=150,
            temperature=0,
            response_format={"type": "json_object"} # Forces Llama to reply in crisp JSON
        )
        raw = response.choices[0].message.content.strip()
        print(f"[ROUTER LLM] raw={raw}")
        return json.loads(raw)
    except Exception as e:
        print(f"[ROUTER ERROR] {e} — falling back")
        # Direct fallback signature if JSON parser hits an edge case
        return {"sources": ["product", "blog"], "standalone_query": message}

def route_query_fallback(message: str) -> list:
    msg = message.lower()

    product_kw = ["recommend", "buy", "product", "serum", "moisturiser", "moisturizer",
                  "sunscreen", "toner", "cleanser", "cream", "gel", "lotion", "under ₹",
                  "budget", "price", "affordable", "brand", "spf", "which product"]
    blog_kw = ["what is", "what does", "how does", "explain", "benefits", "routine",
               "ingredient", "niacinamide", "retinol", "hyaluronic", "aha", "bha",
               "salicylic", "peptide", "ceramide", "skin type", "difference between"]
    web_kw = ["treat", "treatment", "cure", "hormonal", "cause", "causes", "dark circles",
              "acne scars", "diet", "stress", "hormone", "condition", "disease", "symptom"]

    has_price = bool(re.search(r'₹\s*\d+|rs\.?\s*\d+|under\s+\d+|below\s+\d+|\d+\s*rupee', msg))

    p = sum(1 for kw in product_kw if kw in msg) + (3 if has_price else 0)
    b = sum(1 for kw in blog_kw if kw in msg)
    w = sum(1 for kw in web_kw if kw in msg)

    if p == 0 and b == 0 and w == 0:
        return ["blog", "web"]

    mx = max(p, b, w)
    threshold = max(1, mx * 0.6)
    sources = []
    if p >= threshold: sources.append("product")
    if b >= threshold: sources.append("blog")
    if w >= threshold: sources.append("web")
    return sources if sources else ["web"]


def extract_price(message: str):
    patterns = [
        r'under\s*₹?\s*(\d+)',
        r'below\s*₹?\s*(\d+)',
        r'₹\s*(\d+)',
        r'rs\.?\s*(\d+)',
        r'(\d+)\s*rupee',
        r'budget.*?(\d+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, message.lower())
        if match:
            return float(match.group(1))
    return None

CLARIFICATION_PROMPT = """You are a skincare assistant helper. 
Decide if a user query has enough information to recommend specific products.

A query is VAGUE if it's missing key details like:
- Skin type (oily, dry, combination, sensitive)
- Specific concern (acne, pigmentation, dryness, etc.)
- Product type preference (gel, cream, foam, etc.)

A query is SPECIFIC enough if it mentions at least skin type OR a specific concern.

Examples:
"i want a facewash" → VAGUE
"i want a moisturiser" → VAGUE  
"i want a serum" → VAGUE
"show me sunscreen" → VAGUE
"facewash for oily skin" → SPECIFIC
"moisturiser for dry skin with ceramides" → SPECIFIC
"something for acne" → SPECIFIC
"vitamin c serum under 500" → SPECIFIC
"i have oily skin and acne, show me a facewash" → SPECIFIC

If VAGUE, return a JSON object:
{"clarify": true, "question": "one short friendly question asking for the most important missing detail"}

If SPECIFIC, return:
{"clarify": false}

Return ONLY the JSON object, nothing else.
"""

def check_clarification(message: str, history: list) -> dict:
    """Returns {"clarify": True, "question": "..."} or {"clarify": False}"""
    
    # REMOVE: the old "if len(user_turns) > 0" block entirely.
    
    # Keep the length shortcut only for detailed messages
    if len(message.split()) >= 6:
        return {"clarify": False}

    try:
        response = client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[
                {"role": "system", "content": CLARIFICATION_PROMPT},
                {"role": "user", "content": message}
            ],
            max_tokens=80,
            temperature=0,
            response_format={"type": "json_object"}
        )
        raw = response.choices[0].message.content.strip()
        match = re.search(r'\{.*?\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as e:
        print(f"[CLARIFY ERROR] {e}")

    return {"clarify": False}

    try:
        response = client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[
                {"role": "system", "content": CLARIFICATION_PROMPT},
                {"role": "user", "content": message}
            ],
            max_tokens=80,
            temperature=0,
        )
        raw = response.choices[0].message.content.strip()
        print(f"[CLARIFY] raw={raw}")

        match = re.search(r'\{.*?\}', raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
            return result
    except Exception as e:
        print(f"[CLARIFY ERROR] {e}")

    return {"clarify": False}

def run_agent(user_message: str, history: list = None) -> dict:
    if history is None:
        history = []

    # ── Step 1: Gather History Context ──
    last_reply = ""
    last_user_msg = ""
    if history:
        for msg in reversed(history):
            if msg.get("role") == "assistant" and not last_reply:
                last_reply = msg["content"]
            if msg.get("role") == "user" and not last_user_msg:
                last_user_msg = msg["content"]
            if last_reply and last_user_msg:
                break

    # ── Step 2: Route Intent & Generate Standalone Query ──
    router_output = route_query_llm(user_message, last_user_msg, last_reply)
    sources = router_output.get("sources", ["blog"])
    contextual_query = router_output.get("standalone_query", user_message)
    max_price = extract_price(user_message)

    print(f"[ROUTER] sources={sources}, max_price={max_price}")
    print(f"[INTELLIGENT CONTEXT] Standalone Search Target: {contextual_query!r}")

    # ── Step 3: Check if Context Needs Clarification ──
    if "product" in sources:
        # CRITICAL FIX: Pass 'contextual_query' here instead of 'user_message'
        clarify = check_clarification(contextual_query, history)
        
        if clarify.get("clarify"):
            question = clarify.get("question", "Could you tell me your skin type and main concern?")
            print(f"[CLARIFY INTERCEPT] Asking: {question}")
            return {
                "reply": question,
                "tools_used": [],
                "source": "unknown",
                "products": [],
            }
            

    # ── Step 4: Gather Results via Tools ──
    all_results = {}
    tools_used = []
    source_label = "unknown"

    if "product" in sources:
        print(f"[TOOL CALL] search_products(query={contextual_query!r}, max_price={max_price})")
        result = search_products(contextual_query, max_price=max_price)
        all_results["products"] = result
        tools_used.append("search_products")

    if "blog" in sources:
        print(f"[TOOL CALL] search_blogs(query={contextual_query!r})")
        result = search_blogs(contextual_query)
        all_results["blogs"] = result
        tools_used.append("search_blogs")

    if "web" in sources:
        print(f"[TOOL CALL] web_search(query={contextual_query!r})")
        result = web_search(contextual_query)
        all_results["web"] = result
        tools_used.append("web_search")

    # Enforce correct source tracking labels
    if len(tools_used) > 1:
        source_label = "mixed"
    elif "search_products" in tools_used:
        source_label = "products"
    elif "search_blogs" in tools_used:
        source_label = "blogs"
    elif "web_search" in tools_used:
        source_label = "web"

    # ── Step 3: Build context ──
    context_parts = []

    if "products" in all_results:
        products = all_results["products"].get("results", [])
        if products:
            context_parts.append("PRODUCTS FROM CLINIKALLY CATALOG:")
            for p in products[:5]:
                name = p.get("name", "Unknown")
                price = p.get("price", "N/A")
                ingredients = p.get("ingredients", "")
                benefits = p.get("benefits", "")
                desc = p.get("description", "")
                context_parts.append(
                    f"- {name} | ₹{price} | {desc[:80] if desc else ''} | "
                    f"Ingredients: {ingredients[:80] if ingredients else ''} | "
                    f"Benefits: {benefits[:80] if benefits else ''}"
                )

    if "blogs" in all_results:
        blogs = all_results["blogs"].get("results", [])
        if blogs:
            context_parts.append("\nSKINCARE KNOWLEDGE:")
            for b in blogs[:2]:
                excerpt = b.get("excerpt", "")[:250]
                context_parts.append(f"- {excerpt}")

    if "web" in all_results:
        web_results = all_results["web"].get("results", [])
        if web_results:
            context_parts.append("\nWEB RESULTS:")
            for w in web_results[:2]:
                content = w.get("content", "")[:250]
                context_parts.append(f"- {content}")

    context = "\n".join(context_parts) if context_parts else "No relevant results found."

    # ── Step 4: Generate answer ──
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        if msg.get("role") == "system":
            # Convert summary injection to lightweight user/assistant pair
            messages.append({"role": "user", "content": f"[Context from earlier: {msg['content']}]"})
            messages.append({"role": "assistant", "content": "Understood, I'll keep that in mind."})
        else:
            messages.append(msg)
    messages.append({
        "role": "user",
        "content": f"User question: {user_message}\n\nSearch results:\n{context}"
    })

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=300,
            temperature=0.7,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        print(f"[GROQ ERROR] {e}")
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                max_tokens=200,
                temperature=0.7,
            )
            reply = response.choices[0].message.content
        except Exception as e2:
            print(f"[GROQ ERROR RETRY] {e2}")
            if "products" in all_results and all_results["products"].get("results"):
                products = all_results["products"]["results"]
                lines = ["Here are some products I found:\n"]
                for p in products[:3]:
                    name = p.get("name", "")
                    price = p.get("price", "")
                    if name:
                        lines.append(f"• {name} — ₹{price}")
                reply = "\n".join(lines)
            else:
                reply = "I found some results but couldn't generate a response right now. Please try again."

# ── Step 5: Show products from current search results only ──
    structured_products = []
    if "products" in all_results:
        all_products = all_results["products"].get("results", [])
        # Just return top 3 from current search — don't match against reply text
        # This ensures cards always reflect the current query, not previous ones
        structured_products = all_products[:3]
    return {
        "reply": reply,
        "tools_used": tools_used,
        "source": source_label,
        "products": structured_products,
    }