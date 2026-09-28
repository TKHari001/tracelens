import React, { useState, useEffect, useRef } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: string;
  suggestedActions?: string[];
};

type Props = {
  initialQuery?: string;
  onBack?: () => void;
};

export function AIChatbot({ initialQuery, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      role: 'assistant',
      model: 'Anthropic Claude 3.5 Sonnet',
      content: 'Hello! I am your AI Diagnostic Assistant powered by OpenAI ChatGPT, Anthropic Claude, and Google Gemini models.\n\nAsk me about package analysis findings, code vulnerabilities, remediation diffs, or architecture recommendations.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        'Analyze Package Critical Vulnerability',
        'Generate Automated Fix Diff',
        'How to Stream SSE Telemetry?'
      ]
    }
  ]);

  const [input, setInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('Anthropic Claude');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuery) {
      handleSend(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const chatHistory = messages.concat(userMsg).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          provider: selectedProvider
        })
      });

      const data = await res.json();

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        model: data.model || selectedProvider,
        content: data.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: data.suggestedActions || []
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Chat request failed', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          model: selectedProvider,
          content: '⚠️ Service error connecting to AI provider API. Please check internet connection or API keys.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Chat Header */}
      <div style={{ backgroundColor: '#161b22', padding: '12px 20px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                backgroundColor: '#21262d',
                color: '#58a6ff',
                border: '1px solid #30363d',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ← Back to Package Health / Critical View
            </button>
          )}
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#238636' }}></div>
          <div>
            <h3 style={{ margin: 0, color: '#c9d1d9', fontSize: '1rem', fontWeight: 600 }}>AI Diagnostic Assistant</h3>
            <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>Multi-Model Engine (Claude / ChatGPT / Gemini)</span>
          </div>
        </div>

        {/* Model Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>Model Provider:</span>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            style={{ backgroundColor: '#010409', color: '#58a6ff', border: '1px solid #30363d', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <option value="Anthropic Claude">Anthropic Claude 3.5 Sonnet</option>
            <option value="OpenAI ChatGPT">OpenAI ChatGPT (GPT-4o)</option>
            <option value="Google Gemini">Google Gemini 1.5 Pro</option>
          </select>
        </div>
      </div>

      {/* Messages Stream Area */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.75rem', color: '#8b949e' }}>
              <span>{msg.role === 'user' ? 'You' : (msg.model || 'AI Assistant')}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              style={{
                backgroundColor: msg.role === 'user' ? '#1f6beb' : '#161b22',
                color: '#c9d1d9',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                border: msg.role === 'user' ? 'none' : '1px solid #30363d',
                fontSize: '0.9rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}
            >
              {msg.content}
            </div>

            {/* Quick Action Chips */}
            {msg.suggestedActions && msg.suggestedActions.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {msg.suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(action)}
                    style={{
                      backgroundColor: 'rgba(56,139,253,0.1)',
                      border: '1px solid rgba(56,139,253,0.3)',
                      color: '#58a6ff',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✨ {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start', color: '#8b949e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ animation: 'spin 1s linear infinite' }}>⚙️</span> {selectedProvider} is generating response...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        style={{ padding: '16px', backgroundColor: '#161b22', borderTop: '1px solid #30363d', display: 'flex', gap: '10px' }}
      >
        <input
          type="text"
          placeholder={`Ask ${selectedProvider} about package issues, stack traces, or code fixes...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: '#010409',
            border: '1px solid #30363d',
            color: '#c9d1d9',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '0.9rem',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            backgroundColor: '#238636',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !input.trim() ? 0.6 : 1
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
