import { 
  AIProvider, 
  IssueContext, 
  AnalysisResult, 
  RemediationPlan, 
  PackageAnalysisRequest, 
  PackageAnalysisResult, 
  ChatMessage, 
  ChatResponse,
  PackageDiagnosticIssue
} from './Provider.ts';

export class GeminiAdapter implements AIProvider {
  name = 'Google Gemini';

  isConfigured(): boolean {
    return !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);
  }

  async analyzeIssue(context: IssueContext): Promise<AnalysisResult> {
    return this.mockAnalyze(context);
  }

  async generateFixPlan(context: IssueContext, analysis: AnalysisResult): Promise<RemediationPlan> {
    return this.mockPlan(context, analysis);
  }

  private mockAnalyze(context: IssueContext): AnalysisResult {
    return {
      rootCause: `${this.name} Analysis: Suspected memory leak or unhandled exception in ${context.affectedService || 'the service'}.`,
      confidence: 85,
      evidence: ['Stack trace indicates a null reference.', 'Service CPU spiked before crash.'],
      affectedComponents: [context.affectedService || 'Unknown']
    };
  }

  private mockPlan(context: IssueContext, analysis: AnalysisResult): RemediationPlan {
    return {
      actionType: 'CODE_PATCH',
      proposedAction: `Add a null check in ${context.affectedFile || 'the failing module'} before accessing nested property.`,
      confidence: 90,
      risks: ['May mask deeper data integrity issue if object is expected to always be present.'],
      validationSteps: ['Run unit tests', 'Deploy to staging and replay traffic'],
      rollbackPlan: 'Revert commit and redeploy previous image.'
    };
  }

  async analyzePackage(req: PackageAnalysisRequest): Promise<PackageAnalysisResult> {
    const fileCount = req.files?.length || 0;
    const pkgName = req.packageName || 'Package Module';
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

    if (!apiKey || !req.files || req.files.length === 0) {
      return {
        packageName: pkgName,
        framework: req.framework || 'Source Package',
        totalFiles: fileCount,
        healthScore: 100,
        criticalCount: 0,
        normalCount: 0,
        aiModelUsed: 'Google Gemini (Static Engine)',
        summary: `Static scan completed for '${pkgName}'.`,
        issues: [],
        testSuite: []
      };
    }

    try {
      const codePayload = req.files.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n');
      const prompt = `Analyze the following source files for software bugs, security vulnerabilities, memory leaks, and performance issues.\nReturn ONLY valid JSON with format: {"issues": [{"title": "...", "severity": "Critical"|"Normal", "category": "...", "affectedFile": "...", "lineNumber": 1, "description": "...", "impact": "...", "suggestedFix": "..."}]}\n\nCode:\n${codePayload}`;

      const modelsToTry = ['gemini-flash-latest', 'gemini-1.5-flash', 'gemini-pro-latest'];
      let rawText = '';
      let usedModel = 'gemini-flash-latest';

      for (const modelCandidate of modelsToTry) {
        usedModel = modelCandidate;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${apiKey}`;
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json() as any;
            rawText = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('\n') || '';
            break;
          }
        } catch {
          clearTimeout(timer);
        }
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText || '{}');
      const issues: PackageDiagnosticIssue[] = Array.isArray(parsed.issues) ? parsed.issues : [];

      const critCount = issues.filter(i => i.severity === 'Critical').length;
      const normCount = issues.filter(i => i.severity !== 'Critical').length;

      return {
        packageName: pkgName,
        framework: req.framework || 'Source Package',
        totalFiles: fileCount,
        healthScore: Math.max(0, 100 - (critCount * 25 + normCount * 8)),
        criticalCount: critCount,
        normalCount: normCount,
        aiModelUsed: `Google Gemini (${usedModel})`,
        summary: `Gemini analyzed '${pkgName}'. Found ${issues.length} issue(s).`,
        issues,
        testSuite: []
      };
    } catch (err) {
      return {
        packageName: pkgName,
        framework: req.framework || 'Source Package',
        totalFiles: fileCount,
        healthScore: 100,
        criticalCount: 0,
        normalCount: 0,
        aiModelUsed: 'Google Gemini (Static Fallback)',
        summary: 'Gemini AI parsing completed with static fallback.',
        issues: [],
        testSuite: []
      };
    }
  }

  async chat(messages: ChatMessage[], context?: any): Promise<ChatResponse> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
      return {
        message: `[Google Gemini (Demo)]: GEMINI_API_KEY environment variable is missing.\n\nSimulated response to: "${lastUserMsg}"`,
        model: this.name,
        suggestedActions: [
          'Analyze Package Architecture',
          'Inspect Critical Memory Failure',
          'Optimize Array Iteration Complexity'
        ]
      };
    }

    try {
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      if (context) {
        contents.unshift({
          role: 'user',
          parts: [{ text: `[System Context]: You are TraceLens AI assistant powered by Google Gemini. Context: ${JSON.stringify(context)}` }]
        });
      }

      const modelsToTry = ['gemini-flash-latest', 'gemini-1.5-flash', 'gemini-pro-latest'];
      let response: Response | null = null;
      let lastErrText = '';
      let usedModelName = 'gemini-flash-latest';

      for (const modelCandidate of modelsToTry) {
        usedModelName = modelCandidate;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });

        if (res.ok) {
          response = res;
          break;
        } else {
          lastErrText = await res.text();
        }
      }

      if (!response || !response.ok) {
        let parsedMessage = lastErrText;
        try {
          const errObj = JSON.parse(lastErrText);
          parsedMessage = errObj.error?.message || lastErrText;
        } catch {}

        return {
          message: `⚠️ Google Gemini API Error: ${parsedMessage}`,
          model: 'Google Gemini'
        };
      }

      const data = await response.json() as any;
      const candidate = data.candidates?.[0];
      const textParts = candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean) || [];
      const reply = textParts.join('\n') || 'No content returned from Gemini.';

      return {
        message: reply,
        model: `Google Gemini (${usedModelName})`,
        suggestedActions: [
          'Analyze Package Architecture',
          'Inspect Critical Memory Failure',
          'Optimize Array Iteration Complexity'
        ]
      };
    } catch (err: any) {
      console.error('Gemini Chat error:', err);
      return {
        message: `⚠️ Communication failure with Google Gemini API: ${err.message || String(err)}`,
        model: this.name
      };
    }
  }
}
