import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RotateCw,
  Lightbulb,
  FileText,
  Target,
  ShieldCheck,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AiAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hello! I am your OutboundOS AI Outreach Strategist. I have full context of your connected sending accounts, active enterprise campaigns, and deliverability reputation.\n\nHow can I help you accelerate conversions today? You can ask me to write a custom multi-step cold sequence, improve your subject line open rates, troubleshoot deliverability, or triage inbound objection patterns.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const presets = [
    'Write a 3-step sequence for Enterprise VP Engineering with personalized Kubernetes hooks',
    'Audit our deliverability checklist and suggest a safe daily sending ramp-up schedule',
    'Generate 5 curiosity-driven cold email subject lines with under 35 characters',
    'Provide 3 executive responses to the objection: "We already have an internal solution"',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyPayload }),
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setMessages([...nextMessages, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            content: 'I encountered an error generating the outreach strategy. Please try again.',
          },
        ]);
      }
    } catch (e: any) {
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: `Network error: ${e.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#070b14] text-slate-100 p-6 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            Gemini AI Outreach Copilot
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Context-aware AI strategist trained on high-converting B2B cold email copy, deliverability, and objection handling.
          </p>
        </div>
        <span className="rounded bg-slate-900 text-indigo-400 text-xs font-mono px-2.5 py-1 border border-slate-800 font-medium">
          gemini-3.8-flash Active
        </span>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(preset)}
            className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white transition flex items-center gap-1.5 cursor-pointer text-left shadow-xs"
          >
            <Lightbulb className="h-3 w-3 text-amber-400 shrink-0" />
            <span className="truncate max-w-xs">{preset}</span>
          </button>
        ))}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-3 text-xs leading-relaxed max-w-3xl ${
              m.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div
              className={`rounded-xl p-4 relative group ${
                m.role === 'user'
                  ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white rounded-br-none shadow-xs'
                  : 'surface-card text-slate-200 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans">{m.content}</div>

              {m.role === 'assistant' && (
                <button
                  onClick={() => handleCopy(m.content, idx)}
                  className="absolute top-2 right-2 p-1 rounded bg-slate-800 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition"
                  title="Copy response"
                >
                  {copiedIdx === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>

            {m.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-300 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 text-xs text-slate-400 items-center mr-auto">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            </div>
            <span>Analyzing workspace context and generating strategy...</span>
          </div>
        )}
      </div>

      {/* Input Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-2 pt-2 border-t border-slate-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask OutboundOS AI anything about cold email strategy, copy, or deliverability..."
          className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
