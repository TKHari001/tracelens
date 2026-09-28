import React from 'react';

export function IntelligencePanel({ issue, remediation, onApprove, onReject }: any) {
  if (!issue) return null;

  return (
    <aside style={{ width: '350px', backgroundColor: '#161b22', borderLeft: '1px solid #30363d', display: 'flex', flexDirection: 'column', color: '#c9d1d9' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #30363d' }}>
        <h3 style={{ margin: '0 0 5px 0', color: '#ffffff', fontSize: '1.1rem' }}>AI Diagnostics</h3>
        <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>Model Context: {issue.affected_service || 'Unknown'}</div>
      </div>

      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '25px' }}>
          <strong style={{ color: '#8b949e', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            ROOT CAUSE
          </strong>
          <div style={{ backgroundColor: '#0d1117', padding: '15px', borderRadius: '6px', fontSize: '0.9rem', lineHeight: '1.5', border: '1px solid #30363d' }}>
            {issue.root_cause || <span style={{ color: '#8b949e', fontStyle: 'italic' }}>Analyzing telemetry context...</span>}
          </div>
          {issue.confidence && (
            <div style={{ marginTop: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#8b949e' }}>Confidence:</span>
              <div style={{ flex: 1, height: '4px', backgroundColor: '#30363d', borderRadius: '2px' }}>
                <div style={{ width: `${issue.confidence}%`, height: '100%', backgroundColor: issue.confidence > 85 ? '#2ea043' : '#d29922', borderRadius: '2px' }}></div>
              </div>
              <span style={{ fontWeight: 600 }}>{issue.confidence}%</span>
            </div>
          )}
        </div>

        {remediation && (
          <div style={{ marginBottom: '25px' }}>
            <strong style={{ color: '#8b949e', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
              REMEDIATION PLAN ({remediation.ai_model})
            </strong>
            <div style={{ backgroundColor: '#0d1117', padding: '15px', borderRadius: '6px', fontSize: '0.9rem', color: '#e3b341', lineHeight: '1.5', border: '1px solid #d29922' }}>
              {remediation.proposed_action}
            </div>
            
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'rgba(210, 153, 34, 0.1)', borderRadius: '6px', fontSize: '0.8rem', color: '#d29922' }}>
              <strong>Status: </strong> {remediation.status === 'APPROVAL_REQUIRED' ? 'Requires manual approval (Policy Engine)' : remediation.status}
            </div>

            {remediation.status === 'APPROVAL_REQUIRED' && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={onApprove} style={{ flex: 1, padding: '8px', backgroundColor: '#238636', color: '#fff', border: '1px solid rgba(240,246,252,0.1)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Approve</button>
                <button onClick={onReject} style={{ flex: 1, padding: '8px', backgroundColor: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Reject</button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
