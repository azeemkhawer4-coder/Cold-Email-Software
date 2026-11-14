import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  X,
  FileSpreadsheet,
  Check,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { Lead, LeadList } from '../types';
import { isLeadIncomplete } from '../utils/analyticsStats';

export { isLeadIncomplete };

interface LeadsPageProps {
  leads: Lead[];
  lists: LeadList[];
  selectedListId?: string;
  onClearListFilter?: () => void;
  onRefreshLeads: () => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({
  leads,
  lists,
  selectedListId,
  onClearListFilter,
  onRefreshLeads,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [completenessFilter, setCompletenessFilter] = useState<string>('all');
  const [listFilter, setListFilter] = useState<string>(selectedListId || 'all');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setListFilter(selectedListId || 'all');
  }, [selectedListId]);

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    if (listFilter !== 'all' && lead.listId !== listFilter) return false;
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
    if (verificationFilter !== 'all' && lead.verificationStatus !== verificationFilter) return false;
    if (completenessFilter === 'incomplete' && !isLeadIncomplete(lead)) return false;
    if (completenessFilter === 'complete' && isLeadIncomplete(lead)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (lead.fullName || '').toLowerCase().includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.company || '').toLowerCase().includes(q) ||
        (lead.jobTitle || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeListName =
    listFilter !== 'all' ? lists.find((l) => l.id === listFilter)?.name || listFilter : null;

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const toggleSelectLead = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  const handleDeleteSelected = () => {
    if (selectedLeadIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    try {
      await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedLeadIds) }),
      });
      setSelectedLeadIds(new Set());
      setShowDeleteConfirm(false);
      onRefreshLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Full Name',
      'First Name',
      'Last Name',
      'Email',
      'Company',
      'Job Title',
      'Status',
      'Verification',
      'Phone',
      'Country',
    ];
    const rows = filteredLeads.map((l) => [
      `"${l.fullName}"`,
      `"${l.firstName}"`,
      `"${l.lastName}"`,
      `"${l.email}"`,
      `"${l.company}"`,
      `"${l.jobTitle}"`,
      `"${l.status}"`,
      `"${l.verificationStatus}"`,
      `"${l.phone || ''}"`,
      `"${l.country}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `outboundos-leads-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#070b14] text-slate-100">
      {/* Top Action Bar */}
      <div className="p-6 pb-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Lead Management Database
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-blue-400 tabular-nums">
              {filteredLeads.length === leads.length
                ? `${leads.length} Contacts`
                : `${filteredLeads.length} / ${leads.length} Contacts`}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified prospect directory with deduplication, custom fields, completeness audits, and suppression checks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedLeadIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete ({selectedLeadIds.size})</span>
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer shadow-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs ring-1 ring-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-900/30 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter leads by name, email, company, or title..."
            className="w-full rounded-lg bg-slate-900/80 border border-slate-800 pl-8.5 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
        </div>

        {/* List Filter */}
        <select
          value={listFilter}
          onChange={(e) => {
            const val = e.target.value;
            setListFilter(val);
            if (val === 'all') onClearListFilter?.();
          }}
          className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
        >
          <option value="all">All Lists</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
        >
          <option value="all">All Lead Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="interested">Interested</option>
          <option value="meeting_booked">Meeting Booked</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
        </select>

        {/* Verification Status */}
        <select
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
        >
          <option value="all">All Verification</option>
          <option value="valid">Valid (Authoritative)</option>
          <option value="risky">Risky / Catch-All</option>
          <option value="invalid">Invalid</option>
        </select>

        {/* Completeness Filter */}
        <select
          value={completenessFilter}
          onChange={(e) => setCompletenessFilter(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
        >
          <option value="all">All Completeness</option>
          <option value="complete">Complete Profiles</option>
          <option value="incomplete">Incomplete (Missing Fields)</option>
        </select>

        {activeListName && (
          <button
            onClick={() => {
              setListFilter('all');
              onClearListFilter?.();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/25 cursor-pointer"
          >
            <Filter className="h-3 w-3" />
            <span>List: {activeListName}</span>
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Leads Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-[#090e1a]/95 backdrop-blur-md border-b border-slate-800 text-slate-400 select-none z-10">
            <tr>
              <th className="py-2.5 px-4 w-10">
                <input
                  type="checkbox"
                  checked={selectedLeadIds.size > 0 && selectedLeadIds.size === filteredLeads.length}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                />
              </th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Contact Name</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Company & Domain</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Job Title</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Status</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Verification</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Location</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLeads.map((lead) => {
              const isSelected = selectedLeadIds.has(lead.id);
              const incomplete = isLeadIncomplete(lead);
              return (
                <tr
                  key={lead.id}
                  onClick={() => setActiveLead(lead)}
                  className={`hover:bg-slate-800/35 transition cursor-pointer ${
                    isSelected ? 'bg-blue-950/20' : ''
                  }`}
                >
                  <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectLead(lead.id)}
                      className="rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                    />
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-100">
                          {lead.fullName?.trim() || lead.email}
                        </span>
                        {incomplete && (
                          <span
                            className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-amber-300"
                            title="Missing First Name, Company, or Job Title"
                          >
                            Incomplete
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{lead.email}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex flex-col">
                      <span className="text-slate-200 font-medium">{lead.company || '—'}</span>
                      <span className="text-[11px] text-slate-500 truncate">{lead.domain || lead.website || '—'}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-300 truncate max-w-[180px]">{lead.jobTitle || '—'}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        lead.status === 'interested'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : lead.status === 'meeting_booked'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : lead.status === 'replied'
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          : lead.status === 'contacted'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                          : lead.status === 'unsubscribed'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {lead.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        lead.verificationStatus === 'valid'
                          ? 'text-emerald-400'
                          : lead.verificationStatus === 'risky'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {lead.verificationStatus === 'valid' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      <span className="capitalize">{lead.verificationStatus}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 truncate">
                    {lead.city ? `${lead.city}, ${lead.country}` : lead.country || '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActiveLead(lead)}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="h-10 w-10 text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No matching leads found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Try adjusting your search criteria, clearing the active list filter, or importing a new lead batch from CSV.
            </p>
          </div>
        )}
      </div>

      {/* LEAD PROFILE DRAWER */}
      {activeLead && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-[#080d19] border-l border-slate-800 shadow-2xl flex flex-col animate-slide-left">
          <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/80">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {activeLead.fullName?.trim() || activeLead.email}
                </h2>
                <span className="rounded bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-[9px] font-mono font-semibold text-blue-400">
                  {activeLead.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeLead.jobTitle || 'Role unspecified'} {activeLead.company ? `at ${activeLead.company}` : ''}
              </p>
            </div>
            <button
              onClick={() => setActiveLead(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
            <div className="surface-card rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Contact Information
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-mono text-slate-200">{activeLead.email}</span>
                </div>
                {activeLead.phone && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="h-3.5 w-3.5 text-slate-500" />
                    <span className="font-mono">{activeLead.phone}</span>
                  </div>
                )}
                {activeLead.linkedinUrl && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <Linkedin className="h-3.5 w-3.5 text-blue-400" />
                    <a
                      href={activeLead.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline flex items-center gap-1"
                    >
                      LinkedIn Profile <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {activeLead.city ? `${activeLead.city}, ` : ''}
                    {activeLead.country || 'Unspecified'}
                  </span>
                </div>
              </div>
            </div>

            <div className="surface-card rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Company Profile
              </h3>
              <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block">Company</span>
                  <span className="font-medium text-slate-200">{activeLead.company || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Website</span>
                  <span className="font-medium text-slate-200 font-mono text-[11px]">
                    {activeLead.website || activeLead.domain || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Industry</span>
                  <span className="font-medium text-slate-200">{activeLead.industry || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Source</span>
                  <span className="font-medium text-slate-200">{activeLead.source || '—'}</span>
                </div>
              </div>
            </div>

            {activeLead.customFields && Object.keys(activeLead.customFields).length > 0 && (
              <div className="surface-card rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  Custom Personalization Variables
                </h3>
                <div className="space-y-1.5 pt-1">
                  {Object.entries(activeLead.customFields).map(([key, val]) => (
                    <div key={key} className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-400 font-mono text-[11px]">&#123;&#123;{key}&#125;&#125;</span>
                      <span className="font-medium text-slate-200 text-right font-mono">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="surface-card rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Internal Notes
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                {activeLead.notes || 'No internal notes recorded yet.'}
              </p>
            </div>

            <div className="surface-card rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                Compliance & Safeguards
              </h3>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">Global Suppression:</span>
                <span className={activeLead.unsubscribeStatus ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
                  {activeLead.unsubscribeStatus ? 'Suppressed (Opted Out)' : 'Eligible for Campaigns'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          lists={lists}
          defaultListId={listFilter !== 'all' ? listFilter : lists[0]?.id || ''}
          onSuccess={() => {
            setShowAddModal(false);
            onRefreshLeads();
          }}
        />
      )}

      {/* CSV IMPORT WORKFLOW MODAL */}
      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          lists={lists}
          onSuccess={() => {
            setShowImportModal(false);
            onRefreshLeads();
          }}
        />
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-white">Delete Selected Leads?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to delete <span className="font-semibold text-rose-400">{selectedLeadIds.size}</span> selected lead(s) from your workspace. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
              >
                Delete Leads
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ADD LEAD MODAL COMPONENT
const AddLeadModal: React.FC<{
  onClose: () => void;
  lists: LeadList[];
  defaultListId: string;
  onSuccess: () => void;
}> = ({ onClose, lists, defaultListId, onSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    jobTitle: '',
    country: 'United States',
    city: '',
    linkedinUrl: '',
    phone: '',
    listId: defaultListId,
    notes: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.email.trim()) {
      setErrorMsg('Email address is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `Failed to create lead (HTTP ${res.status})`);
        return;
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while saving lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-white">Add New Prospect Lead</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Company Name</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Job Title</label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Target List</label>
              <select
                value={formData.listId}
                onChange={(e) => setFormData({ ...formData, listId: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
              >
                <option value="">Unassigned</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Notes</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// CSV IMPORT MODAL COMPONENT
const CsvImportModal: React.FC<{
  onClose: () => void;
  lists: LeadList[];
  onSuccess: () => void;
}> = ({ onClose, lists, onSuccess }) => {
  const [csvContent, setCsvContent] = useState('');
  const [selectedListId, setSelectedListId] = useState(lists[0]?.id || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importReport, setImportReport] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sampleCsv = `First Name,Last Name,Email,Company,Job Title,Country\nGuillermo,Rauch,guillermo@vercel.com,Vercel,CEO,United States\nDylan,Field,dylan@figma.com,Figma,CEO,United States\nShishir,Mehrotra,shishir@coda.io,Coda,Co-Founder & CEO,United States`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) return;
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/leads/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvContent,
          listId: selectedListId,
          skipDuplicates: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || `CSV import failed (HTTP ${res.status})`);
        return;
      }
      setImportReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'CSV import failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Import Prospects via CSV</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-rose-200 text-xs">
            {errorMsg}
          </div>
        )}

        {importReport ? (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <Check className="h-6 w-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-sm">CSV Import Completed Successfully</p>
                <p className="text-xs text-emerald-400/80">Processed records and synchronized to target lead list.</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Valid Imported</span>
                <span className="text-base font-bold text-emerald-400">{importReport.importedCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Duplicates Skipped</span>
                <span className="text-base font-bold text-slate-300">{importReport.duplicatesCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Suppressed</span>
                <span className="text-base font-bold text-rose-400">{importReport.suppressedCount}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Invalid Syntax</span>
                <span className="text-base font-bold text-amber-400">{importReport.invalidCount}</span>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={onSuccess}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Target Lead List</label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-200"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Upload CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">Or Paste CSV Data</label>
                <button
                  type="button"
                  onClick={() => setCsvContent(sampleCsv)}
                  className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  Load Sample SaaS Founders CSV
                </button>
              </div>
              <textarea
                rows={5}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="First Name,Last Name,Email,Company,Job Title,Country..."
                className="w-full rounded-lg bg-slate-800 border border-slate-700 p-3 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!csvContent || isProcessing}
                className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'Processing CSV...' : 'Start Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
