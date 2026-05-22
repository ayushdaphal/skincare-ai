import { useState, useRef, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
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
  },
  transitions: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
}

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

const ResetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

const OnlineIndicator = () => (
  <div style={{ width: '6px', height: '6px', background: DESIGN.colors.success, borderRadius: DESIGN.radius.full, display: 'inline-block' }} />
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

function useWindowSize() {
  const [size, setSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 1024, height: typeof window !== 'undefined' ? window.innerHeight : 768 })
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return size
}

interface ChatWidgetProps {
  onToggleStateChange?: (isOpen: boolean) => void;
}

export default function ChatWidget({ onToggleStateChange }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Hi! I\'m your AI Dermat.\n\nI can help you find the right skincare products, explain ingredients, and answer any skin concerns. What\'s on your mind?', time: getTime() }
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

  const clearSessionOnBackend = async () => {
    if (loading) return
    setLoading(true)
    try {
      await fetch(`${API_URL}/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId.current })
      })

      setMessages([
        { role: 'bot', content: 'Hi! I\'m your AI Dermat.\n\nI can help you find the right skincare products, explain ingredients, and answer any skin concerns. What\'s on your mind?', time: getTime() }
      ])
      setInput('')
      setStreamingContent('')
      setIsStreaming(false)
      setShowSuggestions(true)
    } catch (error) {
      console.error('Failed to clear backend session:', error)
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

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
      const response = await fetch(
        `${API_URL}/chat/stream?message=${encodeURIComponent(msg)}&session_id=${encodeURIComponent(sessionId.current)}`
      )

      if (!response.ok) throw new Error('Stream request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''
      const tokenQueue: Array<{token?: string; done?: boolean; source?: string; products?: any; error?: boolean; message?: string}> = []

      // Read all data first
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i]
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6)
            try {
              const data = JSON.parse(jsonStr)
              tokenQueue.push(data)
            } catch (e) {
              console.warn('[PARSE ERROR]', e, jsonStr)
            }
          }
        }
        buffer = lines[lines.length - 1]
      }

      // Process remaining buffer
      if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.slice(6)
        try {
          const data = JSON.parse(jsonStr)
          tokenQueue.push(data)
        } catch (e) {
          console.warn('[PARSE ERROR]', e, buffer)
        }
      }

      // Process tokens with delay for smooth animation
      let finalMetadata = { source: '', products: [] }
      let unrecoverableErrorDetected = false
      let customServerErrorMessage = ''

      for (const item of tokenQueue) {
        if (item.error) {
          unrecoverableErrorDetected = true
          customServerErrorMessage = item.message || 'We encountered an engine anomaly.'
          break
        }

        if (item.token) {
          fullContent += item.token
          setStreamingContent(fullContent)
          await new Promise(resolve => setTimeout(resolve, 60))
        } else if (item.done) {
          finalMetadata = {
            source: item.source,
            products: item.products || []
          }
        }
      }

      if (unrecoverableErrorDetected) {
        setIsStreaming(false)
        setStreamingContent('')
        setLoading(false)
        setMessages(prev => [...prev, {
          role: 'bot',
          content: `⚠️ **System Update:** ${customServerErrorMessage}`,
          source: 'web',
          products: [],
          time: getTime(),
        }])
        return
      }

      setIsStreaming(false)
      setStreamingContent('')
      setLoading(false)
      setMessages(prev => [...prev, {
        role: 'bot',
        content: fullContent,
        source: finalMetadata.source,
        products: finalMetadata.products,
        time: getTime(),
      }])
    } catch (error) {
      console.error('[STREAM ERROR]', error)
      setIsStreaming(false)
      setStreamingContent('')
      setLoading(false)
      setMessages(prev => [...prev, {
        role: 'bot',
        content: 'Sorry, something went wrong with the stream. Please try again.',
        time: getTime(),
      }])
    }
  }

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
        .widget-window { transition: all ${DESIGN.transitions.slow}; transform-origin: bottom left; }
        .widget-window.open { transform: scale(1) translateY(0); opacity: 1; }
        .widget-window.closed { transform: scale(0.85) translateY(20px); opacity: 0; pointer-events: none; }
        .widget-messages::-webkit-scrollbar { width: 2px; }
        .widget-messages::-webkit-scrollbar-track { background: transparent; }
        .widget-messages::-webkit-scrollbar-thumb { background: ${DESIGN.colors.border}; border-radius: 2px; }
        .card-hover:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.12) !important; transform: translateY(-2px); }
        .chip-hover:hover { background: ${DESIGN.colors.primary} !important; color: white !important; border-color: ${DESIGN.colors.primary} !important; }
        .input-focus:focus { border-color: ${DESIGN.colors.primary} !important; box-shadow: ${DESIGN.shadows.focus} !important; background: white !important; }
        @keyframes typing-dots {
          0%, 60%, 100% { opacity: 0.5; }
          30% { opacity: 1; }
        }
        .typing-dot:nth-child(1) { animation: typing-dots 1.4s ease-in-out infinite; }
        .typing-dot:nth-child(2) { animation: typing-dots 1.4s ease-in-out 0.2s infinite; }
        .typing-dot:nth-child(3) { animation: typing-dots 1.4s ease-in-out 0.4s infinite; }
        @keyframes pulse-spinner {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .pulse-loader { animation: pulse-spinner 1.5s ease-in-out infinite; }
      `}</style>

      {/* Floating activation button */}
      <div style={{ position: 'fixed', bottom: buttonBottom, left: buttonLeft, zIndex: 998 }}>
        <button
          className="widget-btn-pulse"
          onClick={() => {
            const nextState = !isOpen;
            setIsOpen(nextState);
            if (onToggleStateChange) onToggleStateChange(nextState);
          }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: DESIGN.colors.primary, color: DESIGN.colors.white, border: 'none', borderRadius: DESIGN.radius.sm, padding: `${DESIGN.spacing.sm} ${DESIGN.spacing.md}`, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 600, boxShadow: DESIGN.shadows.button, position: 'relative', transition: `all ${DESIGN.transitions.base}`
          }}
        >
          <div className="pulse-dot" style={{ position: 'absolute', top: '-8px', right: '-8px', width: '10px', height: '10px', background: DESIGN.colors.success, borderRadius: DESIGN.radius.full, border: `2px solid ${DESIGN.colors.white}` }} />
          <div style={{ width: '28px', height: '28px', background: 'rgba(255,255,255,0.2)', borderRadius: DESIGN.radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DESIGN.colors.white, flexShrink: 0 }}><BotIcon /></div>
          <div style={{ textAlign: 'center', lineHeight: '1.1', fontSize: '10px' }}>
            <div style={{ fontWeight: 600 }}>AI Dermat</div>
            <div style={{ opacity: 0.8, fontWeight: 400, fontSize: '9px' }}>Chat now</div>
          </div>
        </button>
      </div>

      {/* Primary chat dialog pane */}
      <div
        className={`widget-window ${isOpen ? 'open' : 'closed'}`}
        style={{
          position: 'fixed', bottom: windowBottom, left: buttonLeft, width: windowWidth, height: windowHeight, maxWidth: 'calc(100vw - 32px)', background: DESIGN.colors.white, borderRadius: DESIGN.radius.lg, boxShadow: DESIGN.shadows.lg, display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 999, border: `1px solid ${DESIGN.colors.border}`, fontFamily: 'DM Sans, sans-serif'
        }}
      >
        {/* Header Component Layout */}
        <div style={{ padding: `${DESIGN.spacing.lg} ${DESIGN.spacing.lg}`, background: DESIGN.colors.primary, display: 'flex', alignItems: 'center', gap: DESIGN.spacing.md, flexShrink: 0, borderBottom: `1px solid rgba(140,48,245,0.2)` }}>
          <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.15)', borderRadius: DESIGN.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', color: DESIGN.colors.white, flexShrink: 0 }}><BotIcon /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: DESIGN.fonts.lg, fontWeight: 600, color: DESIGN.colors.white }}>Your AI Dermat</div>
            <div style={{ fontSize: DESIGN.fonts.sm, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: DESIGN.spacing.xs, marginTop: '2px' }}><OnlineIndicator /><span>Online</span></div>
          </div>
          
          <div style={{ display: 'flex', gap: DESIGN.spacing.sm, alignItems: 'center' }}>
            <button 
              onClick={clearSessionOnBackend} 
              title="Reset Conversation"
              disabled={loading}
              style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: DESIGN.radius.sm, color: DESIGN.colors.white, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: `all ${DESIGN.transitions.fast}` }}
            >
              <ResetIcon />
            </button>
            <button onClick={() => { setIsOpen(false); if(onToggleStateChange) onToggleStateChange(false); }} style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: DESIGN.radius.sm, color: DESIGN.colors.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><CloseIcon /></button>
          </div>
        </div>

        {/* Message Thread Area */}
        <div className="widget-messages" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: DESIGN.spacing.lg, background: DESIGN.colors.bg, display: 'flex', flexDirection: 'column', gap: DESIGN.spacing.lg }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: DESIGN.spacing.xs }}>
              <div style={{ display: 'flex', gap: DESIGN.spacing.md, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                {msg.role === 'bot' && (
                  <div style={{ width: '28px', height: '28px', background: DESIGN.colors.primary, borderRadius: DESIGN.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: DESIGN.fonts.lg, flexShrink: 0, color: DESIGN.colors.white }}><BotIcon /></div>
                )}
                <div style={{ maxWidth: '75%', padding: `${DESIGN.spacing.md} ${DESIGN.spacing.lg}`, borderRadius: msg.role === 'user' ? `${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.sm} ${DESIGN.radius.md}` : `${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.sm}`, background: msg.role === 'user' ? DESIGN.colors.primary : DESIGN.colors.white, color: msg.role === 'user' ? DESIGN.colors.white : DESIGN.colors.text.primary, fontSize: DESIGN.fonts.base, lineHeight: 1.5, boxShadow: msg.role === 'user' ? DESIGN.shadows.button : DESIGN.shadows.sm, border: msg.role === 'bot' ? `1px solid ${DESIGN.colors.border}` : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content.split('\n').map((line, li) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                      <div key={li} style={{ marginBottom: line === '' ? DESIGN.spacing.sm : '0' }}>
                        {parts.map((part, pi) => pi % 2 === 1 ? <strong key={pi} style={{ fontWeight: 600 }}>{part}</strong> : part)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Sourced Attribution Label Chips */}
              {msg.role === 'bot' && msg.source && SOURCE_INFO[msg.source] && (
                <div style={{ paddingLeft: '36px', display: 'flex', gap: DESIGN.spacing.xs, alignItems: 'center' }}>
                  <div style={{ fontSize: DESIGN.fonts.xs, fontWeight: 500, padding: `${DESIGN.spacing.xs} ${DESIGN.spacing.md}`, borderRadius: DESIGN.radius.full, display: 'inline-flex', alignItems: 'center', gap: DESIGN.spacing.xs, background: SOURCE_INFO[msg.source].bg, color: SOURCE_INFO[msg.source].color }}><span style={{ display: 'flex', alignItems: 'center', width: '12px', height: '12px' }}>{SOURCE_INFO[msg.source].icon}</span>{SOURCE_INFO[msg.source].label}</div>
                </div>
              )}

              {/* Structured Catalog Grid Items */}
              {msg.role === 'bot' && msg.products && msg.products.length > 0 && (
                <div style={{ paddingLeft: '36px', display: 'flex', flexDirection: 'column', gap: DESIGN.spacing.md }}>
                  {msg.products.slice(0, 3).map((p, pi) => (
                    <div key={pi} className="card-hover" onClick={() => p.url && window.open(p.url, '_blank')} style={{ background: DESIGN.colors.white, border: `1px solid ${DESIGN.colors.border}`, borderRadius: DESIGN.radius.md, padding: DESIGN.spacing.md, cursor: 'pointer', transition: `all ${DESIGN.transitions.base}`, boxShadow: DESIGN.shadows.sm }}>
                      <div style={{ display: 'flex', gap: DESIGN.spacing.md, alignItems: 'flex-start' }}>
                        {p.image && <img src={p.image} alt={p.name} style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: DESIGN.radius.sm, background: DESIGN.colors.bg, border: `1px solid ${DESIGN.colors.border}`, flexShrink: 0, padding: DESIGN.spacing.xs }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: DESIGN.fonts.sm, fontWeight: 600, color: DESIGN.colors.text.primary, lineHeight: 1.4, marginBottom: DESIGN.spacing.xs, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</div>
                          <div style={{ fontSize: DESIGN.fonts.lg, color: DESIGN.colors.primary, fontWeight: 700 }}>₹{p.price}</div>
                        </div>
                      </div>
                      {p.url && <div style={{ marginTop: DESIGN.spacing.md, paddingTop: DESIGN.spacing.md, borderTop: `1px solid ${DESIGN.colors.border}`, fontSize: DESIGN.fonts.sm, fontWeight: 500, color: DESIGN.colors.primary, display: 'flex', alignItems: 'center', gap: DESIGN.spacing.xs, transition: `opacity ${DESIGN.transitions.fast}` }}>View Product <span>→</span></div>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: DESIGN.fonts.xs, color: DESIGN.colors.text.tertiary, textAlign: msg.role === 'user' ? 'right' : 'left', paddingLeft: msg.role === 'bot' ? '36px' : '0' }}>{msg.time}</div>
            </div>
          ))}

          {/* Token Generation Content Stream Canvas with Loader */}
          {isStreaming && (
            <div style={{ display: 'flex', gap: DESIGN.spacing.md, alignItems: 'flex-end' }}>
              <div style={{ width: '28px', height: '28px', background: DESIGN.colors.primary, borderRadius: DESIGN.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: DESIGN.fonts.lg, flexShrink: 0, color: DESIGN.colors.white }}><BotIcon /></div>
              <div style={{ maxWidth: '75%', padding: `${DESIGN.spacing.md} ${DESIGN.spacing.lg}`, borderRadius: `${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.md} ${DESIGN.radius.sm}`, background: DESIGN.colors.white, color: DESIGN.colors.text.primary, fontSize: DESIGN.fonts.base, lineHeight: 1.5, boxShadow: DESIGN.shadows.sm, border: `1px solid ${DESIGN.colors.border}`, whiteSpace: 'pre-wrap', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                {streamingContent ? (
                  streamingContent.split('\n').map((line, li) => {
                    const parts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                      <div key={li} style={{ marginBottom: line === '' ? DESIGN.spacing.sm : '0' }}>
                        {parts.map((part, pi) => pi % 2 === 1 ? <strong key={pi} style={{ fontWeight: 600 }}>{part}</strong> : part)}
                      </div>
                    )
                  })
                ) : (
                  <div className="pulse-loader" style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <span className="typing-dot" style={{ width: '8px', height: '8px', background: DESIGN.colors.primary, borderRadius: '50%', display: 'inline-block' }} />
                    <span className="typing-dot" style={{ width: '8px', height: '8px', background: DESIGN.colors.primary, borderRadius: '50%', display: 'inline-block' }} />
                    <span className="typing-dot" style={{ width: '8px', height: '8px', background: DESIGN.colors.primary, borderRadius: '50%', display: 'inline-block' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestion Chips Box */}
        {showSuggestions && (
          <div style={{ padding: `${DESIGN.spacing.md} ${DESIGN.spacing.lg} ${DESIGN.spacing.lg}`, background: DESIGN.colors.bg, display: 'flex', gap: DESIGN.spacing.sm, flexWrap: 'wrap', borderTop: `1px solid ${DESIGN.colors.border}` }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="chip-hover" onClick={() => sendMessage(s)} style={{ fontSize: DESIGN.fonts.sm, padding: `${DESIGN.spacing.xs} ${DESIGN.spacing.md}`, borderRadius: DESIGN.radius.full, background: DESIGN.colors.white, border: `1px solid ${DESIGN.colors.border}`, color: DESIGN.colors.primary, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, transition: `all ${DESIGN.transitions.fast}` }}>{s}</button>
            ))}
          </div>
        )}

        {/* Input Control Navbar Strip */}
        <div style={{ padding: DESIGN.spacing.md, borderTop: `1px solid ${DESIGN.colors.border}`, background: DESIGN.colors.white, display: 'flex', gap: DESIGN.spacing.sm, alignItems: 'center', flexShrink: 0 }}>
          <input className="input-focus" ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Ask anything..." disabled={loading} style={{ flex: 1, border: `1.5px solid ${DESIGN.colors.border}`, borderRadius: DESIGN.radius.sm, padding: `${DESIGN.spacing.sm} ${DESIGN.spacing.md}`, fontSize: DESIGN.fonts.base, fontFamily: 'DM Sans, sans-serif', color: DESIGN.colors.text.primary, background: DESIGN.colors.white, outline: 'none', transition: `all ${DESIGN.transitions.fast}` }} />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()} style={{ width: '36px', height: '36px', background: loading || !input.trim() ? DESIGN.colors.border : DESIGN.colors.primary, border: 'none', borderRadius: DESIGN.radius.sm, color: loading || !input.trim() ? DESIGN.colors.text.tertiary : DESIGN.colors.white, fontSize: DESIGN.fonts.base, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: `all ${DESIGN.transitions.fast}` }}><SendIcon /></button>
        </div>
      </div>
    </>
  )
}