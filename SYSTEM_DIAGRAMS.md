# Clinikally AI - System Diagrams & Data Flows

This document provides comprehensive visual representations of the system architecture using Mermaid diagrams.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph User["User Tier"]
        BROWSER["Web Browser"]
        MOBILE["Mobile Browser<br/>(Future)"]
    end
    
    subgraph Frontend["Frontend Tier"]
        CDN["Vercel CDN<br/>Global Distribution"]
        REACT["React SPA<br/>ChatWidget.tsx"]
    end
    
    subgraph Gateway["API Gateway Layer"]
        LB["Load Balancer<br/>(Future)"]
        FASTAPI["FastAPI Server<br/>Port 8000"]
    end
    
    subgraph Services["Service Layer"]
        AGENT["Agent Orchestrator<br/>agent.py"]
        ROUTER["Intent Router<br/>route_query_llm()"]
        CLARIFY["Clarification Engine<br/>check_clarification()"]
        SEARCH["Search Engine<br/>_hybrid_search()"]
    end
    
    subgraph Retrieval["Retrieval Layer"]
        CHROMA["ChromaDB<br/>Vector Store"]
        BM25_P["BM25 Index<br/>Products"]
        BM25_B["BM25 Index<br/>Blogs"]
        CACHE["Query Cache<br/>Embedding-based"]
    end
    
    subgraph Knowledge["Knowledge Base"]
        EXCEL[["Excel Catalog<br/>Products"]]
        BLOGS[["Blog Content<br/>Markdown Files"]]
        CHROMA_STORAGE[["ChromaDB Storage<br/>chroma.sqlite3"]]
    end
    
    subgraph External["External Services"]
        GROQ["Groq API<br/>llama-3.1-8b"]
        TAVILY["Tavily API<br/>Web Search"]
        SENT["Sentence Transformers<br/>Embeddings"]
    end
    
    subgraph Memory["Memory & State"]
        SESSION_DB["SQLite<br/>sessions.db"]
        SUMMARY["Context Summarizer<br/>LLM"]
    end
    
    BROWSER -->|HTTPS| CDN
    MOBILE -->|HTTPS| CDN
    CDN -->|Static Assets| REACT
    REACT -->|HTTP/2| LB
    LB --> FASTAPI
    
    FASTAPI --> AGENT
    AGENT --> ROUTER
    AGENT --> CLARIFY
    AGENT --> SEARCH
    
    SEARCH --> CACHE
    CACHE -->|Query| CHROMA
    CACHE -->|Tokenize| BM25_P
    CACHE -->|Tokenize| BM25_B
    
    CHROMA --> CHROMA_STORAGE
    BM25_P --> EXCEL
    BM25_B --> BLOGS
    
    AGENT -->|Search| TAVILY
    ROUTER -->|Classify| GROQ
    CLARIFY -->|Check| GROQ
    AGENT -->|Generate| GROQ
    SEARCH -->|Embed| SENT
    
    AGENT -->|Save/Load| SESSION_DB
    SESSION_DB -->|Summarize| SUMMARY
    
    FASTAPI -->|Stream| REACT
    REACT -->|Display| BROWSER
    
    style User fill:#e3f2fd
    style Frontend fill:#f3e5f5
    style Gateway fill:#fff3e0
    style Services fill:#ede7f6
    style Retrieval fill:#e8f5e9
    style Knowledge fill:#fce4ec
    style External fill:#ffecb3
    style Memory fill:#e1f5fe
