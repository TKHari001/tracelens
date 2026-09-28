import React, { useState, useEffect } from 'react';
import { ActiveIssuesSection, type DiagnosticIssue } from './ActiveIssuesSection.tsx';
import { CriticalIssuesSection } from './CriticalIssuesSection.tsx';
import { RunningFilesSection } from './RunningFilesSection.tsx';
import { AIRecommendationsSection } from './AIRecommendationsSection.tsx';
import { RemediationHistorySection, type RemediationRecordItem } from './RemediationHistorySection.tsx';

type Props = {
  packageName?: string;
  files?: Array<{ path: string; content?: string }>;
  issues: DiagnosticIssue[];
  remediationHistory?: RemediationRecordItem[];
  isAnalyzing?: boolean;
  onSelectIssue?: (issue: DiagnosticIssue) => void;
  selectedIssueId?: string;
  onSimulateEvent?: () => void;
  activeView?: string;
};

export function StructuredDashboard({
  packageName,
  files,
  issues,
  remediationHistory,
  isAnalyzing,
  onSelectIssue,
  selectedIssueId,
  onSimulateEvent,
  activeView
}: Props) {
  const getFilterFromActiveView = (view?: string): 'ALL' | 'ACTIVE' | 'CRITICAL' | 'FILES' | 'AI' | 'HISTORY' => {
    switch (view) {
      case 'issues':
        return 'ACTIVE';
      case 'critical':
        return 'CRITICAL';
      case 'advisor':
        return 'AI';
      case 'history':
        return 'HISTORY';
      case 'files':
        return 'FILES';
      default:
        return 'ALL';
    }
  };

  const [filterView, setFilterView] = useState<'ALL' | 'ACTIVE' | 'CRITICAL' | 'FILES' | 'AI' | 'HISTORY'>(
    () => getFilterFromActiveView(activeView)
  );

  useEffect(() => {
    if (activeView) {
      setFilterView(getFilterFromActiveView(activeView));
    }
  }, [activeView]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Top Header & Section Filter Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '16px'
      }}>
        <div>
          <h1 style={{ margin: 0, color: '#ffffff', fontSize: '1.4rem', fontWeight: 600 }}>
            {filterView === 'ACTIVE' && 'Section 1: Active Issues'}
            {filterView === 'CRITICAL' && 'Section 2: Critical Issues'}
            {filterView === 'FILES' && 'Section 3: Running Files & Packages'}
            {filterView === 'AI' && 'Section 4: AI Recommendations & Advisor'}
            {filterView === 'HISTORY' && 'Section 5: Remediation History'}
            {filterView === 'ALL' && 'Automated Debugger Dashboard'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '0.88rem' }}>
            Specification-compliant visual architecture for live diagnostics, critical triage, AI recommendations & remediation audit history.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onSimulateEvent && (
            <button 
              onClick={onSimulateEvent} 
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#238636', 
                color: '#fff', 
                border: '1px solid rgba(240,246,252,0.1)', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              ⚡ Simulate Telemetry Event
            </button>
          )}
        </div>
      </div>

      {/* Quick Navigation Tabs for the 5 Main Specification Sections */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { key: 'ACTIVE', label: '1. Active Issues' },
          { key: 'CRITICAL', label: '2. Critical Issues' },
          { key: 'FILES', label: '3. Running Files' },
          { key: 'AI', label: '4. AI Recommendations' },
          { key: 'HISTORY', label: '5. Remediation History' },
          { key: 'ALL', label: '📊 All Sections View' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterView(tab.key as any)}
            style={{
              padding: '8px 14px',
              backgroundColor: filterView === tab.key ? '#1f6feb' : '#21262d',
              color: filterView === tab.key ? '#ffffff' : '#c9d1d9',
              border: filterView === tab.key ? '1px solid #388bfd' : '1px solid #30363d',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: filterView === tab.key ? 600 : 500,
              fontSize: '0.85rem',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section 1: Active Issues */}
      {(filterView === 'ALL' || filterView === 'ACTIVE') && (
        <ActiveIssuesSection 
          issues={issues} 
          onSelectIssue={onSelectIssue} 
          selectedIssueId={selectedIssueId} 
        />
      )}

      {/* Section 2: Critical Issues */}
      {(filterView === 'ALL' || filterView === 'CRITICAL') && (
        <CriticalIssuesSection 
          issues={issues} 
          onSelectIssue={onSelectIssue} 
          selectedIssueId={selectedIssueId} 
        />
      )}

      {/* Section 3: Currently Running Files / Packages */}
      {(filterView === 'ALL' || filterView === 'FILES') && (
        <RunningFilesSection 
          packageName={packageName} 
          files={files} 
          issues={issues} 
          isAnalyzing={isAnalyzing} 
        />
      )}

      {/* Section 4: AI Recommendations */}
      {(filterView === 'ALL' || filterView === 'AI') && (
        <AIRecommendationsSection 
          issues={issues} 
        />
      )}

      {/* Section 5: Remediation History */}
      {(filterView === 'ALL' || filterView === 'HISTORY') && (
        <RemediationHistorySection 
          history={remediationHistory} 
        />
      )}
    </div>
  );
}
