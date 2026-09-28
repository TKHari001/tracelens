import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { BottomPanel } from './BottomPanel.tsx';
import { IntelligencePanel } from './IntelligencePanel.tsx';
import { ArchitectureGraph } from './ArchitectureGraph.tsx';
import { PackageAnalyzer } from './PackageAnalyzer.tsx';
import { AIChatbot } from './AIChatbot.tsx';
import { ActiveIssuesSection, type DiagnosticIssue } from './ActiveIssuesSection.tsx';
import { CriticalIssuesSection } from './CriticalIssuesSection.tsx';
import { AIRecommendationsSection } from './AIRecommendationsSection.tsx';
import { RemediationHistorySection, type RemediationRecordItem } from './RemediationHistorySection.tsx';
import './style.css';

type AnalysisOutput = {
  packageName: string;
  framework: string;
  healthScore: number;
  criticalCount: number;
  normalCount: number;
  aiModelUsed: string;
  summary: string;
  totalFiles: number;
  issues: DiagnosticIssue[];
  testSuite: any[];
  localPathProvided?: boolean;
  resolvedPath?: string | null;
};

type RemediationOutput = {
  success: boolean;
  appliedFixes: string[];
  modifiedLines: number[];
  originalCode: string;
  patchedCode: string;
  savedToDisk?: boolean;
  filePath?: string;
  updatedAnalysis?: AnalysisOutput;
};

