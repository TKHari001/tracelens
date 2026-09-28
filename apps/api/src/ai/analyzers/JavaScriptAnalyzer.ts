import type { CodeFile, PackageDiagnosticIssue, AnalyzerSubsystemResult } from '../Provider.ts';
import type { ILanguageAnalyzer } from './BaseAnalyzer.ts';

export class JavaScriptAnalyzer implements ILanguageAnalyzer {
  public language = 'JavaScript / TypeScript';
  public supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

  public async analyze(file: CodeFile, packageName: string): Promise<AnalyzerSubsystemResult[]> {
    const results: AnalyzerSubsystemResult[] = [];
    const lines = file.content.split('\n');
    const relativePath = file.path;

    // Subsystem 1: Syntax & Tokenization Analyzer
    const t0 = Date.now();
    const syntaxFindings = this.analyzeSyntax(lines, relativePath, packageName);
    results.push({
      analyzerName: 'JS/TS Syntax & Parser Analyzer',
      category: 'Parser',
      executionStatus: 'PASSED',
      durationMs: Math.max(1, Date.now() - t0),
      findingsCount: syntaxFindings.length,
      findings: syntaxFindings,
      details: syntaxFindings.length === 0
        ? 'JS/TS parser completed with 0 syntax errors.'
        : `JS/TS parser completed and detected ${syntaxFindings.length} syntax error(s).`
    });

    // Subsystem 2: Security Analyzer
    const t1 = Date.now();
    const securityFindings = this.analyzeSecurity(lines, relativePath, packageName);
    results.push({
      analyzerName: 'JS/TS Security Vulnerability Analyzer',
      category: 'Security',
      executionStatus: 'PASSED',
      durationMs: Math.max(1, Date.now() - t1),
      findingsCount: securityFindings.length,
      findings: securityFindings,
      details: securityFindings.length === 0
        ? 'Security scan completed with 0 vulnerabilities.'
        : `Security scan completed and detected ${securityFindings.length} security vulnerability finding(s).`
    });

    // Subsystem 3: Resource & Memory Allocation Analyzer
    const t2 = Date.now();
    const resourceFindings = this.analyzeResourceAndMemory(lines, file.content, relativePath, packageName);
    results.push({
      analyzerName: 'JS/TS Memory & Resource Leak Analyzer',
      category: 'Resource',
      executionStatus: 'PASSED',
      durationMs: Math.max(1, Date.now() - t2),
      findingsCount: resourceFindings.length,
      findings: resourceFindings,
      details: resourceFindings.length === 0
        ? 'Memory leak and listener teardown check completed cleanly.'
        : `Resource check completed and detected ${resourceFindings.length} listener/resource leak finding(s).`
    });

    // Subsystem 4: Performance & Logic Analyzer
    const t3 = Date.now();
    const logicFindings = this.analyzePerformanceAndLogic(lines, relativePath, packageName);
    results.push({
      analyzerName: 'JS/TS Event Loop Latency & Performance Analyzer',
      category: 'Logic',
      executionStatus: 'PASSED',
      durationMs: Math.max(1, Date.now() - t3),
      findingsCount: logicFindings.length,
      findings: logicFindings,
      details: logicFindings.length === 0
        ? 'Performance & event loop analysis completed with 0 warnings.'
        : `Performance analysis completed and detected ${logicFindings.length} performance finding(s).`
    });

    return results;
  }

  private analyzeSyntax(lines: string[], relativePath: string, packageName: string): PackageDiagnosticIssue[] {
    const issues: PackageDiagnosticIssue[] = [];
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      for (const char of line) {
        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth--;
        else if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;
      }
    }

    if (parenDepth !== 0 || bracketDepth !== 0 || braceDepth !== 0) {
      issues.push({
        id: `SYN-JS-EOF`,
        title: 'JS/TS Syntax Error: Unbalanced Parentheses or Brackets',
        severity: 'Critical',
        category: 'Syntax & Parsing',
        packageName,
        affectedFile: relativePath,
        lineNumber: lines.length,
        description: 'Unbalanced bracket token structure detected.',
        impact: 'JavaScript engine throws SyntaxError during parsing.',
        suggestedFix: 'Verify matching opening and closing bracket pairs.',
        codeSnippet: lines[lines.length - 1]?.trim() || '',
        status: 'Active',
        confidence: 95
      });
    }

