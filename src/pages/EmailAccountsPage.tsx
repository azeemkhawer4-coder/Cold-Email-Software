import React, { useState } from 'react';
import {
  Mail,
  Plus,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Flame,
  ShieldCheck,
  Trash2,
  Settings2,
  ExternalLink,
  X,
  Server,
  Key,
  FlaskConical,
  Inbox,
  ArrowDownLeft,
} from 'lucide-react';
import { MailboxAccount } from '../types';

interface EmailAccountsPageProps {
  mailboxes: MailboxAccount[];
  onRefreshMailboxes: () => void;
}

export const EmailAccountsPage: React.FC<EmailAccountsPageProps> = ({
  mailboxes,
  onRefreshMailboxes,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<MailboxAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isProvisioningTest, setIsProvisioningTest] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; message: string; success: boolean } | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; message: string; success: boolean } | null>(null);
  const [mailboxToDelete, setMailboxToDelete] = useState<{ id: string; email: string } | null>(null);

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/mailboxes/${id}/test-connection`, { method: 'POST' });
      const data = await res.json();
      setTestResult({ id, message: data.message, success: data.success });
      onRefreshMailboxes();
    } catch (e: any) {
      setTestResult({ id, message: e.message || 'Connection test failed', success: false });
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncReplies = async (id: string) => {
    setSyncingId(id);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/mailboxes/${id}/sync-replies`, { method: 'POST' });
      const data = await res.json();
      setSyncResult({
        id,
        message: `Synced ${data.syncedCount || 0} inbound reply message(s) from server`,
        success: true,
      });
      onRefreshMailboxes();
    } catch (e: any) {
      setSyncResult({ id, message: e.message || 'Sync failed', success: false });
    } finally {
      setSyncingId(null);
    }
  };

  const handleProvisionTestMailbox = async () => {
    setIsProvisioningTest(true);
    try {
      const res = await fetch('/api/mailboxes/provision-test-mailbox', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onRefreshMailboxes();
        setTestResult({
          id: data.mailbox.id,
          message: `Controlled test mailbox ${data.mailbox.email} provisioned successfully with real SMTP & IMAP credentials!`,
          success: true,
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProvisioningTest(false);
    }
  };

  const handleToggleStatus = async (mb: MailboxAccount) => {
    const nextStatus = mb.status === 'connected' ? 'paused' : 'connected';
    try {
      await fetch(`/api/mailboxes/${mb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      onRefreshMailboxes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMailbox = (id: string, email: string) => {
    setMailboxToDelete({ id, email });
  };

  const confirmDeleteMailbox = async () => {
    if (!mailboxToDelete) return;
    try {
      await fetch(`/api/mailboxes/${mailboxToDelete.id}`, { method: 'DELETE' });
      setMailboxToDelete(null);
      onRefreshMailboxes();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Sending Email Accounts & Mailbox Rotation
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-blue-400 tabular-nums">
              {mailboxes.length} Connected
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real email dispatch via Gmail API, Microsoft Graph, or custom SMTP/IMAP with load-balanced rotation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* 1-Click Controlled Test Mailbox Button */}
          <button
            onClick={handleProvisionTestMailbox}
            disabled={isProvisioningTest}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-950/60 border border-indigo-700/60 px-3.5 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-900/40 hover:text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
            title="Automatically generates a live, real SMTP & IMAP test mailbox on ethereal.email"
          >
            {isProvisioningTest ? (
              <RotateCw className="h-4 w-4 animate-spin text-indigo-400" />
            ) : (
              <FlaskConical className="h-4 w-4 text-indigo-400" />
            )}
            <span>{isProvisioningTest ? 'Provisioning Mailbox...' : 'Provision Test Mailbox (Ethereal)'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs ring-1 ring-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Connect Email Account</span>
          </button>
        </div>
      </div>

      {/* Rotation Status Banner */}
      <div className="surface-card rounded-xl p-4 flex items-center justify-between text-xs text-blue-200">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0" />
          <div>
            <span className="font-semibold text-white block">Multi-Mailbox Sender Balancing Active</span>
            <span className="text-slate-400">
              Outbound sequences rotate dynamically across eligible inboxes to protect domain reputation and prevent rate limiting.
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400 block font-mono">Total Safe Capacity</span>
          <span className="text-base font-bold text-white font-mono tabular-nums">
            {mailboxes.reduce((acc, m) => acc + m.dailyLimit, 0)} emails/day
          </span>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mailboxes.map((mb) => {
          const usedPct = Math.round((mb.sentToday / mb.dailyLimit) * 100);
          const isTestingThis = testingId === mb.id;
          const isSyncingThis = syncingId === mb.id;
          const isResultForThis = testResult?.id === mb.id;
          const isSyncResultForThis = syncResult?.id === mb.id;

          return (
            <div
              key={mb.id}
              className="surface-card surface-card-hover rounded-xl p-5 flex flex-col justify-between transition-all duration-150"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                      {mb.isTestMailbox ? (
                        <FlaskConical className="h-4.5 w-4.5 text-indigo-400" />
                      ) : (
                        <Mail className="h-4.5 w-4.5" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-semibold text-white truncate">{mb.name}</h3>
                        {mb.isTestMailbox && (
                          <span className="rounded bg-indigo-950/80 border border-indigo-700/60 px-1.5 py-0.2 text-[9px] font-mono text-indigo-300">
                            TEST RIG
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono truncate block">{mb.email}</span>
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider ${
                      mb.status === 'connected'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : mb.status === 'error'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {mb.status}
                  </span>
                </div>

                {/* Provider Protocol Badge */}
                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Server className="h-3 w-3 text-slate-500" />
                    {mb.provider === 'gmail' && 'Gmail API (OAuth 2.0)'}
                    {mb.provider === 'outlook' && 'MS Graph API (OAuth 2.0)'}
                    {mb.provider === 'smtp' && `SMTP: ${mb.smtpHost || 'Standard'}:${mb.smtpPort || 587}`}
                  </span>
                  {mb.previewUrl && (
                    <a
                      href={mb.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      <span>Web Inbox</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Quota Progress */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="text-slate-400">Daily Quota Usage:</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {mb.sentToday} / {mb.dailyLimit} ({usedPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, usedPct)}%` }}
                    />
                  </div>
                </div>

                {/* Health & Warmup Badges */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-2 text-center">
                    <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1 font-mono">
                      <Flame className="h-3 w-3 text-amber-400" /> Warmup Score
                    </span>
                    <span className="font-bold text-amber-300 text-sm font-mono tabular-nums">{mb.warmupScore}%</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 border border-slate-800 p-2 text-center">
                    <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1 font-mono">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" /> Health Rating
                    </span>
                    <span className="font-bold text-emerald-300 text-sm font-mono tabular-nums">{mb.healthScore}%</span>
                  </div>
                </div>

                {/* Provider Error Message */}
                {mb.lastError && (
                  <div className="mt-2.5 p-2 rounded-lg text-[10.5px] font-mono leading-tight bg-rose-950/40 text-rose-300 border border-rose-800/60 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-400" />
                    <span className="break-all">{mb.lastError}</span>
                  </div>
                )}

                {/* Connection Test Result */}
                {isResultForThis && (
                  <div
                    className={`mt-2.5 p-2 rounded-lg text-[11px] font-mono leading-tight ${
                      testResult.success
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}

                {/* Sync Result */}
                {isSyncResultForThis && (
                  <div
                    className={`mt-2.5 p-2 rounded-lg text-[11px] font-mono leading-tight ${
                      syncResult.success
                        ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {syncResult.message}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(mb.id)}
                    disabled={isTestingThis}
                    className="flex items-center gap-1 text-slate-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
                    title="Run live socket/OAuth authentication check against email server"
                  >
                    <RotateCw className={`h-3 w-3 ${isTestingThis ? 'animate-spin text-blue-400' : ''}`} />
                    <span>{isTestingThis ? 'Verifying...' : 'Test Handshake'}</span>
                  </button>

                  <button
                    onClick={() => handleSyncReplies(mb.id)}
                    disabled={isSyncingThis}
                    className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition disabled:opacity-50 cursor-pointer"
                    title="Poll connected inbox for replies to pause follow-up sequences"
                  >
                    <ArrowDownLeft className={`h-3 w-3 ${isSyncingThis ? 'animate-spin text-cyan-400' : ''}`} />
                    <span>{isSyncingThis ? 'Syncing...' : 'Sync Replies'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(mb)}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {mb.status === 'connected' ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    onClick={() => setEditingMailbox(mb)}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                    title="Edit mailbox credentials and quota"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteMailbox(mb.id, mb.email)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                    title="Delete mailbox account"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CONNECT ACCOUNT MODAL */}
      {showAddModal && (
        <ConnectAccountModal
          onClose={() => setShowAddModal(false)}
          onConnected={() => {
            setShowAddModal(false);
            onRefreshMailboxes();
          }}
        />
      )}

      {/* EDIT SETTINGS MODAL */}
      {editingMailbox && (
        <EditAccountModal
          mailbox={editingMailbox}
          onClose={() => setEditingMailbox(null)}
          onSaved={() => {
            setEditingMailbox(null);
            onRefreshMailboxes();
          }}
        />
      )}

      {/* DELETE MAILBOX CONFIRMATION MODAL */}
      {mailboxToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-white">Disconnect & Delete Mailbox?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete mailbox <span className="font-semibold text-rose-400">{mailboxToDelete.email}</span>? Any campaigns using this sender account will automatically rotate to remaining active mailboxes.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMailboxToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMailbox}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
              >
                Delete Mailbox
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// CONNECT ACCOUNT MODAL
const ConnectAccountModal: React.FC<{ onClose: () => void; onConnected: () => void }> = ({
  onClose,
  onConnected,
}) => {
  const [provider, setProvider] = useState<'gmail' | 'outlook' | 'smtp'>('smtp');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [dailyLimit, setDailyLimit] = useState(40);
  const [smtpHost, setSmtpHost] = useState('smtp.mailgun.org');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [oauthToken, setOauthToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/mailboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          email,
          name: name || email.split('@')[0],
          dailyLimit,
          smtpHost: provider === 'smtp' ? smtpHost : undefined,
          smtpPort: provider === 'smtp' ? smtpPort : undefined,
          smtpUser: provider === 'smtp' ? (smtpUser || email) : undefined,
          smtpPass: provider === 'smtp' ? smtpPass : undefined,
          imapHost: provider === 'smtp' ? (imapHost || smtpHost) : undefined,
          imapPort: provider === 'smtp' ? imapPort : undefined,
          imapUser: provider === 'smtp' ? (smtpUser || email) : undefined,
          imapPass: provider === 'smtp' ? smtpPass : undefined,
          oauth: oauthToken ? { accessToken: oauthToken } : undefined,
        }),
      });
      onConnected();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#080d19] border border-slate-800 p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Connect Email Sending Mailbox</h3>
            <p className="text-[11px] text-slate-400">Configure real delivery credentials with zero mock simulation</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { id: 'smtp', label: 'SMTP / IMAP Relay' },
            { id: 'gmail', label: 'Google Workspace' },
            { id: 'outlook', label: 'Microsoft 365' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id as any)}
              className={`rounded-lg py-2 px-2.5 text-xs font-medium border text-center transition cursor-pointer ${
                provider === p.id
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Sender Email Address *</label>
            <input
              type="email"
              required
              placeholder="azeem@apexoutbound.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Display Name</label>
              <input
                type="text"
                placeholder="Azeem Khawer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Daily Sending Limit</label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 40)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {provider === 'smtp' && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <span className="text-[11px] font-semibold text-white block">Real SMTP & IMAP Server Settings</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">SMTP Username</label>
                  <input
                    type="text"
                    placeholder="postmaster@domain.com"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">SMTP Password</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60">
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-1">IMAP Host (Reply Sync)</label>
                  <input
                    type="text"
                    placeholder="imap.domain.com"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">IMAP Port</label>
                  <input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2.5 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          )}

          {(provider === 'gmail' || provider === 'outlook') && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-blue-400" />
                OAuth 2.0 Access Token
              </label>
              <textarea
                rows={2}
                placeholder="ya29.a0AfH6SMC... or eyJ0eXAiOiJKV1QiLC..."
                value={oauthToken}
                onChange={(e) => setOauthToken(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-slate-100 font-mono text-[10.5px]"
              />
              <span className="text-[10px] text-slate-500 block">
                Tokens are stored securely in local database and refreshed automatically before dispatch.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
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
              className="rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-1.5 font-medium text-white hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? 'Configuring...' : 'Connect Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// EDIT ACCOUNT MODAL
const EditAccountModal: React.FC<{ mailbox: MailboxAccount; onClose: () => void; onSaved: () => void }> = ({
  mailbox,
  onClose,
  onSaved,
}) => {
  const [dailyLimit, setDailyLimit] = useState(mailbox.dailyLimit);
  const [signature, setSignature] = useState(mailbox.signature);
  const [smtpHost, setSmtpHost] = useState(mailbox.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(mailbox.smtpPort || 587);
  const [smtpUser, setSmtpUser] = useState(mailbox.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState(mailbox.smtpPass || '');
  const [imapHost, setImapHost] = useState(mailbox.imapHost || '');
  const [imapPort, setImapPort] = useState(mailbox.imapPort || 993);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await fetch(`/api/mailboxes/${mailbox.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimit,
          signature,
          smtpHost: mailbox.provider === 'smtp' ? smtpHost : undefined,
          smtpPort: mailbox.provider === 'smtp' ? smtpPort : undefined,
          smtpUser: mailbox.provider === 'smtp' ? smtpUser : undefined,
          smtpPass: mailbox.provider === 'smtp' ? smtpPass : undefined,
          imapHost: mailbox.provider === 'smtp' ? imapHost : undefined,
          imapPort: mailbox.provider === 'smtp' ? imapPort : undefined,
        }),
      });
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#080d19] border border-slate-800 p-6 shadow-2xl text-slate-200 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Mailbox Settings</h3>
            <span className="font-mono text-slate-400 text-[11px]">{mailbox.email}</span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-slate-300 mb-1 font-medium">Daily Send Quota</label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value) || 40)}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono"
            />
          </div>

          {mailbox.provider === 'smtp' && (
            <div className="space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="font-semibold text-white text-[11px] block">SMTP & IMAP Credentials</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 text-[10px]">Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px]">Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px]">Username</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px]">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="w-full rounded bg-slate-900 border border-slate-800 px-2 py-1 text-slate-100 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Email Signature</label>
            <textarea
              rows={3}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-100 font-mono text-[11px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