```

---

## 2. Request Processing Pipeline

```mermaid
sequenceDiagram
    participant User
    participant UI as ChatWidget
    participant API as FastAPI
    participant Memory as Memory Store
    participant Router as Query Router
    participant Search as Search Engine
    participant LLM as Groq LLM
    participant DB as Database
    
    User->>UI: Type message
    activate UI
    
    UI->>UI: Validate input
    UI->>API: POST /chat
    deactivate UI
    activate API
    
    API->>Memory: load_history(session_id)
    activate Memory
    Memory-->>API: [messages], summary
    deactivate Memory
    
    API->>Router: route_query_llm(message, context)
    activate Router
    Router->>LLM: Classify intent
    LLM-->>Router: {"sources": [...]}
    Router-->>API: Routing decision
    deactivate Router
    
    alt User Query Vague
        API->>LLM: check_clarification(message)
        LLM-->>API: {"clarify": true, question}
        API-->>UI: Ask clarification
    else Query Clear
        API->>Search: search_sources(query, sources)
        activate Search
        
        Search->>Search: Check cache
        alt Cache Hit
            Search-->>API: Cached results
        else Cache Miss
            Search->>Search: Dense search (ChromaDB)
            Search->>Search: Sparse search (BM25)
            Search->>Search: RRF merge
            Search->>Search: Cross-encode rerank
            Search->>Search: Store in cache
            Search-->>API: Ranked results
        end
        deactivate Search
        
        API->>LLM: Generate response with context
        activate LLM
        LLM-->>API: response text
        deactivate LLM
        
        API->>Memory: append_turn(message, response)
        activate Memory
        Memory->>LLM: Summarize conversation
        LLM-->>Memory: Summary
        Memory->>DB: Save to database
        Memory-->>API: Saved
        deactivate Memory
    end
    
    API-->>UI: {"reply": "...", products, source}
    deactivate API
    
    activate UI
    UI->>UI: Display response
    UI->>UI: Render products
    UI-->>User: Show formatted response
    deactivate UI
```

---

## 3. Search Engine Flow

```mermaid
graph TD
    Query["Input Query:<br/>User Message"]
    
    Normalize["Normalize Query<br/>- Lowercase<br/>- Remove special chars<br/>- Sort tokens"]
    
    CacheCheck{"Cache Hit?<br/>Similarity > 0.90"}
    
    subgraph Dense["Dense Search Path<br/>Semantic Matching"]
        Embed["Embed Query<br/>SentenceTransformer<br/>384-dim vector"]
        ChromaQuery["Query ChromaDB<br/>Top 2N by similarity"]
    end
    
    subgraph Sparse["Sparse Search Path<br/>Keyword Matching"]
        Tokenize["Tokenize Query<br/>Split by spaces"]
        BM25Query["BM25 Scoring<br/>Term frequency"]
    end
    
    RRF["Reciprocal Rank Fusion<br/>Combine dense + sparse<br/>Score = 1/60+dense + 1/60+sparse"]
    
    MergeFilter["Filter & Merge<br/>- Price filtering<br/>- Skin type matching<br/>- Source filtering"]
    
    Rerank["Cross-Encoder Reranking<br/>ms-marco-MiniLM<br/>Compute relevance scores"]
    
    TopK["Select Top K<br/>Final ranked results"]
    
    CacheStore["Store in Cache<br/>Embedding → Results"]
    
    Output["Return Results<br/>To Agent"]
    
    Query --> Normalize
    Normalize --> CacheCheck
    
    CacheCheck -->|YES| Output
    CacheCheck -->|NO| Embed
    CacheCheck -->|NO| Tokenize
    
    Embed --> ChromaQuery
    Tokenize --> BM25Query
    
    ChromaQuery --> RRF
    BM25Query --> RRF
    
    RRF --> MergeFilter
    MergeFilter --> Rerank
    Rerank --> TopK
    TopK --> CacheStore
    CacheStore --> Output
    
    style Query fill:#bbdefb
    style Normalize fill:#c8e6c9
    style CacheCheck fill:#fff9c4
    style Dense fill:#e0bee7
    style Sparse fill:#c8e6c9
    style RRF fill:#ffccbc
    style Rerank fill:#b2dfdb
    style Output fill:#c8e6c9
```

---

## 4. LLM Routing Decision Tree

```mermaid
graph TD
    Query["User Query"]
    
    Extract["Extract Keywords & Entities<br/>- Product keywords: recommend, buy, product type<br/>- Price mentions: ₹, budget<br/>- Medical keywords: treat, cure, condition"]
    
    Score["Calculate Scores<br/>product_score = sum(product_keywords)<br/>blog_score = sum(blog_keywords)<br/>web_score = sum(web_keywords)"]
    
    Decision["Route Decision<br/>Sources = [top scoring categories]"]
    
    GenQuery["Generate Standalone Query<br/>Remove context words<br/>Extract key entities"]
    
    Route1["PRODUCT<br/>Search catalog<br/>Apply filters"]
    
    Route2["BLOG<br/>Search knowledge base<br/>Educational content"]
    
    Route3["WEB<br/>Tavily API<br/>Recent information"]
    
    Response["Generate Response<br/>Format with sources"]
    
    Query --> Extract
    Extract --> Score
    Score --> Decision
    
    Decision -->|product_score ≥ threshold| Route1
    Decision -->|blog_score ≥ threshold| Route2
    Decision -->|web_score ≥ threshold| Route3
    
    Route1 --> GenQuery
    Route2 --> GenQuery
    Route3 --> GenQuery
    
    GenQuery --> Response
    
    style Query fill:#bbdefb
    style Extract fill:#fff9c4
    style Score fill:#ffccbc
    style Decision fill:#f8bbd0
    style GenQuery fill:#c8e6c9
    style Route1 fill:#b3e5fc
    style Route2 fill:#b3e5fc
    style Route3 fill:#b3e5fc
    style Response fill:#c8e6c9
