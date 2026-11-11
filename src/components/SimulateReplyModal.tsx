import React, { useState } from 'react';
import { X, MessageSquare, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { Lead } from '../types';

interface SimulateReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  onReplySimulated: () => void;
}

export const SimulateReplyModal: React.FC<SimulateReplyModalProps> = ({
  isOpen,
  onClose,
  leads,
  onReplySimulated,
}) => {
  const [selectedLeadEmail, setSelectedLeadEmail] = useState(leads[0]?.email || '');
  const [sentiment, setSentiment] = useState<'interested' | 'not_interested' | 'out_of_office' | 'question'>('interested');
  const [replyBody, setReplyBody] = useState(
    'Hi Azeem, thanks for reaching out. This is very relevant to our current cloud migration. Could we schedule a 15-minute demo call next Tuesday at 10am PST?'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<string | null>(null);

  React.useEffect(() => {
    if ((!selectedLeadEmail || selectedLeadEmail === '') && leads.length > 0) {
      setSelectedLeadEmail(leads[0].email);
    }
  }, [leads, selectedLeadEmail]);

  if (!isOpen) return null;

  const presets = {
    interested:
      'Hi Azeem, thanks for reaching out! This is very relevant to our current platform audit. Could we schedule a 15-minute demo call next Tuesday at 10am PST?',
    not_interested:
      'Thanks for the note, but we already have an internal system in place for this. Please remove us from your list.',
    out_of_office:
      'Hello, I am out of the office attending an engineering summit until Friday with delayed response times. For urgent matters contact team@company.com.',
    question:
      'Hi, does OutboundOS support native OAuth with our existing Google Workspace Enterprise accounts?',
  };

  const handleSentimentChange = (newSentiment: typeof sentiment) => {
    setSentiment(newSentiment);
    setReplyBody(presets[newSentiment]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadEmail || !replyBody) return;
    setIsSubmitting(true);
    setSuccessResult(null);

    try {
      const res = await fetch('/api/worker/simulate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selectedLeadEmail,
          body: replyBody,
          sentiment,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessResult(`Reply successfully logged from ${selectedLeadEmail}! Sequence has automatically stopped.`);
        onReplySimulated();
        setTimeout(() => {
          setSuccessResult(null);
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#080d19] border border-slate-800 shadow-2xl p-6 text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-400">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">Inbound Reply Simulator</h3>
              <p className="text-[11px] text-slate-400">Test real-time reply synchronization & sequence auto-pause</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {successResult ? (
          <div className="my-6 flex flex-col items-center justify-center gap-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-bounce" />
            <p className="text-sm font-medium text-emerald-300">{successResult}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Lead</label>
              <select
                value={selectedLeadEmail}
                onChange={(e) => setSelectedLeadEmail(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.email}>
                    {l.fullName} — {l.company} ({l.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Reply Classification Sentiment</label>
              <div className="grid grid-cols-4 gap-2">
                {(['interested', 'not_interested', 'out_of_office', 'question'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSentimentChange(s)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium capitalize border transition cursor-pointer ${
                      sentiment === s
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-xs'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Reply Email Content</label>
              <textarea
                rows={4}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60 font-mono"
              />
            </div>

            <div className="surface-card rounded-xl p-3 text-[11px] text-blue-300 flex items-start gap-2">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
              <span>
                Sending an inbound response will automatically link the conversation, triage the category via sentiment rules, and pause further automated sequence follow-ups for this lead.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-blue-600 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Simulating...' : 'Send Simulated Reply'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
