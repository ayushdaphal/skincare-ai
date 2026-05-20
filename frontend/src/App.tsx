import ChatWidget from './ChatWidget'
import './App.css'

export default function App() {
  return (
    <>
      {/* Blank ecomm background */}
      <div style={{
        height: '100vh',
        background: '#f4f5f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{
          fontSize: '32px',
          fontWeight: 600,
          color: '#e5e7eb',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '-0.02em',
        }}>
          Your ecomm site goes here
        </div>
        <div style={{
          fontSize: '14px',
          color: '#d1d5db',
          fontFamily: 'Inter, sans-serif',
        }}>
          Click the button below to chat with your AI Dermat ✨
        </div>
      </div>

      <ChatWidget />
    </>
  )
}