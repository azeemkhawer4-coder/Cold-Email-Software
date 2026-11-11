import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Shield,
  Key,
  Users,
  Bell,
  Download,
  Check,
  MapPin,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { WorkspaceSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/workspace')
      .then((res) => res.json())
      .then((data) => setWorkspace(data.workspace))
      .catch((err) => console.error(err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setIsSaving(true);
    try {
      await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspace),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!workspace) {
    return <div className="p-6 text-slate-400 text-xs">Loading workspace settings...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar max-w-4xl">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Workspace Settings & Compliance
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage organization profile, physical compliance addresses, unsubscribe footers, and security safeguards.
          </p>
        </div>

        {saveSuccess && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg animate-fade-in font-medium">
            <Check className="h-4 w-4" /> Settings Saved
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Workspace Profile */}
        <div className="surface-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building className="h-4 w-4 text-blue-400" />
            Organization & Workspace Details
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Workspace Display Name</label>
              <input
                type="text"
                value={workspace.name}
                onChange={(e) => setWorkspace({ ...workspace, name: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Legal Company Name</label>
              <input
                type="text"
                value={workspace.companyName}
                onChange={(e) => setWorkspace({ ...workspace, companyName: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Owner Email Address</label>
              <input
                type="email"
                disabled
                value={workspace.ownerEmail}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-800 px-3 py-2 text-slate-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Workspace Timezone</label>
              <select
                value={workspace.timezone}
                onChange={(e) => setWorkspace({ ...workspace, timezone: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              >
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Berlin">Berlin / Paris (CET)</option>
              </select>
            </div>
          </div>
        </div>

        {/* CAN-SPAM & GDPR MANDATORY COMPLIANCE */}
        <div className="surface-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            Mandatory Deliverability & Anti-Spam Compliance Settings
          </h3>
          <p className="text-slate-400 text-xs">
            International cold email regulations (CAN-SPAM Act, CASL, and GDPR) mandate an accurate physical business mailing address and an accessible opt-out mechanism in every outbound communication.
          </p>

          <div>
            <label className="block text-slate-400 mb-1">
              Physical Business Mailing Address *
            </label>
            <input
              type="text"
              required
              value={workspace.physicalAddress}
              onChange={(e) => setWorkspace({ ...workspace, physicalAddress: e.target.value })}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Default Unsubscribe Footer Copy</label>
            <textarea
              rows={2}
              value={workspace.unsubscribeFooter}
              onChange={(e) => setWorkspace({ ...workspace, unsubscribeFooter: e.target.value })}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-100 text-xs focus:outline-none focus:border-blue-500/60"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Compliance Safeguard Mode</label>
            <select
              value={workspace.complianceMode}
              onChange={(e) => setWorkspace({ ...workspace, complianceMode: e.target.value as any })}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500/60"
            >
              <option value="strict">Strict (Immediate 1-click global suppression + audit trail)</option>
              <option value="canspam">CAN-SPAM Standard (US compliance)</option>
              <option value="gdpr">GDPR B2B (Legitimate Interest + Right to erasure)</option>
            </select>
          </div>
        </div>

        {/* Team Members & Roles */}
        <div className="surface-card rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            Team Members & Role-Based Access
          </h3>

          <div className="rounded-lg bg-slate-800/40 border border-slate-700/60 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-200 font-bold text-xs">
                AK
              </div>
              <div>
                <span className="font-semibold text-white block">Azeem Khawer</span>
                <span className="text-[11px] text-slate-400 font-mono">azeemkhawer4@gmail.com</span>
              </div>
            </div>
            <span className="rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase">
              Primary Owner
            </span>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
