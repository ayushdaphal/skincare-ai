import sys
import os
import json
import re
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from groq import Groq, AsyncGroq
from dotenv import load_dotenv

# Configure production logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

# Check system environment variables directly (this is what Railway injects)
api_key = os.getenv("GROQ_API_KEY")

if not api_key:
    print("[CRITICAL WARNING] GROQ_API_KEY is missing! Agent execution calls will fail.")
    client = None
else:
    client = Groq(api_key=api_key)

from tools.search import search_products, search_blogs, web_search

# ═══════════════════════════════════════════════════════════════════════════════
# TYPE DEFINITIONS & DATACLASSES
# ═══════════════════════════════════════════════════════════════════════════════

class ProductTypeEnum(Enum):
    HAIR = "hair"
    SKIN = "skin"
    COSMETICS = "cosmetics"
    MIXED = "mixed"

class RequestTypeEnum(Enum):
    SINGLE = "single"
    BUNDLE = "bundle"
    CLARIFICATION = "clarification"

@dataclass
class ProductContext:
    product_types: List[str]
    request_type: str
    products_requested: List[str] = field(default_factory=list)
    quantity: int = 3
    confidence: float = 0.95

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

HAIR_KEYWORDS = {
    'hair', 'haircare', 'shampoo', 'conditioner', 'scalp', 'dandruff', 'frizz',
    'hair fall', 'alopecia', 'hair loss', 'bald', 'oils', 'oil control',
    'hair type', 'curly', 'wavy', 'straight', 'coily', 'texture',
    'hair care', 'hair routine', 'hair treatment', 'hair mask',
    'split ends', 'dry hair', 'oily hair', 'dull', 'shine', 'bounce',
    'smoothing', 'strengthen', 'protect hair'
}

SKIN_KEYWORDS = {
    'skin', 'skincare', 'acne', 'pimple', 'moistur', 'sunscreen', 'cleanser',
    'serum', 'toner', 'cream', 'lotion', 'facewash', 'dermat', 'complexion',
    'wrinkle', 'pigment', 'dark spot', 'blemish', 'oily', 'dry', 'sensitive',
    'combination', 'eczema', 'psoriasis', 'rash', 'itchy', 'flaky',
    'skin type', 'skin concern', 'skin routine', 'skin care', 'skin health',
    'niacinamide', 'retinol', 'hyaluronic', 'peptide', 'ceramide', 'aha', 'bha',
    'anti-aging', 'brightening', 'makeup', 'lipstick', 'foundation', 'concealer'
}

HAIR_CLARIFICATION_QUESTIONS = {
    "hair_type": "What's your hair type? (oily, dry, combination, normal, curly, wavy, straight, coily)",
    "hair_concern": "What's your main hair concern? (dandruff, frizz, hair loss, dryness, oiliness, damage, breakage)"
}

SKIN_CLARIFICATION_QUESTIONS = {
    "skin_type": "What's your skin type? (oily, dry, combination, sensitive, normal)",
    "skin_concern": "What's your main skin concern? (acne, pigmentation, dryness, sensitivity, aging, oiliness)"
}

FILLER_PHRASES = {
    'ok', 'okay', 'yes', 'yep', 'yeah', 'sure', 'alright', 'fine',
    'got it', 'understood', 'cool', 'thanks', 'thank you', 'thankyou',
    'no', 'nope', 'nah', 'maybe', 'hmm', 'hm', 'umm', 'um',
    'idk', 'i dont know', 'i don\'t know', 'dunno', 'not sure',
    'right', 'exactly', 'indeed', 'agreed', 'ok cool', 'ok sure'
}

import time  # For exponential backoff delays
import random

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
async_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.1-8b-instant"
ROUTER_MODEL = "llama-3.1-8b-instant"

