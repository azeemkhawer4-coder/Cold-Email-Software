import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSearch,
  Sparkles,
  Server,
  RefreshCw,
  Layers,
  AlertOctagon,
  ExternalLink,
  X,
  RotateCw,
  Eye,
  Copy,
  Check,
  Power,
} from 'lucide-react';
import { Campaign, SendingJob, FailureReport, QueueStats } from '../types';
import { SafetyControlBar } from '../components/campaigns/SafetyControlBar';

interface DeliverabilityPageProps {
  campaigns?: Campaign[];
  onRefreshAll?: () => void;
}

export const DeliverabilityPage: React.FC<DeliverabilityPageProps> = ({
  campaigns = [],
  onRefreshAll,
}) => {
  const [activeTab, setActiveTab] = useState<'dns' | 'queue' | 'failures'>('queue');
  const [dnsDomain, setDnsDomain] = useState('');
  const [dnsResult, setDnsResult] = useState<any>(null);
  const [isCheckingDns, setIsCheckingDns] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);

  const [subjectText, setSubjectText] = useState('Quick question regarding your cloud infrastructure');
  const [bodyText, setBodyText] = useState(
    'Hi {{first_name}},\n\nI noticed your team at {{company}} is expanding platform engineering.\n\nWe recently helped several peers cut their cloud egress overhead by 34%.\n\nWould you be open to a 10-minute chat this Thursday?\n\nBest,\n{{sender_name}}'
  );
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Worker & Queue State
  const [workerStatus, setWorkerStatus] = useState<{ isRunning: boolean; sendingActive: boolean } | null>(null);
  const [queueJobs, setQueueJobs] = useState<SendingJob[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [failures, setFailures] = useState<FailureReport[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<SendingJob | null>(null);
  const [copiedIdempotency, setCopiedIdempotency] = useState(false);
  const [isResumingWorker, setIsResumingWorker] = useState(false);

  const handleCheckDns = async (customDomain?: string) => {
    const target = (customDomain || dnsDomain || '').trim();
    if (!target) {
      setDnsError('Please enter a domain name (e.g. yourcompany.com)');
      return;
    }
    setIsCheckingDns(true);
    setDnsError(null);
    try {
      const res = await fetch('/api/deliverability/dns-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'DNS check failed');
      setDnsResult(data);
    } catch (err: any) {
      setDnsError(err.message);
    } finally {
      setIsCheckingDns(false);
    }
  };

  const fetchQueueAndFailures = async () => {
    setIsLoadingQueue(true);
    try {
      const [qRes, fRes, wRes] = await Promise.all([
        fetch('/api/queue'),
        fetch('/api/failures'),
        fetch('/api/worker/status'),
      ]);
      if (qRes.ok) {
        const qData = await qRes.json();
        setQueueJobs(qData.jobs || []);
        setQueueStats(qData.stats || null);
      }
      if (fRes.ok) {
        const fData = await fRes.json();
        setFailures(fData.failureReports || []);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        setWorkerStatus({ isRunning: Boolean(wData.isRunning), sendingActive: Boolean(wData.sendingActive) });
      }
    } catch (e: any) {
      setActionError(e?.message || 'Failed to load queue state');
    } finally {
      setIsLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueueAndFailures();
    const interval = setInterval(fetchQueueAndFailures, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleResumeWorker = async () => {
    setIsResumingWorker(true);
    setActionError(null);
    try {
      const res = await fetch('/api/worker/toggle', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to resume worker');
      setWorkerStatus({ isRunning: true, sendingActive: Boolean(data.sendingActive) });
      await fetchQueueAndFailures();
      onRefreshAll?.();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to resume worker');
    } finally {
      setIsResumingWorker(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingId(jobId);
    setActionError(null);
    try {
      const res = await fetch(`/api/queue/${jobId}/retry`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to retry job');
      await fetchQueueAndFailures();
      onRefreshAll?.();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to retry job');
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/queue/${jobId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to cancel job');
      await fetchQueueAndFailures();
      onRefreshAll?.();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to cancel job');
    }
  };

  const handleScanContent = async () => {
    setIsScanning(true);
    setActionError(null);
    try {
      const res = await fetch('/api/deliverability/check-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subjectText, body: bodyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Content scan failed');
      setScanResult(data);
    } catch (e: any) {
      setActionError(e?.message || 'Content scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const hasActiveCampaignsWithPausedWorker =
    campaigns.some((c) => c.status === 'active') && workerStatus !== null && !workerStatus.sendingActive;

  return (
    <div className="flex-1 overflow-y-auto bg-[#070b14] text-slate-100 p-6 space-y-6 custom-scrollbar">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Deliverability, Queue & Failures
            {dnsResult ? (
              <span className="rounded bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-xs font-mono font-medium text-emerald-400 tabular-nums">
                Score: {dnsResult.score}/100 ({dnsResult.domain})
              </span>
            ) : (
              <span className="rounded bg-slate-900 border border-slate-800 px-2.5 py-0.5 text-xs font-mono text-slate-400">
                Deliverability: Not checked
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Durable outbox queue management, failure reporting with exponential backoff, and SPF/DKIM verification.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Outbox Queue ({queueStats?.total || queueJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('failures')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'failures'
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
            <span>Failures ({failures.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('dns')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              activeTab === 'dns'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>DNS & Spam Auditor</span>
          </button>

          <button
            onClick={fetchQueueAndFailures}
            className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 cursor-pointer"
            title="Refresh queue state"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingQueue ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Safety & Worker Control Bar */}
      <SafetyControlBar
        onRefresh={() => {
          fetchQueueAndFailures();
          onRefreshAll?.();
        }}
        onStatusChange={setWorkerStatus}
      />

      {/* Warning banner when active campaigns exist while Worker Dispatch is paused */}
      {hasActiveCampaignsWithPausedWorker && (
        <div className="rounded-xl bg-amber-950/35 border border-amber-500/40 p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Active campaigns are waiting while Worker Dispatch is Paused</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Queued dispatches will remain paused until you resume the background dispatch loop.
              </p>
            </div>
          </div>
          <button
            onClick={handleResumeWorker}
            disabled={isResumingWorker}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Power className="h-3.5 w-3.5" />
            <span>{isResumingWorker ? 'Resuming...' : 'Resume Worker'}</span>
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: OUTBOX QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Queue KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Queued', value: queueStats?.queued || 0, color: 'text-blue-400', border: 'border-blue-500/20' },
              { label: 'Processing', value: queueStats?.processing || 0, color: 'text-amber-400', border: 'border-amber-500/20' },
              { label: 'Sent', value: queueStats?.sent || 0, color: 'text-emerald-400', border: 'border-emerald-500/20' },
              { label: 'Retrying (Backoff)', value: queueStats?.retrying || 0, color: 'text-cyan-400', border: 'border-cyan-500/20' },
              { label: 'Permanent Failed', value: queueStats?.failed || 0, color: 'text-rose-400', border: 'border-rose-500/20' },
              { label: 'Total Jobs', value: queueStats?.total || 0, color: 'text-white', border: 'border-slate-800' },
            ].map((stat, idx) => (
              <div key={idx} className={`surface-card rounded-xl p-3 border ${stat.border}`}>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">{stat.label}</span>
                <span className={`text-xl font-bold font-mono tabular-nums mt-0.5 block ${stat.color}`}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {/* Queue Table */}
          <div className="surface-card rounded-xl border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Durable Outbox Queue</h3>
                <p className="text-[11px] text-slate-400">Scheduled sequence jobs with idempotency keys and retry attempts</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-0.5 text-[11px] font-mono ${
                  workerStatus?.sendingActive
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    workerStatus?.sendingActive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {workerStatus?.sendingActive ? 'Worker Dispatch: Running' : 'Worker Dispatch: Paused'}
              </span>
            </div>

            {queueJobs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No outbound jobs currently queued. Launch an outreach campaign or trigger queue enrollment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800/80 bg-slate-900/40 text-[10.5px] font-mono uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Lead / Recipient</th>
                      <th className="px-4 py-2.5">Subject</th>
                      <th className="px-4 py-2.5">Mailbox Account</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Attempts</th>
                      <th className="px-4 py-2.5">Scheduled / Result</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {queueJobs.slice(0, 50).map((job) => {
                      const isRetrying = retryingId === job.id;
                      return (
                        <tr key={job.id} className="hover:bg-slate-900/30 transition">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-white block">{job.leadName || 'Prospect'}</span>
                            <span className="text-[11px] text-slate-400 font-mono block">{job.leadEmail}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={job.subject}>
                            {job.subject}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                            {job.mailboxEmail || 'Load Balanced'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-2 py-0.5 text-[9px] font-mono uppercase font-semibold border ${
                                job.status === 'sent'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : job.status === 'processing'
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                                  : job.status === 'retrying'
                                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                                  : job.status === 'failed'
                                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                  : job.status === 'cancelled'
                                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              }`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-slate-300">
                            {job.attempts} / {job.maxAttempts}
                          </td>
                          <td className="px-4 py-3 text-[11px]">
                            {job.status === 'sent' ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-emerald-400 font-mono">Delivered</span>
                                {job.openedAt && (
                                  <span
                                    className="rounded bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.2 text-[10px] font-mono text-violet-300"
                                    title={`First opened ${new Date(job.openedAt).toLocaleString()}`}
                                  >
                                    Opened{(job.openCount || 0) > 1 ? ` ×${job.openCount}` : ''}
                                  </span>
                                )}
                                {job.previewUrl && (
                                  <a
                                    href={job.previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 text-[10px]"
                                  >
                                    <span>Preview</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            ) : job.status === 'retrying' ? (
                              <span className="text-cyan-400 font-mono">
                                Retry at {new Date(job.nextAttemptAt || '').toLocaleTimeString()}
                              </span>
                            ) : job.lastError ? (
                              <span className="text-rose-400 font-mono text-[10px] truncate block max-w-xs" title={job.lastError}>
                                {job.lastError}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">
                                {new Date(job.scheduledAt).toLocaleTimeString()}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setCopiedIdempotency(false);
                                  setSelectedJob(job);
                                }}
                                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                                title="Inspect job details & idempotency key"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Details</span>
                              </button>
                              {(job.status === 'failed' || job.status === 'retrying') && (
                                <button
                                  onClick={() => handleRetryJob(job.id)}
                                  disabled={isRetrying}
                                  className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] text-blue-300 hover:bg-slate-700 cursor-pointer"
                                  title="Retry dispatch immediately"
                                >
                                  <RotateCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                                  <span>Retry</span>
                                </button>
                              )}
                              {(job.status === 'queued' || job.status === 'retrying') && (
                                <button
                                  onClick={() => handleCancelJob(job.id)}
                                  className="rounded bg-slate-800 p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700 cursor-pointer"
                                  title="Cancel job"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FAILURES & BOUNCE LOGS */}
      {activeTab === 'failures' && (
        <div className="space-y-4">
          <div className="surface-card rounded-xl border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">Failure Reports & Delivery Diagnostics</h3>
                <p className="text-[11px] text-slate-400">Classified delivery errors, provider rejections, and bounce events</p>
              </div>
              <span className="text-xs font-mono text-rose-400 font-medium tabular-nums">{failures.length} Recorded</span>
            </div>

            {failures.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Zero delivery failures recorded. Your sender rotation and SMTP/OAuth configuration is healthy.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 text-xs">
                {failures.map((f) => (
                  <div key={f.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-900/30 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[9px] font-mono uppercase text-rose-400 font-semibold">
                          {f.errorType}
                        </span>
                        <span className="font-semibold text-white">{f.campaignName}</span>
                        <span className="text-slate-500 text-[11px]">·</span>
                        <span className="font-mono text-slate-400">{f.leadEmail}</span>
                      </div>
                      <p className="text-xs text-rose-300 font-mono">{f.errorMessage}</p>
                      {f.errorDetails && (
                        <p className="text-[10px] font-mono text-slate-500 break-all">{f.errorDetails}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-[11px] text-slate-500 block">
                        {new Date(f.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">Via {f.provider}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DNS & CONTENT SPAM AUDITOR */}
      {activeTab === 'dns' && (
        <div className="space-y-6">
          {/* Live DNS Checker Search Bar */}
          <div className="surface-card rounded-xl p-5 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Live Outreach Domain DNS Auditor
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct $0 local DNS resolution for SPF, DKIM, DMARC, and MX records via Node.js dns resolver.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. yourcompany.com"
                  value={dnsDomain}
                  onChange={(e) => setDnsDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckDns()}
                  className="rounded-lg bg-slate-900 border border-slate-700/80 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 min-w-[220px]"
                />
                <button
                  onClick={() => handleCheckDns()}
                  disabled={isCheckingDns}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isCheckingDns ? 'animate-spin' : ''}`} />
                  {isCheckingDns ? 'Querying DNS...' : 'Verify DNS'}
                </button>
              </div>
            </div>

            {dnsError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{dnsError}</span>
              </div>
            )}
          </div>

          {/* DNS Records Status Grid */}
          {!dnsResult ? (
            <div className="surface-card rounded-xl p-8 border border-slate-800 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-200">DNS Records Not Verified Yet</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Enter your sending domain (e.g. your outreach domain or Google Workspace root domain) above and click &quot;Verify DNS&quot; to test your live configuration.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Domain: <strong className="text-slate-200 font-mono">{dnsResult.domain}</strong></span>
                <span className="flex items-center gap-2">
                  <span>Score:</span>
                  <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                    dnsResult.score >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    dnsResult.score >= 50 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {dnsResult.score}/100
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Checked {new Date(dnsResult.checkedAt).toLocaleTimeString()}
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* SPF */}
                <div className="surface-card rounded-xl p-4 space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">SPF Record</span>
                    <span className={`flex items-center gap-1 text-[11px] font-medium ${
                      dnsResult.spf?.valid ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {dnsResult.spf?.valid ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Valid</>
                      ) : (
                        <><XCircle className="h-3.5 w-3.5" /> Missing</>
                      )}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-300 border border-slate-800 break-all max-h-24 overflow-y-auto">
                    {dnsResult.spf?.record || 'No SPF TXT record found'}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {dnsResult.spf?.message || 'Authorizes sending mail servers for this domain.'}
                  </p>
                </div>

                {/* DKIM */}
                <div className="surface-card rounded-xl p-4 space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">DKIM Record</span>
                    <span className={`flex items-center gap-1 text-[11px] font-medium ${
                      dnsResult.dkim?.valid ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {dnsResult.dkim?.valid ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Aligned</>
                      ) : (
                        <><AlertTriangle className="h-3.5 w-3.5" /> {dnsResult.dkim?.selector ? 'Not Found' : 'Selector Needed'}</>
                      )}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-300 border border-slate-800 break-all max-h-24 overflow-y-auto">
                    {dnsResult.dkim?.record || 'No public DKIM key detected on default selectors'}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {dnsResult.dkim?.message || 'Cryptographic email signing verification.'}
                  </p>
                </div>

                {/* DMARC */}
                <div className="surface-card rounded-xl p-4 space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">DMARC Policy</span>
                    <span className={`flex items-center gap-1 text-[11px] font-medium ${
                      dnsResult.dmarc?.valid ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {dnsResult.dmarc?.valid ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> {dnsResult.dmarc?.policy || 'Configured'}</>
                      ) : (
                        <><XCircle className="h-3.5 w-3.5" /> Missing</>
                      )}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-300 border border-slate-800 break-all max-h-24 overflow-y-auto">
                    {dnsResult.dmarc?.record || 'No _dmarc TXT record found'}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {dnsResult.dmarc?.message || 'Directs receiving servers how to handle unauthenticated mail.'}
                  </p>
                </div>

                {/* MX */}
                <div className="surface-card rounded-xl p-4 space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">MX Routing</span>
                    <span className={`flex items-center gap-1 text-[11px] font-medium ${
                      dnsResult.mx?.valid ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {dnsResult.mx?.valid ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Verified</>
                      ) : (
                        <><XCircle className="h-3.5 w-3.5" /> Missing</>
                      )}
                    </span>
                  </div>
                  <div className="rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-300 border border-slate-800 break-all max-h-24 overflow-y-auto">
                    {dnsResult.mx?.records && dnsResult.mx.records.length > 0
                      ? dnsResult.mx.records.map((r: any) => `${r.priority} ${r.exchange}`).join(', ')
                      : 'No MX records found'}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {dnsResult.mx?.message || 'Mail exchange routes required for reply synchronization.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Spam Filter Audit Tool */}
          <div className="surface-card rounded-xl p-6">
            <div className="border-b border-slate-800/80 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight">AI Content Spam Auditor</h3>
                <p className="text-xs text-slate-400">Scan cold email copy against SpamAssassin filters, aggressive triggers, and URL traps</p>
              </div>
              <button
                onClick={handleScanContent}
                disabled={isScanning}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isScanning ? 'Auditing Copy...' : 'Run Deliverability Scan'}</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={subjectText}
                    onChange={(e) => setSubjectText(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Body</label>
                  <textarea
                    rows={6}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/60 font-mono"
                  />
                </div>
              </div>

              <div>
                {scanResult ? (
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                      <span className="font-semibold text-slate-200">Deliverability Safety Score:</span>
                      <span
                        className={`font-mono font-bold text-sm tabular-nums ${
                          scanResult.spamScore >= 85
                            ? 'text-emerald-400'
                            : scanResult.spamScore >= 60
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {scanResult.spamScore} / 100
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 leading-relaxed text-xs">
                      {scanResult.advice}
                    </div>

                    {Array.isArray(scanResult.detectedIssues) && scanResult.detectedIssues.length > 0 && (
                      <div>
                        <span className="text-slate-400 text-[11px] block mb-1">Structural &amp; Header Issues:</span>
                        <ul className="space-y-1 text-[11px] text-rose-300">
                          {scanResult.detectedIssues.map((issue: string) => (
                            <li key={issue}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {scanResult.detectedKeywords.length > 0 && (
                      <div>
                        <span className="text-slate-400 text-[11px] block mb-1">Flagged Phrases:</span>
                        <div className="flex flex-wrap gap-1">
                          {scanResult.detectedKeywords.map((k: string) => (
                            <span key={k} className="rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 px-2 py-0.5 text-[10px]">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <FileSearch className="h-8 w-8 mb-2 opacity-50" />
                    <span>Click "Run Deliverability Scan" to evaluate email copy deliverability.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JOB DETAILS MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-lg w-full space-y-4 shadow-2xl text-slate-100 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Sending Job Payload & Diagnostics</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recipient: <span className="font-mono text-slate-200">{selectedJob.leadEmail}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Status</span>
                <span className="font-mono font-semibold text-slate-200 uppercase">{selectedJob.status}</span>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Attempts</span>
                <span className="font-mono font-semibold text-slate-200">
                  {selectedJob.attempts} / {selectedJob.maxAttempts}
                </span>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Mailbox</span>
                <span className="font-mono text-slate-200 truncate block">
                  {selectedJob.mailboxEmail || 'Load Balanced'}
                </span>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
                <span className="text-[10px] font-mono uppercase text-slate-500 block">Scheduled At</span>
                <span className="font-mono text-slate-200">
                  {new Date(selectedJob.scheduledAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-500">Idempotency Key</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(selectedJob.idempotencyKey || '');
                    setCopiedIdempotency(true);
                    setTimeout(() => setCopiedIdempotency(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  {copiedIdempotency ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedIdempotency ? 'Copied' : 'Copy Key'}</span>
                </button>
              </div>
              <p className="font-mono text-[11px] text-slate-300 break-all">{selectedJob.idempotencyKey}</p>
            </div>

            {selectedJob.lastError && (
              <div className="rounded-lg bg-rose-950/30 border border-rose-500/30 p-3 space-y-1 text-xs">
                <span className="text-[10px] font-mono uppercase text-rose-400 block">Last Error</span>
                <p className="font-mono text-rose-200 break-words">{selectedJob.lastError}</p>
              </div>
            )}

            <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 space-y-1.5 text-xs">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Rendered Message</span>
              <p className="font-semibold text-white">{selectedJob.subject}</p>
              <p className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                {selectedJob.body}
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
