import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getSessionId() {
  let id = sessionStorage.getItem('session_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('session_id', id)
  }
  return id
}

type Source = 'products' | 'blogs' | 'web' | 'mixed' | 'unknown' | 'error'

interface Product {
  name?: string
  price?: number
  url?: string
  description?: string
  ingredients?: string
  benefits?: string
  skin_concerns?: string
  image?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: Source
  tools_used?: string[]
  streaming?: boolean
  products?: Product[]
}

const SOURCE_CONFIG: Record<Source, { label: string; color: string; bg: string; border: string }> = {
  products: { label: '🛍️ Product catalog', color: '#8c30f5', bg: '#f3e8ff', border: '#d8b4fe' },
  blogs:    { label: '📖 Blog articles',   color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  web:      { label: '🌐 Web search',      color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  mixed:    { label: '🔀 Multiple sources', color: '#8c30f5', bg: '#f3e8ff', border: '#d8b4fe' },
  unknown:  { label: '💬 General',         color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  error:    { label: '⚠️ Error',           color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
}

function SourceBadge({ source }: { source: Source }) {
  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.unknown
  return (
    <span style={{
      fontSize: '11px',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 500,
      padding: '3px 10px',
      borderRadius: '20px',
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      display: 'inline-block',
      marginTop: '8px',
    }}>
      {cfg.label}
    </span>
  )
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '14px',
      marginTop: '8px',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      cursor: 'default',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = '#8c30f5'
      e.currentTarget.style.boxShadow = '0 0 0 3px #f3e8ff'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = '#e5e7eb'
      e.currentTarget.style.boxShadow = 'none'
    }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {product.image && (
          <img
            src={product.image}
            alt={product.name || 'Product'}
            style={{
              width: '72px', height: '72px',
              objectFit: 'contain',
              borderRadius: '8px',
              background: '#f4f5f7',
              border: '1px solid #e5e7eb',
              flexShrink: 0,
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: '1.4', flex: 1 }}>
              {product.name || 'Product'}
            </div>
            {product.price && (
              <div style={{
                fontSize: '13px', fontWeight: 600, color: '#8c30f5',
                background: '#f3e8ff', padding: '2px 10px',
                borderRadius: '20px', border: '1px solid #d8b4fe',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                ₹{product.price}
              </div>
            )}
          </div>

          {product.description && (
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px', lineHeight: '1.5' }}>
              {product.description.slice(0, 120)}{product.description.length > 120 ? '...' : ''}
            </div>
          )}

          {product.ingredients && (
            <div style={{ marginTop: '8px' }}>
              <span style={{
                fontSize: '10px', color: '#9ca3af',
                fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em'
              }}>
                Key ingredients
              </span>
              <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '3px', lineHeight: '1.5' }}>
                {product.ingredients.replace(/[\[\]"]/g, '').slice(0, 100)}
                {product.ingredients.length > 100 ? '...' : ''}
              </div>
            </div>
          )}

          {product.url && (
            
              < a href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', marginTop: '10px',
                fontSize: '12px', fontWeight: 500, color: '#8c30f5',
                textDecoration: 'none',
                border: '1px solid #d8b4fe',
                background: '#f3e8ff',
                padding: '4px 12px', borderRadius: '20px',
              }}
            >
              View on Clinikally →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
      padding: '0 20px',
    }}>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? '#8c30f5' : '#ffffff',
          border: isUser ? 'none' : '1px solid #e5e7eb',
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: '1.65',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: isUser ? '#ffffff' : '#1f2937',
          boxShadow: isUser ? '0 2px 8px rgba(140,48,245,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {msg.content}
          {msg.streaming && (
            <span style={{ display: 'inline-block', marginLeft: '4px' }}>
              <span style={{ animation: 'blink 1s infinite', color: '#8c30f5' }}>▋</span>
            </span>
          )}
        </div>
        {!isUser && msg.source && !msg.streaming && (
          <div style={{ marginTop: '4px' }}>
            <SourceBadge source={msg.source} />
          </div>
        )}
        {!isUser && msg.products && msg.products.length > 0 && !msg.streaming && (
          <div style={{ marginTop: '8px' }}>
            {msg.products.slice(0, 4).map((p, i) => (
              <ProductCard key={i} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px', padding: '0 20px' }}>
      <div style={{
        padding: '12px 16px',
        borderRadius: '18px 18px 18px 4px',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        display: 'flex', gap: '4px', alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#8c30f5', display: 'inline-block',
            animation: `bounce 1.2s infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

const SUGGESTED = [
  'Recommend a moisturiser for oily skin',
  'What does niacinamide do for skin?',
  'Best vitamin C serums under ₹800',
  'How to treat hormonal acne?',
]

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef(getSessionId())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      streaming: true,
      source: 'unknown',
    }])

    try {
      const eventSource = new EventSource(
        `${API_URL}/chat/stream?message=${encodeURIComponent(msg)}&session_id=${encodeURIComponent(sessionId.current)}`
      )

      let fullContent = ''

      eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.done) {
          eventSource.close()
          setLoading(false)
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.streaming) {
              updated[updated.length - 1] = {
                ...last,
                content: fullContent,
                streaming: false,
                source: data.source,
                tools_used: data.tools_used,
                products: data.products || [],
              }
            }
            return updated
          })
        } else if (data.token) {
          fullContent += data.token
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.streaming) {
              updated[updated.length - 1] = { ...last, content: fullContent }
            }
            return updated
          })
        }
      }

      eventSource.onerror = () => {
        eventSource.close()
        setLoading(false)
        axios.post(`${API_URL}/chat`, {
          message: msg,
          session_id: sessionId.current,
        }).then(res => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: res.data.reply,
              source: res.data.source,
              tools_used: res.data.tools_used,
              products: res.data.products || [],
              streaming: false,
            }
            return updated
          })
        }).catch(() => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: 'Sorry, something went wrong. Please try again.',
              source: 'error',
              streaming: false,
            }
            return updated
          })
        })
      }
    } catch {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f4f5f7' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #8c30f5, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '17px', flexShrink: 0,
        }}>✨</div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Skincare AI</div>
          <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>by Clinikally</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Online</span>
        </div>
      </div>

      {/* Messages or Empty State */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '20px', paddingBottom: '8px' }}>
        {isEmpty ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 24px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '20px',
              background: 'linear-gradient(135deg, #8c30f5, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '30px', marginBottom: '20px',
              boxShadow: '0 8px 24px rgba(140,48,245,0.25)',
            }}>✨</div>
            <div style={{ fontSize: '22px', fontWeight: 600, color: '#111827', marginBottom: '8px', textAlign: 'center' }}>
              Your Skincare Assistant
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px', textAlign: 'center', maxWidth: '360px', lineHeight: '1.6' }}>
              Ask me about products, ingredients, routines, or any skin concerns. I'll find the best answers from Clinikally's catalog and expert blogs.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', maxWidth: '480px' }}>
              {SUGGESTED.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#374151',
                  cursor: 'pointer',
                  textAlign: 'left',
                  lineHeight: '1.4',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#8c30f5'
                  e.currentTarget.style.boxShadow = '0 0 0 3px #f3e8ff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && messages[messages.length - 1]?.content === '' && (
              <TypingIndicator />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #e5e7eb',
        background: '#ffffff',
        flexShrink: 0,
        boxShadow: '0 -1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          background: '#f4f5f7',
          border: '1.5px solid #e5e7eb',
          borderRadius: '14px',
          padding: '10px 10px 10px 16px',
          alignItems: 'center',
          transition: 'border-color 0.15s',
        }}
        onFocus={() => {}}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about products, ingredients, routines..."
            disabled={loading}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#1f2937',
              fontSize: '14px',
              fontWeight: 400,
              fontFamily: 'Inter, sans-serif',
              padding: '2px 0',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: '36px', height: '36px',
              borderRadius: '10px',
              background: loading || !input.trim() ? '#e5e7eb' : '#8c30f5',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              color: loading || !input.trim() ? '#9ca3af' : '#ffffff',
              fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            ↑
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#d1d5db', marginTop: '8px', fontWeight: 500 }}>
          Press Enter to send · Powered by Clinikally
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        input::placeholder { color: #9ca3af; }
      `}</style>
    </div>
  )
}