```

---

## 5. Memory Management Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NewSession: Create session<br/>UUID generated
    
    NewSession --> FirstMessage: User sends message
    
    FirstMessage --> GrowingHistory: Accumulate messages<br/>(Turn 1-3)
    
    GrowingHistory --> GrowingHistory: More messages<br/>(Turn 4+)
    
    GrowingHistory --> CompressThreshold: Turn count > 4?
    
    CompressThreshold --> NoCompress: No<br/>Keep accumulating
    NoCompress --> GrowingHistory
    
    CompressThreshold --> Summarize: Yes<br/>Call LLM
    
    Summarize --> CompressedHistory: Store:<br/>- Summary: "User has oily skin..."<br/>- Recent: Last 3 turns
    
    CompressedHistory --> CompressedHistory: More messages
    CompressedHistory --> Inactive: 7+ days<br/>no activity
    
    Inactive --> Archive: Archive session<br/>to cold storage
    
    Archive --> [*]
    
    note right of GrowingHistory
        Example growth:
        - Turn 1: 100 tokens
        - Turn 2: 200 tokens
        - Turn 3: 300 tokens
    end note
    
    note right of CompressedHistory
        After compression:
        - Summary: 150-200 tokens
        - Recent: 300 tokens
        - Total: ~500 (vs 2000 before)
    end note
```

---

## 6. Component Interaction Matrix

```mermaid
graph LR
    subgraph Input["User Input"]
        UI["ChatWidget<br/>React Component"]
    end
    
    subgraph Orchestration["Orchestration"]
        API["FastAPI Server"]
        AGENT["Agent Logic"]
    end
    
    subgraph Intelligence["Intelligence"]
        ROUTER["Query Router"]
        CLARIFY["Clarification Engine"]
    end
    
    subgraph Retrieval["Retrieval"]
        SEARCH["Hybrid Search"]
        CACHE["Cache Layer"]
    end
    
    subgraph Storage["Storage"]
        CHROMA["ChromaDB"]
        SESSION["Session DB"]
    end
    
    subgraph External["External APIs"]
        GROQ["Groq LLM"]
        TAVILY["Tavily Search"]
    end
    
    UI -->|HTTP POST| API
    API -->|orchestrate| AGENT
    
    AGENT -->|classify intent| ROUTER
    AGENT -->|check vagueness| CLARIFY
    AGENT -->|retrieve docs| SEARCH
    AGENT -->|save/load| SESSION
    AGENT -->|generate response| GROQ
    AGENT -->|web search| TAVILY
    
    ROUTER -->|classify| GROQ
    CLARIFY -->|check| GROQ
    
    SEARCH -->|cache check| CACHE
    SEARCH -->|dense search| CHROMA
    SEARCH -->|embed query| GROQ
    
    SESSION -->|summarize| GROQ
    
    API -->|stream response| UI
    
    style UI fill:#bbdefb
    style API fill:#fff9c4
    style Orchestration fill:#ffccbc
    style Intelligence fill:#f8bbd0
    style Retrieval fill:#c8e6c9
    style Storage fill:#b2dfdb
    style External fill:#ffecb3
```

---

## 7. Data Models

### Message Structure
```typescript
interface Message {
  id: string;                        // UUID
  role: 'user' | 'assistant';       // Sender
  content: string;                   // Message text
  timestamp: number;                 // Unix timestamp
  
  // Assistant-specific fields
  source?: SourceType[];            // ["product", "blog", "web"]
  toolsUsed?: string[];             // ["search_products", "search_blogs"]
  products?: Product[];             // Recommendations
}

interface Product {
  name: string;                      // Product name
  price: string;                     // "₹499"
  reason: string;                    // Why recommended
  image?: string;                    // Product image URL
  link?: string;                     // Store link
}

type SourceType = 'product' | 'blog' | 'web';
```

