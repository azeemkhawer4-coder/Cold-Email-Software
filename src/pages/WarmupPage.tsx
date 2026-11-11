import React from 'react';
import { Flame, CheckCircle2, AlertCircle, Play, Pause, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { MailboxAccount } from '../types';

interface WarmupPageProps {
  mailboxes: MailboxAccount[];
  onRefreshMailboxes: () => void;
}

export const WarmupPage: React.FC<WarmupPageProps> = ({ mailboxes, onRefreshMailboxes }) => {
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

  return (
    <div className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Email Account Warm-Up Engine
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-xs font-mono font-medium text-amber-400">
              Active Peer Pool
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gradual automated ramp-up, inbox placement testing, and reputation building across connected mailboxes.
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
          <div className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">95%</div>
          <p className="mt-1 text-[11px] text-emerald-400">Optimal deliverability reputation</p>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-5 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Inbox Placement Rate</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">99.2%</div>
          <p className="mt-1 text-[11px] text-slate-400">Zero spam folder placement</p>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-5 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Active Warm-Up Mailboxes</span>
            <ShieldCheck className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono tabular-nums">
            {mailboxes.filter((m) => m.warmupStatus === 'active').length} of {mailboxes.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Ramping at +3 emails/day</p>
        </div>
      </div>

      {/* Account Warm-up Table */}
      <div className="surface-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Mailbox Warm-Up Configuration</h3>
          <span className="text-xs text-slate-400">Real-time peer network synchronization</span>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-3 px-4 font-semibold">Mailbox Account</th>
              <th className="py-3 px-4 font-semibold">Provider</th>
              <th className="py-3 px-4 font-semibold">Warm-up Status</th>
              <th className="py-3 px-4 font-semibold">Reputation Score</th>
              <th className="py-3 px-4 font-semibold">Daily Volume</th>
              <th className="py-3 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mailboxes.map((mb) => (
              <tr key={mb.id} className="hover:bg-slate-800/30">
                <td className="py-3.5 px-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">{mb.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{mb.email}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4 uppercase text-[11px] text-slate-300 font-mono">{mb.provider}</td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      mb.warmupStatus === 'active'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${mb.warmupStatus === 'active' ? 'bg-amber-400' : 'bg-slate-500'}`} />
                    {mb.warmupStatus}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-300">{mb.warmupScore}%</span>
                    <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${mb.warmupScore}%` }} />
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-300">
                  {Math.round(mb.dailyLimit * 0.4)} / day
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => handleToggleWarmup(mb)}
                    className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1 text-slate-300 hover:text-white transition"
                  >
                    {mb.warmupStatus === 'active' ? 'Pause Warm-up' : 'Resume Warm-up'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Account Readiness Checklist */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Cold Outreach Deliverability Checklist</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">SPF & DKIM Authenticated</span>
              <span className="text-slate-400 text-[11px]">All connected sending domains have authenticated 2048-bit keys.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">DMARC Enforcement</span>
              <span className="text-slate-400 text-[11px]">Domain-level quarantine policy protecting recipient inboxes.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">Minimum 14 Days Warmup Age</span>
              <span className="text-slate-400 text-[11px]">Mailboxes active in peer network with realistic reply cadence.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">Under 50 Emails/Day Quota</span>
              <span className="text-slate-400 text-[11px]">Conservative sending pace avoiding automated spam filtering flags.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
