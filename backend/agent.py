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
You will be given search results from our product catalog, blog articles, or the web.
Write a helpful, accurate response based ONLY on the provided results.

Response rules:
- Keep responses SHORT — 2-3 sentences maximum
- Never mention blog titles, article names, source URLs
- Never use markdown formatting like **bold** or bullet points with dashes
- Just answer naturally like a knowledgeable dermatologist
- When recommending products:
  Write 1 sentence about what suits the user and why
  Then write EXACTLY: "Here are my top picks for you:"
  Do NOT describe or name any products in your text — the cards will show them
- For non-product queries: answer fully in text
- No long paragraphs — be direct and conversational
"""

ROUTER_PROMPT = """You are a query router for a skincare assistant. 
Classify the user query into one or more of these sources:
- "product": user wants product recommendations, wants to buy something, asks about specific products, mentions price/budget
- "blog": user asks about ingredients, routines, how something works, skin concerns explained, skincare education
- "web": user asks about medical conditions, treatments, causes of skin issues, dermatology advice

Rules:
- Return ONLY a JSON array with one or more of: "product", "blog", "web"
- Most queries need only ONE source
- Only return multiple if the query clearly needs both (e.g. "best niacinamide products for acne" needs product + blog)
- Examples:
  "moisturiser for oily skin under 500" → ["product"]
  "what does retinol do" → ["blog"]  
  "how to treat hormonal acne" → ["web"]
  "best vitamin c products and how vitamin c works" → ["product", "blog"]
  "my skin feels tight" → ["blog"]
  "sunscreen recommendation" → ["product"]

Return ONLY the JSON array, nothing else.
"""

def route_query_llm(message: str, last_reply: str = "") -> list:
    context = message
    if last_reply:
        context = f"Previous answer was about: {last_reply[:100]}\nFollow-up question: {message}"

    try:
        response = client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[
                {"role": "system", "content": ROUTER_PROMPT},
                {"role": "user", "content": context}
            ],
            max_tokens=20,
            temperature=0,
        )
        raw = response.choices[0].message.content.strip()
        print(f"[ROUTER LLM] raw={raw}")

        sources = json.loads(raw)
        valid = {"product", "blog", "web"}
        sources = [s for s in sources if s in valid]
        if not sources:
            return ["blog"]
        return sources
    except Exception as e:
        print(f"[ROUTER ERROR] {e} — falling back to keyword routing")
        return route_query_fallback(message)


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

    # If there's already a conversation happening, don't ask again
    user_turns = [m for m in history if m.get("role") == "user"]
    if len(user_turns) > 0:
        return {"clarify": False}

    # If message already has enough context, skip
    if len(message.split()) >= 5:
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

    # ── Step 1: Route ──
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

    sources = route_query_llm(user_message, last_reply)
    max_price = extract_price(user_message)

# Enrich follow-up — combine with last user message for context
    is_followup = len(user_message.split()) <= 8
    contextual_query = user_message
    if last_user_msg and is_followup:
        contextual_query = f"{last_user_msg} {user_message}"
        print(f"[CONTEXT] enriched: {contextual_query!r}")

    # If previous message was a clarification question (bot asked something),
    # combine with the original user intent from history
    if last_reply and "?" in last_reply:
        # Find the original product intent from history
        original_intent = ""
        for msg in history:
            if msg.get("role") == "user":
                original_intent = msg["content"]
                break
        if original_intent:
            contextual_query = f"{original_intent} {user_message}"
            print(f"[CONTEXT] clarification answered: {contextual_query!r}")

    print(f"[ROUTER] sources={sources}, max_price={max_price}")

    # ── Step 1.5: Check if query needs clarification ──
    if "product" in sources:
        clarify = check_clarification(user_message, history)
        if clarify.get("clarify"):
            question = clarify.get("question", "Could you tell me your skin type and main concern?")
            print(f"[CLARIFY] asking: {question}")
            return {
                "reply": question,
                "tools_used": [],
                "source": "unknown",
                "products": [],
            }
            

    # ── Step 2: Gather results ──
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

    # Set source label
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