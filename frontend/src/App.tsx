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

interface Message {
  role: 'user' | 'assistant'
  content: string
  source?: Source
  tools_used?: string[]
  streaming?: boolean
}

const SOURCE_CONFIG: Record<Source, { label: string; color: string; bg: string }> = {
  products: { label: '🛍️ Product catalog', color: '#60a5fa', bg: '#0a1628' },
  blogs:    { label: '📖 Blog articles',   color: '#4ade80', bg: '#052010' },
  web:      { label: '🌐 Web search',      color: '#f59e0b', bg: '#1c0f00' },
  mixed:    { label: '🔀 Multiple sources', color: '#e879f9', bg: '#1a0520' },
  unknown:  { label: '💬 General',         color: '#94a3b8', bg: '#1e1e21' },
  error:    { label: '⚠️ Error',           color: '#f87171', bg: '#1a0505' },
}

function SourceBadge({ source }: { source: Source }) {
  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.unknown
  return (
    <span style={{
      fontSize: '11px',
      fontFamily: 'monospace',
      padding: '2px 8px',
      borderRadius: '4px',
      background: cfg.bg,
      color: cfg.color,
      border: `0.5px solid ${cfg.color}44`,
      display: 'inline-block',
      marginTop: '6px',
    }}>
      {cfg.label}
    </span>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
      padding: '0 16px',
    }}>
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? '#2563eb' : '#1e1e21',
          border: isUser ? 'none' : '0.5px solid #2a2a2e',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {msg.content}
          {msg.streaming && (
            <span style={{ display: 'inline-block', marginLeft: '4px' }}>
              <span style={{ animation: 'blink 1s infinite' }}>▋</span>
            </span>
          )}
        </div>
        {!isUser && msg.source && !msg.streaming && (
          <div style={{ marginTop: '4px' }}>
            <SourceBadge source={msg.source} />
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px', padding: '0 16px' }}>
      <div style={{
        padding: '12px 16px',
        borderRadius: '16px 16px 16px 4px',
        background: '#1e1e21',
        border: '0.5px solid #2a2a2e',
        display: 'flex', gap: '4px', alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#555', display: 'inline-block',
            animation: `bounce 1.2s infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your Clinikally skincare assistant. Ask me about products, ingredients, routines, or any skincare concerns.',
      source: 'unknown',
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef(getSessionId())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    // Add placeholder streaming message
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      streaming: true,
      source: 'unknown',
    }])

    try {
      const eventSource = new EventSource(
        `${API_URL}/chat/stream?message=${encodeURIComponent(text)}&session_id=${encodeURIComponent(sessionId.current)}`
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
        // Fallback to non-streaming
        axios.post(`${API_URL}/chat`, {
          message: text,
          session_id: sessionId.current,
        }).then(res => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: res.data.reply,
              source: res.data.source,
              tools_used: res.data.tools_used,
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f10' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '0.5px solid #2a2a2e',
        background: '#161618',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px',
        }}>✨</div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Skincare AI</div>
          <div style={{ fontSize: '11px', color: '#6b6b72', fontFamily: 'monospace' }}>by Clinikally</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '20px' }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && messages[messages.length - 1]?.content === '' && (
          <TypingIndicator />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px',
        borderTop: '0.5px solid #2a2a2e',
        background: '#161618',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          background: '#1e1e21',
          border: '0.5px solid #2a2a2e',
          borderRadius: '12px',
          padding: '8px 8px 8px 16px',
          alignItems: 'flex-end',
        }}>
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
              color: '#e8e8ea',
              fontSize: '14px',
              padding: '4px 0',
              resize: 'none',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              width: '36px', height: '36px',
              borderRadius: '8px',
              background: loading || !input.trim() ? '#2a2a2e' : '#2563eb',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#3a3a40', marginTop: '8px' }}>
          Press Enter to send
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}