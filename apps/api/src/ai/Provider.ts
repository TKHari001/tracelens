export interface IssueContext {
  id: string;
  title: string;
  severity: string;
  category: string;
  affectedService?: string;
  affectedFile?: string;
  stackTrace?: string;
}

export interface AnalysisResult {
  rootCause: string;
  confidence: number;
  evidence: string[];
  affectedComponents: string[];
}

export interface RemediationPlan {
  actionType: string;
  proposedAction: string;
  confidence: number;
  risks: string[];
  validationSteps: string[];
  rollbackPlan: string;
}

export interface CodeFile {
  path: string;
  content: string;
}

export interface PackageAnalysisRequest {
  packageName?: string;
  framework?: string;
  files?: CodeFile[];
}

export interface PackageDiagnosticIssue {
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
}

export interface RemediationRecord {
  id: string;
  issueId: string;
  fileName: string;
  originalError: string;
  category: string;
  severity: string;
  fixApplied: string;
  fixedBy: string;
  fixTime: string;
  validationResult: 'PASSED' | 'VERIFIED' | 'FAILED';
  finalStatus: 'Fixed' | 'Verified' | 'Automatically Fixed' | 'Manually Fixed' | 'Rolled Back';
}

export interface TestCaseResult {
  testName: string;
  category: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  details: string;
}

export interface AnalysisDiagnosticStage {
  stage: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  inputCount?: number;
  outputCount?: number;
  importantValues?: Record<string, any>;
  error?: string;
  timestamp: string;
}

export interface AnalysisDiagnostics {
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
  analysisStatus: 'ANALYSIS_SUCCESS_WITH_FINDINGS' | 'ANALYSIS_SUCCESS_NO_FINDINGS' | 'ANALYSIS_FAILED' | 'FILE_READ_FAILED' | 'PARSER_FAILED' | 'AI_ANALYSIS_FAILED';
  stages: AnalysisDiagnosticStage[];
}

export interface AnalyzerSubsystemResult {
  analyzerName: string;
  category: 'Discovery' | 'Parser' | 'Security' | 'Resource' | 'Logic' | 'AI';
  executionStatus: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  findingsCount: number;
  findings: PackageDiagnosticIssue[];
  details: string;
}

export interface PackageAnalysisResult {
  packageName: string;
  framework: string;
  totalFiles: number;
  healthScore: number | null; // 0 - 100 or null if failed
  criticalCount: number;
  normalCount: number;
  issues: PackageDiagnosticIssue[];
  subsystemResults?: AnalyzerSubsystemResult[];
  remediationsHistory?: RemediationRecord[];
  testSuite: TestCaseResult[];
  summary: string;
  aiModelUsed: string;
  sessionId?: string;
  analysisStatus?: 'ANALYSIS_SUCCESS_WITH_FINDINGS' | 'ANALYSIS_SUCCESS_NO_FINDINGS' | 'ANALYSIS_FAILED' | 'FILE_READ_FAILED' | 'PARSER_FAILED' | 'AI_ANALYSIS_FAILED';
  diagnostics?: AnalysisDiagnostics;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  model: string;
  suggestedActions?: string[];
}

export interface AIProvider {
  name: string;
  isConfigured(): boolean;
  analyzeIssue(context: IssueContext): Promise<AnalysisResult>;
  generateFixPlan(context: IssueContext, analysis: AnalysisResult): Promise<RemediationPlan>;
  analyzePackage(req: PackageAnalysisRequest): Promise<PackageAnalysisResult>;
  chat(messages: ChatMessage[], context?: any): Promise<ChatResponse>;
}