def retry_with_backoff(func, *args, max_retries=3, initial_delay=1, **kwargs):
    """
    Executes a sync function with exponential backoff and randomized jitter
    to handle transient network drops or 429/502 API constraints gracefully.
    """
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            if attempt == max_retries - 1:
                raise e  # Re-throw on final exhaust to let local fallbacks trigger
            # Apply exponential backoff with +/- 10% randomized jitter bounds
            jitter = random.uniform(-0.1, 0.1) * delay
            sleep_time = max(0.1, delay + jitter)
            print(f"[RETRY WARNING] Attempt {attempt + 1} failed: {e}. Retrying in {sleep_time:.2f}s...")
            time.sleep(sleep_time)
            delay *= 2

SYSTEM_PROMPT = """You are a skincare and haircare assistant for Clinikally, an Indian skincare platform.

IMPORTANT — YOU MUST STRICTLY FOLLOW THIS:
- ONLY answer questions about skincare, haircare, cosmetics, beauty products, and related topics
- If the user asks about ANY other topic (sports, celebrities, food, movies, travel, politics, etc.), you MUST refuse
- Your refusal response: "I'm a skincare and haircare assistant, so I can only help with questions about skin, hair, and beauty products. Could you ask me about skincare routines, ingredients, product recommendations, or hair care instead?"
- Do NOT engage with off-topic questions at all — refuse firmly and redirect to skincare topics
- Do NOT provide information outside skincare/haircare/cosmetics domain
- IMPORTANT: Do NOT provide unsolicited advice or suggestions unless the user explicitly asks a question
- Only answer when user asks a specific skincare question — do not assume what they need
- Keep responses focused and answer only what is asked, nothing more

For valid skincare/haircare questions:
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

ROUTER_PROMPT = """You are a query router and context interpreter for a skincare and haircare assistant.
Your job is to classify the user's intent into exactly one or more of these sources: "product", "blog", or "web", and to rewrite the user query into a clean, independent search string.

Strict Source Definitions:
- "product": The user explicitly wants to buy something, wants options, asks for a recommendation list, specifies a budget/product class, or wants to see concrete items (e.g., "show me a sunscreen", "recommend a cleanser", "suggest me some products").
- "blog": The user is asking an educational, explanatory, or informational question about an ingredient, a routine, or how something works (e.g., "what does niacinamide do", "how to use retinol", "what skincare routine should I follow in summer"). DO NOT route to product unless they explicitly ask to buy or want option lists.
- "web": The user asks about severe medical conditions, diseases, deep chronic issues, underlying physiological causes, or general lifestyle triggers (e.g., "how do I treat hormonal acne", "what causes dark circles").

CRITICAL DIRECTION FOR STANDALONE QUERY REWRITING:
Analyze the "Current User Message" in light of the "Previous User Message" and "Previous Assistant Reply". 

If the current user message is brief, vague, or conversational (e.g., "suggest me some products", "show options", "it is a skin issue", "oily", "frizz"), you MUST intelligently inject the previously established contexts (such as skin type, hair texture, main concern, or targeted product category) directly into the "standalone_query" field.

Examples:
1. History shows the user discussed "frizz". Current message is "suggest me some products".
   -> Your rewritten standalone_query MUST be: "hair products for frizzy hair"
   
2. History shows the bot asked for skin type. Current message is "oily".
   -> Your rewritten standalone_query MUST be: "skincare for oily skin"

3. History shows skin type is oily. Current message is "suggest me some products".
   -> Your rewritten standalone_query MUST be: "products for oily skin"

