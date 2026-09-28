import type { CodeFile, PackageDiagnosticIssue, AnalyzerSubsystemResult } from '../Provider.ts';

export interface ILanguageAnalyzer {
  language: string;
  supportedExtensions: string[];
  analyze(file: CodeFile, packageName: string): Promise<AnalyzerSubsystemResult[]>;
}
