import React from 'react';

export function ArchitectureGraph() {
  const nodes = [
    { id: 'user', label: 'Browser Client', type: 'external', x: 50, y: 150 },
    { id: 'gateway', label: 'API Gateway', type: 'service', x: 250, y: 150, status: 'warning' },
    { id: 'auth', label: 'Auth Service', type: 'service', x: 450, y: 50, status: 'healthy' },
    { id: 'payment', label: 'Payment API', type: 'service', x: 450, y: 250, status: 'critical' },
    { id: 'db', label: 'PostgreSQL', type: 'database', x: 650, y: 150, status: 'healthy' }
  ];

  const edges = [
    { from: 'user', to: 'gateway' },
    { from: 'gateway', to: 'auth' },
    { from: 'gateway', to: 'payment' },
    { from: 'auth', to: 'db' },
    { from: 'payment', to: 'db' }
  ];

  return (
    <div style={{ padding: '30px', color: '#c9d1d9', height: '100%' }}>
      <h2 style={{ color: '#ffffff', fontWeight: 500, margin: '0 0 10px 0' }}>Architecture Visualization</h2>
      <p style={{ color: '#8b949e', fontSize: '0.9rem', margin: '0 0 30px 0' }}>Live dependency map of connected applications.</p>
      
      <div style={{ 
        position: 'relative', 
        height: '400px', 
        backgroundColor: '#0d1117', 
        border: '1px solid #30363d',
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        {/* Simplified mock SVG renderer for edges */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          {edges.map((e, i) => {
            const from = nodes.find(n => n.id === e.from);
            const to = nodes.find(n => n.id === e.to);
            if (!from || !to) return null;
            return (
              <line key={i} x1={from.x + 75} y1={from.y + 25} x2={to.x} y2={to.y + 25} stroke="#30363d" strokeWidth="2" />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(n => {
          let borderColor = '#30363d';
          let bgColor = '#161b22';
          if (n.status === 'warning') borderColor = '#d29922';
          if (n.status === 'critical') borderColor = '#f85149';

          return (
            <div key={n.id} style={{
              position: 'absolute',
              left: n.x,
              top: n.y,
              width: '150px',
              padding: '12px',
              backgroundColor: bgColor,
              border: `2px solid ${borderColor}`,
              borderRadius: '6px',
              zIndex: 2,
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>{n.label}</div>
              <div style={{ fontSize: '0.7rem', color: '#8b949e', marginTop: '4px', textTransform: 'uppercase' }}>{n.type}</div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
