import { extname } from 'node:path';
import type { CodeFile, PackageDiagnosticIssue, AnalyzerSubsystemResult } from '../Provider.ts';
import type { ILanguageAnalyzer } from './BaseAnalyzer.ts';
import { PythonAnalyzer } from './PythonAnalyzer.ts';
import { JavaScriptAnalyzer } from './JavaScriptAnalyzer.ts';
import { GenericAnalyzer } from './GenericAnalyzer.ts';

export class AnalyzerRegistry {
  private analyzers: ILanguageAnalyzer[] = [];
  private fallbackAnalyzer = new GenericAnalyzer();

  constructor() {
    this.register(new PythonAnalyzer());
    this.register(new JavaScriptAnalyzer());
  }

  public register(analyzer: ILanguageAnalyzer) {
    this.analyzers.push(analyzer);
  }

  public getAnalyzerForFile(filePath: string): ILanguageAnalyzer {
    const ext = extname(filePath).toLowerCase();
    for (const analyzer of this.analyzers) {
      if (analyzer.supportedExtensions.includes(ext)) {
        return analyzer;
      }
    }
    return this.fallbackAnalyzer;
  }

  public async analyzeFiles(files: CodeFile[], packageName: string): Promise<{
    subsystemResults: AnalyzerSubsystemResult[];
    allFindings: PackageDiagnosticIssue[];
  }> {
    const subsystemResults: AnalyzerSubsystemResult[] = [];
    const allFindings: PackageDiagnosticIssue[] = [];

    for (const file of files) {
      const analyzer = this.getAnalyzerForFile(file.path);
      const stageResults = await analyzer.analyze(file, packageName);
      for (const stageRes of stageResults) {
        subsystemResults.push(stageRes);
        allFindings.push(...stageRes.findings);
      }
    }

    return { subsystemResults, allFindings };
  }
}

export const analyzerRegistry = new AnalyzerRegistry();
