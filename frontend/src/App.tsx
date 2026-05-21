import ChatWidget from './ChatWidget'
import './App.css'

export default function App() {
  return (
    <>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f4f5f7 0%, #f8f9fb 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{
          fontSize: 'clamp(28px, 8vw, 48px)',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #8c30f5 0%, #6b21a8 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
          textAlign: 'center',
        }}>
          Clinikally
        </div>
        <div style={{
          fontSize: 'clamp(13px, 4vw, 16px)',
          color: '#6b7280',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          maxWidth: '300px',
        }}>
          Chat with your AI Dermat to find skincare products & get expert advice
        </div>
      </div>

      <ChatWidget />
    </>
  )
}