import type { CodeFile, PackageDiagnosticIssue, AnalyzerSubsystemResult } from '../Provider.ts';
import type { ILanguageAnalyzer } from './BaseAnalyzer.ts';

export class PythonAnalyzer implements ILanguageAnalyzer {
  public language = 'Python';
  public supportedExtensions = ['.py', '.pyw'];

  public async analyze(file: CodeFile, packageName: string): Promise<AnalyzerSubsystemResult[]> {
    const results: AnalyzerSubsystemResult[] = [];
    const lines = file.content.split('\n');
    const relativePath = file.path;

    // Subsystem 1: Syntax & Parser Analyzer
    const t0 = Date.now();
    const syntaxFindings = this.analyzeSyntax(lines, relativePath, packageName);
    results.push({
      analyzerName: 'Python Syntax & Parser Analyzer',
      category: 'Parser',
      executionStatus: 'PASSED', // Subsystem ran successfully!
      durationMs: Math.max(1, Date.now() - t0),
      findingsCount: syntaxFindings.length,
      findings: syntaxFindings,
      details: syntaxFindings.length === 0
        ? 'Python parser completed with 0 syntax errors.'
        : `Python parser completed and detected ${syntaxFindings.length} syntax/parser issue(s).`
    });

    // Subsystem 2: Security & Vulnerability Analyzer
    const t1 = Date.now();
    const securityFindings = this.analyzeSecurity(lines, file.content, relativePath, packageName);
    results.push({
      analyzerName: 'Python Security & Vulnerability Analyzer',
      category: 'Security',
      executionStatus: 'PASSED', // Subsystem ran successfully!
      durationMs: Math.max(1, Date.now() - t1),
      findingsCount: securityFindings.length,
      findings: securityFindings,
      details: securityFindings.length === 0
        ? 'Security scan completed with 0 vulnerability findings.'
        : `Security scan completed and detected ${securityFindings.length} security vulnerability finding(s).`
    });

    // Subsystem 3: Resource Allocation & Error Handling Analyzer
    const t2 = Date.now();
    const resourceFindings = this.analyzeResourceAndErrors(lines, file.content, relativePath, packageName);
    results.push({
      analyzerName: 'Python Resource & Exception Analyzer',
      category: 'Resource',
      executionStatus: 'PASSED', // Subsystem ran successfully!
      durationMs: Math.max(1, Date.now() - t2),
      findingsCount: resourceFindings.length,
      findings: resourceFindings,
      details: resourceFindings.length === 0
        ? 'Resource & error handling check completed cleanly.'
        : `Resource & error check completed and detected ${resourceFindings.length} resource/exception finding(s).`
    });

    // Subsystem 4: Logic & Code Quality Analyzer
    const t3 = Date.now();
    const logicFindings = this.analyzeLogicAndQuality(lines, relativePath, packageName);
    results.push({
      analyzerName: 'Python Logic & Dead Code Analyzer',
      category: 'Logic',
      executionStatus: 'PASSED', // Subsystem ran successfully!
      durationMs: Math.max(1, Date.now() - t3),
      findingsCount: logicFindings.length,
      findings: logicFindings,
      details: logicFindings.length === 0
        ? 'Logic analysis completed with 0 code quality warnings.'
        : `Logic analysis completed and detected ${logicFindings.length} code quality warning(s).`
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
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (trimmed.startsWith('#') || trimmed.length === 0) continue;

      // Unmatched quote check on single line
      if (!trimmed.includes('"""') && !trimmed.includes("'''")) {
        const doubleQuotes = (line.match(/"/g) || []).length;
        const singleQuotes = (line.match(/'/g) || []).length;
        if ((doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) && !trimmed.endsWith('\\')) {
          issues.push({
            id: `SYN-PY-${lineNum}`,
            title: 'Python Syntax Error: Unclosed String Literal',
            severity: 'Critical',
            category: 'Syntax & Parsing',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: 'String quote opened but not terminated on line.',
            impact: 'Python interpreter fails with SyntaxError during parsing.',
            suggestedFix: 'Close string literal with matching quote delimiter.',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 99
          });
        }
      }

      // Check missing colon on control headers
      const controlRegex = /^\s*(def\s+\w+.*|class\s+\w+.*|if\s+.*|elif\s+.*|else|for\s+.*|while\s+.*|try|except.*|finally|with\s+.*)$/;
      if (controlRegex.test(trimmed)) {
        if (!trimmed.endsWith(':') && !trimmed.endsWith('\\') && !trimmed.endsWith('{') && !trimmed.endsWith('(')) {
          issues.push({
            id: `SYN-PY-${lineNum}`,
            title: 'Python Syntax Error: Missing Colon in Statement Header',
            severity: 'Critical',
            category: 'Syntax & Parsing',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: `Python compound statement header '${trimmed.split(' ')[0]}' must end with a colon ':'.`,
            impact: 'Python interpreter fails with SyntaxError upon compilation.',
            suggestedFix: 'Append a colon ":" at end of statement line.',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 98
          });
        }
      }

      // Check invalid assignment in condition
      if (/^\s*(if|elif|while)\s+.*[^=]=[^=].*:$/.test(trimmed)) {
        if (!trimmed.includes('==') && !trimmed.includes('!=') && !trimmed.includes('<=') && !trimmed.includes('>=')) {
          issues.push({
            id: `SYN-PY-${lineNum}`,
            title: 'Python Syntax Error: Assignment in Conditional Statement',
            severity: 'Critical',
            category: 'Syntax & Parsing',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: 'Single assignment operator "=" used inside conditional expression instead of comparison "==".',
            impact: 'Python interpreter fails with SyntaxError.',
            suggestedFix: 'Replace single "=" with double "==" equality operator.',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 95
          });
        }
      }

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
        id: `SYN-PY-EOF`,
        title: 'Python Syntax Error: Unmatched Parentheses or Brackets',
        severity: 'Critical',
        category: 'Syntax & Parsing',
        packageName,
        affectedFile: relativePath,
        lineNumber: lines.length,
        description: `Unbalanced bracket pair detected (Parentheses diff: ${parenDepth}, Brackets diff: ${bracketDepth}).`,
        impact: 'Python parser reaches End-Of-File unexpectedly without closing token.',
        suggestedFix: 'Verify all opening brackets `(`, `[`, `{` have matching closing tokens.',
        codeSnippet: lines[lines.length - 1]?.trim() || '',
        status: 'Active',
        confidence: 96
      });
    }

    return issues;
  }

  private analyzeSecurity(lines: string[], fullContent: string, relativePath: string, packageName: string): PackageDiagnosticIssue[] {
    const issues: PackageDiagnosticIssue[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Eval / Exec
      if (trimmed.includes('eval(') || trimmed.includes('exec(')) {
        issues.push({
          id: `SEC-PY-${lineNum}`,
          title: 'Unsafe Dynamic Code Execution (eval / exec)',
          severity: 'Critical',
          category: 'Security & Integrity',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Dynamic execution of string expressions via `eval()` or `exec()`.',
          impact: 'Remote Code Execution (RCE) vulnerability allowing arbitrary shell execution.',
          suggestedFix: 'Replace dynamic eval call with ast.literal_eval or structured parsing.',
          codeSnippet: trimmed,
          status: 'Active',
          confidence: 98
        });
      }

      // Shell=True or os.system
      if (trimmed.includes('shell=True') || trimmed.includes('os.system(')) {
        issues.push({
          id: `SEC-PY-${lineNum}`,
          title: 'Command Injection Vulnerability (shell=True / os.system)',
          severity: 'Critical',
          category: 'Security & Integrity',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Execution of OS commands using shell invocation (`shell=True` or `os.system()`).',
          impact: 'Allows command injection attacks via shell metacharacters.',
          suggestedFix: 'Pass argument list to subprocess.run without `shell=True`.',
          codeSnippet: trimmed,
          status: 'Active',
          confidence: 96
        });
      }

      // SQL Injection
      if (trimmed.includes('cursor.execute(') || trimmed.includes('execute(')) {
        if (trimmed.includes('f"') || trimmed.includes("f'") || trimmed.includes('%') || (trimmed.includes('+') && trimmed.includes('SELECT'))) {
          issues.push({
            id: `SEC-PY-${lineNum}`,
            title: 'SQL Injection via String Formatting in Python Query',
            severity: 'Critical',
            category: 'Security & Integrity',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: 'Python f-string or string formatting used inside database `cursor.execute()` statement.',
            impact: 'Enables unauthenticated SQL injection and data exfiltration.',
            suggestedFix: 'Pass parameters as tuple binding: `cursor.execute("SELECT ... WHERE id = %s", (id,))`.',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 98
          });
        }
      }

      // Insecure pickle
      if (trimmed.includes('pickle.loads(') || trimmed.includes('pickle.load(')) {
        issues.push({
          id: `SEC-PY-${lineNum}`,
          title: 'Unsafe Object Deserialization (pickle)',
          severity: 'Critical',
          category: 'Security & Integrity',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Deserialization of untrusted payload using Python `pickle`.',
          impact: 'Arbitrary code execution upon unpickling untrusted payload bytes.',
          suggestedFix: 'Use safe data formats such as JSON or Protocol Buffers.',
          codeSnippet: trimmed,
          status: 'Active',
          confidence: 97
        });
      }

      // Hardcoded secret
      if (/SECRET_KEY|API_KEY|AWS_SECRET_ACCESS_KEY|token\s*=\s*['"][a-zA-Z0-9_\-]{20,}['"]/.test(trimmed)) {
        issues.push({
          id: `SEC-PY-${lineNum}`,
          title: 'Hardcoded Secret / API Token in Source Code',
          severity: 'Critical',
          category: 'Security & Secrets',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Hardcoded API secret token or private key string literal in Python file.',
          impact: 'Credential leak allowing unauthorized access if source code is exposed.',
          suggestedFix: 'Extract secret into environment variable `os.getenv("API_KEY")`.',
          codeSnippet: trimmed.replace(/=['"][^'"]+['"]/, '="***MASKED_SECRET***"'),
          status: 'Active',
          confidence: 95
        });
      }
    }

    return issues;
  }

  private analyzeResourceAndErrors(lines: string[], fullContent: string, relativePath: string, packageName: string): PackageDiagnosticIssue[] {
    const issues: PackageDiagnosticIssue[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Open file leak
      if (/^\s*\w+\s*=\s*open\(/.test(trimmed) && !fullContent.includes('with open(')) {
        if (!fullContent.includes('.close()')) {
          issues.push({
            id: `RES-PY-${lineNum}`,
            title: 'Unclosed File Handle Resource Leak',
            severity: 'Normal',
            category: 'Resource Leak',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: 'File opened via `open()` assigned to variable without `with` context manager or `.close()`.',
            impact: 'OS file descriptor leaks leading to file lock failures under load.',
            suggestedFix: 'Use `with open(...) as f:` context manager.',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 90
          });
        }
      }

      // Bare except
      if (trimmed === 'except:' || trimmed === 'except BaseException:') {
        issues.push({
          id: `ERR-PY-${lineNum}`,
          title: 'Broad Exception Handling (Bare except:)',
          severity: 'Normal',
          category: 'Error Handling',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Bare `except:` catches all exceptions indiscriminately including KeyboardInterrupt and SystemExit.',
          impact: 'Masks critical system bugs and prevents graceful process shutdown.',
          suggestedFix: 'Specify explicit exception classes (e.g. `except ValueError as err:`).',
          codeSnippet: trimmed,
          status: 'Active',
          confidence: 92
        });
      }
    }

    return issues;
  }

  private analyzeLogicAndQuality(lines: string[], relativePath: string, packageName: string): PackageDiagnosticIssue[] {
    const issues: PackageDiagnosticIssue[] = [];

    for (let idx = 1; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (lines[idx - 1].trim().startsWith('return ')) {
        const prevIndent = lines[idx - 1].search(/\S/);
        const currIndent = line.search(/\S/);
        if (currIndent === prevIndent && trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('def ') && !trimmed.startsWith('class ')) {
          issues.push({
            id: `LOG-PY-${lineNum}`,
            title: 'Unreachable Dead Code after Return Statement',
            severity: 'Normal',
            category: 'Logic & Code Quality',
            packageName,
            affectedFile: relativePath,
            lineNumber: lineNum,
            description: 'Statements positioned immediately after un-indented `return` statement in same block will never execute.',
            impact: 'Misleading logic flow and dead code bloat.',
            suggestedFix: 'Remove unreachable statements or adjust control flow structure.',
            codeSnippet: trimmed,
            status: 'Active',
            confidence: 88
          });
        }
      }
    }

    return issues;
  }
}
