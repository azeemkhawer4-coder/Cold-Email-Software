import React, { useState } from 'react';
import {
  ListFilter,
  Plus,
  Trash2,
  Users,
  ShieldBan,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Lead, LeadList } from '../types';

interface ListsPageProps {
  lists: LeadList[];
  leads?: Lead[];
  onRefreshLists: () => void;
  onSelectList: (listId: string) => void;
}

export const ListsPage: React.FC<ListsPageProps> = ({
  lists,
  leads = [],
  onRefreshLists,
  onSelectList,
}) => {
  const [activeTab, setActiveTab] = useState<'lists' | 'suppression'>('lists');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [listToDelete, setListToDelete] = useState<{ id: string; name: string } | null>(null);
  const [suppressionList, setSuppressionList] = useState<{ email: string; reason: string; addedAt: string }[]>([]);
  const [newSuppressionEmail, setNewSuppressionEmail] = useState('');
  const [newSuppressionReason, setNewSuppressionReason] = useState('Manual workspace block');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSuppression = async () => {
    try {
      const res = await fetch('/api/suppression');
      const data = await res.json();
      setSuppressionList(data.suppressionList || []);
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'suppression') {
      fetchSuppression();
    }
  }, [activeTab]);

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppressionEmail) return;
    setErrorMsg(null);
    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newSuppressionEmail, reason: newSuppressionReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Failed to add email to suppression list');
        return;
      }
      setNewSuppressionEmail('');
      fetchSuppression();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to add suppression entry');
    }
  };

  const handleDeleteList = (id: string, name: string) => {
    setListToDelete({ id, name });
  };

  const confirmDeleteList = async () => {
    if (!listToDelete) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/lists/${listToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Failed to delete list');
        return;
      }
      setListToDelete(null);
      onRefreshLists();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to delete list');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#070b14] text-slate-100 p-6 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Lists & Audience Segmentation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize target accounts into static lists, dynamic segments, and workspace-wide suppression lists.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setActiveTab('lists')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer ${
                activeTab === 'lists' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lead Lists ({lists.length})
            </button>
            <button
              onClick={() => setActiveTab('suppression')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer ${
                activeTab === 'suppression' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Global Suppression
            </button>
          </div>

          {activeTab === 'lists' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:from-blue-500 hover:to-blue-600 shadow-xs ring-1 ring-blue-500/50 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create List</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-700/60 p-3 text-xs text-rose-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-300 hover:text-white cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'lists' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => {
            const matchedLeads = leads.filter((l) => l.listId === list.id);
            const totalContacts = leads.length > 0 ? matchedLeads.length : list.leadCount;
            const verifiedContacts =
              typeof list.verifiedCount === 'number'
                ? list.verifiedCount
                : matchedLeads.filter((l) => l.verificationStatus === 'valid').length;

            return (
              <div
                key={list.id}
                className="surface-card surface-card-hover rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
                        <ListFilter className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{list.name}</h3>
                        <span className="text-[10px] text-slate-400 capitalize">{list.type} List</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteList(list.id, list.name)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      title="Delete list"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {list.description || 'No description provided.'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {list.tags.map((t) => (
                      <span key={t} className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 font-medium text-slate-200 tabular-nums">
                      <Users className="h-3.5 w-3.5 text-cyan-400" />
                      {totalContacts} Contact{totalContacts === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-mono mt-0.5 tabular-nums">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified: {verifiedContacts} / {totalContacts}
                    </span>
                  </div>
                  <button
                    onClick={() => onSelectList(list.id)}
                    className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                  >
                    View Leads →
                  </button>
                </div>
              </div>
            );
          })}
          {lists.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-800 p-10 text-center text-xs text-slate-500">
              No lead lists created yet. Click "Create List" to segment prospects for your campaigns.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldBan className="h-4 w-4 text-rose-400" />
                Global Workspace Suppression List
              </h3>
              <p className="text-xs text-slate-400">
                Any address on this list is permanently blocked from receiving emails across all current and future campaigns.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddSuppression} className="flex gap-2 text-xs">
            <input
              type="email"
              required
              placeholder="optout@domain.com"
              value={newSuppressionEmail}
              onChange={(e) => setNewSuppressionEmail(e.target.value)}
              className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200 font-mono"
            />
            <input
              type="text"
              placeholder="Reason (e.g. Unsubscribe, hard bounce)"
              value={newSuppressionReason}
              onChange={(e) => setNewSuppressionReason(e.target.value)}
              className="w-64 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
            />
            <button
              type="submit"
              className="rounded-lg bg-rose-600 px-4 py-1.5 font-medium text-white hover:bg-rose-500 transition cursor-pointer"
            >
              Suppress Email
            </button>
          </form>

          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Suppressed Email</th>
                <th className="py-2.5 px-3">Suppression Reason</th>
                <th className="py-2.5 px-3">Date Suppressed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {suppressionList.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-mono text-rose-300">{item.email}</td>
                  <td className="py-2.5 px-3 text-slate-300">{item.reason}</td>
                  <td className="py-2.5 px-3 text-slate-500">{new Date(item.addedAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {suppressionList.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500">
                    No globally suppressed addresses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE LIST MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Create New Lead List</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <CreateListForm
              onClose={() => setShowCreateModal(false)}
              onCreated={() => {
                setShowCreateModal(false);
                onRefreshLists();
              }}
            />
          </div>
        </div>
      )}

      {/* DELETE LIST CONFIRMATION MODAL */}
      {listToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-white">Delete Lead List?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-rose-400">"{listToDelete.name}"</span>? Leads assigned to this list will remain in your master database.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setListToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteList}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
              >
                Delete List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateListForm: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg(null);
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description,
          tags: tag ? tag.split(',').map((t) => t.trim()).filter(Boolean) : ['Outreach'],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || 'Failed to create list');
        return;
      }
      onCreated();
    } catch (e: any) {
      setErrorMsg(e.message || 'Network error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-rose-200">
          {errorMsg}
        </div>
      )}
      <div>
        <label className="block text-slate-400 mb-1">List Name *</label>
        <input
          type="text"
          required
          placeholder="e.g. Q4 Cloud Infra Decision Makers"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
        />
      </div>
      <div>
        <label className="block text-slate-400 mb-1">Description</label>
        <textarea
          rows={2}
          placeholder="Target persona and industry criteria..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
        />
      </div>
      <div>
        <label className="block text-slate-400 mb-1">Tags (comma separated)</label>
        <input
          type="text"
          placeholder="B2B, SaaS, Series B"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200"
        />
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
        <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700 cursor-pointer">
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-500 cursor-pointer">
          Create List
        </button>
      </div>
    </form>
  );
};
