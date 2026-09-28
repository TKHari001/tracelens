import React from 'react';
import type { DiagnosticIssue } from './ActiveIssuesSection.tsx';

type Props = {
  issues: DiagnosticIssue[];
  onSelectIssue?: (issue: DiagnosticIssue) => void;
  selectedIssueId?: string;
};

export function CriticalIssuesSection({ issues, onSelectIssue, selectedIssueId }: Props) {
  const criticalIssues = issues.filter(
    i => i.severity === 'Critical' && i.status !== 'Fixed' && i.status !== 'Verified'
  );

  return (
    <section 
      id="section-critical-issues" 
      style={{
        backgroundColor: '#0d1117',
        border: '1px solid rgba(248,81,73,0.4)',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 16px rgba(248,81,73,0.1)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem', color: '#ff7b72' }}>🚨</span>
          <div>
            <h2 style={{ margin: 0, color: '#ff7b72', fontSize: '1.2rem', fontWeight: 600 }}>
              Section 2: Critical Issues
            </h2>
            <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '0.85rem' }}>
              Urgent, high-severity bugs requiring immediate developer attention.
            </p>
          </div>
        </div>
        <span style={{
          backgroundColor: 'rgba(248,81,73,0.15)',
          color: '#ff7b72',
          fontSize: '0.8rem',
          fontWeight: 700,
          padding: '4px 12px',
          borderRadius: '12px',
          border: '1px solid rgba(248,81,73,0.4)'
        }}>
          {criticalIssues.length} Critical Alert{criticalIssues.length === 1 ? '' : 's'}
        </span>
      </div>

      {criticalIssues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#3fb950', backgroundColor: 'rgba(63,185,80,0.05)', border: '1px dashed rgba(63,185,80,0.3)', borderRadius: '6px' }}>
          ✅ No critical issues found. Core system stability is healthy.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
          {criticalIssues.map(issue => {
            const isSelected = selectedIssueId === issue.id;

            return (
              <div 
                key={issue.id}
                onClick={() => onSelectIssue && onSelectIssue(issue)}
                style={{
                  backgroundColor: isSelected ? '#1c2128' : '#161b22',
                  border: isSelected ? '1px solid #ff7b72' : '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '16px',
                  cursor: onSelectIssue ? 'pointer' : 'default',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#ff7b72', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                    {issue.id}
                  </span>
                  <span style={{
                    backgroundColor: 'rgba(248,81,73,0.2)',
                    color: '#ff7b72',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    CRITICAL
                  </span>
                </div>

                <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.95rem', marginBottom: '6px' }}>
                  {issue.title}
                </div>

                <p style={{ color: '#8b949e', fontSize: '0.82rem', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                  {issue.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: '#c9d1d9', backgroundColor: '#0d1117', padding: '8px 10px', borderRadius: '4px' }}>
                  <div>
                    <span style={{ color: '#8b949e' }}>File: </span>
                    <code style={{ color: '#58a6ff' }}>{issue.affectedFile}</code>
                  </div>
                  <div>
                    <span style={{ color: '#8b949e' }}>Component: </span>
                    <span style={{ color: '#e3b341' }}>{issue.affectedComponent || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#8b949e' }}>Detected: </span>
                    <span>{issue.detectionTime || 'Just now'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#8b949e' }}>Status: </span>
                    <span style={{ color: '#f85149', fontWeight: 600 }}>{issue.status || 'Active'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
