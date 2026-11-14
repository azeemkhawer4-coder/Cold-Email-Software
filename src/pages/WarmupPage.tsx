import React from 'react';
import { Flame, CheckCircle2, AlertCircle, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { MailboxAccount } from '../types';
import { isProductionMailboxConnected } from '../utils/analyticsStats';

interface WarmupPageProps {
  mailboxes: MailboxAccount[];
  onRefreshMailboxes: () => void;
  onNavigateToDeliverability?: () => void;
}

export const WarmupPage: React.FC<WarmupPageProps> = ({
  mailboxes,
  onRefreshMailboxes,
  onNavigateToDeliverability,
}) => {
  const handleToggleWarmup = async (mb: MailboxAccount) => {
    const nextStatus = mb.warmupStatus === 'active' ? 'paused' : 'active';
    try {
      await fetch(`/api/mailboxes/${mb.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warmupStatus: nextStatus }),
      });
      onRefreshMailboxes();
    } catch (e) {
      console.error(e);
    }
  };

  const connectedProdMailboxes = mailboxes.filter(isProductionMailboxConnected);
  const activeWarmupProd = connectedProdMailboxes.filter((m) => m.warmupStatus === 'active');

  const avgWarmupScore =
    connectedProdMailboxes.length > 0
      ? Math.round(
          connectedProdMailboxes.reduce((sum, m) => sum + (m.warmupScore || 0), 0) /
            connectedProdMailboxes.length
        )
      : null;

  const avgHealthScore =
    connectedProdMailboxes.length > 0
      ? Math.round(
          connectedProdMailboxes.reduce((sum, m) => sum + (m.healthScore || 0), 0) /
            connectedProdMailboxes.length
        )
      : null;

  const allUnderFiftyQuota =
    connectedProdMailboxes.length > 0 &&
    connectedProdMailboxes.every((m) => (m.dailyLimit || 0) <= 50);

  return (
    <div className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Email Account Warm-Up Engine
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-amber-400">
              {activeWarmupProd.length > 0 ? 'Active Peer Pool' : 'Standby'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gradual automated ramp-up, deliverability health monitoring, and reputation tracking across connected production mailboxes.
          </p>
        </div>
      </div>

      {/* Warm-up Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-card surface-card-hover rounded-xl p-5 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Average Warm-Up Score</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">
            {avgWarmupScore !== null ? `${avgWarmupScore}%` : 'N/A'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {connectedProdMailboxes.length > 0
              ? `Computed across ${connectedProdMailboxes.length} connected production mailbox(es)`
              : 'Connect a production mailbox to compute warmup score'}
          </p>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-5 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Sender Health Rating</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">
            {avgHealthScore !== null ? `${avgHealthScore}%` : 'N/A'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {connectedProdMailboxes.length > 0
              ? 'Average mailbox health score across active senders'
              : 'No connected production senders active'}
          </p>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-5 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Warm-Up Mailboxes</span>
            <ShieldCheck className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">
            {activeWarmupProd.length} of {connectedProdMailboxes.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Excludes disconnected, re-auth required, and Ethereal test rigs ({mailboxes.length} total)
          </p>
        </div>
      </div>

      {/* Account Warm-up Table */}
      <div className="surface-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Mailbox Warm-Up Configuration</h3>
          <span className="text-xs text-slate-400">Real-time mailbox database state</span>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 font-semibold">Mailbox Account</th>
              <th className="py-3 px-4 font-semibold">Connection</th>
              <th className="py-3 px-4 font-semibold">Warm-up Status</th>
              <th className="py-3 px-4 font-semibold">Warmup Score</th>
              <th className="py-3 px-4 font-semibold">Daily Limit</th>
              <th className="py-3 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mailboxes.map((mb) => {
              const isProd = isProductionMailboxConnected(mb);
              return (
                <tr key={mb.id} className="hover:bg-slate-800/30">
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200">{mb.name}</span>
                        {mb.isTestMailbox && (
                          <span className="rounded bg-indigo-950/80 border border-indigo-700/60 px-1.5 py-0.2 text-[9px] font-mono text-indigo-300">
                            TEST RIG
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{mb.email}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[11px] font-mono">
                    <span
                      className={`uppercase font-semibold ${
                        mb.status === 'connected'
                          ? 'text-emerald-400'
                          : mb.status === 'reauth_required'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {mb.status}
                    </span>
                    <span className="text-slate-500 ml-1.5">({mb.provider})</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        mb.warmupStatus === 'active' && isProd
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          mb.warmupStatus === 'active' && isProd ? 'bg-amber-400' : 'bg-slate-500'
                        }`}
                      />
                      {mb.warmupStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-300 font-mono tabular-nums">{mb.warmupScore}%</span>
                      <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${mb.warmupScore}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300 tabular-nums">
                    {mb.dailyLimit} / day
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleToggleWarmup(mb)}
                      className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1 text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      {mb.warmupStatus === 'active' ? 'Pause Warm-up' : 'Resume Warm-up'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {mailboxes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                  No email accounts configured yet. Connect an account in Email Accounts to begin warmup.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Account Readiness Checklist */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Cold Outreach Deliverability Checklist</h3>
          {onNavigateToDeliverability && (
            <button
              onClick={onNavigateToDeliverability}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Run Live DNS Audit</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">SPF & DKIM Verification (Audit Required)</span>
              <span className="text-slate-400 text-[11px]">
                Run the live DNS Auditor under Deliverability to inspect SPF and DKIM TXT records for your sending domain.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">DMARC Policy Verification (Audit Required)</span>
              <span className="text-slate-400 text-[11px]">
                Verify `_dmarc` TXT policy (`quarantine` or `reject`) in the Deliverability DNS Auditor before scaling volume.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            {activeWarmupProd.length > 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-semibold text-white block">
                Active Warm-Up Coverage ({activeWarmupProd.length} / {connectedProdMailboxes.length})
              </span>
              <span className="text-slate-400 text-[11px]">
                {activeWarmupProd.length > 0
                  ? 'Connected production mailboxes have active warmup enabled.'
                  : 'No connected production mailboxes currently have active warmup.'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            {allUnderFiftyQuota ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-semibold text-white block">Under 50 Emails/Day Quota</span>
              <span className="text-slate-400 text-[11px]">
                {connectedProdMailboxes.length === 0
                  ? 'Connect a production mailbox with dailyLimit <= 50 for conservative sending.'
                  : allUnderFiftyQuota
                  ? 'All connected production mailboxes respect conservative <= 50/day limits.'
                  : 'One or more connected production mailboxes exceed 50 emails/day.'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
