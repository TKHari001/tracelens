import React from 'react';

type SidebarProps = {
  onNavClick: (view: string) => void;
  activeView: string;
};

export function Sidebar({ onNavClick, activeView }: SidebarProps) {
  const sections = [
    {
      title: 'Diagnostics',
      items: [
        { id: 'issues', label: 'Active Issues' },
        { id: 'critical', label: 'Critical Issues' },
        { id: 'package', label: '📦 Package Analyzer' },
        { id: 'architecture', label: 'Architecture' },
      ]
    },
    {
      title: 'AI & Chatbot',
      items: [
        { id: 'chat', label: '💬 AI Diagnostic Chat' },
        { id: 'advisor', label: 'AI Advisor' },
        { id: 'approvals', label: 'Pending Approvals' },
        { id: 'history', label: 'Remediation History' },
      ]
    },
    {
      title: 'Telemetry Stream',
      items: [
        { id: 'logs', label: 'Live Logs' },
        { id: 'metrics', label: 'Metrics' },
        { id: 'traces', label: 'Traces' },
      ]
    }
  ];

  return (
    <aside style={{ 
      width: '260px', 
      backgroundColor: '#161b22', 
      borderRight: '1px solid #30363d', 
      display: 'flex', 
      flexDirection: 'column', 
      color: '#c9d1d9',
      paddingTop: '15px'
    }}>
      <div style={{ padding: '0 20px', marginBottom: '20px' }}>
        <h1 style={{ color: '#58a6ff', fontSize: '1.1rem', fontWeight: 600, margin: 0, letterSpacing: '0.5px' }}>
          ◈ X-RAY VISION
        </h1>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: '20px' }}>
            <h3 style={{ 
              color: '#8b949e', 
              fontSize: '0.75rem', 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              padding: '0 20px', 
              margin: '0 0 10px 0' 
            }}>
              {section.title}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {section.items.map(item => (
                <li key={item.id}>
                  <button 
                    onClick={() => onNavClick(item.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 20px',
                      backgroundColor: activeView === item.id ? '#1f242c' : 'transparent',
                      color: activeView === item.id ? '#ffffff' : '#c9d1d9',
                      border: 'none',
                      borderLeft: activeView === item.id ? '3px solid #58a6ff' : '3px solid transparent',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.1s ease'
                    }}
                    onMouseOver={(e) => { if (activeView !== item.id) e.currentTarget.style.backgroundColor = '#1c2128' }}
                    onMouseOut={(e) => { if (activeView !== item.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      <div style={{ padding: '20px', borderTop: '1px solid #30363d' }}>
        <div style={{ fontSize: '0.8rem', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#238636' }}></span>
          System Connected
        </div>
      </div>
    </aside>
  );
}