### Session Structure
```typescript
interface Session {
  sessionId: string;                 // UUID v4
  messages: Message[];               // All turns
  summary: string;                   // Compressed context
  createdAt: number;                 // Unix timestamp
  updatedAt: number;                 // Unix timestamp
  metadata?: {
    skinType?: string;               // "oily" | "dry" | "combination" | "sensitive"
    concerns?: string[];             // ["acne", "pigmentation"]
    budget?: number;                 // Max price
  };
}
```

### Search Result Structure
```typescript
interface SearchResult {
  documents: string[];               // Top K ranked documents
  metadatas: Metadata[];            // Metadata per document
  scores?: number[];                // Relevance scores
  source: SourceType;               // Where found
  cacheHit?: boolean;               // Was it cached?
}

interface Metadata {
  source: 'excel' | 'blog';         // Data source
  productName?: string;             // If product
  price?: number;                    // If product
  url?: string;                      // If blog
  category?: string;                // Classification
}
```

---

## 8. Performance Characteristics

```mermaid
gantt
    title Request Latency Breakdown (p95)
    dateFormat YYYY-MM-DD
    axisFormat %M:%S
    
    section Breakdown
    Load History           :load, 0m, 30ms
    Route Query (LLM)     :route, 30ms, 150ms
    Check Clarification   :clarify, 180ms, 100ms
    Hybrid Search         :search, 280ms, 170ms
    Reranking             :rerank, 450ms, 200ms
    LLM Generation        :groq, 650ms, 400ms
    Format Response       :format, 1050ms, 30ms
    
    section Total
    Total Response Time   :crit, 0m, 1080ms
    Target (p95)          :crit2, 0m, 1200ms
```

---

## 9. Scaling Architecture

### Horizontal Scaling Strategy

```mermaid
graph TB
    subgraph Before["Single Instance (Current)"]
        SINGLE["FastAPI Instance<br/>Memory: 1.2GB<br/>CPU: 45%<br/>Max: 10 concurrent users"]
    end
    
    subgraph After["Multi-Instance (Future)"]
        LB["Load Balancer<br/>Round-robin"]
        INSTANCE1["FastAPI #1"]
        INSTANCE2["FastAPI #2"]
        INSTANCE3["FastAPI #3"]
        
        SHARED["Shared Storage<br/>- ChromaDB (persistent)<br/>- SQLite (sessions)<br/>- Cache layer (Redis)"]
    end
    
    Before -->|At 50 users| After
    
    LB --> INSTANCE1
    LB --> INSTANCE2
    LB --> INSTANCE3
    
    INSTANCE1 --> SHARED
    INSTANCE2 --> SHARED
    INSTANCE3 --> SHARED
    
    style Before fill:#ffccbc
    style After fill:#c8e6c9
    style LB fill:#bbdefb
    style SHARED fill:#b2dfdb
```

**Capacity Planning:**

| Users | Instances | Est. Cost/mo | Response Time |
|-------|-----------|--------------|---------------|
| 10 | 1 | $70 | 800ms |
| 50 | 2 | $150 | 1000ms |
| 100 | 3 | $220 | 1100ms |
| 500 | 5 | $380 | 1200ms (p95) |

---

## 10. Deployment Pipeline

```mermaid
graph LR
    DEV["Developer<br/>Local Environment"]
    
    COMMIT["git commit<br/>git push origin main"]
    
    GITHUB["GitHub Repository<br/>Webhook trigger"]
    
    subgraph RAILWAY["Railway CI/CD"]
        BUILD["Build Phase<br/>pip install<br/>uvicorn build"]
        TEST["Test Phase<br/>pytest"]
        DEPLOY["Deploy Phase<br/>Hot reload"]
    end
    
    subgraph VERCEL["Vercel CI/CD"]
        VBUILD["Build Phase<br/>npm run build"]
        VTEST["Test Phase<br/>eslint, tsc"]
        VDEPLOY["Deploy Phase<br/>CDN distribution"]
    end
    
    PROD["Production<br/>- API: railway-app.up.railway.app<br/>- Frontend: clinikally.vercel.app"]
    
    DEV --> COMMIT
    COMMIT --> GITHUB
    
    GITHUB -->|Backend changes| RAILWAY
    GITHUB -->|Frontend changes| VERCEL
    
    RAILWAY --> BUILD
    BUILD --> TEST
    TEST --> DEPLOY
    DEPLOY --> PROD
    
    VERCEL --> VBUILD
    VBUILD --> VTEST
    VTEST --> VDEPLOY
    VDEPLOY --> PROD
    
    style DEV fill:#bbdefb
    style PROD fill:#c8e6c9
    style RAILWAY fill:#fff9c4
    style VERCEL fill:#fff9c4
```

