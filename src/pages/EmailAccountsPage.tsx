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
  ArrowDownLeft,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { MailboxAccount } from '../types';
import { isProductionMailboxConnected } from '../utils/analyticsStats';
import { OAuthFeedback } from '../utils/oauthHash';

interface EmailAccountsPageProps {
  mailboxes: MailboxAccount[];
  onRefreshMailboxes: () => void;
  oauthFeedback?: OAuthFeedback | null;
  onClearOAuthFeedback?: () => void;
}

interface GoogleOAuthStatusInfo {
  configured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  redirectUri: string;
  origin: string;
}

export const EmailAccountsPage: React.FC<EmailAccountsPageProps> = ({
  mailboxes,
  onRefreshMailboxes,
  oauthFeedback,
  onClearOAuthFeedback,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<MailboxAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isProvisioningTest, setIsProvisioningTest] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; message: string; success: boolean } | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; message: string; success: boolean } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [mailboxToDelete, setMailboxToDelete] = useState<{ id: string; email: string } | null>(null);
  const [checkingOAuthTarget, setCheckingOAuthTarget] = useState<string | null>(null);
  const [googleOAuthSetupModal, setGoogleOAuthSetupModal] = useState<
    (GoogleOAuthStatusInfo & { targetMailbox?: MailboxAccount }) | null
  >(null);
  const [appPasswordTarget, setAppPasswordTarget] = useState<MailboxAccount | null>(null);
  const [connectDefaults, setConnectDefaults] = useState<{
    provider?: 'gmail' | 'outlook' | 'smtp';
    email?: string;
    name?: string;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
  } | null>(null);

  const connectedProdMailboxes = mailboxes.filter(isProductionMailboxConnected);
  const reauthMailboxes = mailboxes.filter(
    (m) => m.status === 'reauth_required' || m.status === 'error'
  );
  const safeDailyCapacity = connectedProdMailboxes.reduce(
    (acc, m) => acc + (m.dailyLimit || 0),
    0
  );

  const handleConnectGoogleOAuth = async (targetMailbox?: MailboxAccount) => {
    const trackingKey = targetMailbox ? targetMailbox.id : 'global';
    setCheckingOAuthTarget(trackingKey);
    setPageError(null);
    try {
      const res = await fetch('/api/auth/google/status');
      const statusData: GoogleOAuthStatusInfo = await res.json();
      if (res.ok && statusData.configured) {
        const query = targetMailbox?.email ? `?email=${encodeURIComponent(targetMailbox.email)}` : '';
        window.location.href = `/api/auth/google${query}`;
        return;
      }
      setShowAddModal(false);
      setGoogleOAuthSetupModal({
        ...statusData,
        targetMailbox,
      });
    } catch (err: any) {
      setPageError(err?.message || 'Could not check Google OAuth configuration status.');
    } finally {
      setCheckingOAuthTarget(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    setPageError(null);
    try {
      const res = await fetch(`/api/mailboxes/${id}/test-connection`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      const isOk = res.ok && Boolean(data.success);
      const msg =
        data.message ||
        data.error ||
        (res.ok ? 'Connection check finished' : `HTTP ${res.status} verification failed`);
      setTestResult({ id, message: msg, success: isOk });
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
    setPageError(null);
    try {
      const res = await fetch(`/api/mailboxes/${id}/sync-replies`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setSyncResult({
          id,
          message: data.message || data.error || `Sync failed (HTTP ${res.status})`,
          success: false,
        });
      } else {
        setSyncResult({
          id,
          message: `Synced ${data.syncedCount || 0} inbound reply message(s) from server`,
          success: true,
        });
      }
      onRefreshMailboxes();
    } catch (e: any) {
      setSyncResult({ id, message: e.message || 'Sync failed', success: false });
    } finally {
      setSyncingId(null);
    }
  };

  const handleProvisionTestMailbox = async () => {
    setIsProvisioningTest(true);
    setPageError(null);
    try {
      const res = await fetch('/api/mailboxes/provision-test-mailbox', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        onRefreshMailboxes();
        setTestResult({
          id: data.mailbox.id,
          message: `Controlled test mailbox ${data.mailbox.email} provisioned successfully with real SMTP & IMAP credentials!`,
          success: true,
        });
      } else {
        setPageError(data.error || data.message || 'Failed to provision test mailbox');
      }
    } catch (err: any) {
      setPageError(err.message || 'Failed to provision test mailbox');
    } finally {
      setIsProvisioningTest(false);
    }
  };

  const handleToggleStatus = async (mb: MailboxAccount) => {
    setPageError(null);
    if (mb.status === 'reauth_required') {
      await handleTestConnection(mb.id);
      return;
    }
    const nextStatus = mb.status === 'connected' ? 'paused' : 'connected';
    try {
      const res = await fetch(`/api/mailboxes/${mb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPageError(err.error || 'Failed to update mailbox status');
      }
      onRefreshMailboxes();
    } catch (e: any) {
      setPageError(e.message || 'Failed to update mailbox status');
    }
  };

  const handleDeleteMailbox = (id: string, email: string) => {
    setMailboxToDelete({ id, email });
  };

  const confirmDeleteMailbox = async () => {
    if (!mailboxToDelete) return;
    setPageError(null);
    try {
      const res = await fetch(`/api/mailboxes/${mailboxToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPageError(err.error || 'Failed to delete mailbox');
      }
      setMailboxToDelete(null);
      onRefreshMailboxes();
    } catch (e: any) {
      setPageError(e.message || 'Failed to delete mailbox');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap">
            Sending Email Accounts & Mailbox Rotation
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-blue-400 tabular-nums">
              {connectedProdMailboxes.length} Connected · {mailboxes.length} Total
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

      {/* OAuth Redirect Feedback Banner */}
      {oauthFeedback && (
        <div
          className={`rounded-xl p-3.5 text-xs flex items-center justify-between gap-3 border ${
            oauthFeedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
              : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {oauthFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{oauthFeedback.message}</span>
          </div>
          {onClearOAuthFeedback && (
            <button
              type="button"
              onClick={onClearOAuthFeedback}
              className="text-slate-300 hover:text-white cursor-pointer"
              aria-label="Dismiss OAuth notice"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Page Error Banner */}
      {pageError && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-700/60 p-3.5 text-xs text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{pageError}</span>
          </div>
          <button onClick={() => setPageError(null)} className="text-rose-300 hover:text-white cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Prominent Top Re-Auth Alert Banner */}
      {reauthMailboxes.length > 0 && (
        <div className="rounded-xl bg-rose-950/40 border border-rose-600/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-rose-200 block">
                {reauthMailboxes.length} Mailbox{reauthMailboxes.length > 1 ? 'es' : ''} Require Re-Authentication
              </span>
              <span className="text-rose-200/80 block">
                Excluded from live rotation and safe capacity:{' '}
                <span className="font-mono text-white">
                  {reauthMailboxes.map((m) => m.email).join(', ')}
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {reauthMailboxes.some((m) => m.provider === 'gmail') && (
              <button
                type="button"
                onClick={() =>
                  handleConnectGoogleOAuth(reauthMailboxes.find((m) => m.provider === 'gmail'))
                }
                disabled={checkingOAuthTarget !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-60"
              >
                <Key className="h-3.5 w-3.5" />
                {checkingOAuthTarget ? 'Checking OAuth...' : 'Reconnect Google OAuth'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rotation Status Banner */}
      <div className="surface-card rounded-xl p-4 flex items-center justify-between text-xs text-blue-200">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-400 shrink-0" />
          <div>
            <span className="font-semibold text-white block">
              {connectedProdMailboxes.length > 0
                ? 'Multi-Mailbox Sender Balancing Active'
                : 'No Production Mailboxes Connected'}
            </span>
            <span className="text-slate-400">
              {connectedProdMailboxes.length > 0
                ? 'Outbound sequences rotate dynamically across connected production inboxes to protect domain reputation.'
                : 'Paused, disconnected, re-auth required, and Ethereal sandbox mailboxes are excluded from production sending capacity.'}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[11px] text-slate-400 block font-mono">Total Safe Capacity</span>
          <span className="text-base font-bold text-white font-mono tabular-nums">
            {safeDailyCapacity} emails/day
          </span>
          <span className="text-[10px] text-slate-500 block font-mono">
            Across {connectedProdMailboxes.length} connected production account(s)
          </span>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mailboxes.map((mb) => {
          const usedPct = mb.dailyLimit > 0 ? Math.round((mb.sentToday / mb.dailyLimit) * 100) : 0;
          const isTestingThis = testingId === mb.id;
          const isSyncingThis = syncingId === mb.id;
          const isResultForThis = testResult?.id === mb.id;
          const isSyncResultForThis = syncResult?.id === mb.id;
          const isOAuth = mb.provider === 'gmail' || mb.provider === 'outlook';

          return (
            <div
              key={mb.id}
              className="surface-card surface-card-hover rounded-xl p-5 flex flex-col justify-between transition-all duration-150"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
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
                          <span className="rounded bg-indigo-950/80 border border-indigo-700/60 px-1.5 py-0.2 text-[9px] font-mono text-indigo-300 shrink-0">
                            TEST RIG
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono truncate block">{mb.email}</span>
                    </div>
                  </div>
                  {(() => {
                    const getBadge = (status: string) => {
                      switch (status) {
                        case 'connected':
                          return { text: 'CONNECTED', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
                        case 'sync_completed':
                          return { text: 'CONNECTED', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
                        case 'synchronizing':
                          return { text: 'SYNCHRONIZING', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 animate-pulse' };
                        case 'reauth_required':
                          return { text: 'RE-AUTH REQUIRED', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold' };
                        case 'temporary_error':
                          return { text: 'TEMP ERROR', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
                        case 'disconnected':
                          return { text: 'DISCONNECTED', cls: 'bg-slate-700/30 text-slate-400 border-slate-700/50' };
                        case 'paused':
                          return { text: 'PAUSED', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
                        default:
                          return { text: (status || 'ERROR').toUpperCase(), cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
                      }
                    };
                    const badge = getBadge(mb.status);
                    return (
                      <span className={`rounded px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider border shrink-0 ${badge.cls}`}>
                        {badge.text}
                      </span>
                    );
                  })()}
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

                {/* OAuth Token Refresh Telemetry */}
                {isOAuth && (
                  <div className="mt-2 rounded-lg bg-slate-900/70 border border-slate-800/80 px-2.5 py-1.5 text-[10.5px] font-mono flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-slate-400">
                      <RefreshCw className="h-3 w-3 text-slate-500" />
                      Token Refresh:
                    </span>
                    <span
                      className={
                        mb.lastTokenRefreshStatus === 'ok'
                          ? 'text-emerald-400'
                          : mb.lastTokenRefreshStatus === 'error'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }
                      title={mb.lastTokenRefreshError || undefined}
                    >
                      {mb.lastTokenRefreshStatus === 'ok'
                        ? mb.lastTokenRefreshAt
                          ? `OK (${new Date(mb.lastTokenRefreshAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                          : 'OK'
                        : mb.lastTokenRefreshStatus === 'error'
                        ? 'Failed (Re-auth needed)'
                        : mb.lastTokenRefreshAt
                        ? new Date(mb.lastTokenRefreshAt).toLocaleDateString()
                        : 'Not refreshed yet'}
                    </span>
                  </div>
                )}

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

                {/* Re-auth Required Banner */}
                {mb.status === 'reauth_required' && (
                  <div className="mt-2.5 p-2.5 rounded-lg text-xs bg-rose-950/50 text-rose-200 border border-rose-700/60 space-y-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                      <div>
                        <p className="font-semibold text-rose-300">Re-authentication Required</p>
                        <p className="text-[11px] text-rose-200/80 leading-snug">
                          {mb.lastError ||
                            'OAuth access token expired or refresh token was revoked. Re-authenticate to resume sending.'}
                        </p>
                      </div>
                    </div>
                    {mb.provider === 'gmail' && (
                      <button
                        type="button"
                        onClick={() => handleConnectGoogleOAuth(mb)}
                        disabled={checkingOAuthTarget === mb.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition shadow-xs cursor-pointer disabled:opacity-60"
                      >
                        <Key className="h-3 w-3" />
                        <span>
                          {checkingOAuthTarget === mb.id ? 'Checking OAuth...' : 'Reconnect Google Account'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Provider Error Message */}
                {mb.lastError && mb.status !== 'reauth_required' && (
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
                    {mb.status === 'connected' ? 'Pause' : mb.status === 'reauth_required' ? 'Verify' : 'Resume'}
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
          initialDefaults={connectDefaults || undefined}
          onConnectGoogleOAuth={() => handleConnectGoogleOAuth()}
          isCheckingGoogleOAuth={checkingOAuthTarget === 'global'}
          onClose={() => {
            setShowAddModal(false);
            setConnectDefaults(null);
          }}
          onConnected={() => {
            setShowAddModal(false);
            setConnectDefaults(null);
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

      {/* IN-APP GOOGLE OAUTH SETUP & RECOVERY MODAL */}
      {googleOAuthSetupModal && (
        <GoogleOAuthSetupModal
          info={googleOAuthSetupModal}
          isRetrying={checkingOAuthTarget !== null}
          onRetry={() => handleConnectGoogleOAuth(googleOAuthSetupModal.targetMailbox)}
          onUseAppPassword={() => {
            const target = googleOAuthSetupModal.targetMailbox;
            setGoogleOAuthSetupModal(null);
            if (target) {
              setAppPasswordTarget(target);
            } else {
              setConnectDefaults({
                provider: 'smtp',
                smtpHost: 'smtp.gmail.com',
                smtpPort: 587,
                imapHost: 'imap.gmail.com',
                imapPort: 993,
              });
              setShowAddModal(true);
            }
          }}
          onClose={() => setGoogleOAuthSetupModal(null)}
        />
      )}

      {/* GMAIL APP PASSWORD RECONNECT MODAL */}
      {appPasswordTarget && (
        <GmailAppPasswordModal
          mailbox={appPasswordTarget}
          onClose={() => setAppPasswordTarget(null)}
          onConnected={() => {
            setAppPasswordTarget(null);
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
const ConnectAccountModal: React.FC<{
  initialDefaults?: {
    provider?: 'gmail' | 'outlook' | 'smtp';
    email?: string;
    name?: string;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
  };
  onConnectGoogleOAuth: () => void;
  isCheckingGoogleOAuth: boolean;
  onClose: () => void;
  onConnected: () => void;
}> = ({ initialDefaults, onConnectGoogleOAuth, isCheckingGoogleOAuth, onClose, onConnected }) => {
  const [provider, setProvider] = useState<'gmail' | 'outlook' | 'smtp'>(initialDefaults?.provider || 'smtp');
  const [email, setEmail] = useState(initialDefaults?.email || '');
  const [name, setName] = useState(initialDefaults?.name || '');
  const [dailyLimit, setDailyLimit] = useState(40);
  const [smtpHost, setSmtpHost] = useState(initialDefaults?.smtpHost || 'smtp.mailgun.org');
  const [smtpPort, setSmtpPort] = useState(initialDefaults?.smtpPort || 587);
  const [smtpUser, setSmtpUser] = useState(initialDefaults?.email || '');
  const [smtpPass, setSmtpPass] = useState('');
  const [imapHost, setImapHost] = useState(initialDefaults?.imapHost || '');
  const [imapPort, setImapPort] = useState(initialDefaults?.imapPort || 993);
  const [oauthToken, setOauthToken] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/mailboxes', {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `Failed to connect mailbox (HTTP ${res.status})`);
        return;
      }
      onConnected();
    } catch (e: any) {
      setErrorMsg(e.message || 'Network error');
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

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

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
              placeholder="sender@company.com"
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
                placeholder="Sender Name"
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

          {provider === 'gmail' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Google Workspace Direct OAuth 2.0</span>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono text-emerald-400">
                    RECOMMENDED
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Authorize OutboundOS with your Google account in 1 click. Generates offline refresh tokens saved in local SQLite.
                </p>
                <button
                  type="button"
                  onClick={onConnectGoogleOAuth}
                  disabled={isCheckingGoogleOAuth}
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>{isCheckingGoogleOAuth ? 'Checking Google OAuth...' : 'Authorize with Google OAuth'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-blue-400" />
                  Or Enter Access / Refresh Token Manually
                </label>
                <textarea
                  rows={2}
                  placeholder="ya29.a0AfH6SMC... (Optional if using 1-click button above)"
                  value={oauthToken}
                  onChange={(e) => setOauthToken(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 p-2 text-slate-100 font-mono text-[10.5px]"
                />
              </div>
            </div>
          )}

          {provider === 'outlook' && (
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-blue-400" />
                Microsoft Graph OAuth 2.0 Access Token
              </label>
              <textarea
                rows={2}
                placeholder="eyJ0eXAiOiJKV1QiLC..."
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

// IN-APP GOOGLE OAUTH SETUP & RECOVERY MODAL
const GoogleOAuthSetupModal: React.FC<{
  info: GoogleOAuthStatusInfo & { targetMailbox?: MailboxAccount };
  isRetrying: boolean;
  onRetry: () => void;
  onUseAppPassword: () => void;
  onClose: () => void;
}> = ({ info, isRetrying, onRetry, onUseAppPassword, onClose }) => {
  const [copiedField, setCopiedField] = useState<'redirect' | 'origin' | null>(null);

  const copyValue = (text: string, field: 'redirect' | 'origin') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#080d19] border border-slate-800 p-6 shadow-2xl text-slate-200 text-xs space-y-4">
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="h-4 w-4 text-blue-400" />
              Google OAuth Credentials Required
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {info.targetMailbox
                ? `Cannot launch direct OAuth for ${info.targetMailbox.email} until your local .env has Google Cloud OAuth credentials.`
                : 'Cannot launch direct OAuth until your local .env has Google Cloud OAuth credentials.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Google OAuth notice"
            className="rounded p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-3.5 space-y-2">
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-400">GOOGLE_CLIENT_ID in .env:</span>
            <span className={info.hasClientId ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {info.hasClientId ? 'Configured' : 'Missing'}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-slate-400">GOOGLE_CLIENT_SECRET in .env:</span>
            <span className={info.hasClientSecret ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {info.hasClientSecret ? 'Configured' : 'Missing'}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-[11px] text-slate-300 leading-relaxed">
            To enable 1-click Google OAuth on <span className="font-mono text-white">localhost:3000</span>:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
            <li>
              In Google Cloud Console (OAuth 2.0 Web Client), allow these exact URLs:
            </li>
          </ol>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block">Authorized Redirect URI</span>
                <span className="font-mono text-[11px] text-blue-300 break-all">{info.redirectUri}</span>
              </div>
              <button
                type="button"
                onClick={() => copyValue(info.redirectUri, 'redirect')}
                className="shrink-0 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {copiedField === 'redirect' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedField === 'redirect' ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block">Authorized JavaScript Origin</span>
                <span className="font-mono text-[11px] text-blue-300 break-all">{info.origin}</span>
              </div>
              <button
                type="button"
                onClick={() => copyValue(info.origin, 'origin')}
                className="shrink-0 rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {copiedField === 'origin' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedField === 'origin' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            2. Create or update <span className="font-mono text-slate-200">.env</span> in your project folder (copied from <span className="font-mono text-slate-200">.env.example</span>) with <span className="font-mono text-slate-200">GOOGLE_CLIENT_ID</span>, <span className="font-mono text-slate-200">GOOGLE_CLIENT_SECRET</span>, and <span className="font-mono text-slate-200">GOOGLE_REDIRECT_URI</span>, then restart the app server.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={onUseAppPassword}
            className="rounded-lg bg-indigo-950/70 hover:bg-indigo-900/60 border border-indigo-700/60 px-3 py-1.5 text-[11px] font-medium text-indigo-200 transition cursor-pointer"
          >
            Use Gmail App Password (SMTP/IMAP) Instead
          </button>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 font-semibold text-white transition cursor-pointer disabled:opacity-60"
            >
              {isRetrying ? 'Checking...' : 'Retry Google OAuth'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// RECONNECT EXISTING GMAIL MAILBOX VIA GOOGLE APP PASSWORD (SMTP/IMAP)
const GmailAppPasswordModal: React.FC<{
  mailbox: MailboxAccount;
  onClose: () => void;
  onConnected: () => void;
}> = ({ mailbox, onClose, onConnected }) => {
  const [appPassword, setAppPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appPassword.trim()) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const updateRes = await fetch(`/api/mailboxes/${mailbox.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'smtp',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: mailbox.email,
          smtpPass: appPassword.trim(),
          smtpSecure: false,
          imapHost: 'imap.gmail.com',
          imapPort: 993,
          imapUser: mailbox.email,
          imapPass: appPassword.trim(),
          imapSecure: true,
          status: 'connected',
        }),
      });
      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        setErrorMsg(err.error || 'Failed to update mailbox credentials.');
        return;
      }

      const testRes = await fetch(`/api/mailboxes/${mailbox.id}/test-connection`, {
        method: 'POST',
      });
      const testData = await testRes.json().catch(() => ({}));
      if (!testRes.ok || !testData.success) {
        setErrorMsg(testData.message || 'SMTP verification failed. Check your 16-character Google App Password.');
        return;
      }
      onConnected();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Connection error.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#080d19] border border-slate-800 p-6 shadow-2xl text-slate-200 text-xs space-y-4">
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Reconnect with Gmail App Password</h3>
            <span className="font-mono text-slate-400 text-[11px]">{mailbox.email}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-lg bg-slate-900/70 border border-slate-800 p-3 text-[11px] text-slate-400 space-y-1">
            <div>
              SMTP: <span className="font-mono text-slate-200">smtp.gmail.com:587</span>
            </div>
            <div>
              IMAP: <span className="font-mono text-slate-200">imap.gmail.com:993</span>
            </div>
            <p className="pt-1 text-slate-400">
              Works immediately at $0 without Google Cloud OAuth setup using a 16-character Google App Password.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Google App Password *</label>
            <input
              type="password"
              required
              placeholder="xxxx xxxx xxxx xxxx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
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
              className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-1.5 font-semibold text-white disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Verifying SMTP...' : 'Verify & Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
