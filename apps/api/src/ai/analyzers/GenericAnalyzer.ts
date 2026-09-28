import type { CodeFile, PackageDiagnosticIssue, AnalyzerSubsystemResult } from '../Provider.ts';
import type { ILanguageAnalyzer } from './BaseAnalyzer.ts';

export class GenericAnalyzer implements ILanguageAnalyzer {
  public language = 'Generic Source Code';
  public supportedExtensions = ['*'];

  public async analyze(file: CodeFile, packageName: string): Promise<AnalyzerSubsystemResult[]> {
    const results: AnalyzerSubsystemResult[] = [];
    const lines = file.content.split('\n');
    const relativePath = file.path;

    const t0 = Date.now();
    const findings: PackageDiagnosticIssue[] = [];

    // Basic secret scanner across generic files
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (/SECRET_KEY|API_KEY|AWS_SECRET_ACCESS_KEY|token\s*=\s*['"][a-zA-Z0-9_\-]{20,}['"]/.test(trimmed)) {
        findings.push({
          id: `SEC-GEN-${lineNum}`,
          title: 'Hardcoded Secret Token in Generic Source File',
          severity: 'Critical',
          category: 'Security & Secrets',
          packageName,
          affectedFile: relativePath,
          lineNumber: lineNum,
          description: 'Hardcoded secret key string literal detected in source file.',
          impact: 'Potential credential leak.',
          suggestedFix: 'Extract secret token into environment variable.',
          codeSnippet: trimmed.replace(/=['"][^'"]+['"]/, '="***MASKED_SECRET***"'),
          status: 'Active',
          confidence: 90
        });
      }
    }

    results.push({
      analyzerName: 'Generic Code & Secrets Analyzer',
      category: 'Security',
      executionStatus: 'PASSED',
      durationMs: Math.max(1, Date.now() - t0),
      findingsCount: findings.length,
      findings,
      details: findings.length === 0
        ? 'Generic analyzer completed with 0 findings.'
        : `Generic analyzer completed and detected ${findings.length} finding(s).`
    });

    return results;
  }
}
