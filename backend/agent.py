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
You will be given search results from our product catalog, blog articles, or the web.
Write a helpful, accurate, conversational response based ONLY on the provided results.
Always mention product prices in INR (₹) when recommending products.
Be concise and friendly.
"""

# ── Keyword-based router ──
PRODUCT_KEYWORDS = [
    "recommend", "suggestion", "buy", "product", "serum", "moisturiser",
    "moisturizer", "sunscreen", "toner", "cleanser", "cream", "gel", "lotion",
    "under ₹", "under rs", "budget", "price", "cheap", "affordable", "best product",
    "which product", "what product", "brand", "spf", "retinol", "vitamin c serum"
]

BLOG_KEYWORDS = [
    "what is", "what does", "how does", "explain", "benefits of", "why does",
    "how to use", "routine", "ingredient", "niacinamide", "retinol", "hyaluronic",
    "aha", "bha", "salicylic", "glycolic", "peptide", "ceramide", "spf works",
    "skin type", "oily skin tips", "dry skin tips", "what happens", "difference between"
]

WEB_KEYWORDS = [
    "treat", "treatment", "cure", "hormonal", "medical", "doctor", "dermatologist",
    "cause", "causes", "dark circles", "acne scars", "hyperpigmentation causes",
    "diet", "food", "sleep", "stress", "hormone", "condition", "disease", "symptom"
]

def route_query(message: str) -> list:
    msg = message.lower()
    sources = []

    # Check for price patterns
    import re
    has_price = bool(re.search(r'₹\s*\d+|rs\.?\s*\d+|under\s+\d+|below\s+\d+|\d+\s*rupee', msg))

    product_score = sum(1 for kw in PRODUCT_KEYWORDS if kw in msg) + (3 if has_price else 0)
    blog_score = sum(1 for kw in BLOG_KEYWORDS if kw in msg)
    web_score = sum(1 for kw in WEB_KEYWORDS if kw in msg)

    # Always include at least one source
    max_score = max(product_score, blog_score, web_score)

    if max_score == 0:
        # Default: try blogs first, then web
        return ["blog", "web"]

    threshold = max(1, max_score * 0.6)

    if product_score >= threshold:
        sources.append("product")
    if blog_score >= threshold:
        sources.append("blog")
    if web_score >= threshold:
        sources.append("web")

    # If query has both product + ingredient signals, include both
    if product_score > 0 and blog_score > 0 and "product" not in sources:
        sources.append("product")
    if product_score > 0 and blog_score > 0 and "blog" not in sources:
        sources.append("blog")

    return sources if sources else ["web"]


def extract_price(message: str):
    import re
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


def run_agent(user_message: str, history: list = None) -> dict:
    if history is None:
        history = []

    # ── Step 1: Route the query ──
    # Include last assistant reply in routing context for follow-up questions
    last_reply = ""
    if history:
        for msg in reversed(history):
            if msg["role"] == "assistant":
                last_reply = msg["content"]
                break
    routing_context = user_message + " " + last_reply[:200]
    sources = route_query(routing_context)

    max_price = extract_price(user_message)
    print(f"[ROUTER] sources={sources}, max_price={max_price}")

    # ── Step 2: Gather results from relevant sources ──
    all_results = {}
    tools_used = []
    source_label = "unknown"

    if "product" in sources:
        print(f"[TOOL CALL] search_products(query={user_message!r}, max_price={max_price})")
        result = search_products(user_message, max_price=max_price)
        all_results["products"] = result
        tools_used.append("search_products")

    if "blog" in sources:
        print(f"[TOOL CALL] search_blogs(query={user_message!r})")
        result = search_blogs(user_message)
        all_results["blogs"] = result
        tools_used.append("search_blogs")

    if "web" in sources:
        print(f"[TOOL CALL] web_search(query={user_message!r})")
        result = web_search(user_message)
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

    # ── Step 3: Build context for Groq ──
    context_parts = []

    if "products" in all_results:
        products = all_results["products"].get("results", [])
        if products:
            context_parts.append("PRODUCTS FROM CLINIKALLY CATALOG:")
            for p in products[:5]:
                name = p.get("name", "Unknown")
                price = p.get("price", "N/A")
                url = p.get("url", "")
                ingredients = p.get("ingredients", "")
                benefits = p.get("benefits", "")
                desc = p.get("description", "")
                context_parts.append(
                    f"- {name} | ₹{price} | {desc[:100] if desc else ''} | "
                    f"Ingredients: {ingredients[:100] if ingredients else ''} | "
                    f"Benefits: {benefits[:100] if benefits else ''} | URL: {url}"
                )

    if "blogs" in all_results:
        blogs = all_results["blogs"].get("results", [])
        if blogs:
            context_parts.append("\nBLOG ARTICLES:")
            for b in blogs[:3]:
                title = b.get("title", "Article")
                excerpt = b.get("excerpt", "")[:300]
                link = b.get("link", "")
                context_parts.append(f"- {title}: {excerpt} (source: {link})")

    if "web" in all_results:
        web_results = all_results["web"].get("results", [])
        if web_results:
            context_parts.append("\nWEB SEARCH RESULTS:")
            for w in web_results[:3]:
                title = w.get("title", "")
                content = w.get("content", "")[:300]
                context_parts.append(f"- {title}: {content}")

    context = "\n".join(context_parts) if context_parts else "No relevant results found."

    # ── Step 4: Generate final answer with Groq ──
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    messages.extend(history)
    messages.append({
        "role": "user",
        "content": f"User question: {user_message}\n\nSearch results:\n{context}"
    })

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=1024,
            temperature=0.7,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        print(f"[GROQ ERROR] {e}")
        # Retry once
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                max_tokens=512,
                temperature=0.7,
            )
            reply = response.choices[0].message.content
        except Exception as e2:
            print(f"[GROQ ERROR RETRY] {e2}")
            # Build a clean fallback from structured data
            if "products" in all_results and all_results["products"].get("results"):
                products = all_results["products"]["results"]
                lines = ["Here are some products I found for you:\n"]
                for p in products[:3]:
                    name = p.get("name", "")
                    price = p.get("price", "")
                    url = p.get("url", "")
                    if name:
                        lines.append(f"• **{name}** — ₹{price}" + (f" ([View]({url}))" if url else ""))
                reply = "\n".join(lines)
            else:
                reply = "I found some relevant results but couldn't generate a response right now. Please try again."

 # Only show product cards for products Groq actually mentioned in reply
    structured_products = []
    if "products" in all_results:
        all_products = all_results["products"].get("results", [])
        reply_lower = reply.lower()
        for p in all_products:
            name = p.get("name", "")
            if not name:
                continue
            # Check if any significant word from product name appears in reply
            name_words = [w for w in name.lower().split() if len(w) > 3]
            if any(w in reply_lower for w in name_words):
                structured_products.append(p)

    return {
        "reply": reply,
        "tools_used": tools_used,
        "source": source_label,
        "products": structured_products,
    }