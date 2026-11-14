import React, { useState, useEffect } from 'react';
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
  CheckSquare,
  Square,
  Briefcase,
  Globe,
  Trash2,
  Search,
} from 'lucide-react';
import { Deal, DealStage, Lead, Company, Task } from '../types';

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
  const [activeTab, setActiveTab] = useState<'deals' | 'companies' | 'tasks'>('deals');
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Companies & Tasks state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/crm/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/crm/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchTasks();
  }, [deals, leads]);

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

  const handleToggleTask = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await fetch(`/api/crm/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await fetch(`/api/crm/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      await fetch(`/api/crm/companies/${id}`, { method: 'DELETE' });
      fetchCompanies();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#070b14] text-slate-100 p-6 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              CRM & Pipeline Management
            </h1>
            <span className="rounded bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-xs font-mono font-medium text-emerald-400 tabular-nums">
              ${totalPipelineValue.toLocaleString()} Active Pipeline
            </span>
            <span className="rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 text-[10px] font-mono">
              SQLite ACID
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage deals, target corporate accounts, and outreach follow-up tasks persisted locally in SQLite.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub tabs */}
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setActiveTab('deals')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'deals' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KanbanSquare className="h-3.5 w-3.5" />
              Deals ({deals.length})
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'companies' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building className="h-3.5 w-3.5" />
              Companies ({companies.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tasks' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Tasks ({tasks.length})
            </button>
          </div>

          {activeTab === 'deals' && (
            <button
              onClick={() => setShowCreateDealModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Deal</span>
            </button>
          )}

          {activeTab === 'companies' && (
            <button
              onClick={() => setShowCreateCompanyModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Company</span>
            </button>
          )}

          {activeTab === 'tasks' && (
            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: DEALS KANBAN */}
      {activeTab === 'deals' && (
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
                      <div className="p-4 text-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-[11px]">
                        No deals
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMPANIES TABLE */}
      {activeTab === 'companies' && (
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="rounded-xl border border-slate-800 bg-[#080d19] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Target Corporate Accounts</h3>
                <p className="text-xs text-slate-400">Companies stored in local SQLite database (<code className="font-mono text-slate-300">data/outboundos.sqlite</code>)</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{companies.length} Total Accounts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium bg-slate-900/50">
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">Industry</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Deals</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {companies.map((comp) => (
                    <tr key={comp.id} className="hover:bg-slate-900/30 transition">
                      <td className="py-3 px-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <Building className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          <span>{comp.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-cyan-300">{comp.domain}</td>
                      <td className="py-3 px-4 text-slate-300">{comp.industry}</td>
                      <td className="py-3 px-4 text-slate-400">{comp.employeeCount} employees</td>
                      <td className="py-3 px-4 text-slate-400">{comp.location}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">{comp.dealsCount} deals (${comp.totalValue?.toLocaleString() || 0})</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteCompany(comp.id)}
                          className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1"
                          title="Delete Company"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs font-sans">
                        No company accounts recorded yet. Click "New Company" above to add your first account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TASKS LIST */}
      {activeTab === 'tasks' && (
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="rounded-xl border border-slate-800 bg-[#080d19] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Outreach & Follow-Up Tasks</h3>
                <p className="text-xs text-slate-400">Scheduled action items and demo preparation persisted in local SQLite.</p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {tasks.filter((t) => t.status === 'completed').length} / {tasks.length} Completed
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 flex items-center justify-between gap-4 transition hover:bg-slate-900/40 ${
                    task.status === 'completed' ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleTask(task)}
                      className="cursor-pointer text-slate-400 hover:text-emerald-400 transition"
                    >
                      {task.status === 'completed' ? (
                        <CheckSquare className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-500" />
                      )}
                    </button>
                    <div>
                      <h4 className={`text-xs font-bold ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-mono">
                        {task.leadName && <span>Contact: {task.leadName}</span>}
                        <span>Assignee: {task.assignedTo}</span>
                        <span>Due: {task.dueDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase font-mono ${
                        task.priority === 'high'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : task.priority === 'medium'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {task.priority} Priority
                    </span>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-slate-500 hover:text-rose-400 transition cursor-pointer p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No pending outreach tasks. Click "New Task" above to add an action item.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE DEAL MODAL */}
      {showCreateDealModal && (
        <CreateDealModal
          leads={leads}
          onClose={() => setShowCreateDealModal(false)}
          onCreated={() => {
            setShowCreateDealModal(false);
            onRefreshDeals();
          }}
        />
      )}

      {/* CREATE COMPANY MODAL */}
      {showCreateCompanyModal && (
        <CreateCompanyModal
          onClose={() => setShowCreateCompanyModal(false)}
          onCreated={() => {
            setShowCreateCompanyModal(false);
            fetchCompanies();
          }}
        />
      )}

      {/* CREATE TASK MODAL */}
      {showCreateTaskModal && (
        <CreateTaskModal
          leads={leads}
          onClose={() => setShowCreateTaskModal(false)}
          onCreated={() => {
            setShowCreateTaskModal(false);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
};

// ------------------------------------------
// MODAL: CREATE DEAL
// ------------------------------------------
const CreateDealModal: React.FC<{
  leads: Lead[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ leads, onClose, onCreated }) => {
  const [leadId, setLeadId] = useState(leads[0]?.id || '');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('15000');
  const [stage, setStage] = useState<DealStage>('new');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = leads.find((l) => l.id === leadId);
    setIsSubmitting(true);
    try {
      await fetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          leadName: lead?.fullName || 'Contact',
          leadEmail: lead?.email || '',
          leadCompany: lead?.company || 'Company',
          title,
          value: parseFloat(value) || 0,
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
      <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Create New CRM Deal</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Associated Lead *</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            >
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.fullName} — {l.company} ({l.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Deal Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Enterprise License"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Value ($ USD)</label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Stage</label>
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
            <label className="block text-slate-400 mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-100"
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

// ------------------------------------------
// MODAL: CREATE COMPANY
// ------------------------------------------
const CreateCompanyModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [employeeCount, setEmployeeCount] = useState('50-200');
  const [location, setLocation] = useState('United States');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain, industry, employeeCount, location }),
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
      <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Add Company Account</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Company Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Stripe, Inc."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Corporate Domain *</label>
            <input
              type="text"
              required
              placeholder="stripe.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Industry</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Employee Count</label>
              <select
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
              >
                <option value="1-10">1-10</option>
                <option value="10-50">10-50</option>
                <option value="50-200">50-200</option>
                <option value="200-1000">200-1,000</option>
                <option value="1000+">1,000+</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
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
              {isSubmitting ? 'Saving...' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ------------------------------------------
// MODAL: CREATE TASK
// ------------------------------------------
const CreateTaskModal: React.FC<{
  leads: Lead[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ leads, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [leadId, setLeadId] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const lead = leads.find((l) => l.id === leadId);
    try {
      await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          dueDate,
          priority,
          leadId,
          leadName: lead?.fullName,
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
      <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Create Follow-Up Task</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Task Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Send technical proposal & case study"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Associated Lead (Optional)</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
            >
              <option value="">None / General Task</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.fullName} ({l.company})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-100"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Description / Details</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-slate-100"
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
              {isSubmitting ? 'Saving...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
