import React, { useState } from 'react';
import {
  Users,
  Send,
  MessageSquare,
  ThumbsUp,
  AlertOctagon,
  CalendarCheck,
  Flame,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Briefcase,
  AlertTriangle,
  DollarSign,
  Eye,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Lead, Campaign, MailboxAccount, Conversation, SendingJob, Deal } from '../types';
import { computeAnalyticsSummary, isProductionMailboxConnected } from '../utils/analyticsStats';
import { NavigationItem } from '../components/Sidebar';

interface DashboardPageProps {
  leads: Lead[];
  campaigns: Campaign[];
  mailboxes: MailboxAccount[];
  conversations: Conversation[];
  sendingJobs?: SendingJob[];
  deals?: Deal[];
  workerStatus?: { isRunning: boolean; sendingActive: boolean } | null;
  onSelectCampaign: (id: string) => void;
  onOpenConversation: (id: string) => void;
  onOpenCreateCampaign: () => void;
  onNavigateTab?: (tab: NavigationItem) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  leads,
  campaigns,
  mailboxes,
  conversations,
  sendingJobs = [],
  deals = [],
  workerStatus,
  onSelectCampaign,
  onOpenConversation,
  onOpenCreateCampaign,
  onNavigateTab,
}) => {
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d'>('7d');

  const safeLeads = Array.isArray(leads) ? leads : [];
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const safeMailboxes = Array.isArray(mailboxes) ? mailboxes : [];
  const safeConversations = Array.isArray(conversations) ? conversations : [];
  const safeJobs = Array.isArray(sendingJobs) ? sendingJobs : [];
  const safeDeals = Array.isArray(deals) ? deals : [];

  const summary = computeAnalyticsSummary({
    leads: safeLeads,
    campaigns: safeCampaigns,
    mailboxes: safeMailboxes,
    conversations: safeConversations,
    sendingJobs: safeJobs,
    deals: safeDeals,
  });

  const verifiedPct =
    summary.totalLeads > 0 ? Math.round((summary.verifiedLeads / summary.totalLeads) * 100) : 0;

  const displayedSeries =
    dateRange === 'today' ? summary.dailySeries.slice(-1) : summary.dailySeries;

  const chartData = displayedSeries.map((pt) => ({
    day: pt.label,
    sent: pt.sent,
    delivered: pt.delivered,
    opened: pt.opened,
    replies: pt.replied,
  }));

  const hasChartActivity = chartData.some((d) => d.sent > 0 || d.delivered > 0 || d.opened > 0 || d.replies > 0);
  const showWorkerPausedWarning =
    summary.activeCampaignsCount > 0 && workerStatus && !workerStatus.sendingActive;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#070b14] text-slate-100">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Executive Outreach Dashboard
            <span className="flex items-center gap-1 rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live DB
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time campaign delivery velocity, mailbox rotation health, and conversion pipeline metrics.
          </p>
        </div>

        {/* Date Filter Range */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-900/90 border border-slate-800 p-1">
          {(['today', '7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer ${
                dateRange === r
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {r === 'today' ? 'Today' : r === '7d' ? 'Last 7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Active Campaign While Worker Paused Warning */}
      {showWorkerPausedWarning && (
        <div className="rounded-xl bg-amber-950/40 border border-amber-600/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>{summary.activeCampaignsCount} active campaign(s)</strong> exist, but background queue dispatching is currently <strong>Paused</strong>. Queued jobs will not send until resumed.
            </span>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('deliverability')}
              className="rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition cursor-pointer shrink-0"
            >
              Inspect Queue & Worker
            </button>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Leads</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
            {summary.totalLeads}
          </div>
          <div className="mt-1 flex items-center text-[11px] text-slate-400">
            <span className="text-emerald-400 flex items-center mr-1 font-mono tabular-nums">
              <TrendingUp className="h-3 w-3 inline mr-0.5" /> {verifiedPct}%
            </span>
            <span>({summary.verifiedLeads} verified)</span>
          </div>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Emails Sent</span>
            <Send className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
            {summary.totalSent}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            <span className="text-cyan-400 font-mono font-medium">{summary.totalDelivered}</span> accepted
          </div>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Open Rate</span>
            <Eye className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
            {summary.openRate.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            <span className="text-violet-400 font-mono font-medium">{summary.totalOpened}</span> unique opens
          </div>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Reply Rate</span>
            <MessageSquare className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
            {summary.replyRate.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            <span className="text-indigo-400 font-mono font-medium">{summary.totalReplies}</span> total replies
          </div>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Positive Replies</span>
            <ThumbsUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
            {summary.positiveReplies}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-mono font-medium">
              {summary.totalReplies > 0
                ? Math.round((summary.positiveReplies / summary.totalReplies) * 100)
                : 0}
              %
            </span>{' '}
            positive ratio
          </div>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Meetings Booked</span>
            <CalendarCheck className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
            {summary.totalMeetings}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {summary.openDealsCount} open deal(s)
          </div>
        </div>

        <div className="surface-card surface-card-hover rounded-xl p-4 transition-all duration-150">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Bounce Rate</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white font-mono tabular-nums">
            {summary.bounceRate.toFixed(1)}%
          </div>
          <div
            className={`mt-1 text-[11px] font-mono ${
              summary.bounceRate <= 2.0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.bounceRate <= 2.0 ? 'Below 2.0% safe threshold' : 'Above 2.0% threshold'}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Outbound Velocity Chart */}
        <div className="lg:col-span-2 surface-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Outbound Sending & Delivery Performance</h3>
              <p className="text-xs text-slate-400">
                Real daily dispatches from recorded sending queue jobs (last 7 days)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Sent
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400" /> Accepted
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full bg-violet-400" /> Opened
              </span>
            </div>
          </div>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="delivGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090d16',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#sentGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#delivGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="opened"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#openGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
            {!hasChartActivity && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-1.5 text-[11px] text-slate-400 font-mono">
                  No dispatches recorded in this date window yet
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mailbox Health & Sending Limits */}
        <div className="surface-card rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Sending Accounts Health</h3>
              <span
                className={`text-[11px] font-mono font-medium flex items-center gap-1 ${
                  summary.connectedProductionMailboxesCount > 0
                    ? 'text-cyan-400'
                    : summary.reauthRequiredMailboxesCount > 0
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    summary.connectedProductionMailboxesCount > 0
                      ? 'bg-cyan-400'
                      : summary.reauthRequiredMailboxesCount > 0
                      ? 'bg-rose-400'
                      : 'bg-amber-400'
                  }`}
                />
                {summary.connectedProductionMailboxesCount > 0
                  ? `${summary.connectedProductionMailboxesCount} Prod Active`
                  : summary.reauthRequiredMailboxesCount > 0
                  ? `${summary.reauthRequiredMailboxesCount} Re-auth Req`
                  : 'No Prod Senders'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Live sender status and daily quota usage across configured mailboxes.
            </p>

            <div className="space-y-3">
              {safeMailboxes.map((mb) => {
                const limit = mb.dailyLimit || mb.dailyQuota || 50;
                const sent = mb.sentToday || 0;
                const usedPct = Math.min(100, Math.round((sent / Math.max(1, limit)) * 100));
                const warmup = mb.warmupScore ?? 0;
                const health = mb.healthScore ?? 0;
                const isProdOk = isProductionMailboxConnected(mb);
                const dotColor = isProdOk
                  ? 'bg-emerald-400'
                  : mb.status === 'reauth_required' || mb.status === 'error'
                  ? 'bg-rose-400'
                  : 'bg-amber-400';

                return (
                  <div key={mb.id} className="rounded-lg bg-slate-900/60 border border-slate-800 p-3">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                        <span className="font-medium text-slate-200 truncate">{mb.email}</span>
                        {mb.isTestMailbox && (
                          <span className="rounded bg-indigo-950 border border-indigo-700/60 px-1 text-[9px] font-mono text-indigo-300 shrink-0">
                            TEST
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono text-[11px] tabular-nums shrink-0">
                        {sent} / {limit}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-amber-400" /> Warmup:{' '}
                        <span className="font-mono text-slate-300 tabular-nums">{warmup}%</span>
                      </span>
                      <span
                        className={`font-mono uppercase ${
                          mb.status === 'reauth_required'
                            ? 'text-rose-400'
                            : mb.status === 'connected'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {mb.status.replace(/_/g, ' ')} · {health}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {safeMailboxes.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
                  No email accounts configured yet.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <button
              onClick={() => onNavigateTab?.('deliverability')}
              className="flex items-center gap-1.5 hover:text-blue-300 transition cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span>Run DNS Audit (SPF/DKIM/DMARC)</span>
            </button>
            <span className="text-slate-300 font-medium font-mono text-[11px]">
              {summary.connectedProductionMailboxesCount}/{safeMailboxes.length} Prod
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Conversations, Campaign Performance & Top Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Inbound Conversations */}
        <div className="surface-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Recent Conversations</h3>
              <p className="text-xs text-slate-400">Incoming replies triaged by intent</p>
            </div>
            <span className="text-xs font-mono font-medium text-blue-400 tabular-nums">
              {safeConversations.length} Threads
            </span>
          </div>

          <div className="space-y-2.5">
            {safeConversations.slice(0, 4).map((conv) => (
              <div
                key={conv.id}
                onClick={() => onOpenConversation(conv.id)}
                className="flex items-start justify-between rounded-lg bg-slate-900/60 border border-slate-800 p-3 hover:bg-slate-800/60 hover:border-slate-700 transition cursor-pointer"
              >
                <div className="flex-1 truncate pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">{conv.leadName || 'Lead'}</span>
                    <span className="text-[10px] text-slate-400 truncate">({conv.leadCompany || 'Company'})</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                        conv.category === 'interested'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : conv.category === 'meeting_booked'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : conv.category === 'out_of_office'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {(conv.category || 'general').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 truncate font-mono">{conv.subject || 'No Subject'}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400 truncate">{conv.snippet || ''}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 shrink-0 mt-1" />
              </div>
            ))}
            {safeConversations.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                No inbound replies recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Campaign Performance Ranking */}
        <div className="surface-card rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Campaign Performance</h3>
              <p className="text-xs text-slate-400">Active outreach campaigns and conversion metrics</p>
            </div>
            <button
              onClick={onOpenCreateCampaign}
              className="shrink-0 whitespace-nowrap text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              + New Campaign
            </button>
          </div>

          <div className="space-y-3">
            {safeCampaigns.map((camp) => {
              const stepCount = (camp.steps || (camp as any).sequenceSteps || []).length;
              const sent = camp.stats?.sent ?? camp.stats?.sentCount ?? 0;
              const opened = camp.stats?.opened ?? camp.stats?.openCount ?? 0;
              const campOpenRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
              const replied = camp.stats?.replied ?? camp.stats?.replyCount ?? 0;
              const meetings = camp.stats?.meetingsBooked ?? camp.stats?.meetingCount ?? 0;

              return (
                <div
                  key={camp.id}
                  onClick={() => onSelectCampaign(camp.id)}
                  className="rounded-lg bg-slate-900/60 border border-slate-800 p-3.5 hover:bg-slate-800/60 hover:border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {camp.name || 'Untitled Campaign'}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-semibold uppercase shrink-0 ${
                          camp.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {camp.status || 'draft'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                      {stepCount} Steps
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs mt-3 pt-2.5 border-t border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sent</span>
                      <span className="font-semibold text-slate-200 font-mono tabular-nums">{sent}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Open Rate</span>
                      <span className="font-semibold text-violet-400 font-mono tabular-nums">
                        {campOpenRate}% <span className="text-[10px] text-slate-500">({opened})</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Replies</span>
                      <span className="font-semibold text-indigo-400 font-mono tabular-nums">{replied}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Meetings</span>
                      <span className="font-semibold text-emerald-400 font-mono tabular-nums">{meetings}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {safeCampaigns.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                No campaigns created yet.
              </div>
            )}
          </div>
        </div>

        {/* Top Opportunities (CRM Deals) */}
        <div className="surface-card rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-emerald-400" />
                  Top Opportunities
                </h3>
                <p className="text-xs text-slate-400">
                  Open CRM pipeline ({summary.openDealsCount} active deal{summary.openDealsCount === 1 ? '' : 's'})
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                ${summary.openPipelineValue.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2.5">
              {summary.topOpportunities.map((deal) => (
                <div
                  key={deal.id}
                  onClick={() => onNavigateTab?.('crm')}
                  className="rounded-lg bg-slate-900/60 border border-slate-800 p-3 hover:bg-slate-800/60 hover:border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200 truncate">{deal.title}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                      ${(deal.value || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate">
                      {deal.leadCompany || 'Account'} · {deal.leadName || 'Contact'}
                    </span>
                    <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[9px] font-mono uppercase text-slate-300 shrink-0">
                      {deal.stage.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {summary.topOpportunities.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                  No open CRM opportunities yet. Deals created in CRM Pipeline appear here automatically.
                </div>
              )}
            </div>
          </div>

          {onNavigateTab && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                Live SQLite Pipeline
              </span>
              <button
                onClick={() => onNavigateTab('crm')}
                className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
              >
                Open CRM Pipeline →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