---

## 11. Error Recovery Flow

```mermaid
graph TD
    ERROR["Error Occurs"]
    
    CLASSIFY{"Classify<br/>Error Type"}
    
    INPUT["Input Validation<br/>Error"]
    LLM_ERR["LLM API<br/>Timeout"]
    SEARCH_ERR["Search Engine<br/>Failure"]
    DB_ERR["Database<br/>Error"]
    
    INPUT_HANDLE["Return 400<br/>Bad Request"]
    LLM_HANDLE["Retry with backoff<br/>Max 3 attempts<br/>Then fallback<br/>to simpler model"]
    SEARCH_HANDLE["Return cached<br/>or empty results"]
    DB_HANDLE["Log error<br/>Alert ops team<br/>Return cached session"]
    
    RESPOND["Return error<br/>response to client"]
    
    LOG["Log full error<br/>context for debugging"]
    
    MONITOR["Alert monitoring<br/>system"]
    
    ERROR --> CLASSIFY
    
    CLASSIFY -->|Validation| INPUT
    CLASSIFY -->|LLM| LLM_ERR
    CLASSIFY -->|Search| SEARCH_ERR
    CLASSIFY -->|Database| DB_ERR
    
    INPUT --> INPUT_HANDLE
    LLM_ERR --> LLM_HANDLE
    SEARCH_ERR --> SEARCH_HANDLE
    DB_ERR --> DB_HANDLE
    
    INPUT_HANDLE --> RESPOND
    LLM_HANDLE --> RESPOND
    SEARCH_HANDLE --> RESPOND
    DB_HANDLE --> RESPOND
    
    RESPOND --> LOG
    LOG --> MONITOR
    
    style ERROR fill:#ffccbc
    style CLASSIFY fill:#fff9c4
    style RESPOND fill:#c8e6c9
    style MONITOR fill:#bbdefb
```

---

## 12. Feature Flags & A/B Testing

```mermaid
graph LR
    subgraph Config["Configuration"]
        FLAGS["Feature Flags<br/>- enable_streaming: true<br/>- enable_reranking: true<br/>- enable_web_search: true"]
    end
    
    subgraph AB_TEST["A/B Testing"]
        VAR_A["Variant A<br/>Original prompt"]
        VAR_B["Variant B<br/>New prompt"]
        SPLIT["Route 50/50<br/>by session_id"]
    end
    
    subgraph METRICS["Metrics Collection"]
        LATENCY["Latency"]
        QUALITY["Response Quality"]
        CTR["Product Click Rate"]
    end
    
    FLAGS --> LOGIC["Agent Logic<br/>Route decisions"]
    
    LOGIC --> SPLIT
    SPLIT --> VAR_A
    SPLIT --> VAR_B
    
    VAR_A --> METRICS
    VAR_B --> METRICS
    
    METRICS --> DASHBOARD["Dashboard<br/>Stats & Insights"]
    
    style FLAGS fill:#bbdefb
    style VAR_A fill:#c8e6c9
    style VAR_B fill:#ffccbc
    style METRICS fill:#fff9c4
    style DASHBOARD fill:#e1f5fe
```

---

## Summary

These diagrams represent the complete architecture of Clinikally AI, showing:

1. **Overall System:** How all components interact
2. **Request Flow:** End-to-end user message → response
3. **Search Engine:** Hybrid retrieval architecture
4. **LLM Routing:** Intent classification logic
5. **Memory:** Session persistence and compression
6. **Component Interactions:** Dependencies and data flow
7. **Data Models:** TypeScript interfaces
8. **Performance:** Latency breakdown
9. **Scaling:** Multi-instance deployment
10. **Deployment:** CI/CD pipeline
11. **Error Handling:** Recovery strategies
12. **A/B Testing:** Feature flags and experimentation

