import React, { useState } from 'react';

type CodeFile = {
  path: string;
  content: string;
};

export type DiagnosticIssue = {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Normal' | 'Warning' | 'Info';
  category: string;
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

type TestCase = {
  testName: string;
  category: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  details: string;
};

type DiagnosticStage = {
  stage: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  inputCount?: number;
  outputCount?: number;
  importantValues?: any;
  error?: string;
  timestamp: string;
};

type AnalysisDiagnostics = {
  sessionId: string;
  originalPath?: string;
  normalizedPath?: string;
  pathExists?: boolean;
  pathIsDirectory?: boolean;
  pathIsFile?: boolean;
  discoveredFiles: Array<{ path: string; language: string; sizeBytes: number; lines: number; charCount: number; preview: string }>;
  staticFindingsCount: number;
  aiFindingsCount: number;
  runtimeFindingsCount: number;
  duplicateCountRemoved: number;
  finalFindingsCount: number;
  criticalCount: number;
  warningCount: number;
  analysisStatus: string;
  stages: DiagnosticStage[];
};

type AnalysisResult = {
  packageName: string;
  framework: string;
  totalFiles: number;
  healthScore: number | null;
  criticalCount: number;
  normalCount: number;
  issues: DiagnosticIssue[];
  testSuite: TestCase[];
  summary: string;
  aiModelUsed: string;
  localPathProvided?: boolean;
  resolvedPath?: string | null;
  sessionId?: string;
  analysisStatus?: string;
  diagnostics?: AnalysisDiagnostics;
};

type Props = {
  onOpenChat: (initialQuery?: string) => void;
  onAnalysisComplete?: (result: any) => void;
  onRemediationComplete?: (result: any) => void;
  currentAnalysis?: AnalysisResult | null;
};

export function PackageAnalyzer({ onOpenChat, onAnalysisComplete, onRemediationComplete, currentAnalysis }: Props) {
  const [localPath, setLocalPath] = useState('');
  const [selectedModel, setSelectedModel] = useState('Anthropic Claude');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'local' | 'demo'>('local');
  const [customCode, setCustomCode] = useState<string>(`// @acme/payment-sdk/index.ts
import { createStream } from './stream';

export function processPayment(req, res) {
  const stream = createStream(req.body);
  stream.on("data", (chunk) => { 
     // Unhandled event listener memory leak
     processChunk(chunk); 
  });
}`);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'issues' | 'tests' | 'splitView' | 'diagnostics'>('issues');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'Critical' | 'Normal'>('ALL');
  
  // Local active file for the code viewer panel
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);

  // Remediation & 60:40 Split View State
  const [selectedFixIds, setSelectedFixIds] = useState<string[]>([]);
  const [isApplyingFix, setIsApplyingFix] = useState(false);
  const [patchedResult, setPatchedResult] = useState<{
    originalCode: string;
    patchedCode: string;
    appliedFixes: string[];
    modifiedLines: number[];
    savedToDisk?: boolean;
  } | null>(null);
  const [saveToDisk, setSaveToDisk] = useState(true);

  // Local state + props fallback
  const [localAnalysis, setLocalAnalysis] = useState<AnalysisResult | null>(null);
  const result = localAnalysis || currentAnalysis || null;

  const runAnalysis = async () => {
    setValidationError(null);
    setPatchedResult(null);
    setLocalAnalysis(null);
    if (onAnalysisComplete) onAnalysisComplete(null);

    const isLocalMode = !!localPath.trim();
    setAnalysisMode(isLocalMode ? 'local' : 'demo');

    // Validation: Require path or active preset
    if (!localPath.trim() && !activePreset) {
      setValidationError('Please select or enter a valid package or file path before starting analysis.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const files: CodeFile[] = [
        { path: 'src/index.ts', content: customCode },
        { path: 'src/db/query.ts', content: 'const query = `SELECT * FROM users WHERE id = ${userId}`;' },
        { path: 'src/server.ts', content: 'app.use(express.json()); // Missing payload limit' },
        { path: 'src/utils/sync.ts', content: 'const raw = fs.readFileSync("./data.json", "utf-8"); // Synchronous I/O' }
      ];

      const res = await fetch('/api/v1/package/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          localPath: localPath.trim() || undefined,
          files: isLocalMode ? undefined : files
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || 'Validation error: Failed to analyze package.');
        return;
      }

      setLocalAnalysis(data);
      setSelectedFixIds((data.issues || []).map((i: DiagnosticIssue) => i.id));
      if (onAnalysisComplete) onAnalysisComplete(data);
    } catch (err: any) {
      console.error('Analysis failed', err);
      setValidationError(`Connection error: ${err.message || String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySelectedFixes = async () => {
    if (!result) return;
    setIsApplyingFix(true);
    try {
      const targetFile = result.issues[0]?.affectedFile || result.resolvedPath || 'src/index.ts';
      const res = await fetch('/api/v1/package/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: targetFile,
          originalCode: customCode,
          fixIds: selectedFixIds,
          writeToDisk: saveToDisk && !!localPath.trim(),
          localPath: localPath.trim() || undefined
        })
      });

      const data = await res.json();
      const remResult = {
        originalCode: data.originalCode || customCode,
        patchedCode: data.patchedCode,
        appliedFixes: data.appliedFixes || [],
        modifiedLines: data.modifiedLines || [],
        savedToDisk: data.savedToDisk,
        success: data.success !== false,
        filePath: data.filePath,
        updatedAnalysis: data.updatedAnalysis
      };

      setPatchedResult(remResult);
      if (data.updatedAnalysis) {
        setLocalAnalysis(data.updatedAnalysis);
        if (onAnalysisComplete) onAnalysisComplete(data.updatedAnalysis);
      }
      if (onRemediationComplete) {
        onRemediationComplete(remResult);
      }

      setActiveTab('splitView');
    } catch (err) {
      console.error('Failed applying fix:', err);
    } finally {
      setIsApplyingFix(false);
    }
  };

  const toggleFixSelection = (id: string) => {
    setSelectedFixIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const loadPreset = (preset: string) => {
    setLocalPath('');
    setValidationError(null);
    setActivePreset(preset);
    setAnalysisMode('demo');
    if (preset === 'payment') {
      setCustomCode(`// @acme/payment-sdk/index.ts\nexport async function handleCheckout(payload) {\n  const query = \`SELECT * FROM accounts WHERE id = \${payload.accountId}\`;\n  const conn = await pool.getConnection();\n  // Missing catch block on async stream\n  conn.query(query);\n}`);
    } else if (preset === 'auth') {
      setCustomCode(`// @acme/auth-middleware/index.ts\nexport function verifyToken(req, res, next) {\n  const token = req.headers.authorization;\n  if (!token) return res.status(401).send("Unauthorized");\n  const raw = fs.readFileSync("./keys/jwt.pub", "utf-8"); // Sync I/O blocking loop\n  const user = jwt.verify(token, raw);\n  req.user = user;\n  next();\n}`);
    } else if (preset === 'pipeline') {
      setCustomCode(`// @acme/stream-pipeline/worker.ts\nexport function startWorker() {\n  process.on("uncaughtException", (err) => {\n     console.log("Error occurred", err);\n     // Missing listener removal\n  });\n}`);
    }
  };

  const scannedFilesList = result?.diagnostics?.discoveredFiles?.map(f => ({
    name: f.path,
    content: f.preview || '(Source code loaded)'
  })) || [
    { name: 'src/index.ts', content: customCode },
    { name: 'src/db/query.ts', content: 'const query = `SELECT * FROM users WHERE id = ${userId}`;' },
    { name: 'src/server.ts', content: 'app.use(express.json()); // Missing body limit' }
  ];

  const filteredIssues = result?.issues.filter(i => {
    if (filterSeverity === 'ALL') return true;
    return i.severity === filterSeverity;
  }) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Compact IDE Header & Controls */}
      <div style={{ backgroundColor: '#161b22', padding: '14px 18px', borderRadius: '8px', border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem', color: '#58a6ff' }}>📦</span>
          <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: '1.1rem', fontWeight: 600 }}>
            Whole-Package Code Analyzer
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{ 
              backgroundColor: '#010409', 
              color: '#58a6ff', 
              border: '1px solid #30363d', 
              borderRadius: '6px', 
              padding: '6px 12px', 
              fontSize: '0.82rem',
              fontWeight: 600,
              outline: 'none'
            }}
          >
            <option value="Anthropic Claude">Anthropic Claude 3.5 Sonnet</option>
            <option value="OpenAI ChatGPT">OpenAI ChatGPT (GPT-4o)</option>
            <option value="Google Gemini">Google Gemini 1.5 Pro</option>
          </select>

          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            style={{
              backgroundColor: isAnalyzing ? '#21262d' : '#238636',
              color: '#fff',
              border: 'none',
              padding: '7px 16px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            {isAnalyzing ? 'Scanning Package...' : '🚀 Analyze Package'}
          </button>
        </div>
      </div>

      {/* Compact Path Input Section & Quick Demo Presets */}
      <div style={{ backgroundColor: '#161b22', padding: '14px 18px', borderRadius: '8px', border: '1px solid #30363d', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.78rem', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📂 Local Package or File Path
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>Demo Presets:</span>
            <button onClick={() => loadPreset('payment')} style={{ backgroundColor: activePreset === 'payment' ? '#1f6beb' : '#21262d', border: '1px solid #30363d', color: '#c9d1d9', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>💳 Payment SDK</button>
            <button onClick={() => loadPreset('auth')} style={{ backgroundColor: activePreset === 'auth' ? '#1f6beb' : '#21262d', border: '1px solid #30363d', color: '#c9d1d9', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>🔒 Auth Middleware</button>
            <button onClick={() => loadPreset('pipeline')} style={{ backgroundColor: activePreset === 'pipeline' ? '#1f6beb' : '#21262d', border: '1px solid #30363d', color: '#c9d1d9', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>⚡ Stream Pipeline</button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Select package or enter local path"
          value={localPath}
          onChange={(e) => {
            setLocalPath(e.target.value);
            setActivePreset(null);
            setValidationError(null);
          }}
          style={{
            width: '100%',
            backgroundColor: '#010409',
            border: validationError ? '1px solid #ff7b72' : '1px solid #30363d',
            color: '#79c0ff',
            fontFamily: 'monospace',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            outline: 'none'
          }}
        />

        {/* Validation Warning Alert */}
        {validationError && (
          <div style={{ backgroundColor: 'rgba(248,81,73,0.15)', border: '1px solid rgba(248,81,73,0.4)', color: '#ff7b72', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 500 }}>
            ⚠️ {validationError}
          </div>
        )}
      </div>

      {/* Compact Executive Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div style={{ backgroundColor: '#161b22', padding: '12px 16px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Package Health Score</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: result ? ((result.healthScore ?? 0) > 80 ? '#3fb950' : '#d29922') : '#8b949e', marginTop: '2px' }}>
            {result ? `${result.healthScore}%` : '—'}
          </div>
        </div>
        <div style={{ backgroundColor: '#161b22', padding: '12px 16px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Critical Failures</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: result && result.criticalCount > 0 ? '#ff7b72' : '#3fb950', marginTop: '2px' }}>
            {result ? result.criticalCount : 0}
          </div>
        </div>
        <div style={{ backgroundColor: '#161b22', padding: '12px 16px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>Normal Warnings</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#d29922', marginTop: '2px' }}>
            {result ? result.normalCount : 0}
          </div>
        </div>
        <div style={{ backgroundColor: '#161b22', padding: '12px 16px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', fontWeight: 600 }}>AI Reasoning Model</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#58a6ff', marginTop: '6px' }}>
            {result ? result.aiModelUsed : selectedModel}
          </div>
        </div>
      </div>

      {/* Analysis Output Section */}
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Compact AI Summary Statement Banner */}
          <div style={{ backgroundColor: 'rgba(56,139,253,0.1)', border: '1px solid rgba(56,139,253,0.3)', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#c9d1d9', fontSize: '0.85rem' }}>
              💡 <strong>Summary:</strong> {result.summary}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={applySelectedFixes}
                disabled={isApplyingFix || selectedFixIds.length === 0}
                style={{ backgroundColor: '#238636', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                {isApplyingFix ? 'Applying Fixes...' : `⚡ Apply Selected Fixes (${selectedFixIds.length})`}
              </button>
              <button
                onClick={() => onOpenChat(`Let's discuss the package analysis for ${result.packageName} (${result.healthScore}% health score).`)}
                style={{ backgroundColor: '#1f6beb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                💬 Discuss with AI
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ borderBottom: '1px solid #30363d', display: 'flex', gap: '16px' }}>
            <button
              onClick={() => setActiveTab('issues')}
              style={{ padding: '8px 0', border: 'none', background: 'none', color: activeTab === 'issues' ? '#58a6ff' : '#8b949e', borderBottom: activeTab === 'issues' ? '2px solid #58a6ff' : 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Categorized Issues & Fixes ({result.issues.length})
            </button>
            <button
              onClick={() => setActiveTab('splitView')}
              style={{ padding: '8px 0', border: 'none', background: 'none', color: activeTab === 'splitView' ? '#58a6ff' : '#8b949e', borderBottom: activeTab === 'splitView' ? '2px solid #58a6ff' : 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              📐 60:40 Split View & Diff
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              style={{ padding: '8px 0', border: 'none', background: 'none', color: activeTab === 'tests' ? '#58a6ff' : '#8b949e', borderBottom: activeTab === 'tests' ? '2px solid #58a6ff' : 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Automated Standard Test Suite ({result.testSuite.length})
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              style={{ padding: '8px 0', border: 'none', background: 'none', color: activeTab === 'diagnostics' ? '#58a6ff' : '#8b949e', borderBottom: activeTab === 'diagnostics' ? '2px solid #58a6ff' : 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              🔍 Analysis Diagnostics
            </button>
          </div>

          {/* Tab 1: Issues View with Checkboxes for Automatic Fixes */}
          {activeTab === 'issues' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#8b949e' }}>Filter Priority:</span>
                  <button onClick={() => setFilterSeverity('ALL')} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', border: 'none', backgroundColor: filterSeverity === 'ALL' ? '#388bfd' : '#21262d', color: '#fff', cursor: 'pointer' }}>All ({result.issues.length})</button>
                  <button onClick={() => setFilterSeverity('Critical')} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', border: 'none', backgroundColor: filterSeverity === 'Critical' ? '#da3633' : '#21262d', color: '#fff', cursor: 'pointer' }}>Critical ({result.criticalCount})</button>
                  <button onClick={() => setFilterSeverity('Normal')} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', border: 'none', backgroundColor: filterSeverity === 'Normal' ? '#d29922' : '#21262d', color: '#fff', cursor: 'pointer' }}>Normal ({result.normalCount})</button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: '#8b949e' }}>
                  <input
                    type="checkbox"
                    checked={saveToDisk}
                    onChange={(e) => setSaveToDisk(e.target.checked)}
                  />
                  Save fixes directly to local disk file
                </label>
              </div>

              {filteredIssues.map((iss) => {
                const isChecked = selectedFixIds.includes(iss.id);
                return (
                  <div key={iss.id} style={{ backgroundColor: '#161b22', border: isChecked ? '1px solid #388bfd' : '1px solid #30363d', borderRadius: '6px', padding: '14px', transition: 'border-color 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFixSelection(iss.id)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#238636' }}
                        />
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: iss.severity === 'Critical' ? 'rgba(248,81,73,0.15)' : 'rgba(210,153,34,0.15)',
                          color: iss.severity === 'Critical' ? '#ff7b72' : '#d29922'
                        }}>
                          {iss.severity}
                        </span>
                        <h4 style={{ margin: 0, color: '#c9d1d9', fontSize: '0.9rem' }}>{iss.title}</h4>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#8b949e', fontFamily: 'monospace' }}>
                        {iss.affectedFile}{iss.lineNumber ? `:${iss.lineNumber}` : ''}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 8px 0', color: '#8b949e', fontSize: '0.82rem' }}>{iss.description}</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: '#0d1117', padding: '8px', borderRadius: '4px', fontSize: '0.78rem' }}>
                      <div>
                        <strong style={{ color: '#ff7b72' }}>System Impact:</strong>
                        <div style={{ color: '#c9d1d9', marginTop: '2px' }}>{iss.impact}</div>
                      </div>
                      <div>
                        <strong style={{ color: '#3fb950' }}>AI Remediation Suggestion:</strong>
                        <div style={{ color: '#c9d1d9', marginTop: '2px' }}>{iss.suggestedFix}</div>
                      </div>
                    </div>

                    {iss.codeSnippet && (
                      <div style={{ marginTop: '8px' }}>
                        <pre style={{ backgroundColor: '#010409', color: '#79c0ff', padding: '6px 10px', borderRadius: '4px', fontSize: '0.76rem', margin: 0, overflowX: 'auto' }}>
                          <code>{iss.codeSnippet}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: 60:40 Split Screen Code View & VS Code Diff Viewer */}
          {activeTab === 'splitView' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#161b22', padding: '8px 12px', borderRadius: '6px', border: '1px solid #30363d' }}>
                <div style={{ fontSize: '0.82rem', color: '#c9d1d9', fontWeight: 600 }}>
                  VS Code Style Split Screen Code Comparison (60% Source Code : 40% AI Fix Patch)
                </div>
                {patchedResult?.savedToDisk && (
                  <div style={{ color: '#3fb950', fontSize: '0.78rem', fontWeight: 600 }}>
                    ✓ Fix successfully written to local disk file!
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: '10px', minHeight: '350px' }}>
                <div style={{ backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ backgroundColor: '#161b22', padding: '6px 10px', borderBottom: '1px solid #30363d', color: '#8b949e', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    Original Source File (60% Layout Width)
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '10px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    {(patchedResult?.originalCode || customCode).split('\n').map((line, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ width: '40px', color: '#484f58', textAlign: 'right', userSelect: 'none' }}>Line {idx + 1}</span>
                        <span style={{ color: '#c9d1d9', whiteSpace: 'pre-wrap' }}>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: '#0d1117', border: '1px solid #388bfd', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ backgroundColor: 'rgba(56,139,253,0.15)', padding: '6px 10px', borderBottom: '1px solid rgba(56,139,253,0.3)', color: '#58a6ff', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>
                    AI Remediated Patch (40% Layout Width)
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '10px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    {(patchedResult?.patchedCode || customCode).split('\n').map((line, idx) => {
                      const isModified = patchedResult?.modifiedLines.includes(idx + 1) || line.includes('removeListener') || line.includes('$1');
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            gap: '8px',
                            backgroundColor: isModified ? 'rgba(46,160,67,0.15)' : 'transparent',
                            color: isModified ? '#3fb950' : '#79c0ff'
                          }}
                        >
                          <span style={{ width: '40px', color: isModified ? '#3fb950' : '#484f58', textAlign: 'right', userSelect: 'none' }}>Line {idx + 1}</span>
                          <span style={{ width: '12px', color: isModified ? '#3fb950' : 'transparent', userSelect: 'none' }}>{isModified ? '+' : ''}</span>
                          <span style={{ whiteSpace: 'pre-wrap' }}>{line}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Test Suite Matrix */}
          {activeTab === 'tests' && (
            <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #30363d', color: '#8b949e', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th>Test Name</th>
                    <th>Category</th>
                    <th>Duration</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {result.testSuite.map((test, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #21262d' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: test.status === 'PASSED' ? 'rgba(46,160,67,0.15)' : 'rgba(248,81,73,0.15)',
                          color: test.status === 'PASSED' ? '#3fb950' : '#ff7b72'
                        }}>
                          {test.status}
                        </span>
                      </td>
                      <td style={{ color: '#c9d1d9', fontWeight: 500 }}>{test.testName}</td>
                      <td style={{ color: '#8b949e' }}>{test.category}</td>
                      <td style={{ color: '#8b949e', fontFamily: 'monospace' }}>{test.durationMs}ms</td>
                      <td style={{ color: '#8b949e' }}>{test.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Temporary Developer Analysis Diagnostics Panel */}
          {activeTab === 'diagnostics' && (
            <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#58a6ff', fontSize: '1rem', fontWeight: 600 }}>
                  🔍 Developer Analysis Diagnostics Tracing
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#8b949e', fontFamily: 'monospace' }}>
                  Session ID: {result.sessionId || result.diagnostics?.sessionId || 'N/A'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '0.82rem' }}>
                <div style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '4px', border: '1px solid #21262d' }}>
                  <div style={{ color: '#8b949e', fontSize: '0.75rem' }}>Input Path:</div>
                  <div style={{ color: '#79c0ff', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                    {result.diagnostics?.originalPath || localPath || '(In-memory source)'}
                  </div>
                </div>
                <div style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '4px', border: '1px solid #21262d' }}>
                  <div style={{ color: '#8b949e', fontSize: '0.75rem' }}>Path Validated:</div>
                  <div style={{ color: result.diagnostics?.pathExists !== false ? '#3fb950' : '#ff7b72', fontWeight: 600, marginTop: '2px' }}>
                    {result.diagnostics?.pathExists !== false ? '✅ Valid (Exists & Readable)' : '❌ Invalid / Not Found'}
                  </div>
                </div>
                <div style={{ backgroundColor: '#0d1117', padding: '10px', borderRadius: '4px', border: '1px solid #21262d' }}>
                  <div style={{ color: '#8b949e', fontSize: '0.75rem' }}>Analysis Status:</div>
                  <div style={{ color: result.analysisStatus?.includes('SUCCESS') ? '#3fb950' : '#d29922', fontWeight: 700, marginTop: '2px' }}>
                    {result.analysisStatus || 'ANALYSIS_SUCCESS'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', fontSize: '0.82rem' }}>
                <div style={{ backgroundColor: '#0d1117', padding: '8px 12px', borderRadius: '4px', border: '1px solid #21262d' }}>
                  <span style={{ color: '#8b949e' }}>Files Discovered:</span> <strong>{result.totalFiles}</strong>
                </div>
                <div style={{ backgroundColor: '#0d1117', padding: '8px 12px', borderRadius: '4px', border: '1px solid #21262d' }}>
                  <span style={{ color: '#8b949e' }}>Files Read:</span> <strong>{result.diagnostics?.discoveredFiles?.length || result.totalFiles}</strong>
                </div>
                <div style={{ backgroundColor: '#0d1117', padding: '8px 12px', borderRadius: '4px', border: '1px solid #21262d' }}>
                  <span style={{ color: '#8b949e' }}>Languages:</span> <strong>{Array.from(new Set((result.diagnostics?.discoveredFiles || []).map(f => f.language))).join(', ') || 'Python / TS'}</strong>
                </div>
                <div style={{ backgroundColor: '#0d1117', padding: '8px 12px', borderRadius: '4px', border: '1px solid #21262d' }}>
                  <span style={{ color: '#8b949e' }}>Health Score:</span> <strong>{result.healthScore !== null ? `${result.healthScore}%` : '—'}</strong>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', fontSize: '0.78rem', backgroundColor: '#0d1117', padding: '10px', borderRadius: '4px' }}>
                <div><span style={{ color: '#8b949e' }}>Static Findings:</span> <strong style={{ color: '#c9d1d9' }}>{result.diagnostics?.staticFindingsCount ?? 'N/A'}</strong></div>
                <div><span style={{ color: '#8b949e' }}>AI Findings:</span> <strong style={{ color: '#c9d1d9' }}>{result.diagnostics?.aiFindingsCount ?? 'N/A'}</strong></div>
                <div><span style={{ color: '#8b949e' }}>Final Findings:</span> <strong style={{ color: '#58a6ff' }}>{result.issues.length}</strong></div>
                <div><span style={{ color: '#8b949e' }}>Critical:</span> <strong style={{ color: '#ff7b72' }}>{result.criticalCount}</strong></div>
                <div><span style={{ color: '#8b949e' }}>Warnings:</span> <strong style={{ color: '#d29922' }}>{result.normalCount}</strong></div>
              </div>

              {/* Stage-by-Stage Execution Trace Log */}
              {result.diagnostics?.stages && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '0.78rem', color: '#8b949e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                    Pipeline Execution Stage Log:
                  </div>
                  <div style={{ backgroundColor: '#010409', borderRadius: '4px', overflow: 'hidden', border: '1px solid #30363d' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#161b22', borderBottom: '1px solid #30363d', color: '#8b949e' }}>
                          <th style={{ padding: '6px 10px' }}>Stage</th>
                          <th>Status</th>
                          <th>In / Out</th>
                          <th>Important Values & Metrics</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.diagnostics.stages.map((stg, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #161b22' }}>
                            <td style={{ padding: '6px 10px', color: '#c9d1d9', fontWeight: 600 }}>{stg.stage}</td>
                            <td>
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                backgroundColor: stg.status === 'COMPLETED' ? 'rgba(46,160,67,0.15)' : (stg.status === 'FAILED' ? 'rgba(248,81,73,0.15)' : 'rgba(56,139,253,0.15)'),
                                color: stg.status === 'COMPLETED' ? '#3fb950' : (stg.status === 'FAILED' ? '#ff7b72' : '#58a6ff')
                              }}>
                                {stg.status}
                              </span>
                            </td>
                            <td style={{ color: '#8b949e' }}>{stg.inputCount ?? '-'} / {stg.outputCount ?? '-'}</td>
                            <td style={{ color: stg.error ? '#ff7b72' : '#79c0ff' }}>
                              {stg.error ? `❌ ${stg.error}` : JSON.stringify(stg.importantValues || {})}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        /* Source Code Viewer Panel when IDLE / No analysis run yet */
        <div style={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden', display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '300px' }}>
          {/* File Tree Left Column */}
          <div style={{ borderRight: '1px solid #30363d', backgroundColor: '#0d1117', padding: '12px' }}>
            <div style={{ fontSize: '0.72rem', color: '#8b949e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
              Scanned Package Files ({scannedFilesList.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {scannedFilesList.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFileIdx(i)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 8px',
                    backgroundColor: selectedFileIdx === i ? '#161b22' : 'transparent',
                    color: selectedFileIdx === i ? '#58a6ff' : '#8b949e',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                    cursor: 'pointer'
                  }}
                >
                  📄 {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Selected File Content Viewer Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#010409' }}>
            <div style={{ backgroundColor: '#161b22', padding: '8px 12px', borderBottom: '1px solid #30363d', color: '#58a6ff', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}>
              {scannedFilesList[selectedFileIdx]?.name}
            </div>
            <div style={{ flex: 1, padding: '12px', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4', overflow: 'auto' }}>
              {scannedFilesList[selectedFileIdx]?.content.split('\n').map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ width: '35px', color: '#484f58', textAlign: 'right', userSelect: 'none' }}>{idx + 1}</span>
                  <span style={{ color: '#c9d1d9', whiteSpace: 'pre-wrap' }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