Return a JSON object exactly matching this schema:
{
  "sources": ["product" | "blog" | "web"],
  "standalone_query": "completely rewritten independent search string incorporating prior conversation context"
}
"""

# ═══════════════════════════════════════════════════════════════════════════════
# CORE HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def detect_product_type(message: str, llm_fallback: bool = True) -> List[str]:
    msg_lower = message.lower()
    hair_score = sum(1 for kw in HAIR_KEYWORDS if kw in msg_lower)
    skin_score = sum(1 for kw in SKIN_KEYWORDS if kw in msg_lower)
    
    if hair_score > skin_score and hair_score >= 1:
        return ["hair"]
    elif skin_score > hair_score and skin_score >= 1:
        return ["skin"]
    elif hair_score > 0 and skin_score > 0:
        return ["hair", "skin"]
    
    if llm_fallback:
        try:
            response = client.chat.completions.create(
                model=ROUTER_MODEL,
                messages=[
                    {"role": "system", "content": "You are a product classifier. Classify if the user query is about HAIR, SKIN, or BOTH. Return ONLY one word: hair, skin, or both."},
                    {"role": "user", "content": f"Classify this query: {message}"}
                ],
                max_tokens=5,
                temperature=0,
            )
            result = response.choices[0].message.content.strip().lower()
            if "both" in result: return ["hair", "skin"]
            if "hair" in result: return ["hair"]
            return ["skin"]
        except Exception as e:
            logger.warning(f"[PRODUCT_TYPE_ERROR] LLM validation failed: {e}. Defaulting to skin.")
            return ["skin"]
    
    return ["skin"]

def parse_product_request(message: str) -> ProductContext:
    msg_lower = message.lower()
    products_requested = []
    request_type = RequestTypeEnum.SINGLE.value
    
    bundle_keywords = {"and", "both", "plus", "with", "along with", "together"}
    is_bundled = any(kw in msg_lower for kw in bundle_keywords)
    
    for kw in ["shampoo", "conditioner", "serum", "moisturizer", "moisturiser", "cleanser", "facewash", "sunscreen", "spf", "mask"]:
        if kw in msg_lower:
            products_requested.append(kw)
    
    if is_bundled and len(products_requested) > 1:
        request_type = RequestTypeEnum.BUNDLE.value
    elif len(products_requested) == 0:
        request_type = RequestTypeEnum.CLARIFICATION.value
    
    return ProductContext(
        product_types=detect_product_type(message),
        request_type=request_type,
        products_requested=products_requested,
        quantity=len(products_requested) if is_bundled else 1
    )

def check_clarification(message: str, history: list, product_type: Optional[List[str]] = None) -> dict:
    if len(message.split()) >= 6:
        return {"clarify": False}
    
    if product_type is None:
        product_type = detect_product_type(message)
    
    primary_type = product_type[0] if product_type else "skin"
    history_text = " ".join([m.get("content", "").lower() for m in history[-6:]])
    
    existing_context = {}
    
    if any(kw in history_text for kw in ["oily", "dry", "combination", "sensitive", "normal", "skin type"]):
        existing_context["skin_type"] = True
    if any(kw in history_text for kw in ["acne", "pimple", "dark spot", "pigment", "wrinkle", "skin concern"]):
        existing_context["skin_concern"] = True
    if any(kw in history_text for kw in ["curly", "wavy", "straight", "coily", "texture", "hair type"]):
        existing_context["hair_type"] = True
    if any(kw in history_text for kw in ["dandruff", "frizz", "hair loss", "fall", "breakage", "damage", "dryness"]):
        existing_context["hair_concern"] = True

    if primary_type == "hair":
        if not existing_context.get("hair_concern"):
            return {"clarify": True, "question": HAIR_CLARIFICATION_QUESTIONS["hair_concern"], "product_type": "hair"}
        if not existing_context.get("hair_type"):
            return {"clarify": False} # Smooth dynamic handoff, avoid tracking loop traps
            
    elif primary_type == "skin":
        if not existing_context.get("skin_type"):
            return {"clarify": True, "question": SKIN_CLARIFICATION_QUESTIONS["skin_type"], "product_type": "skin"}
        if not existing_context.get("skin_concern"):
            return {"clarify": True, "question": SKIN_CLARIFICATION_QUESTIONS["skin_concern"], "product_type": "skin"}

    return {"clarify": False}

def prune_session_history(history: List[Dict], max_turns: int = 20) -> Tuple[str, List[Dict]]:
    if not history or len(history) <= max_turns:
        return ("", history)
    
    old_history = history[:-max_turns]
    pruned_history = history[-max_turns:]
    summary_parts = []
    for msg in old_history[-3:]:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")[:100]
        summary_parts.append(f"[{role}]: {content}...")
    
    return ("Previous context: " + " | ".join(summary_parts), pruned_history)

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
            max_tokens=200,
            temperature=0,
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content.strip())
    except Exception as e:
        logger.error(f"[ROUTER_ERROR] {e} — falling back")
        return {"sources": ["product", "blog"], "standalone_query": message}

def extract_price(message: str) -> Optional[float]:
    patterns = [r'under\s*₹?\s*(\d+)', r'below\s*₹?\s*(\d+)', r'₹\s*(\d+)', r'rs\.?\s*(\d+)', r'(\d+)\s*rupee']
    for pattern in patterns:
        match = re.search(pattern, message.lower())
        if match: return float(match.group(1))
    return None

def is_filler_response(message: str) -> bool:
    msg_lower = message.strip().lower()
    if not msg_lower or len(msg_lower) <= 2 or msg_lower in FILLER_PHRASES:
        return True
    return any(msg_lower.startswith(phrase + ' ') for phrase in FILLER_PHRASES)

# ═══════════════════════════════════════════════════════════════════════════════
# AGENT RUNNERS (ORCHESTRATORS)
# ═══════════════════════════════════════════════════════════════════════════════

def run_agent(user_message: str, history: list = None) -> dict:
    if history is None: history = []
    
    if is_filler_response(user_message):
        return {"reply": "What skincare or haircare question can I help you with?", "source": "unknown", "tools_used": [], "products": []}

    last_reply, last_user_msg = "", ""
    if history:
        for msg in reversed(history):
            if msg.get("role") == "assistant" and not last_reply: last_reply = msg["content"]
            if msg.get("role") == "user" and not last_user_msg: last_user_msg = msg["content"]
            if last_reply and last_user_msg: break

    # Context-Aware Product Type Handling
    product_type = detect_product_type(user_message, llm_fallback=False)
    if len(user_message.split()) < 5 and history:
        history_text = " ".join([m.get("content", "").lower() for m in history[-5:]])
        if sum(1 for kw in ['skin','acne','moistur','oily'] if kw in history_text) > sum(1 for kw in ['hair','shampoo','frizz'] if kw in history_text):
            product_type = ["skin"]
        else:
            product_type = ["hair"]

    router_output = route_query_llm(user_message, last_user_msg, last_reply)
    sources = router_output.get("sources", ["blog"])
    contextual_query = router_output.get("standalone_query", user_message)
    max_price = extract_price(user_message)

    if "product" in sources:
        clarify = check_clarification(contextual_query, history, product_type=product_type)
        if clarify.get("clarify"):
            return {"reply": clarify.get("question"), "tools_used": [], "source": "unknown", "products": []}

    all_results, tools_used = {}, []
    if "product" in sources:
        print(f"[TOOL CALL] search_products(query={contextual_query!r}, max_price={max_price})")
        try:
            # Wrapped in retry backoff bounds before shifting to dynamic downgrades
            result = retry_with_backoff(search_products, contextual_query, max_price=max_price)
            all_results["products"] = result
            tools_used.append("search_products")
        except Exception as e:
            print(f"[GRACEFUL DEGRADATION] search_products failed completely: {e}. Isolation active.")
            all_results["products"] = {"results": []}  # Safe empty fallback template structure
    if "blog" in sources:
        print(f"[TOOL CALL] search_blogs(query={contextual_query!r})")
        try:
            result = retry_with_backoff(search_blogs, contextual_query)
            all_results["blogs"] = result
            tools_used.append("search_blogs")
        except Exception as e:
            print(f"[GRACEFUL DEGRADATION] search_blogs failed completely: {e}. Isolation active.")
            all_results["blogs"] = {"results": []}
    if "web" in sources:
        print(f"[TOOL CALL] web_search(query={contextual_query!r})")
        try:
            result = retry_with_backoff(web_search, contextual_query)
            all_results["web"] = result
            tools_used.append("web_search")
        except Exception as e:
            print(f"[GRACEFUL DEGRADATION] web_search failed completely: {e}. Isolation active.")
            all_results["web"] = {"results": []}

    source_label = "mixed" if len(tools_used) > 1 else (tools_used[0].replace("search_", "").replace("_search", "") if tools_used else "unknown")

    context_parts = []
    if "products" in all_results and all_results["products"].get("results"):
        context_parts.append("PRODUCTS FROM CLINIKALLY CATALOG:")
        for p in all_results["products"]["results"][:5]:
            context_parts.append(f"- {p.get('name')} | ₹{p.get('price')} | Ingredients: {p.get('ingredients','')[:80]} | Benefits: {p.get('benefits','')[:80]}")
    if "blogs" in all_results and all_results["blogs"].get("results"):
        context_parts.append("\nSKINCARE KNOWLEDGE:")
        for b in all_results["blogs"]["results"][:2]: context_parts.append(f"- {b.get('excerpt','')[:250]}")
    if "web" in all_results and all_results["web"].get("results"):
        context_parts.append("\nWEB RESULTS:")
        for w in all_results["web"]["results"][:2]: context_parts.append(f"- {w.get('content','')[:250]}")

    context = "\n".join(context_parts) if context_parts else "No relevant results found."

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        if "Earlier Summary Context:" in msg.get("content", ""):
            messages.append({"role": "user", "content": f"[Context from earlier summary: {msg['content']}]"})
            messages.append({"role": "assistant", "content": "Understood, tracking this skin background information."})
        elif msg.get("role") in ["user", "assistant"]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": f"User question: {user_message}\n\nSearch results:\n{context}"})

    try:
        response = client.chat.completions.create(model=MODEL, messages=messages, max_tokens=300, temperature=0.7)
        reply = response.choices[0].message.content
    except Exception as e:
        logger.error(f"[GROQ_ERROR] Fallback triggered: {e}")
        reply = "I successfully found matching options in our systems. Here are my top picks for you:" if "products" in all_results else "I found information on that concern but cannot compile a summary text right now."

    return {"reply": reply, "tools_used": tools_used, "source": source_label, "products": all_results["products"].get("results", [])[:3] if "products" in all_results else []}


async def run_agent_stream(user_message: str, history: list = None):
    if history is None: history = []

    if is_filler_response(user_message):
        prompt = "What skincare or haircare question can I help you with?"
        yield {"type": "token", "content": prompt}
        yield {"type": "metadata", "reply": prompt, "source": "unknown", "tools_used": [], "products": []}
        return

    _, pruned_history = prune_session_history(history, max_turns=20)

    def gather_context_sync():
        try:
            last_reply, last_user_msg = "", ""
            if pruned_history:
                for msg in reversed(pruned_history):
                    if msg.get("role") == "assistant" and not last_reply: last_reply = msg["content"]
                    if msg.get("role") == "user" and not last_user_msg: last_user_msg = msg["content"]
                    if last_reply and last_user_msg: break

            product_type = detect_product_type(user_message, llm_fallback=False)
            if len(user_message.split()) < 5 and pruned_history:
                history_text = " ".join([m.get("content", "").lower() for m in pruned_history[-5:]])
                if sum(1 for kw in ['skin','acne','moistur','oily'] if kw in history_text) > sum(1 for kw in ['hair','shampoo','frizz'] if kw in history_text):
                    product_type = ["skin"]
                else:
                    product_type = ["hair"]

            router_output = route_query_llm(user_message, last_user_msg, last_reply)
            sources = router_output.get("sources", ["blog"])
            contextual_query = router_output.get("standalone_query", user_message)
            max_price = extract_price(user_message)

            if "product" in sources:
                clarify = check_clarification(contextual_query, pruned_history, product_type=product_type)
                if clarify.get("clarify"):
                    return {"is_clarification": True, "reply": clarify.get("question"), "tools_used": [], "source": "unknown", "products": []}

            all_results, tools_used = {}, []
            if "product" in sources:
                try:
                    all_results["products"] = retry_with_backoff(search_products, contextual_query, max_price=max_price)
                    tools_used.append("search_products")
                except Exception as e:
                    print(f"[STREAM DEGRADATION] search_products failed: {e}")
                    all_results["products"] = {"results": []}

            if "blog" in sources:
                try:
                    all_results["blogs"] = retry_with_backoff(search_blogs, contextual_query)
                    tools_used.append("search_blogs")
                except Exception as e:
                    print(f"[STREAM DEGRADATION] search_blogs failed: {e}")
                    all_results["blogs"] = {"results": []}

            if "web" in sources:
                try:
                    all_results["web"] = retry_with_backoff(web_search, contextual_query)
                    tools_used.append("web_search")
                except Exception as e:
                    print(f"[STREAM DEGRADATION] web_search failed: {e}")
                    all_results["web"] = {"results": []}    

            source_label = "mixed" if len(tools_used) > 1 else (tools_used[0].replace("search_", "").replace("_search", "") if tools_used else "unknown")

            context_parts = []
            if "products" in all_results and all_results["products"].get("results"):
                context_parts.append("PRODUCTS FROM CLINIKALLY CATALOG:")
                for p in all_results["products"]["results"][:5]:
                    context_parts.append(f"- {p.get('name')} | ₹{p.get('price')} | Ingredients: {p.get('ingredients','')[:80]} | Benefits: {p.get('benefits','')[:80]}")
            if "blogs" in all_results and all_results["blogs"].get("results"):
                for b in all_results["blogs"]["results"][:2]: context_parts.append(f"- {b.get('excerpt','')[:250]}")
            if "web" in all_results and all_results["web"].get("results"):
                for w in all_results["web"]["results"][:2]: context_parts.append(f"- {w.get('content','')[:250]}")

            context = "\n".join(context_parts) if context_parts else "No relevant results found."

            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            for msg in pruned_history:
                if "Earlier Summary Context:" in msg.get("content", ""):
                    messages.append({"role": "user", "content": f"[Context from earlier summary: {msg['content']}]"})
                    messages.append({"role": "assistant", "content": "Understood."})
                elif msg.get("role") in ["user", "assistant"]:
                    messages.append({"role": msg["role"], "content": msg["content"]})

            messages.append({"role": "user", "content": f"User question: {user_message}\n\nSearch results:\n{context}"})

            return {
                "is_clarification": False, "messages": messages, "tools_used": tools_used, "source": source_label,
                "products": all_results["products"].get("results", [])[:3] if "products" in all_results else []
            }
        except Exception as e:
            logger.error(f"[GATHER_ERROR] {e}", exc_info=True)
            return {"is_clarification": False, "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_message}], "tools_used": [], "source": "unknown", "products": []}

    prep = await asyncio.get_event_loop().run_in_executor(None, gather_context_sync)

    if prep["is_clarification"]:
        yield {"type": "token", "content": prep["reply"]}
        yield {"type": "metadata", "reply": prep["reply"], "source": prep["source"], "tools_used": prep["tools_used"], "products": prep["products"]}
        return

    try:
        response_stream = await async_client.chat.completions.create(
            model=MODEL, messages=prep["messages"], max_tokens=300, temperature=0.7, stream=True
        )
        full_reply = ""
        async for chunk in response_stream:
            token = chunk.choices[0].delta.content
            if token:
                full_reply += token
                yield {"type": "token", "content": token}
    except Exception as e:
        logger.error(f"[STREAM_LLM_ERROR] {e}")
        full_reply = "I successfully found matching options in our systems. Here are my top picks for you:" if prep["products"] else "I processed that concern but encountered a text stream interruption."
        yield {"type": "token", "content": full_reply}

    yield {"type": "metadata", "reply": full_reply, "source": prep["source"], "tools_used": prep["tools_used"], "products": prep["products"]}