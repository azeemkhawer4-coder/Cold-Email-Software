import React from 'react';
import {
  Download,
  Split,
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
import { Campaign, Conversation, Deal, Lead, MailboxAccount, SendingJob } from '../types';
import { computeAnalyticsSummary } from '../utils/analyticsStats';

interface AnalyticsPageProps {
  campaigns: Campaign[];
  mailboxes: MailboxAccount[];
  leads?: Lead[];
  conversations?: Conversation[];
  sendingJobs?: SendingJob[];
  deals?: Deal[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  campaigns,
  mailboxes,
  leads = [],
  conversations = [],
  sendingJobs = [],
  deals = [],
}) => {
  const summary = computeAnalyticsSummary({
    leads,
    campaigns,
    mailboxes,
    conversations,
    sendingJobs,
    deals,
  });

  const mailboxBarData = mailboxes.map((mb) => ({
    name: mb.email.split('@')[0],
    sentToday: mb.sentToday || 0,
    dailyLimit: mb.dailyLimit || 0,
    health: mb.healthScore || 0,
  }));

  const handleExportAnalytics = () => {
    const headers = [
      'Campaign Name',
      'Status',
      'Sent',
      'Delivered',
      'Replies',
      'Positive Replies',
      'Meetings Booked',
      'Bounces',
    ];
    const rows = campaigns.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.status,
      c.stats?.sent || 0,
      c.stats?.delivered || 0,
      c.stats?.replied || 0,
      c.stats?.positiveReplies || 0,
      c.stats?.meetingsBooked || 0,
      c.stats?.bounced || 0,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outboundos-analytics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            Live SQLite metrics for sending acceptance, reply velocity, variant A/B performance, and mailbox allocation.
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
          <span className="text-2xl font-bold text-white mt-1 block font-mono tabular-nums">
            {summary.totalSent}
          </span>
          <span className="text-[10px] text-cyan-400 block mt-1 font-mono">
            {summary.totalDelivered} accepted
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Total Replies</span>
          <span className="text-2xl font-bold text-indigo-400 mt-1 block font-mono tabular-nums">
            {summary.totalReplies}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            {summary.replyRate.toFixed(1)}% reply rate
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Positive Replies</span>
          <span className="text-2xl font-bold text-emerald-400 mt-1 block font-mono tabular-nums">
            {summary.positiveReplies}
          </span>
          <span className="text-[10px] text-emerald-400/80 block mt-1 font-mono">
            {summary.totalReplies > 0
              ? Math.round((summary.positiveReplies / summary.totalReplies) * 100)
              : 0}
            % intent ratio
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Meetings Booked</span>
          <span className="text-2xl font-bold text-amber-400 mt-1 block font-mono tabular-nums">
            {summary.totalMeetings}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            {summary.openDealsCount} open CRM deal(s)
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Hard Bounces</span>
          <span className="text-2xl font-bold text-rose-400 mt-1 block font-mono tabular-nums">
            {summary.totalBounced}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            {summary.bounceRate.toFixed(1)}% bounce rate
          </span>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <span className="text-xs text-slate-400 block font-medium">Prod Senders</span>
          <span className="text-2xl font-bold text-blue-400 mt-1 block font-mono tabular-nums">
            {summary.connectedProductionMailboxesCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1 font-mono">
            {mailboxes.length} total ({summary.reauthRequiredMailboxesCount} re-auth, {summary.testMailboxesCount} test)
          </span>
        </div>
      </div>

      {/* Chart: Mailbox Quota & Sending Comparison */}
      <div className="surface-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Mailbox Usage & Daily Allocation</h3>
            <p className="text-xs text-slate-400">
              Comparing sent volume vs configured daily limits across configured mailboxes
            </p>
          </div>
        </div>

        {mailboxBarData.length === 0 ? (
          <div className="h-44 flex items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
            No mailboxes configured yet. Connect an email account in Email Accounts to monitor daily quota usage.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mailboxBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="sentToday" name="Sent Today" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dailyLimit" name="Daily Safe Quota" fill="#334155" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
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
              Live response tracking across campaign sequence variants persisted in local SQLite.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {summary.variantResults.length} Variant{summary.variantResults.length === 1 ? '' : 's'} Tracked
          </span>
        </div>

        {summary.variantResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {summary.variantResults.map((v) => (
              <div
                key={`${v.campaignId}-${v.variantId}`}
                className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white truncate">
                    {v.name}: {v.subject || '(No Subject)'}
                  </span>
                  <span className="rounded bg-blue-500/10 text-blue-400 px-2 py-0.5 text-[10px] font-mono font-bold shrink-0">
                    {v.campaignName} · Step {v.stepNumber}
                  </span>
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-slate-700/60 font-mono text-[11px]">
                  <span className="text-slate-400">Sent: {v.sentCount}</span>
                  <span className="text-indigo-400 font-semibold">
                    Replies: {v.replyCount} ({v.replyRate.toFixed(1)}%)
                  </span>
                  <span className={v.sentCount >= 20 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                    {v.sentCount === 0
                      ? 'Not Dispatched'
                      : v.sentCount >= 20
                      ? 'Active Sample'
                      : 'Collecting Sample'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
            No A/B variants tested yet. Add A/B variants to an email step inside Campaigns to track live variant performance.
          </div>
        )}
      </div>
    </div>
  );
};
