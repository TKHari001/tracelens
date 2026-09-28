import React from 'react';
import type { DiagnosticIssue } from './ActiveIssuesSection.tsx';

export type RunningFileItem = {
  fileName: string;
  packageName: string;
  fileType: string;
  runningStatus: 'Running' | 'Idle' | 'Analyzing';
  analysisStatus: 'Completed' | 'In Progress' | 'Pending';
  activeIssuesCount: number;
  criticalIssuesCount: number;
  lastAnalyzedTime: string;
};

type Props = {
  packageName?: string;
  files?: Array<{ path: string; content?: string }>;
  issues?: DiagnosticIssue[];
  isAnalyzing?: boolean;
};

export function RunningFilesSection({ packageName = 'Payment Gateway SDK', files = [], issues = [], isAnalyzing = false }: Props) {
  // Synthesize running files list from provided files or default active set
  const defaultFilesList = [
    { path: 'src/index.ts', type: 'TypeScript' },
    { path: 'src/db/query.ts', type: 'TypeScript' },
    { path: 'src/services/payment.ts', type: 'TypeScript' },
    { path: 'src/utils/parser.ts', type: 'TypeScript' },
    { path: 'src/components/Dashboard.tsx', type: 'TSX' },
    { path: 'src/server.ts', type: 'TypeScript' }
  ];

  const fileItems: RunningFileItem[] = (files.length > 0 ? files : defaultFilesList).map(f => {
    const fileName = f.path.split(/[\\/]/).pop() || f.path;
    const ext = fileName.split('.').pop()?.toUpperCase() || 'CODE';
    const lang = ext === 'TS' ? 'TypeScript' : ext === 'TSX' ? 'TypeScript React' : ext === 'PY' ? 'Python' : ext === 'SQL' ? 'SQL' : ext;

    const fileIssues = issues.filter(i => i.affectedFile.includes(fileName) || f.path.includes(i.affectedFile));
    const activeCount = fileIssues.filter(i => i.status !== 'Fixed' && i.status !== 'Verified').length;
    const critCount = fileIssues.filter(i => i.severity === 'Critical' && i.status !== 'Fixed' && i.status !== 'Verified').length;

    return {
      fileName,
      packageName,
      fileType: lang,
      runningStatus: isAnalyzing ? 'Analyzing' : 'Running',
      analysisStatus: isAnalyzing ? 'In Progress' : 'Completed',
      activeIssuesCount: activeCount,
      criticalIssuesCount: critCount,
      lastAnalyzedTime: new Date().toLocaleTimeString()
    };
  });

  return (
    <section 
      id="section-running-files" 
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
          <span style={{ fontSize: '1.2rem' }}>⚡</span>
          <div>
            <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: '1.2rem', fontWeight: 600 }}>
              Section 3: Currently Running Files / Packages
            </h2>
            <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '0.85rem' }}>
              Real-time software execution and active static analysis inventory.
            </p>
          </div>
        </div>
        <span style={{
          backgroundColor: '#21262d',
          color: '#3fb950',
          fontSize: '0.8rem',
          fontWeight: 600,
          padding: '4px 12px',
          borderRadius: '12px',
          border: '1px solid #30363d'
        }}>
          {fileItems.length} Files Active
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d', color: '#8b949e', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '10px 12px' }}>File Name</th>
              <th>Package / Module</th>
              <th>Language</th>
              <th>Running Status</th>
              <th>Analysis Status</th>
              <th>Active Issues</th>
              <th>Critical Issues</th>
              <th>Last Analyzed</th>
            </tr>
          </thead>
          <tbody>
            {fileItems.map((item, idx) => (
              <tr 
                key={idx}
                style={{
                  borderBottom: '1px solid #21262d',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#161b22'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '12px', fontWeight: 600, color: '#58a6ff', fontFamily: 'monospace' }}>
                  {item.fileName}
                </td>
                <td style={{ color: '#8b949e' }}>{item.packageName}</td>
                <td style={{ color: '#c9d1d9' }}>
                  <span style={{ backgroundColor: '#21262d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                    {item.fileType}
                  </span>
                </td>
                <td>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: item.runningStatus === 'Running' ? 'rgba(63,185,80,0.15)' : 'rgba(210,153,34,0.15)',
                    color: item.runningStatus === 'Running' ? '#3fb950' : '#d29922'
                  }}>
                    ● {item.runningStatus}
                  </span>
                </td>
                <td>
                  <span style={{ color: item.analysisStatus === 'Completed' ? '#3fb950' : '#58a6ff', fontSize: '0.82rem' }}>
                    {item.analysisStatus}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: item.activeIssuesCount > 0 ? '#d29922' : '#8b949e' }}>
                  {item.activeIssuesCount}
                </td>
                <td style={{ fontWeight: 700, color: item.criticalIssuesCount > 0 ? '#ff7b72' : '#8b949e' }}>
                  {item.criticalIssuesCount}
                </td>
                <td style={{ color: '#8b949e', fontSize: '0.8rem' }}>{item.lastAnalyzedTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
