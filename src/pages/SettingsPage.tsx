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
  Database,
  RotateCw,
  HardDrive,
  Lock,
  LogOut,
  RefreshCw,
  Archive,
  CheckCircle2,
} from 'lucide-react';
import { WorkspaceSettings } from '../types';

interface BackupItem {
  filename: string;
  filepath: string;
  sizeKb: number;
  createdAt: string;
}

interface SettingsPageProps {
  authStatus?: { isSetup: boolean; authenticated: boolean; user?: any } | null;
  onRequireAuthSetup?: () => void;
  onWorkspaceUpdated?: () => void;
  onSignedOut?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  authStatus,
  onRequireAuthSetup,
  onWorkspaceUpdated,
  onSignedOut,
}) => {
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Backup & SQLite State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<string | null>(null);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [backupToRestore, setBackupToRestore] = useState<string | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchBackups = async () => {
    try {
      const res = await fetch('/api/database/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e) {
      console.error('Failed to load backups:', e);
    }
  };

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('/api/budget/status');
      if (res.ok) {
        const data = await res.json();
        setStorageStats(data.storage);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetch('/api/workspace')
      .then((res) => res.json())
      .then((data) => {
        if (data.workspace) {
          setWorkspace({
            ...data.workspace,
            timezone: data.workspace.timezone || 'America/Chicago',
          });
        }
      })
      .catch((err) => console.error(err));

    fetchBackups();
    fetchStorageStats();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspace),
      });
      if (res.ok) {
        setSaveSuccess(true);
        onWorkspaceUpdated?.();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const res = await fetch('/api/database/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBackupMessage(`Backup successfully created: ${data.backup.filename}`);
        fetchBackups();
        setTimeout(() => setBackupMessage(null), 4000);
      } else {
        setBackupMessage(`Backup error: ${data.error}`);
      }
    } catch (err: any) {
      setBackupMessage(`Backup failed: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCheckIntegrity = async () => {
    setIsCheckingIntegrity(true);
    try {
      const res = await fetch('/api/database/integrity');
      const data = await res.json();
      setIntegrityStatus(data.ok ? 'Integrity Check Passed (Database Healthy)' : `Issue: ${data.message}`);
    } catch (err: any) {
      setIntegrityStatus(`Check failed: ${err.message}`);
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  const confirmRestoreBackup = async () => {
    if (!backupToRestore) return;
    const filename = backupToRestore;
    setBackupToRestore(null);
    try {
      const res = await fetch('/api/database/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        setRestoreFeedback({ ok: true, text: data.message || 'Database restored successfully. Reloading...' });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setRestoreFeedback({ ok: false, text: `Restore failed: ${data.message || 'Unknown error'}` });
      }
    } catch (err: any) {
      setRestoreFeedback({ ok: false, text: `Restore failed: ${err.message}` });
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      if (onSignedOut) {
        onSignedOut();
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!workspace) {
    return <div className="p-6 text-slate-400 text-xs">Loading workspace settings...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Workspace Settings & Local Database
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Organization profile, local SQLite database management, automated backups, and CAN-SPAM compliance footers.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg animate-fade-in font-medium">
              <Check className="h-4 w-4" /> Settings Saved
            </span>
          )}
          {authStatus?.isSetup ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out Local Session
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-[11px] font-mono text-slate-400">
                Local Single-User Mode
              </span>
              {onRequireAuthSetup && (
                <button
                  type="button"
                  onClick={onRequireAuthSetup}
                  className="rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 px-3 py-1.5 text-xs font-medium text-blue-300 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Enable Password Lock
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {restoreFeedback && (
        <div
          className={`p-3 rounded-lg text-xs border ${
            restoreFeedback.ok
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {restoreFeedback.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Workspace Profile */}
        <div className="surface-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building className="h-4 w-4 text-blue-400" />
            Organization & Workspace Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">Primary Owner Email</label>
              <input
                type="email"
                value={workspace.ownerEmail}
                onChange={(e) => setWorkspace({ ...workspace, ownerEmail: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Default Sending Timezone</label>
              <select
                value={workspace.timezone}
                onChange={(e) => setWorkspace({ ...workspace, timezone: e.target.value })}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              >
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="Europe/London">London / GMT</option>
                <option value="Europe/Paris">Central European Time</option>
                <option value="Asia/Tokyo">Tokyo / JST</option>
              </select>
            </div>
          </div>
        </div>

        {/* Local SQLite Database & Backup Management */}
        <div className="surface-card rounded-xl p-5 space-y-4 border border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                Local SQLite Database & Automated Backup System
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                OutboundOS operates locally with zero cloud dependencies. All data persists locally in ACID WAL SQLite.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCheckIntegrity}
                disabled={isCheckingIntegrity}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isCheckingIntegrity ? 'animate-spin' : ''}`} />
                Integrity Check
              </button>

              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1.5 text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Archive className="h-3.5 w-3.5" />
                {isBackingUp ? 'Backing Up...' : 'Create SQLite Backup'}
              </button>
            </div>
          </div>

          {backupMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{backupMessage}</span>
            </div>
          )}

          {integrityStatus && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400 shrink-0" />
              <span>{integrityStatus}</span>
            </div>
          )}

          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Database Driver:</span>
              <span className="text-emerald-400 font-bold">better-sqlite3 (WAL Mode & Foreign Keys ON)</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Storage Path:</span>
              <span className="text-slate-200 truncate max-w-md">{storageStats?.path || 'data/outboundos.sqlite'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Secret Encryption Key:</span>
              <span className="text-purple-400">AES-256-GCM (stored in data/.secret_key)</span>
            </div>
          </div>

          {/* Existing Backups Table */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Archive className="h-3.5 w-3.5 text-slate-400" />
              Available Database Backups ({backups.length})
            </h4>

            <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/80">
                    <th className="py-2 px-3 font-medium">Backup Filename</th>
                    <th className="py-2 px-3 font-medium">Created Date</th>
                    <th className="py-2 px-3 font-medium">Size</th>
                    <th className="py-2 px-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {backups.map((b) => (
                    <tr key={b.filename} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 text-slate-200 font-bold">{b.filename}</td>
                      <td className="py-2 px-3 text-slate-400">{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="py-2 px-3 text-emerald-400">{b.sizeKb} KB</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setBackupToRestore(b.filename)}
                          className="text-blue-400 hover:text-blue-300 text-xs font-semibold cursor-pointer underline"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 text-xs font-sans">
                        No manual backups created yet. Click "Create SQLite Backup" above to generate a safe snapshot.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CAN-SPAM & Physical Compliance */}
        <div className="surface-card rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            CAN-SPAM & Legal Compliance Safeguards
          </h3>

          <div>
            <label className="block text-slate-400 mb-1">Physical Business Street Address (Mandatory for CAN-SPAM)</label>
            <input
              type="text"
              value={workspace.physicalAddress}
              onChange={(e) => setWorkspace({ ...workspace, physicalAddress: e.target.value })}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
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

      {/* Restore Confirmation Modal */}
      {backupToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Restore SQLite Backup?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to restore from <span className="font-mono text-amber-300">{backupToRestore}</span>? The active database will be replaced with this snapshot.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBackupToRestore(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRestoreBackup}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
              >
                Restore Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
