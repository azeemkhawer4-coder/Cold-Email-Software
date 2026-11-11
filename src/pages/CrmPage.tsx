import React, { useState } from 'react';
import {
  KanbanSquare,
  Plus,
  DollarSign,
  Calendar,
  Building,
  User,
  ArrowRight,
  CheckCircle2,
  X,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Deal, DealStage, Lead } from '../types';

interface CrmPageProps {
  deals: Deal[];
  leads: Lead[];
  onRefreshDeals: () => void;
}

const STAGES: { id: DealStage; label: string; color: string }[] = [
  { id: 'new', label: 'New Opportunity', color: 'border-slate-700' },
  { id: 'contacted', label: 'Contacted', color: 'border-blue-700' },
  { id: 'replied', label: 'Replied', color: 'border-indigo-700' },
  { id: 'interested', label: 'Interested', color: 'border-cyan-700' },
  { id: 'meeting_booked', label: 'Meeting Booked', color: 'border-amber-700' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'border-purple-700' },
  { id: 'won', label: 'Closed Won', color: 'border-emerald-700' },
  { id: 'lost', label: 'Closed Lost', color: 'border-rose-700' },
];

export const CrmPage: React.FC<CrmPageProps> = ({ deals, leads, onRefreshDeals }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const totalPipelineValue = deals
    .filter((d) => d.stage !== 'lost')
    .reduce((acc, d) => acc + (d.value || 0), 0);

  const handleMoveStage = async (dealId: string, nextStage: DealStage) => {
    try {
      await fetch(`/api/crm/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      });
      onRefreshDeals();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#070b14] text-slate-100 p-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            CRM & Deal Pipeline
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-emerald-400 tabular-nums">
              ${totalPipelineValue.toLocaleString()} Active Pipeline
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track qualified prospect conversions, scheduled demos, deal progression, and sales revenue.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs ring-1 ring-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Deal</span>
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-4 min-w-[1400px] h-full items-start">
          {STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage.id);
            const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

            return (
              <div
                key={stage.id}
                className="w-72 rounded-xl bg-[#080d19]/80 border border-slate-800/80 flex flex-col max-h-full shrink-0 shadow-sm"
              >
                {/* Column Header */}
                <div className={`p-3.5 border-b border-slate-800/80 border-t-2 ${stage.color} flex items-center justify-between`}>
                  <div>
                    <h3 className="text-xs font-semibold text-white tracking-tight">{stage.label}</h3>
                    <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                      ${stageValue.toLocaleString()} ({stageDeals.length})
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="surface-card surface-card-hover rounded-xl p-3.5 space-y-2 transition-all duration-150"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-white leading-tight">{deal.title}</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                          ${(deal.value || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Building className="h-3 w-3 text-slate-500" />
                        <span className="text-slate-300 font-medium">{deal.leadCompany}</span>
                        <span>· {deal.leadName}</span>
                      </div>

                      {deal.meetingDate && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                          <Calendar className="h-2.5 w-2.5" />
                          <span>Demo: {new Date(deal.meetingDate).toLocaleDateString()}</span>
                        </div>
                      )}

                      {deal.notes && (
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                          {deal.notes}
                        </p>
                      )}

                      {/* Stage Progression Selector */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-mono">Move:</span>
                        <select
                          value={deal.stage}
                          onChange={(e) => handleMoveStage(deal.id, e.target.value as DealStage)}
                          className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 text-slate-200 text-[10px] focus:outline-none"
                        >
                          {STAGES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="py-8 text-center text-[11px] text-slate-600 font-mono">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE DEAL MODAL */}
      {showCreateModal && (
        <CreateDealModal
          leads={leads}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            onRefreshDeals();
          }}
        />
      )}
    </div>
  );
};

const CreateDealModal: React.FC<{
  leads: Lead[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ leads, onClose, onCreated }) => {
  const [selectedLeadId, setSelectedLeadId] = useState(leads[0]?.id || '');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('25000');
  const [stage, setStage] = useState<DealStage>('interested');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !selectedLead) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          leadName: selectedLead.fullName,
          leadEmail: selectedLead.email,
          leadCompany: selectedLead.company,
          title,
          value: parseFloat(value) || 10000,
          stage,
          notes,
        }),
      });
      onCreated();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-white">Create New CRM Deal</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-slate-400 mb-1">Target Contact & Account</label>
            <select
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              disabled={leads.length === 0}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100 disabled:opacity-50"
            >
              {leads.length === 0 ? (
                <option value="">No leads in database — please add a lead first</option>
              ) : (
                leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName} — {l.company} ({l.email})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Deal Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Corp — Enterprise Outbound License"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Deal Value ($ USD)</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Pipeline Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Deal Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key priorities, deal requirements..."
              className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
