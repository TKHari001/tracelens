import React from 'react';

export type DiagnosticIssue = {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Normal' | 'Warning' | 'Info';
  category: string;
  packageName?: string;
  affectedFile: string;
  affectedComponent?: string;
  lineNumber?: number;
  description: string;
  impact: string;
  suggestedFix: string;
  codeSnippet?: string;
  status?: 'Active' | 'Investigating' | 'Fix Suggested' | 'Validation Pending' | 'Fixed' | 'Verified';
  detectionTime?: string;
  rootCause?: string;
  suggestedAction?: string;
  riskOrWarning?: string;
  confidence?: number;
};

type Props = {
  issues: DiagnosticIssue[];
  onSelectIssue?: (issue: DiagnosticIssue) => void;
  selectedIssueId?: string;
};

export function ActiveIssuesSection({ issues, onSelectIssue, selectedIssueId }: Props) {
  const unresolvedIssues = issues.filter(i => i.status !== 'Fixed' && i.status !== 'Verified');

  const getSeverityBadgeStyle = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return { bg: 'rgba(248,81,73,0.15)', color: '#ff7b72', border: 'rgba(248,81,73,0.4)' };
      case 'High':
        return { bg: 'rgba(240,136,62,0.15)', color: '#f0883e', border: 'rgba(240,136,62,0.4)' };
      case 'Medium':
      case 'Normal':
      case 'Warning':
        return { bg: 'rgba(210,153,34,0.15)', color: '#d29922', border: 'rgba(210,153,34,0.4)' };
      case 'Low':
      case 'Info':
      default:
        return { bg: 'rgba(88,166,255,0.15)', color: '#58a6ff', border: 'rgba(88,166,255,0.4)' };
    }
  };

  const getStatusBadgeStyle = (status?: string) => {
    switch (status) {
      case 'Investigating':
        return { bg: 'rgba(163,113,247,0.15)', color: '#a371f7' };
      case 'Fix Suggested':
        return { bg: 'rgba(56,139,253,0.15)', color: '#58a6ff' };
      case 'Validation Pending':
        return { bg: 'rgba(210,153,34,0.15)', color: '#d29922' };
      case 'Active':
      default:
        return { bg: 'rgba(248,81,73,0.1)', color: '#f85149' };
    }
  };

  return (
    <section 
      id="section-active-issues" 
      style={{
        backgroundColor: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: '1.2rem', fontWeight: 600 }}>
              Section 1: Active Issues
            </h2>
            <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '0.85rem' }}>
              All currently detected unresolved software bugs and diagnostic anomalies.
            </p>
          </div>
        </div>
        <span style={{
          backgroundColor: '#21262d',
          color: '#58a6ff',
          fontSize: '0.8rem',
          fontWeight: 600,
          padding: '4px 12px',
          borderRadius: '12px',
          border: '1px solid #30363d'
        }}>
          {unresolvedIssues.length} Unresolved Issues
        </span>
      </div>

      {unresolvedIssues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e', backgroundColor: '#161b22', borderRadius: '6px' }}>
          ✨ No active issues detected in the running codebase.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d', color: '#8b949e', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '10px 12px' }}>Issue ID</th>
                <th>File & Line</th>
                <th>Package / Module</th>
                <th>Issue Title & Description</th>
                <th>Error Type</th>
                <th>Severity</th>
                <th>Detected At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {unresolvedIssues.map(issue => {
                const sevStyle = getSeverityBadgeStyle(issue.severity);
                const statStyle = getStatusBadgeStyle(issue.status);
                const isSelected = selectedIssueId === issue.id;

                return (
                  <tr 
                    key={issue.id}
                    onClick={() => onSelectIssue && onSelectIssue(issue)}
                    style={{
                      borderBottom: '1px solid #21262d',
                      cursor: onSelectIssue ? 'pointer' : 'default',
                      backgroundColor: isSelected ? '#161b22' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#161b22'; }}
                    onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '12px', fontWeight: 700, color: '#58a6ff', fontFamily: 'monospace' }}>
                      {issue.id}
                    </td>
                    <td style={{ color: '#c9d1d9', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {issue.affectedFile}
                      {issue.lineNumber ? <span style={{ color: '#8b949e' }}>:{issue.lineNumber}</span> : ''}
                    </td>
                    <td style={{ color: '#8b949e' }}>
                      {issue.packageName || 'Root Package'}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ color: '#f0f6fc', fontWeight: 600, marginBottom: '2px' }}>{issue.title}</div>
                      <div style={{ color: '#8b949e', fontSize: '0.8rem', lineHeight: '1.3' }}>{issue.description}</div>
                    </td>
                    <td style={{ color: '#c9d1d9', fontSize: '0.82rem' }}>
                      {issue.category}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: sevStyle.bg,
                        color: sevStyle.color,
                        border: `1px solid ${sevStyle.border}`
                      }}>
                        {issue.severity}
                      </span>
                    </td>
                    <td style={{ color: '#8b949e', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {issue.detectionTime || 'Just now'}
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: statStyle.bg,
                        color: statStyle.color
                      }}>
                        {issue.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
