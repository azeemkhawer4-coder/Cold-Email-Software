import React, { useState } from 'react';
import {
  Inbox,
  Mail,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  CalendarCheck,
  Building,
  User,
  Tag,
  ArrowRight,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Archive,
  CornerDownLeft,
} from 'lucide-react';
import { Conversation, InboundMessage } from '../types';

interface UnifiedInboxPageProps {
  conversations: Conversation[];
  onRefreshInbox: () => void;
  selectedConversationId?: string;
}

export const UnifiedInboxPage: React.FC<UnifiedInboxPageProps> = ({
  conversations,
  onRefreshInbox,
  selectedConversationId,
}) => {
  const [currentFolder, setCurrentFolder] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [activeConvId, setActiveConvId] = useState<string>(
    selectedConversationId || conversations[0]?.id || ''
  );
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Sync prop changes
  React.useEffect(() => {
    if (selectedConversationId) {
      setActiveConvId(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (currentFolder !== 'all') {
      if (currentFolder === 'unread') {
        if (c.status !== 'unread') return false;
      } else if (c.category !== currentFolder) {
        return false;
      }
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        c.leadName.toLowerCase().includes(q) ||
        c.leadCompany.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.snippet.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeConversation = conversations.find((c) => c.id === activeConvId) || conversations[0];

  const handleSendReply = async () => {
    if (!replyText || !activeConversation) return;
    setIsSendingReply(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/inbox/${activeConversation.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setReplyError(data.error || 'Failed to dispatch email reply');
        return;
      }
      setReplyText('');
      setReplyError(null);
      onRefreshInbox();
    } catch (err: any) {
      setReplyError(err.message || 'Network error sending reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleAiDraftResponse = async () => {
    if (!activeConversation) return;
    setIsAiGenerating(true);
    const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
    try {
      const res = await fetch('/api/ai/classify-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText: lastMsg?.body || activeConversation.snippet }),
      });
      const data = await res.json();
      if (data.success && data.classification?.suggestedReply) {
        setReplyText(data.classification.suggestedReply);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleChangeCategory = async (newCategory: string) => {
    if (!activeConversation) return;
    try {
      await fetch(`/api/inbox/${activeConversation.id}/category`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      });
      onRefreshInbox();
    } catch (e) {
      console.error(e);
    }
  };

  const folders = [
    { id: 'all', label: 'All Inboxes', count: conversations.length },
    { id: 'unread', label: 'Unread', count: conversations.filter((c) => c.status === 'unread').length },
    { id: 'interested', label: 'Interested', count: conversations.filter((c) => c.category === 'interested').length },
    { id: 'meeting_booked', label: 'Meetings Booked', count: conversations.filter((c) => c.category === 'meeting_booked').length },
    { id: 'question', label: 'Questions', count: conversations.filter((c) => c.category === 'question').length },
    { id: 'out_of_office', label: 'Out of Office', count: conversations.filter((c) => c.category === 'out_of_office').length },
    { id: 'not_interested', label: 'Not Interested', count: conversations.filter((c) => c.category === 'not_interested').length },
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-[#070b14] text-slate-100">
      {/* COLUMN 1: FOLDERS & LABELS */}
      <div className="w-56 border-r border-slate-800/80 bg-[#080d19]/90 flex flex-col p-3 space-y-3 shrink-0">
        <div className="px-2 pt-1">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-tight">
            <Inbox className="h-4 w-4 text-blue-400" />
            <span>Master Unibox</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Unified replies across all accounts</p>
        </div>

        <nav className="space-y-0.5">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setCurrentFolder(f.id)}
              className={`flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                currentFolder === f.id
                  ? 'bg-blue-600/15 text-white font-semibold border border-blue-500/25 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
            >
              <span className="truncate">{f.label}</span>
              {f.count > 0 && (
                <span
                  className={`rounded-full px-1.5 font-mono text-[10px] font-bold tabular-nums ${
                    currentFolder === f.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* COLUMN 2: CONVERSATIONS LIST */}
      <div className="w-80 border-r border-slate-800/80 bg-[#080d19]/50 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-800/80">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-lg bg-slate-900 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
          {filteredConversations.map((c) => {
            const isSelected = c.id === activeConversation?.id;
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`p-3.5 hover:bg-slate-800/35 transition cursor-pointer relative ${
                  isSelected ? 'bg-blue-600/10 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-100 truncate pr-2">{c.leadName}</span>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 tabular-nums">
                    {new Date(c.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 font-medium truncate mb-1">
                  {c.leadCompany} · {c.subject}
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">{c.snippet}</p>

                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase tracking-wider ${
                      c.category === 'interested'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : c.category === 'meeting_booked'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : c.category === 'out_of_office'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {c.category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate max-w-[120px] font-mono">
                    via {c.mailboxEmail.split('@')[0]}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No conversations in this folder.
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 3: CONVERSATION THREAD & COMPOSER */}
      {activeConversation ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070b14]">
          {/* Thread Header */}
          <div className="p-4 px-6 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">{activeConversation.subject}</h3>
                <span className="text-xs text-slate-400">({activeConversation.leadCompany})</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Thread with <span className="text-slate-200">{activeConversation.leadName}</span> (<span className="font-mono text-slate-300">{activeConversation.leadEmail}</span>) · Campaign: {activeConversation.campaignName}
              </p>
            </div>

            {/* Sentiment Category Selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px] font-mono">Triage:</span>
              <select
                value={activeConversation.category}
                onChange={(e) => handleChangeCategory(e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60"
              >
                <option value="interested">Interested</option>
                <option value="meeting_booked">Meeting Booked</option>
                <option value="question">Question</option>
                <option value="out_of_office">Out of Office</option>
                <option value="not_interested">Not Interested</option>
                <option value="unsubscribed">Unsubscribed</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Messages Chronological Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {activeConversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-2xl rounded-xl p-4 text-xs ${
                  msg.isInbound
                    ? 'surface-card border-blue-500/30 mr-auto'
                    : 'bg-slate-900 border border-slate-800 ml-auto'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">{msg.sender}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({msg.senderEmail})</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {msg.body}
                </div>
              </div>
            ))}
          </div>

          {/* Reply Composer Box */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <CornerDownLeft className="h-3.5 w-3.5" />
                Replying to <span className="text-slate-200 font-mono">{activeConversation.leadEmail}</span> via{' '}
                <span className="text-slate-200 font-mono">{activeConversation.mailboxEmail}</span>
              </span>

              <button
                type="button"
                onClick={handleAiDraftResponse}
                disabled={isAiGenerating}
                className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isAiGenerating ? 'AI Drafting...' : 'Draft AI Reply'}</span>
              </button>
            </div>

            {replyError && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{replyError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyError(null)}
                  className="text-rose-400 hover:text-white cursor-pointer text-xs ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            <textarea
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply or use AI to draft an executive response..."
              className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500/60 leading-relaxed font-sans"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={handleSendReply}
                disabled={!replyText || isSendingReply}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 transition cursor-pointer shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSendingReply ? 'Sending...' : 'Send Reply'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
          Select a conversation from the left to view messages.
        </div>
      )}
    </div>
  );
};