export function XRayVision() {
  const [activeView, setActiveView] = useState('issues');
  const [chatQuery, setChatQuery] = useState<string | undefined>(undefined);

  // Synchronized Master Dynamic Analysis & Remediation State (Empty by default until user analyzes a package)
  const [analysisResult, setAnalysisResult] = useState<AnalysisOutput | null>(null);
  const [remediationResult, setRemediationResult] = useState<RemediationOutput | null>(null);
  const [issues, setIssues] = useState<DiagnosticIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<DiagnosticIssue | null>(null);
  const [remediationHistory, setRemediationHistory] = useState<RemediationRecordItem[]>([]);

  useEffect(() => {
    // Listen for live SSE events from backend telemetry
    const eventSource = new EventSource('/api/telemetry/stream');

    eventSource.addEventListener('issue.detected', (e) => {
      const data = JSON.parse(e.data);
      const newIssue: DiagnosticIssue = {
        id: data.id || `ISS-${Date.now().toString(36).slice(-4)}`,
        title: data.title || 'Telemetry Anomaly Detected',
        severity: (data.severity as any) || 'High',
        category: data.category || 'Runtime Error',
        affectedFile: data.affected_file || 'src/services/payment.ts',
        affectedComponent: data.affected_service || 'Payment Service',
        description: data.stack_trace || 'Anomaly detected during service execution.',
        impact: 'Potential degradation of request latency or resource leakage.',
        suggestedFix: 'Inspect function execution trace and sanitize parameters.',
        status: 'Active',
        detectionTime: new Date().toLocaleTimeString(),
        rootCause: data.root_cause || 'Telemetry event spike',
        confidence: 90
      };
      
      setIssues(prev => {
        const nextIssues = [newIssue, ...prev];
        syncAnalysisState(nextIssues);
        return nextIssues;
      });
    });

    eventSource.addEventListener('analysis.completed', (e) => {
      const data = JSON.parse(e.data);
      setIssues(prev => {
        const next: DiagnosticIssue[] = prev.map(iss => iss.id === data.issueId ? { 
          ...iss, 
          rootCause: data.rootCause, 
          confidence: data.confidence,
          status: 'Fix Suggested' as const
        } : iss);
        syncAnalysisState(next);
        return next;
      });
    });

    return () => eventSource.close();
  }, []);

  // Recalculate dynamic health score and issue counts whenever issues state changes
  const syncAnalysisState = (updatedIssues: DiagnosticIssue[]) => {
    const active = updatedIssues.filter(i => i.status !== 'Fixed' && i.status !== 'Verified');
    const criticalCount = active.filter(i => i.severity === 'Critical').length;
    const normalCount = active.filter(i => i.severity !== 'Critical').length;
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - (criticalCount * 25 + normalCount * 8))));

    setAnalysisResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        healthScore,
        criticalCount,
        normalCount,
        issues: updatedIssues
      };
    });
  };

  const triggerSimulatedEvent = async () => {
    try {
      const res = await fetch('/api/telemetry/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'High latency spike in Payment Gateway API',
          severity: 'Critical',
          category: 'Performance & Latency',
          affectedService: 'Payment Gateway',
          affectedFile: 'src/services/payment.ts',
          stackTrace: 'Error: Connection acquisition timeout after 5000ms at Pool.getConnection'
        })
      });
      if (res.ok) {
        const newEv = await res.json();
        console.log('Simulated event created:', newEv);
      }
    } catch (err) {
      console.error('Failed simulating event:', err);
    }
  };

  const handleApprove = () => {
    if (selectedIssue) {
      const updatedIssues = issues.map(iss => iss.id === selectedIssue.id ? { ...iss, status: 'Fixed' as const } : iss);
      setIssues(updatedIssues);
      syncAnalysisState(updatedIssues);

      const newHistoryItem: RemediationRecordItem = {
        id: `REM-${Date.now().toString(36).slice(-4)}`,
        issueId: selectedIssue.id,
        fileName: selectedIssue.affectedFile,
        originalError: selectedIssue.title,
        category: selectedIssue.category,
        severity: selectedIssue.severity,
        fixApplied: selectedIssue.suggestedFix,
        fixedBy: 'AI Debugger (Approved by User)',
        fixTime: new Date().toLocaleString(),
        validationResult: 'PASSED',
        finalStatus: 'Verified'
      };

      setRemediationHistory(prev => [newHistoryItem, ...prev]);
      alert(`Issue ${selectedIssue.id} resolved and recorded in Remediation History!`);
      setSelectedIssue(null);
    }
  };

  const openChatWithQuery = (query?: string) => {
    setChatQuery(query);
    setActiveView('chat');
  };

  const handleAnalysisComplete = (result: AnalysisOutput | null) => {
    setAnalysisResult(result);
    setIssues(result?.issues || []);
  };

  const handleRemediationComplete = (result: RemediationOutput) => {
    setRemediationResult(result);
    if (result.updatedAnalysis) {
      handleAnalysisComplete(result.updatedAnalysis);
    } else if (result.appliedFixes && result.appliedFixes.length > 0) {
      const updatedIssues = issues.map(iss => {
        const wasApplied = result.appliedFixes.some(f => f.includes(iss.id));
        if (wasApplied) {
          return { ...iss, status: 'Fixed' as const };
        }
        return iss;
      });
      setIssues(updatedIssues);
      syncAnalysisState(updatedIssues);
    }

    if (result.appliedFixes && result.appliedFixes.length > 0) {
      const newRecords: RemediationRecordItem[] = result.appliedFixes.map((fixStr, i) => ({
        id: `REM-${Date.now().toString(36).slice(-4)}-${i}`,
        issueId: fixStr.split(':')[0] || 'FIX-100',
        fileName: result.filePath || 'src/index.ts',
        originalError: fixStr,
        category: 'Code Remediation',
        severity: fixStr.includes('CRIT') ? 'Critical' : 'Medium',
        fixApplied: fixStr,
        fixedBy: 'AI Patch Engine',
        fixTime: new Date().toLocaleString(),
        validationResult: 'PASSED',
        finalStatus: 'Automatically Fixed'
      }));

      setRemediationHistory(prev => [...newRecords, ...prev]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0d1117', color: '#c9d1d9', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar activeView={activeView} onNavClick={setActiveView} />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#010409' }}>
          <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            
            {activeView === 'issues' && (
              <ActiveIssuesSection 
                issues={issues} 
                onSelectIssue={setSelectedIssue} 
                selectedIssueId={selectedIssue?.id} 
              />
            )}

            {activeView === 'critical' && (
              <CriticalIssuesSection 
                issues={issues} 
                onSelectIssue={setSelectedIssue} 
                selectedIssueId={selectedIssue?.id} 
              />
            )}

            {activeView === 'advisor' && (
              <AIRecommendationsSection 
                issues={issues} 
              />
            )}

            {activeView === 'history' && (
              <RemediationHistorySection 
                history={remediationHistory} 
              />
            )}

            {activeView === 'architecture' && <ArchitectureGraph />}
            
            {activeView === 'package' && (
              <PackageAnalyzer 
                onOpenChat={openChatWithQuery} 
                onAnalysisComplete={handleAnalysisComplete}
                onRemediationComplete={handleRemediationComplete}
                currentAnalysis={analysisResult}
              />
            )}
            
            {activeView === 'chat' && (
              <AIChatbot 
                initialQuery={chatQuery} 
                onBack={() => setActiveView('package')} 
              />
            )}

            {['logs', 'metrics', 'traces', 'approvals'].includes(activeView) && (
              <div style={{ textAlign: 'center', padding: '100px 50px', color: '#8b949e', border: '1px dashed #30363d', borderRadius: '8px' }}>
                <h3 style={{ color: '#58a6ff', margin: '0 0 10px 0' }}>{activeView.toUpperCase()} Stream Active</h3>
                <p style={{ margin: 0 }}>Please check the bottom terminal panel below for real-time telemetry streams.</p>
              </div>
            )}
          </div>
        </main>

        {activeView !== 'chat' && activeView !== 'package' && (
          <IntelligencePanel 
            issue={selectedIssue as any} 
            remediation={selectedIssue ? {
              id: `REM-${selectedIssue.id}`,
              issue_id: selectedIssue.id,
              ai_model: analysisResult?.aiModelUsed || 'Claude 3.5 Sonnet',
              confidence: selectedIssue.confidence || 94,
              proposed_action: selectedIssue.suggestedFix,
              status: selectedIssue.status || 'Active'
            } : null} 
            onApprove={handleApprove}
            onReject={() => setSelectedIssue(null)}
          />
        )}
      </div>
      
      {/* Bottom Resizable Multi-Tab Terminal (PROBLEMS, OUTPUT, DEBUG LOGS, TRACES, REMEDIATION) */}
      <BottomPanel 
        analysisResult={analysisResult}
        remediationResult={remediationResult}
      />
    </div>
  );
}
