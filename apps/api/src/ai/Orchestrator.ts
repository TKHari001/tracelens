import { 
  AIProvider, 
  IssueContext, 
  AnalysisResult, 
  RemediationPlan, 
  PackageAnalysisRequest, 
  PackageAnalysisResult, 
  ChatMessage, 
  ChatResponse 
} from './Provider.ts';
import { GeminiAdapter } from './GeminiAdapter.ts';
import { OpenAIAdapter } from './OpenAIAdapter.ts';
import { ClaudeAdapter } from './ClaudeAdapter.ts';

export class AIOrchestrator {
  private providers: Map<string, AIProvider> = new Map();

  constructor() {
    this.register(new GeminiAdapter());
    this.register(new OpenAIAdapter());
    this.register(new ClaudeAdapter());
  }

  register(provider: AIProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): AIProvider {
    // Exact or loose match lookup
    for (const [key, provider] of this.providers.entries()) {
      if (key.toLowerCase().includes(name.toLowerCase())) {
        return provider;
      }
    }
    // Default fallback
    return this.providers.get('Anthropic Claude') || this.providers.get('Google Gemini')!;
  }

  async getPrimaryProvider(): Promise<AIProvider> {
    const claude = this.providers.get('Anthropic Claude');
    if (claude && claude.isConfigured()) return claude;

    const openai = this.providers.get('OpenAI ChatGPT');
    if (openai && openai.isConfigured()) return openai;

    const gemini = this.providers.get('Google Gemini');
    if (gemini && gemini.isConfigured()) return gemini;

    // Fallback if none configured
    return claude || gemini!;
  }

  async analyzePackage(req: PackageAnalysisRequest, providerName?: string): Promise<PackageAnalysisResult> {
    const provider = providerName ? this.getProvider(providerName) : await this.getPrimaryProvider();
    return provider.analyzePackage(req);
  }

  async chat(messages: ChatMessage[], providerName?: string, context?: any): Promise<ChatResponse> {
    const provider = providerName ? this.getProvider(providerName) : await this.getPrimaryProvider();
    return provider.chat(messages, context);
  }
}

export const aiOrchestrator = new AIOrchestrator();
