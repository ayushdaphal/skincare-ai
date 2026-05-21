# Clinikally AI - API Reference

## Overview

The Clinikally AI API provides chat capabilities powered by LLM-based routing, hybrid search, and intelligent recommendations.

**Base URL:** `https://api.clinikally.com` (Production)  
**Base URL:** `http://localhost:8000` (Development)  
**API Version:** 1.0  
**Protocol:** HTTP/2 + HTTPS  

---

## Authentication

Currently **no authentication required** (open API). Future versions will implement:
- API key authentication
- JWT bearer tokens
- Rate limiting per client

---

## Request/Response Format

All requests use `application/json` content type.

### Standard Error Response

```json
{
  "detail": "Descriptive error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-05-21T14:30:22Z"
}
```

---

## Endpoints

### 1. Health Check

**Endpoint:** `GET /health`

**Purpose:** Verify API is operational

**Response:**
```json
200 OK

{
  "status": "healthy"
}
```

**Use Cases:**
- Load balancer health checks (every 30s)
- Frontend initialization
- Monitoring systems

**Latency:** <10ms

---

### 2. Chat (Blocking Response)

**Endpoint:** `POST /chat`

**Purpose:** Send message and get complete response

**Request:**
```json
{
  "message": "I have oily skin with acne, what serum should I use?",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Request Schema:**
```typescript
interface ChatRequest {
  message: string;        // Required. 1-1000 characters
  session_id: string;     // Required. UUID v4 format
}
```

**Response (200 OK):**
```json
{
  "reply": "For oily skin with acne, I'd recommend a lightweight serum with salicylic acid and niacinamide. These help control sebum and reduce breakouts without clogging pores.",
  "source": ["product", "blog"],
  "tools_used": ["search_products", "search_blogs"],
  "products": [
    {
      "name": "Niacinamide + Salicylic Acid Serum",
      "price": "₹499",
      "reason": "Combines two powerhouse ingredients for oily acne-prone skin"
    },
    {
      "name": "Lightweight Acne Control Gel",
      "price": "₹399",
      "reason": "Gel texture perfect for oily skin, won't feel greasy"
    }
  ],
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Schema:**
```typescript
interface ChatResponse {
  reply: string;              // Generated response
  source: SourceType[];       // ["product" | "blog" | "web"]
  tools_used: string[];       // ["search_products", "search_blogs", "web_search"]
  products: Product[];        // Recommended products
  session_id: string;         // Session ID for persistence
}

interface Product {
  name: string;               // Product name
  price: string;              // Price (e.g., "₹499")
  reason: string;             // Why recommended
}

type SourceType = "product" | "blog" | "web";
```

**Errors:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_REQUEST` | Message cannot be empty |
| 400 | `INVALID_SESSION` | Invalid session_id format |
| 504 | `LLM_TIMEOUT` | LLM request timeout |
| 500 | `INTERNAL_ERROR` | Internal server error |

**Example Request:**
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Best sunscreen under 500",
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Latency:** 
- p50: 800ms
- p95: 1200ms
- p99: 1800ms

---

### 3. Chat Streaming (Real-time Tokens)

**Endpoint:** `GET /chat/stream`

**Purpose:** Stream response tokens in real-time for better UX

**Query Parameters:**
```
GET /chat/stream?message=<query>&session_id=<uuid>

message (required): URL-encoded user query
session_id (required): UUID v4
```

**Response:** Server-Sent Events (text/event-stream)

**Event Format:**
```
data: {"token": "word "}
data: {"token": "another "}
...
data: {"done": true, "source": [...], "tools_used": [...], "products": [...]}
```

**Full Response Example:**
```
data: {"token": "For "}
data: {"token": "oily "}
data: {"token": "skin, "}
...
data: {"token": "."}
data: {"done": true, "source": ["product"], "tools_used": ["search_products"], "products": [{"name": "...", "price": "...", "reason": "..."}]}
```

**Event Schema:**
```typescript
// Token event
interface TokenEvent {
  token: string;  // Single word or token with space
}

// Completion event
interface CompletionEvent {
  done: true;
  source: SourceType[];
  tools_used: string[];
  products: Product[];
  session_id: string;
}
```

**Frontend Implementation:**
```typescript
async function streamChat(message: string, sessionId: string) {
  const eventSource = new EventSource(
    `/chat/stream?message=${encodeURIComponent(message)}&session_id=${sessionId}`
  );
  
  let fullResponse = "";
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.token) {
      fullResponse += data.token;
      // Update UI with token
      displayToken(fullResponse);
    }
    
    if (data.done) {
      // Finalize with metadata
      displayProducts(data.products);
      displaySources(data.source);
      eventSource.close();
    }
  };
  
  eventSource.onerror = () => {
    eventSource.close();
    displayError("Connection lost");
  };
}
```

**Latency:**
- First token: 600-800ms
- Token interval: 30ms
- Total completion: 900-1500ms

---

### 4. Clear Session

**Endpoint:** `POST /chat/clear`

**Purpose:** Clear conversation history for a session

**Request:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200 OK):**
```json
{
  "status": "cleared",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_SESSION` | Invalid session_id |
| 404 | `NOT_FOUND` | Session not found |

**Example:**
```bash
curl -X POST http://localhost:8000/chat/clear \
  -H "Content-Type: application/json" \
  -d '{"session_id": "550e8400-e29b-41d4-a716-446655440000"}'
```

**Latency:** <50ms

---

## Query Routing

The API automatically classifies user intent into data sources:

### Routing Rules

**Product (Buy/Recommend):**
- "show me a sunscreen"
- "best moisturizer under 500"
- "recommend a cleanser"
- "what products have retinol"

**Blog (Educational):**
- "what is niacinamide"
- "how to use retinol safely"
- "benefits of hyaluronic acid"
- "routine for dry skin"

**Web (Medical/Severe):**
- "what causes dark circles"
- "hormonal acne treatment"
- "dermatitis disease info"
- "cure for hair fall"

### Source Detection

| Signal | Weight | Example |
|--------|--------|---------|
| Keyword match | +3 | "recommend", "buy", "what is" |
| Product type | +2 | "serum", "cleanser", "toner" |
| Price mention | +3 | "under ₹500", "budget" |
| Medical keyword | +2 | "treat", "cure", "condition" |

---

## Advanced Features

### Price Extraction

The API automatically extracts price filters from user queries:

```
"moisturizer under 500" → max_price = 500
"cleanser ₹300" → max_price = 300
"serum below 1000" → max_price = 1000
```

### Skin Type Matching

Automatically filters products by detected skin type:

```
Query: "serum for oily skin"
Detected: skin_type = "oily"
Filters applied: ["oil control", "acne", "mattify"]
```

### Clarification Prompts

If a product query is vague, the API asks for clarification:

```json
{
  "reply": "What's your skin type? That'll help me recommend the perfect products.",
  "source": ["product"],
  "tools_used": ["clarification"],
  "products": [],
  "session_id": "..."
}
```

---

## Rate Limiting (Future)

When implemented:

```
- 100 requests/minute per IP
- 50 requests/minute per session
- 10 concurrent connections per IP
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1234567890
```

---

## Batch Operations (Future)

**Endpoint:** `POST /chat/batch`

Send multiple messages in one request:

```json
{
  "requests": [
    {"message": "I have oily skin", "session_id": "session1"},
    {"message": "what serum", "session_id": "session1"},
    {"message": "under 500", "session_id": "session1"}
  ]
}
```

**Response:**
```json
{
  "results": [
    {"session_id": "session1", "reply": "..."},
    {"session_id": "session1", "reply": "..."},
    {"session_id": "session1", "reply": "..."}
  ]
}
```

---

## Webhook Support (Future)

Receive async notifications when responses are ready:

```json
POST /webhooks/configure
{
  "url": "https://yoursite.com/webhook",
  "events": ["chat.complete", "chat.error"]
}
```

---

## Session Management

### Session ID Format

UUID v4 (36 characters):
```
550e8400-e29b-41d4-a716-446655440000
```

Generate in frontend:
```typescript
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

### Session Persistence

- **Duration:** 90 days of inactivity
- **Storage:** SQLite (local) / PostgreSQL (production)
- **Summarization:** Automatic after 4 turns

---

## Error Codes

| Code | HTTP | Description | Retry? |
|------|------|-------------|--------|
| `INVALID_REQUEST` | 400 | Malformed request | No |
| `INVALID_SESSION` | 400 | Invalid session ID | No |
| `MESSAGE_EMPTY` | 400 | Message is empty | No |
| `LLM_TIMEOUT` | 504 | LLM request timeout | Yes (backoff) |
| `SEARCH_FAILED` | 500 | Search engine error | Yes |
| `DATABASE_ERROR` | 500 | Database connection error | Yes |
| `INTERNAL_ERROR` | 500 | Unknown error | Yes |

---

## Usage Examples

### Example 1: Product Recommendation

```bash
# Request
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I have oily skin with acne, recommend a serum under 500",
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Response
{
  "reply": "For oily acne-prone skin, I'd recommend a serum with salicylic acid or niacinamide. These keep oil at bay without irritating.",
  "source": ["product"],
  "tools_used": ["search_products"],
  "products": [
    {
      "name": "BHA Exfoliating Serum",
      "price": "₹450",
      "reason": "Controls excess oil and prevents breakouts"
    }
  ],
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Example 2: Educational Query

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the benefits of niacinamide?",
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Response
{
  "reply": "Niacinamide strengthens your skin barrier, reduces redness, and regulates sebum production. It's great for both acne-prone and sensitive skin.",
  "source": ["blog"],
  "tools_used": ["search_blogs"],
  "products": [],
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Example 3: Multi-turn Conversation

```bash
# Turn 1
curl -X POST http://localhost:8000/chat -d '{
  "message": "I have dry skin",
  "session_id": "session-123"
}'
# → "Great! What are your specific concerns?"

# Turn 2 (same session)
curl -X POST http://localhost:8000/chat -d '{
  "message": "I get really flaky",
  "session_id": "session-123"
}'
# → "I'd recommend a hydrating moisturizer with ceramides..."
# (API automatically includes previous context)

# Turn 3
curl -X POST http://localhost:8000/chat -d '{
  "message": "under 300",
  "session_id": "session-123"
}'
# → "Perfect! Here are budget-friendly options..."
# (System understands you're still asking about products)
```

---

## SDK (Future)

JavaScript/TypeScript SDK:
```typescript
import { ClinikallySkincare } from '@clinikally/sdk';

const client = new ClinikallySkincare({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.clinikally.com'
});

const response = await client.chat({
  message: "I have oily skin",
  sessionId: "session-123"
});

// Streaming
client.chatStream(message, sessionId)
  .on('token', (token) => console.log(token))
  .on('complete', (response) => console.log(response))
  .on('error', (error) => console.error(error));
```

---

## Status Page

Monitor API status: (Coming Soon)  
https://status.clinikally.com

---

## Support

- **Documentation:** https://docs.clinikally.com
- **Issues:** support@clinikally.com
- **Status:** https://status.clinikally.com

