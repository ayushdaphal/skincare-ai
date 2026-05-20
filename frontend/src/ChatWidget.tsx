import { useState, useRef, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getSessionId() {
  let id = sessionStorage.getItem('widget_session_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('widget_session_id', id)
  }
  return id
}

interface Product {
  name?: string
  price?: number
  url?: string
  description?: string
  ingredients?: string
  image?: string
}

interface Message {
  role: 'user' | 'bot'
  content: string
  source?: string
  products?: Product[]
  time: string
}

const SOURCE_LABELS: Record<string, string> = {
  products: '🛍️ Product catalog',
  blogs: '📖 Blog articles',
  web: '🌐 Web search',
  mixed: '🔀 Multiple sources',
}

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  products: { bg: '#f3e8ff', color: '#8c30f5' },
  blogs:    { bg: '#ecfdf5', color: '#059669' },
  web:      { bg: '#fffbeb', color: '#d97706' },
  mixed:    { bg: '#f3e8ff', color: '#8c30f5' },
}

const SUGGESTIONS = [
  'Moisturiser for oily skin',
  'What does niacinamide do?',
  'Best sunscreen under ₹500',
]

function getTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      content: "Hi! I'm your AI Dermat 👋\n\nI can help you find the right skincare products, explain ingredients, and answer any skin concerns. What's on your mind?",
      time: getTime(),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionId = useRef(getSessionId())

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    setInput('')
    setLoading(true)
    setIsStreaming(true)
    setShowSuggestions(false)
    setStreamingContent('')

    setMessages(prev => [...prev, { role: 'user', content: msg, time: getTime() }])

    try {
      const evtSource = new EventSource(
        `${API_URL}/chat/stream?message=${encodeURIComponent(msg)}&session_id=${encodeURIComponent(sessionId.current)}`
      )

      let fullContent = ''

      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data)

        if (data.done) {
          evtSource.close()
          setIsStreaming(false)
          setStreamingContent('')
          setLoading(false)
          setMessages(prev => [...prev, {
            role: 'bot',
            content: fullContent,
            source: data.source,
            products: data.products || [],
            time: getTime(),
          }])
        } else if (data.token) {
          fullContent += data.token
          setStreamingContent(fullContent)
        }
      }

      evtSource.onerror = () => {
        evtSource.close()
        setIsStreaming(false)
        setStreamingContent('')

        fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, session_id: sessionId.current })
        })
        .then(r => r.json())
        .then(data => {
          setLoading(false)
          setMessages(prev => [...prev, {
            role: 'bot',
            content: data.reply,
            source: data.source,
            products: data.products || [],
            time: getTime(),
          }])
        })
        .catch(() => {
          setLoading(false)
          setMessages(prev => [...prev, {
            role: 'bot',
            content: 'Sorry, something went wrong. Please try again.',
            time: getTime(),
          }])
        })
      }
    } catch {
      setLoading(false)
      setIsStreaming(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

        .widget-btn {
          animation: widget-shake 15s ease-in-out infinite;
        }
        .widget-btn:hover {
          animation-play-state: paused;
        }
        @keyframes widget-shake {
          0%, 88%, 100% { transform: rotate(0deg) translateY(0); }
          90% { transform: rotate(-4deg) translateY(-2px); }
          92% { transform: rotate(4deg) translateY(-2px); }
          94% { transform: rotate(-3deg) translateY(-1px); }
          96% { transform: rotate(3deg) translateY(-1px); }
          98% { transform: rotate(-1deg) translateY(0); }
        }
        .pulse-dot::after {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: #10b981;
          opacity: 0.4;
          animation: pulse-ring 2s ease-out infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .typing-dot { animation: typing-bounce 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        .widget-window {
          transition: transform .3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity .25s ease;
          transform-origin: bottom left;
        }
        .widget-window.open {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
        .widget-window.closed {
          transform: scale(0.85) translateY(20px);
          opacity: 0;
          pointer-events: none;
        }
        .widget-messages::-webkit-scrollbar { width: 3px; }
        .widget-messages::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
        .mini-card:hover { border-color: #8c30f5 !important; }
        .suggestion-chip:hover { background: #f3e8ff !important; border-color: #8c30f5 !important; }
      `}</style>

      {/* Floating button */}
      <div style={{ position: 'fixed', bottom: '28px', left: '28px', zIndex: 1000 }}>
        <button
          className="widget-btn"
          onClick={() => setIsOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#8c30f5', color: 'white', border: 'none',
            borderRadius: '50px', padding: '14px 20px', cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600,
            boxShadow: '0 8px 32px rgba(140,48,245,0.4)',
            position: 'relative',
          }}
        >
          {/* Pulse dot */}
          <div className="pulse-dot" style={{
            position: 'absolute', top: '-3px', right: '-3px',
            width: '12px', height: '12px', background: '#10b981',
            borderRadius: '50%', border: '2px solid white',
          }} />
          <div style={{
            width: '34px', height: '34px', background: 'rgba(255,255,255,0.2)',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px', flexShrink: 0,
          }}>✨</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.2 }}>Your AI Dermat</div>
            <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 400 }}>Ask me anything about skin</div>
          </div>
        </button>
      </div>

      {/* Chat window */}
      <div
        className={`widget-window ${isOpen ? 'open' : 'closed'}`}
        style={{
          position: 'fixed', bottom: '100px', left: '28px',
          width: '380px', height: '620px',
          background: '#ffffff', borderRadius: '20px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(140,48,245,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          zIndex: 999, border: '1px solid rgba(140,48,245,0.15)',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px', background: '#8c30f5',
          display: 'flex', alignItems: 'center', gap: '12px',
          flexShrink: 0,
        }}>
          <div style={{
            width: '38px', height: '38px', background: 'rgba(255,255,255,0.2)',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px',
            border: '2px solid rgba(255,255,255,0.3)',
          }}>✨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'white' }}>Your AI Dermat</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <div style={{ width: '6px', height: '6px', background: '#4ade80', borderRadius: '50%' }} />
              Online · by Clinikally
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} style={{
            width: '30px', height: '30px', background: 'rgba(255,255,255,0.15)',
            border: 'none', borderRadius: '50%', color: 'white', fontSize: '14px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Messages */}
        <div className="widget-messages" style={{
          flex: 1, overflowY: 'auto', padding: '14px',
          background: '#f9fafb', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {messages.map((msg, i) => (
            <div key={i}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'bot' && (
                  <div style={{
                    width: '28px', height: '28px', background: '#f3e8ff',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '14px', flexShrink: 0, alignSelf: 'flex-end',
                  }}>✨</div>
                )}
                <div style={{
                  maxWidth: '78%', padding: '10px 13px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? '#8c30f5' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1a1a2e',
                  fontSize: '13px', lineHeight: '1.6',
                  boxShadow: msg.role === 'user' ? '0 2px 8px rgba(140,48,245,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
                  border: msg.role === 'bot' ? '1px solid #e5e7eb' : 'none',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>

              {/* Source badge */}
              {msg.role === 'bot' && msg.source && SOURCE_LABELS[msg.source] && (
                <div style={{ paddingLeft: '36px', marginTop: '4px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 500, padding: '2px 8px',
                    borderRadius: '20px', display: 'inline-block',
                    background: SOURCE_COLORS[msg.source]?.bg || '#f3f4f6',
                    color: SOURCE_COLORS[msg.source]?.color || '#6b7280',
                  }}>
                    {SOURCE_LABELS[msg.source]}
                  </span>
                </div>
              )}

              {/* Mini product cards */}
              {msg.role === 'bot' && msg.products && msg.products.length > 0 && (
                <div style={{ paddingLeft: '36px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {msg.products
                    .filter(p => {
                      if (!p.name) return false
                      const words = p.name.toLowerCase().split(' ').filter(w => w.length > 3)
                      return words.some(w => msg.content.toLowerCase().includes(w))
                    })
                    .slice(0, 3)
                    .map((p, pi) => (
                      <div key={pi} className="mini-card" style={{
                        background: 'white', border: '1px solid #e5e7eb',
                        borderRadius: '10px', padding: '8px 10px', cursor: 'pointer',
                        transition: 'border-color .15s',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }} onClick={() => p.url && window.open(p.url, '_blank')}>
                        {p.image && (
                          <img src={p.image} alt={p.name} style={{
                            width: '36px', height: '36px', objectFit: 'contain',
                            borderRadius: '6px', background: '#f9fafb',
                            border: '1px solid #f3f4f6', flexShrink: 0,
                          }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: '#8c30f5', fontWeight: 600, marginTop: '1px' }}>₹{p.price}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#8c30f5', flexShrink: 0 }}>→</div>
                      </div>
                    ))}
                </div>
              )}

              <div style={{
                fontSize: '10px', color: '#9ca3af', marginTop: '4px',
                textAlign: msg.role === 'user' ? 'right' : 'left',
                paddingLeft: msg.role === 'bot' ? '36px' : '0',
              }}>{msg.time}</div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', background: '#f3e8ff',
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '14px', flexShrink: 0, alignSelf: 'flex-end',
              }}>✨</div>
              <div style={{
                maxWidth: '78%', padding: '10px 13px',
                borderRadius: '16px 16px 16px 4px',
                background: 'white', color: '#1a1a2e', fontSize: '13px',
                lineHeight: '1.6', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap',
              }}>
                {streamingContent || (
                  <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <span key={i} className={`typing-dot`} style={{
                        width: '6px', height: '6px', background: '#8c30f5',
                        borderRadius: '50%', display: 'inline-block', opacity: 0.4,
                        animationDelay: `${i * 0.2}s`,
                      }} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {showSuggestions && (
          <div style={{
            padding: '8px 14px 10px', background: '#f9fafb',
            display: 'flex', gap: '6px', flexWrap: 'wrap',
            borderTop: '1px solid #f3f4f6',
          }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)} style={{
                fontSize: '12px', padding: '5px 11px', borderRadius: '20px',
                background: 'white', border: '1px solid #e5e7eb', color: '#8c30f5',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                transition: 'all .15s',
              }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: '12px 14px', borderTop: '1px solid #e5e7eb',
          background: 'white', display: 'flex', gap: '8px', alignItems: 'center',
          flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about skin, products, ingredients..."
            disabled={loading}
            style={{
              flex: 1, border: '1.5px solid #e5e7eb', borderRadius: '10px',
              padding: '9px 13px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              color: '#1a1a2e', background: '#f9fafb', outline: 'none',
            }}
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{
            width: '36px', height: '36px',
            background: loading || !input.trim() ? '#e5e7eb' : '#8c30f5',
            border: 'none', borderRadius: '10px',
            color: loading || !input.trim() ? '#9ca3af' : 'white',
            fontSize: '16px', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>↑</button>
        </div>
      </div>
    </>
  )
}