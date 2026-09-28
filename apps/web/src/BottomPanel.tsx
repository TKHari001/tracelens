import React, { useState, useRef, useEffect } from 'react';

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  source: string;
};

type TraceSpan = {
  traceId: string;
  spanName: string;
  durationMs: number;
  status: string;
  service: string;
  timestamp: string;
};

type MetricEntry = {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: string;
};

type AnalysisOutput = {
  packageName: string;
  healthScore: number;
  criticalCount: number;
  normalCount: number;
  aiModelUsed: string;
  summary: string;
  totalFiles: number;
  issues?: any[];
  testSuite?: any[];
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
};

type Props = {
  analysisResult?: AnalysisOutput | null;
  remediationResult?: RemediationOutput | null;
};

export function BottomPanel({ analysisResult, remediationResult }: Props) {
  const [activeTab, setActiveTab] = useState('problems');
  const [panelHeight, setPanelHeight] = useState(220);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(220);

  // Live SSE data
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [traces, setTraces] = useState<TraceSpan[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [sseAnalysis, setSseAnalysis] = useState<AnalysisOutput | null>(null);
  const [sseRemediation, setSseRemediation] = useState<RemediationOutput | null>(null);
  const [connected, setConnected] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Connect to SSE stream on mount
  useEffect(() => {
    const eventSource = new EventSource('/api/telemetry/stream');

    eventSource.addEventListener('connected', () => {
      setConnected(true);
    });

    eventSource.addEventListener('log.entry', (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLogs(prev => [...prev.slice(-200), entry]); // Keep last 200 entries
    });

    eventSource.addEventListener('trace.span', (e) => {
      const span: TraceSpan = JSON.parse(e.data);
      setTraces(prev => [...prev.slice(-100), span]);
    });

    eventSource.addEventListener('metric.update', (e) => {
      const metric: MetricEntry = JSON.parse(e.data);
      setMetrics(prev => {
        const existing = prev.findIndex(m => m.name === metric.name);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = metric;
          return updated;
        }
        return [...prev, metric];
      });
    });

    eventSource.addEventListener('analysis.output', (e) => {
      const result: AnalysisOutput = JSON.parse(e.data);
      setSseAnalysis(result);
      setActiveTab('output'); // Auto-switch to output tab
    });

    eventSource.addEventListener('remediation.output', (e) => {
      const result: RemediationOutput = JSON.parse(e.data);
      setSseRemediation(result);
      setActiveTab('remediation'); // Auto-switch to remediation tab
    });

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => eventSource.close();
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  // Use SSE data as fallback if no props passed
  const outputData = analysisResult || sseAnalysis;
  const remData = remediationResult || sseRemediation;

  const tabs = [
    { id: 'problems', label: 'PROBLEMS', count: outputData ? outputData.criticalCount : 0 },
    { id: 'output', label: 'OUTPUT', count: outputData ? 1 : 0 },
    { id: 'logs', label: 'DEBUG LOGS', count: logs.length },
    { id: 'traces', label: 'TRACES', count: traces.length },
    { id: 'remediation', label: 'REMEDIATION', count: remData ? remData.appliedFixes.length : 0 }
  ];

  const startResize = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, 40), 550);
      setPanelHeight(newHeight);
      if (newHeight > 50 && isCollapsed) setIsCollapsed(false);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const actualHeight = isCollapsed ? 36 : panelHeight;

  const levelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR': return '#ff7b72';
      case 'WARN': return '#d29922';
      case 'INFO': return '#58a6ff';
      case 'DEBUG': return '#8b949e';
      default: return '#c9d1d9';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'OK': return '#3fb950';
      case 'ERROR': return '#ff7b72';
      case 'IN_PROGRESS': case 'STARTED': return '#d29922';
      default: return '#8b949e';
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ts; }
  };

  return (
    <div style={{ height: `${actualHeight}px`, backgroundColor: '#0d1117', borderTop: '1px solid #30363d', display: 'flex', flexDirection: 'column', transition: isDraggingRef.current ? 'none' : 'height 0.15s ease' }}>
      {/* Draggable Top Handle */}
      <div
        onMouseDown={startResize}
        title="Drag up or down to adjust terminal height"
        style={{
          height: '6px',
          backgroundColor: '#21262d',
          cursor: 'ns-resize',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderBottom: '1px solid #30363d'
        }}
      >
        <div style={{ width: '36px', height: '3px', borderRadius: '2px', backgroundColor: '#8b949e' }} />
      </div>

      {/* Tabs & Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', padding: '0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {/* SSE connection indicator */}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: connected ? '#3fb950' : '#f85149', marginRight: '8px', boxShadow: connected ? '0 0 6px rgba(63,185,80,0.4)' : 'none' }} title={connected ? 'SSE Connected' : 'SSE Disconnected'} />
          {tabs.map(t => (
            <button 
              key={t.id}
              onClick={() => { setActiveTab(t.id); if (isCollapsed) setIsCollapsed(false); }}
              style={{
                padding: '8px 14px',
                backgroundColor: 'transparent',
                color: activeTab === t.id ? '#c9d1d9' : '#8b949e',
                border: 'none',
                borderBottom: activeTab === t.id ? '2px solid #58a6ff' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span style={{
                  backgroundColor: t.id === 'problems' ? 'rgba(248,81,73,0.2)' : 'rgba(88,166,255,0.15)',
                  color: t.id === 'problems' ? '#ff7b72' : '#58a6ff',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.65rem',
                  fontWeight: 700
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Layout Editing & Height Preset Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => { setLogs([]); setTraces([]); setMetrics([]); }} style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#8b949e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>🗑 Clear</button>
          <button onClick={() => setPanelHeight(100)} style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#8b949e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>Compact</button>
          <button onClick={() => setPanelHeight(220)} style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#8b949e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>Medium</button>
          <button onClick={() => setPanelHeight(380)} style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', color: '#8b949e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>Expanded</button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ backgroundColor: '#21262d', border: '1px solid #30363d', color: '#58a6ff', padding: '2px 10px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
          >
            {isCollapsed ? '▲ Expand' : '▼ Collapse'}
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      {!isCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', color: '#c9d1d9', fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace", fontSize: '0.8rem', lineHeight: '1.6' }}>

          {/* ====== PROBLEMS TAB ====== */}
          {activeTab === 'problems' && (
            <div>
              {outputData && outputData.issues && outputData.issues.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {outputData.issues.filter((i: any) => i.severity === 'Critical').map((issue: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', padding: '6px 8px', borderRadius: '4px', backgroundColor: 'rgba(248,81,73,0.06)', borderLeft: '3px solid #ff7b72' }}>
                      <span style={{ color: '#ff7b72', fontWeight: 700, minWidth: '60px', fontSize: '0.72rem' }}>CRITICAL</span>
                      <span style={{ color: '#c9d1d9', flex: 1 }}>{issue.title}</span>
                      <span style={{ color: '#8b949e', fontSize: '0.72rem', fontFamily: 'monospace' }}>{issue.affectedFile}{issue.lineNumber ? `:${issue.lineNumber}` : ''}</span>
                    </div>
                  ))}
                  {outputData.issues.filter((i: any) => i.severity !== 'Critical').map((issue: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: '12px', padding: '4px 8px', borderRadius: '4px', borderLeft: '3px solid #d29922' }}>
                      <span style={{ color: '#d29922', fontWeight: 700, minWidth: '60px', fontSize: '0.72rem' }}>WARNING</span>
                      <span style={{ color: '#c9d1d9', flex: 1 }}>{issue.title}</span>
                      <span style={{ color: '#8b949e', fontSize: '0.72rem', fontFamily: 'monospace' }}>{issue.affectedFile}{issue.lineNumber ? `:${issue.lineNumber}` : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#3fb950', padding: '8px 0' }}>✅ No critical compiler or runtime problems detected in this workspace.</div>
              )}
            </div>
          )}

          {/* ====== OUTPUT TAB ====== */}
          {activeTab === 'output' && (
            <div>
              {outputData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '20px', padding: '8px 10px', backgroundColor: 'rgba(88,166,255,0.08)', borderRadius: '6px', border: '1px solid rgba(88,166,255,0.2)' }}>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Package</span>
                      <div style={{ color: '#58a6ff', fontWeight: 600 }}>{outputData.packageName}</div>
                    </div>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Health Score</span>
                      <div style={{ color: outputData.healthScore > 80 ? '#3fb950' : '#d29922', fontWeight: 700, fontSize: '1.1rem' }}>{outputData.healthScore}%</div>
                    </div>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Critical</span>
                      <div style={{ color: '#ff7b72', fontWeight: 700 }}>{outputData.criticalCount}</div>
                    </div>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Normal</span>
                      <div style={{ color: '#d29922', fontWeight: 700 }}>{outputData.normalCount}</div>
                    </div>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Files</span>
                      <div style={{ color: '#c9d1d9', fontWeight: 600 }}>{outputData.totalFiles}</div>
                    </div>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>AI Model</span>
                      <div style={{ color: '#a5d6ff', fontWeight: 600 }}>{outputData.aiModelUsed}</div>
                    </div>
                  </div>
                  <div style={{ color: '#c9d1d9', padding: '6px 0', borderBottom: '1px solid #21262d' }}>
                    💡 <strong>Summary:</strong> {outputData.summary}
                  </div>
                  {outputData.localPathProvided && (
                    <div style={{ color: '#58a6ff', fontSize: '0.78rem' }}>
                      📂 Analyzed from local disk: <span style={{ fontFamily: 'monospace', color: '#79c0ff' }}>{outputData.resolvedPath}</span>
                    </div>
                  )}
                  {outputData.testSuite && outputData.testSuite.length > 0 && (
                    <div>
                      <div style={{ color: '#8b949e', fontSize: '0.72rem', textTransform: 'uppercase', marginTop: '8px', marginBottom: '4px' }}>Test Suite Results</div>
                      {outputData.testSuite.map((test: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', gap: '10px', padding: '3px 0', fontSize: '0.78rem' }}>
                          <span style={{ color: test.status === 'PASSED' ? '#3fb950' : '#ff7b72', fontWeight: 700, minWidth: '55px' }}>{test.status === 'PASSED' ? '✓ PASS' : '✗ FAIL'}</span>
                          <span style={{ color: '#c9d1d9', flex: 1 }}>{test.testName}</span>
                          <span style={{ color: '#8b949e' }}>{test.durationMs}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#8b949e', padding: '16px 0', textAlign: 'center' }}>
                  📋 Waiting for package analysis output... Run an analysis above to see results here.
                </div>
              )}
            </div>
          )}

          {/* ====== DEBUG LOGS TAB ====== */}
          {activeTab === 'logs' && (
            <div>
              {logs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {logs.map((entry, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', padding: '2px 0', borderBottom: '1px solid rgba(48,54,61,0.3)' }}>
                      <span style={{ color: '#484f58', minWidth: '65px', fontSize: '0.72rem' }}>{formatTime(entry.timestamp)}</span>
                      <span style={{ color: levelColor(entry.level), fontWeight: 700, minWidth: '40px', fontSize: '0.72rem' }}>{entry.level}</span>
                      <span style={{ color: '#58a6ff', minWidth: '100px', fontSize: '0.72rem' }}>[{entry.source}]</span>
                      <span style={{ color: '#c9d1d9', flex: 1 }}>{entry.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              ) : (
                <div style={{ color: '#8b949e', padding: '16px 0', textAlign: 'center' }}>
                  📡 Listening for live debug logs via SSE stream...{connected ? ' (Connected)' : ' (Connecting...)'}
                </div>
              )}
            </div>
          )}

          {/* ====== TRACES TAB ====== */}
          {activeTab === 'traces' && (
            <div>
              {traces.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', gap: '10px', padding: '4px 8px', color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '1px solid #21262d', marginBottom: '4px' }}>
                    <span style={{ minWidth: '65px' }}>Time</span>
                    <span style={{ minWidth: '180px' }}>Span Name</span>
                    <span style={{ minWidth: '100px' }}>Service</span>
                    <span style={{ minWidth: '70px' }}>Duration</span>
                    <span>Status</span>
                  </div>
                  {traces.map((span, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', padding: '3px 8px', borderBottom: '1px solid rgba(48,54,61,0.2)', fontSize: '0.78rem' }}>
                      <span style={{ color: '#484f58', minWidth: '65px', fontSize: '0.72rem' }}>{formatTime(span.timestamp)}</span>
                      <span style={{ color: '#79c0ff', minWidth: '180px' }}>{span.spanName}</span>
                      <span style={{ color: '#8b949e', minWidth: '100px' }}>{span.service}</span>
                      <span style={{ color: '#c9d1d9', minWidth: '70px', fontFamily: 'monospace' }}>{span.durationMs}ms</span>
                      <span style={{ color: statusColor(span.status), fontWeight: 600 }}>{span.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#8b949e', padding: '16px 0', textAlign: 'center' }}>
                  🔗 Waiting for distributed trace spans via SSE...{connected ? ' (Connected)' : ' (Connecting...)'}
                </div>
              )}
            </div>
          )}

          {/* ====== REMEDIATION TAB ====== */}
          {activeTab === 'remediation' && (
            <div>
              {remData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '15px', padding: '8px 10px', backgroundColor: remData.success ? 'rgba(46,160,67,0.08)' : 'rgba(248,81,73,0.08)', borderRadius: '6px', border: `1px solid ${remData.success ? 'rgba(46,160,67,0.3)' : 'rgba(248,81,73,0.3)'}` }}>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Status</span>
                      <div style={{ color: remData.success ? '#3fb950' : '#ff7b72', fontWeight: 700 }}>
                        {remData.success ? '✅ Remediation Successful' : '❌ Remediation Failed'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Fixes Applied</span>
                      <div style={{ color: '#58a6ff', fontWeight: 700 }}>{remData.appliedFixes.length}</div>
                    </div>
                    <div>
                      <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Lines Modified</span>
                      <div style={{ color: '#d29922', fontWeight: 700 }}>{remData.modifiedLines.length}</div>
                    </div>
                    {remData.savedToDisk && (
                      <div>
                        <span style={{ color: '#8b949e', fontSize: '0.7rem', textTransform: 'uppercase' }}>Disk Write</span>
                        <div style={{ color: '#3fb950', fontWeight: 700 }}>💾 Saved</div>
                      </div>
                    )}
                  </div>

                  <div style={{ color: '#8b949e', fontSize: '0.72rem', textTransform: 'uppercase', marginTop: '4px' }}>Applied Fixes</div>
                  {remData.appliedFixes.map((fix, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', padding: '4px 8px', borderLeft: '3px solid #3fb950', borderRadius: '2px', backgroundColor: 'rgba(46,160,67,0.04)' }}>
                      <span style={{ color: '#3fb950', fontWeight: 600 }}>✓</span>
                      <span style={{ color: '#c9d1d9' }}>{fix}</span>
                    </div>
                  ))}

                  {remData.filePath && (
                    <div style={{ marginTop: '6px', fontSize: '0.78rem' }}>
                      <span style={{ color: '#8b949e' }}>Target File: </span>
                      <span style={{ color: '#79c0ff', fontFamily: 'monospace' }}>{remData.filePath}</span>
                    </div>
                  )}

                  {/* Metrics bar */}
                  {metrics.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ color: '#8b949e', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '4px' }}>Live Metrics</div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {metrics.map((m, idx) => (
                          <div key={idx} style={{ padding: '4px 10px', backgroundColor: '#161b22', borderRadius: '4px', border: '1px solid #30363d', fontSize: '0.75rem' }}>
                            <span style={{ color: '#8b949e' }}>{m.name}: </span>
                            <span style={{ color: '#58a6ff', fontWeight: 700 }}>{m.value}</span>
                            <span style={{ color: '#484f58', marginLeft: '2px' }}>{m.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#8b949e', padding: '16px 0', textAlign: 'center' }}>
                  🔧 Waiting for remediation results... Apply fixes from the Package Analyzer to see AI remediation output here.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
