import { useState, useRef, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Design tokens
const DESIGN = {
  colors: {
    primary: '#8c30f5',
    success: '#10b981',
    white: '#ffffff',
    bg: '#f9fafb',
    bgLight: '#f4f5f7',
    border: '#e5e7eb',
    text: {
      primary: '#1a1a2e',
      secondary: '#6b7280',
      tertiary: '#9ca3af',
      muted: '#d1d5db',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 12px rgba(0,0,0,0.08)',
    lg: '0 12px 24px rgba(0,0,0,0.12)',
    focus: '0 0 0 3px rgba(140,48,245,0.1)',
    button: '0 2px 8px rgba(140,48,245,0.25)',
  },
  radius: {
    sm: '6px',
    md: '12px',
    lg: '18px',
    full: '9999px',
  },
  fonts: {
    xs: '10px',
    sm: '12px',
    base: '13px',
    lg: '14px',
    xl: '15px',
    '2xl': '16px',
  },
  transitions: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}

// Inline SVG Icons
const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="7" cy="9" r="1" fill="currentColor" />
    <circle cx="13" cy="9" r="1" fill="currentColor" />
    <path d="M8 13 Q10 14 12 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 3v2M10 15v2M4 10H2M18 10h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 8L14 2L8.5 14L7 10L3 8.5L2 8Z" fill="currentColor" />
  </svg>
)

const ShoppingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M1 3h2l2 10h8l1.5-7H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7" cy="14" r="1" fill="currentColor" />
    <circle cx="13" cy="14" r="1" fill="currentColor" />
  </svg>
)

const BlogIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
    <line x1="4" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1" />
    <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1" />
    <line x1="4" y1="11" x2="10" y2="11" stroke="currentColor" strokeWidth="1" />
  </svg>
)

const WebIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
    <path d="M2 8h12M8 2a6 6 0 0 0 0 12" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const OnlineIndicator = () => (
  <div style={{
    width: '6px',
    height: '6px',
    background: DESIGN.colors.success,
    borderRadius: DESIGN.radius.full,
    display: 'inline-block',
  }} />
)

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

const SOURCE_INFO: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  products: { label: 'Product catalog', icon: <ShoppingIcon />, bg: '#fef3c7', color: '#d97706' },
  blogs: { label: 'Blog articles', icon: <BlogIcon />, bg: '#ecfdf5', color: '#059669' },
  web: { label: 'Web search', icon: <WebIcon />, bg: '#eff6ff', color: '#0284c7' },
  mixed: { label: 'Multiple sources', icon: <ShoppingIcon />, bg: '#f3e8ff', color: '#8c30f5' },
}

const SUGGESTIONS = [
  'Moisturiser for oily skin',
  'What does niacinamide do?',
  'Best sunscreen under ₹500',
]

function getTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// Responsive hook
function useWindowSize() {
  const [size, setSize] = useState<{ width: number; height: number }>({ width: typeof window !== 'undefined' ? window.innerWidth : 1024, height: typeof window !== 'undefined' ? window.innerHeight : 768 })
  
  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return size
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      content: 'Hi! I\'m your AI Dermat.\n\nI can help you find the right skincare products, explain ingredients, and answer any skin concerns. What\'s on your mind?',
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
  const windowSize = useWindowSize()

  const isMobile = windowSize.width < 640

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

  // Responsive sizing
  const buttonBottom = isMobile ? '20px' : '28px'
  const buttonLeft = isMobile ? '16px' : '28px'
  const windowBottom = isMobile ? '80px' : '100px'
  const windowWidth = isMobile ? 'calc(100vw - 32px)' : '380px'
  const windowHeight = isMobile ? 'calc(100vh - 120px)' : '620px'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        
        * { box-sizing: border-box; }
        
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(140, 48, 245, 0.4); }
          50% { box-shadow: 0 8px 32px rgba(140, 48, 245, 0.6); }
        }
        
        .widget-btn-pulse { animation: glow-pulse 3s ease-in-out infinite; }
        .widget-btn:hover { animation-play-state: paused; }
        
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        
        .pulse-dot::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: ${DESIGN.colors.success};
          opacity: 0.5;
          animation: pulse-ring 2s ease-out infinite;
        }
        
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        
        .typing-dot { animation: typing-bounce 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        .widget-window {
          transition: all ${DESIGN.transitions.slow};
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
        
        .widget-messages::-webkit-scrollbar { width: 2px; }
        .widget-messages::-webkit-scrollbar-track { background: transparent; }
        .widget-messages::-webkit-scrollbar-thumb { 
          background: ${DESIGN.colors.border}; 
          border-radius: 2px; 
        }
        .widget-messages::-webkit-scrollbar-thumb:hover { 
          background: ${DESIGN.colors.text.secondary}; 
        }
        
        .card-hover:hover { 
          box-shadow: 0 8px 20px rgba(0,0,0,0.12) !important;
          transform: translateY(-2px);
        }
        
        .chip-hover:hover { 
          background: ${DESIGN.colors.primary} !important;
          color: white !important;
          border-color: ${DESIGN.colors.primary} !important;
        }
        
        .input-focus:focus { 
          border-color: ${DESIGN.colors.primary} !important;
          box-shadow: ${DESIGN.shadows.focus} !important;
          background: white !important;
        }
        
        @media (max-width: 640px) {
          .widget-window {
            left: 16px !important;
            right: 16px !important;
            width: auto !important;
            bottom: 80px !important;
            height: calc(100vh - 120px) !important;
            border-radius: 16px !important;
          }
          
          .widget-btn {
            bottom: 20px !important;
            left: 16px !important;
          }
          
          .suggestion-area {
            flex-wrap: wrap;
          }
        }
      `}</style>

      {/* Floating button */}
      <div style={{
        position: 'fixed',
        bottom: buttonBottom,
        left: buttonLeft,
        zIndex: 998,
        transition: `all ${DESIGN.transitions.base}`,
      }}>
        <button
          className="widget-btn-pulse"
          onClick={() => setIsOpen(o => !o)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            background: DESIGN.colors.primary,
            color: DESIGN.colors.white,
            border: 'none',
            borderRadius: DESIGN.radius.sm,
            padding: `${DESIGN.spacing.sm} ${DESIGN.spacing.md}`,
            cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: DESIGN.shadows.button,
            position: 'relative',
            transition: `all ${DESIGN.transitions.base}`,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(140,48,245,0.35)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = DESIGN.shadows.button
          }}
        >
          <div className="pulse-dot" style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '10px',
            height: '10px',
            background: DESIGN.colors.success,
            borderRadius: DESIGN.radius.full,
            border: `2px solid ${DESIGN.colors.white}`,
          }} />
          <div style={{
            width: '28px',
            height: '28px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: DESIGN.radius.sm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: DESIGN.colors.white,
            flexShrink: 0,
          }}>
            <BotIcon />
          </div>
          <div style={{ textAlign: 'center', lineHeight: '1.1', fontSize: '10px' }}>
            <div style={{ fontWeight: 600 }}>AI Dermat</div>
            <div style={{ opacity: 0.8, fontWeight: 400, fontSize: '9px' }}>Chat now</div>
          </div>
        </button>
      </div>

      {/* Chat window */}
      <div
        className={`widget-window ${isOpen ? 'open' : 'closed'}`}
        style={{
          position: 'fixed',
          bottom: windowBottom,
          left: buttonLeft,
          width: windowWidth,
          height: windowHeight,
          maxWidth: 'calc(100vw - 32px)',
          background: DESIGN.colors.white,
          borderRadius: DESIGN.radius.lg,
          boxShadow: DESIGN.shadows.lg,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 999,
          border: `1px solid ${DESIGN.colors.border}`,
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: `${DESIGN.spacing.lg} ${DESIGN.spacing.lg}`,
          background: DESIGN.colors.primary,
          display: 'flex',
          alignItems: 'center',
          gap: DESIGN.spacing.md,
          flexShrink: 0,
          borderBottom: `1px solid rgba(140,48,245,0.2)`,
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: DESIGN.radius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: DESIGN.colors.white,
            flexShrink: 0,
          }}>
            <BotIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: DESIGN.fonts.lg,
              fontWeight: 600,
              color: DESIGN.colors.white,
            }}>
              Your AI Dermat
            </div>
            <div style={{
              fontSize: DESIGN.fonts.sm,
              color: 'rgba(255,255,255,0.75)',
              display: 'flex',
              alignItems: 'center',
              gap: DESIGN.spacing.xs,
              marginTop: '2px',
            }}>
              <OnlineIndicator />
              <span>Online</span>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: DESIGN.radius.sm,
              color: DESIGN.colors.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: `all ${DESIGN.transitions.fast}`,
              padding: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'
            }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Messages */}
        <div className="widget-messages" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: DESIGN.spacing.lg,
          background: DESIGN.colors.bg,
          display: 'flex',
          flexDirection: 'column',
          gap: DESIGN.spacing.lg,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: DESIGN.spacing.xs }}>
              {/* Message bubble */}
              <div style={{
                display: 'flex',
                gap: DESIGN.spacing.md,
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
              }}>
                {msg.role === 'bot' && (
                  <div style={{
                    width: '28px',
                    height: '28px',
                    background: DESIGN.colors.primary,
                    borderRadius: DESIGN.radius.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: DESIGN.fonts.lg,
                    flexShrink: 0,
                    color: DESIGN.colors.white,
                  }}>
                    <BotIcon />
                  </div>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: `${DESIGN.spacing.md} ${DESIGN.spacing.lg}`,
                  borderRadius: msg.role === 'user'
                    ? `${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.sm} ${DESIGN.radius.md}`
                    : `${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.sm}`,
                  background: msg.role === 'user' ? DESIGN.colors.primary : DESIGN.colors.white,
                  color: msg.role === 'user' ? DESIGN.colors.white : DESIGN.colors.text.primary,
                  fontSize: DESIGN.fonts.base,
                  lineHeight: 1.5,
                  boxShadow: msg.role === 'user' ? DESIGN.shadows.button : DESIGN.shadows.sm,
                  border: msg.role === 'bot' ? `1px solid ${DESIGN.colors.border}` : 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content.split('\n').map((line, li) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                      <div key={li} style={{ marginBottom: line === '' ? DESIGN.spacing.sm : '0' }}>
                        {parts.map((part, pi) =>
                          pi % 2 === 1
                            ? <strong key={pi} style={{ fontWeight: 600 }}>{part}</strong>
                            : part
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Source badge */}
              {msg.role === 'bot' && msg.source && SOURCE_INFO[msg.source] && (
                <div style={{ paddingLeft: '36px', display: 'flex', gap: DESIGN.spacing.xs, alignItems: 'center' }}>
                  <div style={{
                    fontSize: DESIGN.fonts.xs,
                    fontWeight: 500,
                    padding: `${DESIGN.spacing.xs} ${DESIGN.spacing.md}`,
                    borderRadius: DESIGN.radius.full,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: DESIGN.spacing.xs,
                    background: SOURCE_INFO[msg.source].bg,
                    color: SOURCE_INFO[msg.source].color,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', width: '12px', height: '12px' }}>
                      {SOURCE_INFO[msg.source].icon}
                    </span>
                    {SOURCE_INFO[msg.source].label}
                  </div>
                </div>
              )}

             {/* Product cards */}
{msg.role === 'bot' && msg.products && msg.products.length > 0 && (
  <div style={{
    paddingLeft: '36px',
    display: 'flex',
    flexDirection: 'column',
    gap: DESIGN.spacing.md,
  }}>
    {msg.products
      .slice(0, 3)
      .map((p, pi) => (
        <div
          key={pi}
          className="card-hover"
          onClick={() => p.url && window.open(p.url, '_blank')}
          style={{
            background: DESIGN.colors.white,
            border: `1px solid ${DESIGN.colors.border}`,
            borderRadius: DESIGN.radius.md,
            padding: DESIGN.spacing.md,
            cursor: 'pointer',
            transition: `all ${DESIGN.transitions.base}`,
            boxShadow: DESIGN.shadows.sm,
          }}
        >
          {/* Product image + details */}
          <div style={{
            display: 'flex',
            gap: DESIGN.spacing.md,
            alignItems: 'flex-start',
          }}>
            {p.image && (
              <img
                src={p.image}
                alt={p.name}
                style={{
                  width: '56px',
                  height: '56px',
                  objectFit: 'contain',
                  borderRadius: DESIGN.radius.sm,
                  background: DESIGN.colors.bg,
                  border: `1px solid ${DESIGN.colors.border}`,
                  flexShrink: 0,
                  padding: DESIGN.spacing.xs,
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: DESIGN.fonts.sm,
                fontWeight: 600,
                color: DESIGN.colors.text.primary,
                lineHeight: 1.4,
                marginBottom: DESIGN.spacing.xs,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {p.name}
              </div>
              <div style={{
                fontSize: DESIGN.fonts.lg,
                color: DESIGN.colors.primary,
                fontWeight: 700,
              }}>
                ₹{p.price}
              </div>
            </div>
          </div>

          {/* View link */}
          {p.url && (
            <div style={{
              marginTop: DESIGN.spacing.md,
              paddingTop: DESIGN.spacing.md,
              borderTop: `1px solid ${DESIGN.colors.border}`,
              fontSize: DESIGN.fonts.sm,
              fontWeight: 500,
              color: DESIGN.colors.primary,
              display: 'flex',
              alignItems: 'center',
              gap: DESIGN.spacing.xs,
              transition: `opacity ${DESIGN.transitions.fast}`,
            }}>
              View Product
              <span>→</span>
            </div>
          )}
        </div>
      ))}
  </div>
)}

              {/* Timestamp */}
              <div style={{
                fontSize: DESIGN.fonts.xs,
                color: DESIGN.colors.text.tertiary,
                textAlign: msg.role === 'user' ? 'right' : 'left',
                paddingLeft: msg.role === 'bot' ? '36px' : '0',
              }}>
                {msg.time}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div style={{ display: 'flex', gap: DESIGN.spacing.md, alignItems: 'flex-end' }}>
              <div style={{
                width: '28px',
                height: '28px',
                background: DESIGN.colors.primary,
                borderRadius: DESIGN.radius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: DESIGN.fonts.lg,
                flexShrink: 0,
                color: DESIGN.colors.white,
              }}>
                <BotIcon />
              </div>
              <div style={{
                maxWidth: '75%',
                padding: `${DESIGN.spacing.md} ${DESIGN.spacing.lg}`,
                borderRadius: `${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.sm}`,
                background: DESIGN.colors.white,
                color: DESIGN.colors.text.primary,
                fontSize: DESIGN.fonts.base,
                lineHeight: 1.5,
                boxShadow: DESIGN.shadows.sm,
                border: `1px solid ${DESIGN.colors.border}`,
                whiteSpace: 'pre-wrap',
              }}>
                {streamingContent || (
                  <span style={{ display: 'flex', gap: DESIGN.spacing.xs, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className="typing-dot"
                        style={{
                          width: '6px',
                          height: '6px',
                          background: DESIGN.colors.primary,
                          borderRadius: DESIGN.radius.full,
                          display: 'inline-block',
                          opacity: 0.4,
                        }}
                      />
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
          <div className="suggestion-area" style={{
            padding: `${DESIGN.spacing.md} ${DESIGN.spacing.lg} ${DESIGN.spacing.lg}`,
            background: DESIGN.colors.bg,
            display: 'flex',
            gap: DESIGN.spacing.sm,
            flexWrap: 'wrap',
            borderTop: `1px solid ${DESIGN.colors.border}`,
          }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="chip-hover"
                onClick={() => sendMessage(s)}
                style={{
                  fontSize: DESIGN.fonts.sm,
                  padding: `${DESIGN.spacing.xs} ${DESIGN.spacing.md}`,
                  borderRadius: DESIGN.radius.full,
                  background: DESIGN.colors.white,
                  border: `1px solid ${DESIGN.colors.border}`,
                  color: DESIGN.colors.primary,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 500,
                  transition: `all ${DESIGN.transitions.fast}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div style={{
          padding: DESIGN.spacing.md,
          borderTop: `1px solid ${DESIGN.colors.border}`,
          background: DESIGN.colors.white,
          display: 'flex',
          gap: DESIGN.spacing.sm,
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <input
            className="input-focus"
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask anything..."
            disabled={loading}
            style={{
              flex: 1,
              border: `1.5px solid ${DESIGN.colors.border}`,
              borderRadius: DESIGN.radius.sm,
              padding: `${DESIGN.spacing.sm} ${DESIGN.spacing.md}`,
              fontSize: DESIGN.fonts.base,
              fontFamily: 'DM Sans, sans-serif',
              color: DESIGN.colors.text.primary,
              background: DESIGN.colors.white,
              outline: 'none',
              transition: `all ${DESIGN.transitions.fast}`,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              width: '36px',
              height: '36px',
              background: loading || !input.trim() ? DESIGN.colors.border : DESIGN.colors.primary,
              border: 'none',
              borderRadius: DESIGN.radius.sm,
              color: loading || !input.trim() ? DESIGN.colors.text.tertiary : DESIGN.colors.white,
              fontSize: DESIGN.fonts.base,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: `all ${DESIGN.transitions.fast}`,
            }}
            onMouseEnter={e => {
              if (!loading && input.trim()) {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </>
  )
}