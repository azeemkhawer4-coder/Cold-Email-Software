import React, { useState } from 'react';
import { FolderPlus, Plus, X, AlertCircle, List } from 'lucide-react';
import { LeadList } from '../../types';

interface AddLeadsToListModalProps {
  selectedLeadIds: string[];
  lists: LeadList[];
  onClose: () => void;
  onSuccess: (listName: string, updatedCount: number) => void;
}

export const AddLeadsToListModal: React.FC<AddLeadsToListModalProps> = ({
  selectedLeadIds,
  lists,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>(lists.length > 0 ? 'existing' : 'new');
  const [selectedListId, setSelectedListId] = useState<string>(lists[0]?.id || '');
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === 'existing' && !selectedListId) {
      setErrorMsg('Please select a target list or switch to Create New List.');
      return;
    }
    if (mode === 'new' && !newListName.trim()) {
      setErrorMsg('Please enter a name for the new list.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload =
        mode === 'existing'
          ? { leadIds: selectedLeadIds, listId: selectedListId }
          : {
              leadIds: selectedLeadIds,
              newListName: newListName.trim(),
              newListDescription: newListDescription.trim(),
            };

      const res = await fetch('/api/leads/bulk-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || `Failed to assign leads to list (HTTP ${res.status})`);
        return;
      }
      onSuccess(data.list?.name || newListName.trim(), data.updatedCount ?? selectedLeadIds.length);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while assigning leads to list.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#080d19] border border-slate-800 p-6 shadow-2xl text-slate-200 text-xs">
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-blue-400" />
              Add Leads to List
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Assign <span className="font-mono font-semibold text-blue-300">{selectedLeadIds.length}</span>{' '}
              selected lead{selectedLeadIds.length === 1 ? '' : 's'} to an existing list or create a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Add to List modal"
            className="rounded p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('existing');
              setErrorMsg(null);
            }}
            disabled={lists.length === 0}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 border text-xs font-medium transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              mode === 'existing'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Existing List ({lists.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('new');
              setErrorMsg(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 border text-xs font-medium transition cursor-pointer ${
              mode === 'new'
                ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New List</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {mode === 'existing' ? (
            <div>
              <label htmlFor="existing-list-select" className="block text-slate-300 font-medium mb-1">
                Select Target List *
              </label>
              <select
                id="existing-list-select"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.leadCount} contacts)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="new-list-name" className="block text-slate-300 font-medium mb-1">
                  New List Name *
                </label>
                <input
                  id="new-list-name"
                  type="text"
                  required
                  placeholder="e.g. Guest Posting Prospects Q4"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="new-list-desc" className="block text-slate-300 font-medium mb-1">
                  Description (Optional)
                </label>
                <input
                  id="new-list-desc"
                  type="text"
                  placeholder="e.g. SaaS marketing & tech blogs"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-1.5 font-semibold text-white disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting
                ? 'Saving...'
                : mode === 'new'
                ? 'Create List & Add Leads'
                : 'Add to List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