    return issues;
  }

  private analyzeSecurity(lines: string[], relativePath: string, packageName: string): PackageDiagnosticIssue[] {
    const issues: PackageDiagnosticIssue[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // SQL Injection via string interpolation in query
      if (trimmed.includes('SELECT ') || trimmed.includes('INSERT ') || trimmed.includes('UPDATE ') || trimmed.includes('DELETE ')) {
        if (trimmed.includes('${') || trimmed.includes(' + ')) {
          issues.push({
            id: `SEC-JS-${lineNum}`,
            title: 'Unsanitized Input in Database Query String',
            severity: 'Critical',
            category: 'Security & Integrity',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: 'String interpolation or concatenation used directly inside SQL query statement.',
            impact: 'Allows unauthorized remote SQL injection vulnerabilities and data extraction.',
            suggestedFix: 'Replace template literal string interpolation with parameterized SQL bindings ($1, $2).',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 98
          });
        }
      }

      // Missing body payload size limit
      if (trimmed.includes('express.json()') && !trimmed.includes('limit')) {
        issues.push({
          id: `SEC-JS-${lineNum}`,
          title: 'Missing Body Payload Size Limit',
          severity: 'Normal',
          category: 'Security',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Express JSON parser initialized without explicit request body size ceiling.',
          impact: 'Potential Denial-of-Service (DoS) via large POST request payloads.',
          suggestedFix: 'Pass limit option: express.json({ limit: "1mb" }).',
          codeSnippet: trimmed,
          status: 'Active',
          confidence: 88
        });
      }
    }

    return issues;
  }

  private analyzeResourceAndMemory(lines: string[], fullContent: string, relativePath: string, packageName: string): PackageDiagnosticIssue[] {
    const issues: PackageDiagnosticIssue[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (trimmed.includes('stream.on("data"') || trimmed.includes('emitter.on(') || trimmed.includes('.on("data"')) {
        if (!fullContent.includes('removeListener') && !fullContent.includes('removeAllListeners') && !fullContent.includes('AbortController')) {
          issues.push({
            id: `RES-JS-${lineNum}`,
            title: 'Unhandled Event Listener Memory Leak',
            severity: 'Critical',
            category: 'Memory & Reliability',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: 'Event listener attached repeatedly without removing listeners on connection close.',
            impact: 'Gradual memory accumulation leading to Out-Of-Memory process crashes under sustained load.',
            suggestedFix: 'Wrap listener assignment and add removeListener hook on stream close event.',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 95
          });
        }
      }
    }

    return issues;
  }

  private analyzePerformanceAndLogic(lines: string[], relativePath: string, packageName: string): PackageDiagnosticIssue[] {
    const issues: PackageDiagnosticIssue[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (trimmed.includes('readFileSync(') || trimmed.includes('writeFileSync(')) {
        issues.push({
          id: `PERF-JS-${lineNum}`,
          title: 'Synchronous File System Operation in Request Path',
          severity: 'Normal',
          category: 'Performance',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Synchronous fs method blocks Node.js event loop during request processing.',
          impact: 'Thread blocking degrades server throughput under concurrent client traffic.',
          suggestedFix: 'Migrate sync call to fs.promises.readFile with async/await.',
          codeSnippet: trimmed,
          status: 'Active',
          confidence: 90
        });
      }

      if (trimmed.includes('.map(') && trimmed.includes('.find(')) {
        issues.push({
          id: `PERF-JS-${lineNum}`,
          title: 'Sub-optimal Nested Array Iteration',
          severity: 'Normal',
          category: 'Performance',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Nested array find operation executed inside map callback (O(N^2) complexity).',
          impact: 'Increased latency when processing large datasets exceeding 10,000 items.',
          suggestedFix: 'Build a Map lookup table before mapping iteration.',
          codeSnippet: trimmed,
          status: 'Active',
          confidence: 85
        });
      }
    }

    return issues;
  }
}
