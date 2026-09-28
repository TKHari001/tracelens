import React from 'react';
import type { DiagnosticIssue } from './ActiveIssuesSection.tsx';

type Props = {
  issues: DiagnosticIssue[];
  onSelectFix?: (issueId: string) => void;
};

export function AIRecommendationsSection({ issues, onSelectFix }: Props) {
  const unresolved = issues.filter(i => i.status !== 'Fixed' && i.status !== 'Verified');
  const criticalRecs = unresolved.filter(i => i.severity === 'Critical');
  const activeRecs = unresolved.filter(i => i.severity !== 'Critical');

  return (
    <section 
      id="section-ai-recommendations" 
      style={{
        backgroundColor: '#0d1117',
        border: '1px solid #1f6feb',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 16px rgba(31,111,235,0.15)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.3rem' }}>🤖</span>
          <div>
            <h2 style={{ margin: 0, color: '#58a6ff', fontSize: '1.2rem', fontWeight: 600 }}>
              Section 4: AI Recommendations
            </h2>
            <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '0.85rem' }}>
              Guidance-only AI suggestions. Recommendation display does not modify source code until explicitly approved and validated.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ backgroundColor: 'rgba(248,81,73,0.15)', color: '#ff7b72', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(248,81,73,0.3)' }}>
            Category A: {criticalRecs.length} Critical
          </span>
          <span style={{ backgroundColor: 'rgba(56,139,253,0.15)', color: '#58a6ff', fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(56,139,253,0.3)' }}>
            Category B: {activeRecs.length} Active
          </span>
        </div>
      </div>

      {/* --- Category A: Critical Issue Recommendations --- */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: '#ff7b72', fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid #30363d', paddingBottom: '8px', marginBottom: '12px' }}>
          Category A: Critical Issue Recommendations
        </h3>
        {criticalRecs.length === 0 ? (
          <div style={{ color: '#8b949e', fontSize: '0.85rem', fontStyle: 'italic', padding: '10px 0' }}>
            No critical issue recommendations pending.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {criticalRecs.map(rec => (
              <div 
                key={rec.id}
                style={{
                  backgroundColor: '#161b22',
                  border: '1px solid rgba(248,81,73,0.3)',
                  borderRadius: '6px',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#ff7b72', fontFamily: 'monospace' }}>[{rec.id}]</span>
                    <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem' }}>{rec.title}</span>
                  </div>
                  <span style={{ color: '#3fb950', fontWeight: 600, fontSize: '0.82rem', backgroundColor: 'rgba(63,185,80,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                    Confidence: {rec.confidence || 95}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '12px 0', fontSize: '0.85rem' }}>
                  <div style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #f0883e' }}>
                    <strong style={{ color: '#f0883e', display: 'block', marginBottom: '4px' }}>🔍 Root Cause Identified by AI:</strong>
                    <span style={{ color: '#c9d1d9' }}>{rec.rootCause || rec.description}</span>
                  </div>
                  <div style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #58a6ff' }}>
                    <strong style={{ color: '#58a6ff', display: 'block', marginBottom: '4px' }}>💡 AI Recommendation:</strong>
                    <span style={{ color: '#c9d1d9' }}>{rec.suggestedFix}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#8b949e', backgroundColor: '#0d1117', padding: '8px 12px', borderRadius: '4px' }}>
                  <div>
                    <span style={{ color: '#8b949e' }}>Suggested Action: </span>
                    <span style={{ color: '#e3b341' }}>{rec.suggestedAction || `Inspect ${rec.affectedFile}`}</span>
                  </div>
                  <div style={{ color: '#ff7b72' }}>
                    ⚠️ {rec.riskOrWarning || 'Apply fix in isolated environment.'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Category B: Active Issue Recommendations --- */}
      <div>
        <h3 style={{ color: '#58a6ff', fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid #30363d', paddingBottom: '8px', marginBottom: '12px' }}>
          Category B: Active Issue Recommendations
        </h3>
        {activeRecs.length === 0 ? (
          <div style={{ color: '#8b949e', fontSize: '0.85rem', fontStyle: 'italic', padding: '10px 0' }}>
            No active issue recommendations pending.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {activeRecs.map(rec => (
              <div 
                key={rec.id}
                style={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, color: '#58a6ff', fontFamily: 'monospace', fontSize: '0.85rem' }}>[{rec.id}]</span>
                  <span style={{ color: '#3fb950', fontSize: '0.78rem', fontWeight: 600 }}>Confidence: {rec.confidence || 88}%</span>
                </div>

                <div style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                  {rec.title}
                </div>

                <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: '8px' }}>
                  File: <code style={{ color: '#58a6ff' }}>{rec.affectedFile}</code>
                </div>

                <div style={{ backgroundColor: '#0d1117', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', color: '#c9d1d9', marginBottom: '8px' }}>
                  <strong style={{ color: '#58a6ff', display: 'block', marginBottom: '2px' }}>Recommended Fix:</strong>
                  {rec.suggestedFix}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#8b949e' }}>
                  Next Action: <span style={{ color: '#e3b341' }}>{rec.suggestedAction || 'Review code snippet & test'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
