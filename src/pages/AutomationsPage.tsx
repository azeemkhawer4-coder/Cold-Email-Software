import React, { useState } from 'react';
import {
  Zap,
  Plus,
  ArrowRight,
  Clock,
  ToggleLeft,
  ToggleRight,
  X,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { Automation } from '../types';

interface AutomationsPageProps {
  automations: Automation[];
  onRefreshAutomations: () => void;
}

const STARTER_TEMPLATES = [
  {
    name: 'Positive Reply -> Advance Deal in CRM',
    triggerEvent: 'positive_reply',
    actionType: 'move_deal_stage',
    actionParams: { targetStage: 'interested' },
    summary: 'Automatically advances associated lead deals when a positive reply arrives.',
  },
  {
    name: 'Unsubscribe -> Global Suppression',
    triggerEvent: 'unsubscribed',
    actionType: 'update_lead_status',
    actionParams: { status: 'unsubscribed' },
    summary: 'Marks contact as suppressed and halts remaining active follow-up jobs.',
  },
  {
    name: 'Hard Bounce -> Tag & Suppress',
    triggerEvent: 'bounce_detected',
    actionType: 'add_tag',
    actionParams: { tag: 'bounced' },
    summary: 'Flags bounced addresses automatically so future campaigns skip them.',
  },
];

export const AutomationsPage: React.FC<AutomationsPageProps> = ({
  automations,
  onRefreshAutomations,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggle = async (auto: Automation) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/automations/${auto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !auto.enabled }),
      });
      if (!res.ok) throw new Error('Failed to update automation state');
      onRefreshAutomations();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to update automation');
    }
  };

  const handleDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/automations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete automation');
      onRefreshAutomations();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to delete automation');
    }
  };

  const handleUseTemplate = async (tpl: (typeof STARTER_TEMPLATES)[number]) => {
    setCreatingTemplate(tpl.name);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tpl.name,
          triggerEvent: tpl.triggerEvent,
          actionType: tpl.actionType,
          actionParams: tpl.actionParams,
        }),
      });
      if (!res.ok) throw new Error('Failed to create automation workflow');
      onRefreshAutomations();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to add starter workflow');
    } finally {
      setCreatingTemplate(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Automations & Event Workflows
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-indigo-400 tabular-nums">
              {automations.filter((a) => a.enabled).length} Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Event-driven triggers that update lead statuses, synchronize CRM deals, and manage suppression.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs ring-1 ring-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Automation</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty State with Starter Templates */}
      {automations.length === 0 ? (
        <div className="surface-card rounded-2xl border border-slate-800 p-8 space-y-6">
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 text-[11px] font-semibold text-indigo-300">
              <Zap className="h-3.5 w-3.5" />
              Zero Active Workflows Configured
            </div>
            <h2 className="text-base font-bold text-white">Automate Reply Triage, CRM Pipeline Updates & Suppression</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create your own trigger-action workflow or install a zero-cost starter rule below. Every rule persists locally in SQLite and executes automatically during email sending and reply synchronization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STARTER_TEMPLATES.map((tpl) => (
              <div
                key={tpl.name}
                className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-white">{tpl.name}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{tpl.summary}</p>
                  <div className="pt-1 flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="text-cyan-300">{tpl.triggerEvent}</span>
                    <ArrowRight className="h-3 w-3 text-slate-500" />
                    <span className="text-indigo-300">{tpl.actionType}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUseTemplate(tpl)}
                  disabled={creatingTemplate === tpl.name}
                  className="w-full rounded-lg bg-blue-600/20 border border-blue-500/30 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition cursor-pointer disabled:opacity-50"
                >
                  {creatingTemplate === tpl.name ? 'Installing...' : 'Use Starter Rule'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Automations Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="surface-card surface-card-hover rounded-xl p-5 flex flex-col justify-between transition-all duration-150 space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{auto.name}</h3>
                      <span className="text-[10px] text-slate-400">
                        Executed {auto.executionCount} times
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(auto)}
                      className="text-slate-400 hover:text-white transition cursor-pointer"
                      title={auto.enabled ? 'Disable automation' : 'Enable automation'}
                      aria-label={auto.enabled ? `Disable ${auto.name}` : `Enable ${auto.name}`}
                    >
                      {auto.enabled ? (
                        <ToggleRight className="h-6 w-6 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-slate-600" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(auto.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      title={`Delete ${auto.name}`}
                      aria-label={`Delete ${auto.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Trigger & Action Flow */}
                <div className="mt-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700/60 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">When:</span>
                    <span className="font-mono text-cyan-300 text-[11px]">{auto.triggerEvent.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center justify-center text-slate-500">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Then:</span>
                    <span className="font-mono text-indigo-300 text-[11px]">{auto.actionType.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {auto.lastExecutedAt
                    ? `Last ran: ${new Date(auto.lastExecutedAt).toLocaleDateString()}`
                    : 'Never executed'}
                </span>
                <span className={auto.enabled ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                  {auto.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE AUTOMATION MODAL */}
      {showCreateModal && (
        <CreateAutomationModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            onRefreshAutomations();
          }}
        />
      )}
    </div>
  );
};

const CreateAutomationModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('positive_reply');
  const [actionType, setActionType] = useState('move_deal_stage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Automation name is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          triggerEvent,
          actionType,
          actionParams: { targetStage: 'interested' },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create automation');
      }
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Failed to save automation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-white">Create New Event Automation</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-1">Automation Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Move Deal to Won on Meeting Booked"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Trigger Event</label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            >
              <option value="positive_reply">Positive Reply Received</option>
              <option value="reply_received">Any Reply Received</option>
              <option value="unsubscribed">Unsubscribe Request</option>
              <option value="bounce_detected">Hard Bounce Detected</option>
              <option value="email_sent">Outbound Email Dispatched</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Action to Take</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            >
              <option value="move_deal_stage">Advance Deal to Interested in CRM</option>
              <option value="add_tag">Add Custom Tag to Lead</option>
              <option value="update_lead_status">Add Lead to Global Suppression List</option>
              <option value="pause_campaign">Pause Active Campaign Follow-ups</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300 cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
