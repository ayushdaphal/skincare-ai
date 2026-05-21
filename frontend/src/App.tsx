import { useState, useEffect } from 'react'
import ChatWidget from './ChatWidget'
import './App.css'

export default function App() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('routing') // Initialized to match your sequence head perfectly
  const [shouldShake, setShouldShake] = useState(false)

  // ── PERIODIC 15-SECOND SUBTLE ATTENTION SHAKE LOOP (EXACTLY 1-SECOND SHAKE DURATION) ──
  useEffect(() => {
    let intervalId: NodeJS.Timeout
    let shakeTimeoutId: NodeJS.Timeout

    if (isWidgetOpen && !isRightPanelOpen) {
      setShouldShake(false)
      
      // Establishes a repeating interval every 15 seconds
      intervalId = setInterval(() => {
        setShouldShake(true)
        
        // Disables shaking animation after exactly 1 second has elapsed
        shakeTimeoutId = setTimeout(() => {
          setShouldShake(false)
        }, 1000)
      }, 15000)
    } else {
      setShouldShake(false)
    }

    return () => {
      clearInterval(intervalId)
      clearTimeout(shakeTimeoutId)
    }
  }, [isWidgetOpen, isRightPanelOpen])

  const handleChatWidgetToggle = (open: boolean) => {
    setIsWidgetOpen(open)
    if (!open) {
      setIsRightPanelOpen(false)
    }
  }

  return (
    <>
      {/* ── HIGH-FIDELITY REPO STYLING OVERRIDES & HARDWARE ACCELERATED SHAKE KEYFRAMES ── */}
      <style>{`
        @keyframes github-attention-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .shake-element-active {
          animation: github-attention-shake 0.5s ease-in-out 2 !important; /* Shakes subtly for exactly 1 second */
          box-shadow: 0 0 0 4px rgba(88, 166, 255, 0.4) !important;
          border-color: #58a6ff !important;
        }
        .github-btn-transition {
          transition: transform 200ms ease, background-color 200ms ease, border-color 200ms ease, opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .github-btn-transition:hover {
          transform: scale(1.05);
          background-color: #30363d !important;
          border-color: #8b949e !important;
        }
        .repo-file-row {
          transition: background-color 120ms ease;
          cursor: pointer;
        }
        .repo-file-row:hover {
          background-color: #161b22 !important;
        }
        .repo-file-active {
          background-color: #1f242c !important;
          border-left: 3px solid #f78166 !important;
        }
        .github-tab-link {
          transition: color 150ms ease, border-bottom-color 150ms ease;
        }
        .github-tab-link:hover {
          color: #c9d1d9 !important;
        }
        .readme-canvas-scroll::-webkit-scrollbar { width: 4px; }
        .readme-canvas-scroll::-webkit-scrollbar-track { background: transparent; }
        .readme-canvas-scroll::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
      `}</style>

      {/* ── LANDING PAGE BACKGROUND LAYOUT WRAPPER (WITH INTEGRATED HARDWARE BLUR EFFECT) ── */}
      <div 
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #eef2f7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          filter: isWidgetOpen ? 'blur(12px) brightness(0.92)' : 'none',
          transition: 'filter 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'fixed',
          inset: 0,
          zIndex: 1
        }}
      >
        <div style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, background: 'linear-gradient(135deg, #8c30f5 0%, #5b1aa6 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em', textAlign: 'center' }}>
          Clinikally
        </div>
        <div style={{ fontSize: 'clamp(14px, 3vw, 16px)', color: '#4b5563', textAlign: 'center', maxWidth: '340px', fontWeight: 500, lineHeight: '1.5' }}>
          Your e-comerce website sits here</div>
      </div>

      {/* ── AUTHENTIC FULL-SCREEN GITHUB REPOSITORY THEMED PORTFOLIO CONSOLE ── */}
      {isRightPanelOpen && (
        <div 
          style={{
            position: 'fixed',
            top: '20px',
            bottom: '20px',
            right: '24px',
            width: '780px', // Wide high-density architecture canvas footprint
            background: '#0d1117', // GitHub Dark Default Background
            border: '1px solid #30363d', // Primer border-default
            borderRadius: '6px', // GitHub standard radius
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
            zIndex: 10,
            display: window.innerWidth < 1200 ? 'none' : 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"'
          }}
        >
          {/* Section 1: GitHub Repo Top Nav Indicator Header Banner */}
          <div style={{ padding: '16px 24px 0 24px', background: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c9d1d9', fontSize: '14px' }}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="#8b949e"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 0 1 1-1Zm0 9v1.5h-1.75V10.5Z"></path></svg>
                <span style={{ color: '#58a6ff', cursor: 'pointer' }}>ayushdaphal</span>
                <span style={{ color: '#8b949e' }}>/</span>
                <span style={{ fontWeight: 600, color: '#c9d1d9', cursor: 'pointer' }}>skincare-ai</span>
                <span style={{ fontSize: '12px', border: '1px solid #30363d', borderRadius: '20px', padding: '0 7px', color: '#8b949e', fontWeight: 500 }}>Public</span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,monospace', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', overflow: 'hidden' }}>
                  <span style={{ padding: '3px 8px', color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid #30363d' }}>
                    <svg height="14" viewBox="0 0 16 16" width="14" fill="#8b949e"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.695Z"></path></svg>Star
                  </span>
                  <span style={{ padding: '3px 8px', color: '#c9d1d9', fontWeight: 600, background: '#161b22' }}>101</span>
                </div>
              </div>
            </div>

            {/* ── RE-ORDERED REPOSITORY NAVIGATION MATRICES (SEQUENCE 1-4 TOP DOWN FLOW) ── */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '-1px' }}>
              {[
                { id: 'routing', label: '1. System Core & Intent' },
                { id: 'rag', label: '2. Hybrid Retrieval' },
                { id: 'inference', label: '3. Inference Optimization' },
                { id: 'memory', label: '4. Recursive Memory' }
              ].map(tab => (
                <div 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="github-tab-link" 
                  style={{ 
                    padding: '8px 12px 12px 12px', 
                    borderBottom: activeTab === tab.id ? '2px solid #f78166' : 'none', 
                    color: activeTab === tab.id ? '#c9d1d9' : '#8b949e', 
                    fontSize: '13px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    cursor: 'pointer',
                    fontWeight: activeTab === tab.id ? 600 : 400 
                  }}
                >
                  <span>{tab.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Main Outer Working Body Repository File Matrix Grid */}
          <div className="readme-canvas-scroll" style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '5px 12px', fontSize: '13px', color: '#c9d1d9', fontWeight: 600 }}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="#8b949e" style={{ marginRight: '4px', verticalAlign: 'text-bottom' }}><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06L9.44 7.25H6.75a.75.75 0 0 1 0-1.5h2.69l-2.263-2.263a.75.75 0 0 1 0-1.06ZM2.5 2a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 10.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"></path></svg>
                  <span>main</span>
                </div>
                <div style={{ fontSize: '13px', color: '#8b949e' }}><strong>1</strong> Branch &nbsp; <strong>0</strong> Tags</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: '6px', padding: '5px 12px', fontSize: '13px', color: '#c9d1d9' }}>Go to file</div>
                <div style={{ background: '#238636', border: '1px solid rgba(240,246,252,0.1)', borderRadius: '6px', padding: '5px 12px', fontSize: '13px', color: '#fff', fontWeight: 600 }}>Code ▼</div>
              </div>
            </div>

            {/* Commit Message Status Line */}
            <div style={{ border: '1px solid #30363d', borderRadius: '6px', background: '#161b22', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', background: '#8c30f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10px', color: '#fff' }}>AD</div>
                  <div>
                    <span style={{ fontWeight: 600, color: '#c9d1d9' }}>ayushdaphal</span>
                    <span style={{ color: '#8b949e', marginLeft: '8px' }}>update- re-ordered pipeline whitepaper nodes to sequence logic specifications</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,monospace', fontSize: '12px', color: '#8b949e' }}>
                  <span>4015af6</span>
                  <span>1 hour ago</span>
                  <span style={{ color: '#c9d1d9', fontWeight: 600 }}>9 Commits</span>
                </div>
              </div>

              {/* ── RE-ORDERED REPOSITORY FILE ROWS LAYOUT (1 TO 4 MATCHING SEQUENCE) ── */}
              <div style={{ display: 'flex', flexDirection: 'column', background: '#0d1117', fontSize: '13px' }}>
                
                {/* File Row 1: backend -> Tab 1 */}
                <div 
                  onClick={() => setActiveTab('routing')}
                  className={`repo-file-row ${activeTab === 'routing' ? 'repo-file-active' : ''}`}
                  style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid #30363d', alignItems: 'center' }}
                >
                  <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '10px', color: '#58a6ff', fontWeight: 500 }}>
                    <svg height="16" viewBox="0 0 16 16" width="16" fill="#58a6ff"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.583L6.054 1.222A1.753 1.753 0 0 0 4.731 1H1.75Z"></path></svg>
                    <span>backend</span>
                  </div>
                  <div style={{ flex: 1, color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    update- program multi-channel intent routing & validation check blocks
                  </div>
                  <div style={{ width: '90px', color: '#8b949e', textAlign: 'right' }}>1 hour ago</div>
                </div>

                {/* File Row 2: embed -> Tab 2 */}
                <div 
                  onClick={() => setActiveTab('rag')}
                  className={`repo-file-row ${activeTab === 'rag' ? 'repo-file-active' : ''}`}
                  style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid #30363d', alignItems: 'center' }}
                >
                  <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '10px', color: '#58a6ff', fontWeight: 500 }}>
                    <svg height="16" viewBox="0 0 16 16" width="16" fill="#58a6ff"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.583L6.054 1.222A1.753 1.753 0 0 0 4.731 1H1.75Z"></path></svg>
                    <span>embed</span>
                  </div>
                  <div style={{ flex: 1, color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    init- hybrid retrieval dense SBERT vectors + local Okapi sparse pickle datasets
                  </div>
                  <div style={{ width: '90px', color: '#8b949e', textAlign: 'right' }}>2 days ago</div>
                </div>

                {/* File Row 3: frontend -> Tab 3 */}
                <div 
                  onClick={() => setActiveTab('inference')}
                  className={`repo-file-row ${activeTab === 'inference' ? 'repo-file-active' : ''}`}
                  style={{ display: 'flex', padding: '10px 16px', borderBottom: '1px solid #30363d', alignItems: 'center' }}
                >
                  <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '10px', color: '#58a6ff', fontWeight: 500 }}>
                    <svg height="16" viewBox="0 0 16 16" width="16" fill="#58a6ff"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.583L6.054 1.222A1.753 1.753 0 0 0 4.731 1H1.75Z"></path></svg>
                    <span>frontend</span>
                  </div>
                  <div style={{ flex: 1, color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    tune- cross-encoder inference optimization & real-time SSE token stream sync
                  </div>
                  <div style={{ width: '90px', color: '#8b949e', textAlign: 'right' }}>1 hour ago</div>
                </div>

                {/* File Row 4: README.md -> Tab 4 */}
                <div 
                  onClick={() => setActiveTab('memory')}
                  className={`repo-file-row ${activeTab === 'memory' ? 'repo-file-active' : ''}`}
                  style={{ display: 'flex', padding: '10px 16px', alignItems: 'center' }}
                >
                  <div style={{ width: '180px', display: 'flex', alignItems: 'center', gap: '10px', color: '#c9d1d9', fontWeight: 500 }}>
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="#8b949e"><path d="M4 1.75V0h8.25c.966 0 1.75.784 1.75 1.75v12.5a1.75 1.75 0 0 1-1.75 1.75H3.25a1.75 1.75 0 0 1-1.75-1.75V1.75C1.5.784 2.284 0 3.25 0H4Zm0 1.5h-.75a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h10a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H4v1.5Z"></path></svg>
                    <span>README.md</span>
                  </div>
                  <div style={{ flex: 1, color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    docs- clear definition layout for SQLite recursive compaction memory sub-agents
                  </div>
                  <div style={{ width: '90px', color: '#8b949e', textAlign: 'right' }}>2 days ago</div>
                </div>

              </div>
            </div>

            {/* Split Grid: Markdown Document Reader Pane */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '24px', alignItems: 'flex-start', borderTop: '1px solid #30363d', paddingTop: '24px' }}>
              
              {/* Left Column Area: Whitepaper Markdown Block */}
              <div style={{ border: '1px solid #30363d', borderRadius: '6px', background: '#0d1117', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#c9d1d9' }}>
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="#8b949e"><path d="M4 1.75V0h8.25c.966 0 1.75.784 1.75 1.75v12.5a1.75 1.75 0 0 1-1.75 1.75H3.25a1.75 1.75 0 0 1-1.75-1.75V1.75C1.5.784 2.284 0 3.25 0H4Zm0 1.5h-.75a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h10a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H4v1.5Z"></path></svg>
                  <span>README.md</span>
                </div>

                <div style={{ padding: '28px 32px', color: '#c9d1d9', fontSize: '13.5px', lineHeight: '1.65' }}>
                  
                  {/* ────────── SECTION 01: SYSTEM CORE & INTENT (backend) ────────── */}
                  {activeTab === 'routing' && (
                    <div>
                      <h1 style={{ color: '#c9d1d9', fontSize: '22px', fontWeight: 600, margin: '0 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        1.0 Multi-Channel Intent Routing Strategy & Dialogue Pipeline
                      </h1>
                      <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                        Clinikally AI functions as a high-density, multi-source intelligent assistant engineered to resolve open-domain skincare queries into structured, grounded insights. The architecture rejects the common limitation of single-source generation, instead utilizing a programmatic orchestrator to split incoming natural language targets into distinct functional retrieval channels.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>1.1 Autonomous LLM Intent Classification Gateway</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        Every query transaction is funneled through a high-performance classification layer powered by a zero-temperature implementation of the <strong>Llama 3.1 8B Instant</strong> model. Operating under strict system instructions and JSON schemas, this model parses conversational turns to categorize the query into multi-label channels:
                      </p>
                      <ul style={{ paddingLeft: '20px', marginBottom: '16px', color: '#8b949e' }}>
                        <li style={{ marginBottom: '6px' }}><strong style={{ color: '#c9d1d9' }}>PRODUCT Matrix:</strong> Activated when user queries show transactional commercial intent, request product listings, or state explicit budget allocations. This opens routing channels directly to internal e-commerce vector frames.</li>
                        <li style={{ marginBottom: '6px' }}><strong style={{ color: '#c9d1d9' }}>BLOG Matrix:</strong> Triggered when incoming queries seek educational breakdowns, routine guides, or ingredient mechanism explanations. This points the pipeline to internal curated clinical markdown indices.</li>
                      </ul>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>1.2 Context-Enriched Independent Search Query Synthesizer</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        Raw conversational prompts are often ambiguous or reliant on pronouns (e.g., <em>"Suggest a sunscreen under 600"</em> followed by <em>"Show me another one"</em>). To prevent database query failures, the intent layer reviews past session arrays to rewrite inputs into fully formed, entity-resolved standalone queries.
                      </p>
                      
                      <div style={{ background: '#161b22', color: '#8b949e', fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,monospace', padding: '14px 16px', borderRadius: '6px', fontSize: '11.5px', marginBottom: '16px', lineHeight: '1.5', border: '1px solid #30363d' }}>
                        {"// LIVE CONTEXT REWRITING TRANSACTION DIFF"}<br />
                        <span style={{ color: '#ff7b72' }}>{"[-] RAW_INPUT    :"}</span> <span style={{ color: '#a5d6ff' }}>{"\"suggest a sunscreen under 600\""}</span><br />
                        <span style={{ color: '#7ee787' }}>{"[+] STANDALONE   :"}</span> <span style={{ color: '#a5d6ff' }}>{"\"sunscreen oily skin acne prone suitability price_max:600.00\""}</span>
                      </div>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>1.3 Clarification Guardrail Boundary & Intercept Loop</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        The catalog search loop enforces safety rules to block vague queries before they enter the data tier. The <code>check_clarification</code> sub-agent intercepts product lookups unless specific entities are present:
                      </p>
                      <div style={{ borderLeft: '3px solid #f78166', paddingLeft: '14px', background: '#161b22', padding: '10px 14px', marginBottom: '0', color: '#8b949e', borderRadius: '0 4px 4px 0', border: '1px solid #30363d', borderLeftColor: '#f78166' }}>
                        • Validation Requirement A: Explicit user skin type configuration profile (Oily, Dry, Combination, Sensitive).<br />
                        • Validation Requirement B: Targeted clinical dermatological manifestation concern (Acne, Pigmentation, Dryness).
                      </div>
                    </div>
                  )}

                  {/* ────────── SECTION 02: HYBRID RETRIEVAL (embed) ────────── */}
                  {activeTab === 'rag' && (
                    <div>
                      <h1 style={{ color: '#c9d1d9', fontSize: '22px', fontWeight: 600, margin: '0 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        2.0 Hybrid Dense-Sparse Retrieval Framework & Fusion Core
                      </h1>
                      <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                        To maximize search precision and avoid neural blindness, Clinikally AI uses a dual-engine information retrieval matrix. This architecture balances dense semantic indexing with sparse keyword recovery.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>2.1 Dense Vector Retrieval Field (ChromaDB Architecture)</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        Dense retrieval is powered by a persistent <strong>ChromaDB</strong> infrastructure running local semantic vector frames. Documents are chunked, indexed, and embedded into 384-dimensional vector spaces using the <code>all-MiniLM-L6-v2</code> Sentence-Transformers framework. This setup yields high semantic performance over abstract skin properties on commodity CPU hardware, running over 1,000 queries per second.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>2.2 Sparse Token Array Engineering (Rank-BM25 Lexicons)</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        Dense models can miss critical exact matches like specific ingredient names, brand terminology, or numbers. To solve this, the pipeline runs a parallel lexical keyword matching track via an implementation of the <strong>Okapi BM25</strong> algorithm. The system processes incoming tokens against compressed binary indices stored on disk as serialized <code>.pkl</code> data assets to provide instant keyword scoring.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>2.3 Reciprocal Rank Fusion (RRF) Unification Core</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        Rather than normalizing scores from incompatible probability distributions, the system combines dense and sparse search rankings using <strong>Reciprocal Rank Fusion (RRF)</strong>. Candidates are re-scored based on their rank positions in each index, calculated using a standard scaling constant of $k = 60$:
                      </p>
                      
                      <div style={{ fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace', fontSize: '11px', margin: '14px 0', textAlign: 'center', fontWeight: 600, padding: '12px 16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9' }}>
                        {"$$\\text{RRF Score}(d) = \\sum_{m \\in M} \\frac{1}{60 + \\text{Rank}_m(d)}$$"}
                      </div>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        This math ensures high-relevance documents from either track rise to the top of the candidate pool, preventing out-of-domain terms from dominating early results.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>2.4 Neural Cross-Encoder Reranking Loop</h3>
                      <p style={{ marginBottom: '0', textAlign: 'justify' }}>
                        The final retrieval stage uses a deep learning reranking model to evaluate fine-grained context. The top candidates are passed to a neural <code>cross-encoder/ms-marco-MiniLM-L-6-v2</code> network. This model computes full query-document attention matrix scores, sorting the final context pool. To minimize system latency, document token windows are constrained strictly to the first 512 characters during evaluation.
                      </p>
                    </div>
                  )}

                  {/* ────────── SECTION 03: INFERENCE OPTIMIZATION (frontend) ────────── */}
                  {activeTab === 'inference' && (
                    <div>
                      <h1 style={{ color: '#c9d1d9', fontSize: '22px', fontWeight: 600, margin: '0 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        3.0 Inference Infrastructure & Semantic Optimization Layers
                      </h1>
                      <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                        Operating real-time RAG applications at scale requires managing computational costs, token overhead, and API latency. This architecture uses high-speed hardware partnerships alongside custom caching mechanisms to deliver low-latency responses.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>3.1 LLM Provider Infrastructure Analysis</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        The application routes inference calls to <strong>Groq Cloud</strong>, leveraging their specialized LPU (Language Processing Unit) hardware acceleration. This choice provides massive operational advantages over standard commercial LLM endpoints:
                      </p>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace', marginBottom: '16px', background: '#161b22', border: '1px solid #30363d' }}>
                        <thead>
                          <tr style={{ background: '#21262d', borderBottom: '1px solid #30363d' }}>
                            <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #30363d', color: '#c9d1d9' }}>METRIC SPEC</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #30363d', color: '#c9d1d9' }}>GPT-4 TURBO</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#c9d1d9' }}>LLAMA 3.1 8B (GROQ)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #30363d' }}>
                            <td style={{ padding: '8px', fontWeight: 600, borderRight: '1px solid #30363d' }}>Input Cost / MTok</td>
                            <td style={{ padding: '8px', borderRight: '1px solid #30363d' }}>$15.00</td>
                            <td style={{ padding: '8px', color: '#58a6ff', fontWeight: 600 }}>$0.40 (1/25th cost)</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #30363d' }}>
                            <td style={{ padding: '8px', fontWeight: 600, borderRight: '1px solid #30363d' }}>Output Cost / MTok</td>
                            <td style={{ padding: '8px', borderRight: '1px solid #30363d' }}>$75.00</td>
                            <td style={{ padding: '8px', color: '#58a6ff', fontWeight: 600 }}>$0.60</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px', fontWeight: 600, borderRight: '1px solid #30363d' }}>Avg Inference Latency</td>
                            <td style={{ padding: '8px', borderRight: '1px solid #30363d' }}>2200ms - 3500ms</td>
                            <td style={{ padding: '8px', color: '#58a6ff', fontWeight: 600 }}>100ms - 400ms</td>
                          </tr>
                        </tbody>
                      </table>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>3.2 Embedding-Based Vector L1 Cosine Similarity Cache</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        To short-circuit redundant database lookup cycles and optimize costs, incoming queries are checked against a local, in-memory semantic cache. The normalized query string embedding is evaluated against past cache keys using an explicit cosine similarity measure:
                      </p>
                      <div style={{ fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace', fontSize: '11px', margin: '14px 0', textAlign: 'center', fontWeight: 600, padding: '12px 16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9' }}>
                        {"$$\\text{Similarity} = \\frac{\\mathbf{A} \\cdot \\mathbf{B}}{\\|\\mathbf{A}\\| \\|\\mathbf{B}\\|} \\ge 0.90$$"}
                      </div>
                    </div>
                  )}

                  {/* ────────── SECTION 04: RECURSIVE MEMORY (README.md) ────────── */}
                  {activeTab === 'memory' && (
                    <div>
                      <h1 style={{ color: '#c9d1d9', fontSize: '22px', fontWeight: 600, margin: '0 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid #30363d' }}>
                        4.0 Dialogue State Coherence & Recursive Memory Lifecycle
                      </h1>
                      <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                        Maintaining long-term conversation context while keeping token usage bounded requires an active, automated state compaction strategy rather than simple history logging. This architecture combines sliding context windows with background summarization loops.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>4.1 Verbatim Sliding History & Context Compaction Lifecycle</h3>
                      <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                        The backend maps conversation state into two distinct memory pools inside a persistent SQLite store. To limit context bloat, the active prompt payload maintains a strict rolling buffer of the last 10 messages (3 full conversation turns) verbatim. Older messages that exit this sliding window are passed to a background summarization sub-agent.
                      </p>
                      <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                        This background agent uses a specialized prompt to compress old dialogue blocks into a dense, 2-3 sentence semantic summary snippet. This summary is saved in the database and prepended to future system messages, maintaining long-term continuity while reducing history token overhead by 75%.
                      </p>

                      <h3 style={{ color: '#c9d1d9', fontSize: '15px', fontWeight: 600, margin: '20px 0 10px 0' }}>4.2 Asynchronous Non-Blocking I/O Workflows</h3>
                      <p style={{ marginBottom: '12px', textAlign: 'justify' }}>
                        To maintain performance under concurrent loads, the FastAPI server keeps its primary ASGI runtime loop strictly non-blocking. Heavy, synchronous operations—such as computing BM25 token frequencies, running database queries, or serializing disk assets—are isolated from the main event thread:
                      </p>
                      
                      <div style={{ background: '#161b22', color: '#8b949e', fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,monospace', padding: '14px 16px', borderRadius: '6px', fontSize: '11.5px', marginBottom: '0', lineHeight: '1.5', border: '1px solid #30363d' }}>
                        <span style={{ color: '#ff7b72' }}>{"await"}</span> {"asyncio.get_event_loop().run_in_executor("}<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;{"thread_pool_executor,"}<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;{"execute_synchronous_db_compaction,"}<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;{"session_id"}<br />
                        {")"}
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Right Column: Repository Information Sidebar */}
              <div style={{ fontSize: '12px', color: '#c9d1d9', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: '6px', fontSize: '14px' }}>About</div>
                  <p style={{ color: '#8b949e', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                    Clinikally AI: Accelerating Hybrid Dense-Sparse Retrieval & Multi-Source Agent Orchestration.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#8b949e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e"><path d="M4 1.75V0h8.25c.966 0 1.75.784 1.75 1.75v12.5a1.75 1.75 0 0 1-1.75 1.75H3.25a1.75 1.75 0 0 1-1.75-1.75V1.75C1.5.784 2.284 0 3.25 0H4Zm0 1.5h-.75a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h10a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H4v1.5Z"></path></svg>
                      <span style={{ color: '#58a6ff', fontWeight: 500 }}>Readme</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg height="16" viewBox="0 0 16 16" width="16" fill="#8b949e"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.958c.83.244 1.44.98 1.44 1.867 0 1.035-.895 1.875-2 1.875s-2-.84-2-1.875c0-.886.61-1.623 1.44-1.867V4.75a.75.75 0 0 1 1.5 0Z"></path></svg>
                      <span>Activity</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #30363d', paddingTop: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: '4px' }}>Releases</div>
                  <div style={{ color: '#8b949e', fontStyle: 'italic' }}>No releases published</div>
                </div>

                <div style={{ borderTop: '1px solid #30363d', paddingTop: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: '8px' }}>Contributors</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '20px', height: '20px', background: '#8c30f5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '9px', color: '#fff' }}>AD</div>
                    <span style={{ color: '#58a6ff', fontWeight: 500 }}>ayushdaphal</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Persistent Repository Status Footer */}
          <div style={{ padding: '14px 24px', background: '#161b22', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b949e', fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,monospace', fontWeight: 500, letterSpacing: '0.01em' }}>
            <span>HOST ENGINE // FASTAPI WORKER CLUSTER</span>
            <span style={{ color: '#58a6ff', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', background: '#56d364', borderRadius: '50%', display: 'inline-block' }}></span>
              ACTIVE_SSE_CHANNEL
            </span>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE WIDGET 2: BOTTOM RIGHT FLOATING GITHUB PILL TRIGGER BUTTON ── */}
      {isWidgetOpen && (
        <div style={{ position: 'fixed', bottom: '28px', right: '24px', zIndex: 998 }}>
          <button
            onClick={() => setIsRightPanelOpen(p => !p)}
            className={`github-btn-transition ${shouldShake ? 'shake-element-active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: '24px', 
              padding: '0 16px',
              height: '42px',
              cursor: 'pointer',
              color: '#c9d1d9',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              outline: 'none',
              fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,monospace',
              fontSize: '11px',
              fontWeight: 600
            }}
            title="Open Repository Whitepaper"
          >
            {/* Left-aligned GitHub Style README label token */}
            <span style={{ color: '#8b949e', borderRight: '1px solid #30363d', paddingRight: '10px', display: 'flex', alignItems: 'center', height: '100%' }}>
              README.md
            </span>
            <svg height="18" viewBox="0 0 16 16" width="18" fill="currentColor" style={{ display: 'block' }}><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82A7.433 7.433 0 0 0 8 4c-.68.003-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path></svg>
          </button>
        </div>
      )}

      {/* ── MODULAR CHAT INTERFACE COMPONENT WRAPPER ── */}
      <ChatWidget onToggleStateChange={handleChatWidgetToggle} />
    </>
  )
}