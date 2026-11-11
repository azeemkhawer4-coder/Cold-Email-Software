import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Send,
  CheckCircle2,
  MessageSquare,
  AlertOctagon,
  CalendarCheck,
  Split,
  Mail,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Campaign, MailboxAccount } from '../types';

interface AnalyticsPageProps {
  campaigns: Campaign[];
  mailboxes: MailboxAccount[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ campaigns, mailboxes }) => {
  const totalSent = campaigns.reduce((acc, c) => acc + c.stats.sent, 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + c.stats.delivered, 0);
  const totalReplies = campaigns.reduce((acc, c) => acc + c.stats.replied, 0);
  const positiveReplies = campaigns.reduce((acc, c) => acc + c.stats.positiveReplies, 0);
  const totalMeetings = campaigns.reduce((acc, c) => acc + c.stats.meetingsBooked, 0);
  const totalBounced = campaigns.reduce((acc, c) => acc + c.stats.bounced, 0);

  const mailboxBarData = mailboxes.map((mb) => ({
    name: mb.email.split('@')[0],
    sentToday: mb.sentToday,
    dailyLimit: mb.dailyLimit,
    health: mb.healthScore,
  }));

  const handleExportAnalytics = () => {
    const headers = ['Campaign Name', 'Status', 'Sent', 'Delivered', 'Replies', 'Positive Replies', 'Meetings Booked', 'Bounces'];
    const rows = campaigns.map((c) => [
      `"${c.name}"`,
      c.status,
      c.stats.sent,
      c.stats.delivered,
      c.stats.replied,
      c.stats.positiveReplies,
      c.stats.meetingsBooked,
      c.stats.bounced,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outboundos-analytics-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Advanced Analytics & Conversion Reporting
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit sending acceptance, reply velocity, variant A/B winners, and mailbox health performance.
          </p>
        </div>

        <button
          onClick={handleExportAnalytics}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer shadow-xs"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Analytics CSV</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Total Sent</span>
          <span className="text-2xl font-bold text-white mt-1 block font-mono tabular-nums">{totalSent}</span>
          <span className="text-[10px] text-cyan-400 block mt-1 font-mono">{totalDelivered} accepted</span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Total Replies</span>
          <span className="text-2xl font-bold text-indigo-400 mt-1 block font-mono tabular-nums">{totalReplies}</span>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            {totalDelivered > 0 ? ((totalReplies / totalDelivered) * 100).toFixed(1) : 0}% reply rate
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Positive Replies</span>
          <span className="text-2xl font-bold text-emerald-400 mt-1 block font-mono tabular-nums">{positiveReplies}</span>
          <span className="text-[10px] text-emerald-400/80 block mt-1 font-mono">
            {totalReplies > 0 ? Math.round((positiveReplies / totalReplies) * 100) : 0}% intent ratio
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Meetings Booked</span>
          <span className="text-2xl font-bold text-amber-400 mt-1 block font-mono tabular-nums">{totalMeetings}</span>
          <span className="text-[10px] text-slate-400 block mt-1">Confirmed demo pipeline</span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Hard Bounces</span>
          <span className="text-2xl font-bold text-rose-400 mt-1 block font-mono tabular-nums">{totalBounced}</span>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            {totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : 0}% bounce rate
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Sending Accounts</span>
          <span className="text-2xl font-bold text-blue-400 mt-1 block font-mono tabular-nums">{mailboxes.length}</span>
          <span className="text-[10px] text-emerald-400 block mt-1">All balanced</span>
        </div>
      </div>

      {/* Chart: Mailbox Quota & Sending Comparison */}
      <div className="surface-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Mailbox Usage & Daily Allocation</h3>
            <p className="text-xs text-slate-400">Comparing sent volume vs configured daily limits across rotating inboxes</p>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mailboxBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="sentToday" name="Sent Today" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dailyLimit" name="Daily Safe Quota" fill="#334155" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* A/B Variant Testing Results */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Split className="h-4 w-4 text-indigo-400" />
              A/B Subject & Body Variant Testing Breakdown
            </h3>
            <p className="text-xs text-slate-400">
              Evaluates response rates between alternative copy variations before declaring statistical winner.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Variant A: Question regarding platform scale</span>
              <span className="rounded bg-blue-500/10 text-blue-400 px-2 py-0.5 text-[10px] font-bold">50% Weight</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              "Quick question regarding &#123;&#123;company&#125;&#125; platform scale..."
            </p>
            <div className="pt-2 flex items-center justify-between border-t border-slate-700/60 font-mono text-[11px]">
              <span className="text-slate-400">Sent: 22</span>
              <span className="text-indigo-400 font-semibold">Replies: 3 (13.6%)</span>
              <span className="text-emerald-400 font-bold">Leader (Sample &gt; 20)</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Variant B: Scaling developer velocity in Q4</span>
              <span className="rounded bg-blue-500/10 text-blue-400 px-2 py-0.5 text-[10px] font-bold">50% Weight</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              "Scaling &#123;&#123;company&#125;&#125;'s developer velocity in Q4..."
            </p>
            <div className="pt-2 flex items-center justify-between border-t border-slate-700/60 font-mono text-[11px]">
              <span className="text-slate-400">Sent: 20</span>
              <span className="text-indigo-400 font-semibold">Replies: 2 (10.0%)</span>
              <span className="text-slate-400">Testing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
