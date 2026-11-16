import React, { useState, useEffect } from 'react';
import { Send, AlertTriangle, X, Clock, Users, Mail, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Campaign } from '../../types';

interface SendNowModalProps {
  campaign: Campaign;
  onClose: () => void;
  onConfirmed: (enqueuedCount: number, message: string) => void;
}

export const SendNowModal: React.FC<SendNowModalProps> = ({ campaign, onClose, onConfirmed }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/campaigns/${campaign.id}/prelaunch-summary`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load pre-launch diagnostic summary');
        if (isMounted) setSummary(data);
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [campaign.id]);

  const handleConfirmSendNow = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/send-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to initiate campaign sending');
      }

      if (data.batchResult?.processedCount > 0 || data.enqueuedCount > 0) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      }

      onConfirmed(data.enqueuedCount, data.message);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-lg w-full space-y-5 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Confirm Immediate Send</h3>
              <p className="text-xs text-slate-400">Review sequence recipients and dispatch parameters before launching</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center space-y-2">
            <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Running pre-launch recipient & deliverability checks...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Diagnostic check warning</span>
            </div>
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Campaign Name & Subject preview */}
            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-semibold text-white truncate max-w-xs">{summary.campaignName}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Ready to send
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                <span className="text-slate-500">Step 1 Subject: </span>
                <span className="text-slate-200 font-medium font-sans">"{summary.firstStepSubject}"</span>
              </div>
            </div>

            {/* Recipient breakdown grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Eligible Recipients</span>
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  {summary.eligibleCount}
                </div>
                <p className="text-[10px] text-slate-500">Passed unsubscribe & bounce filters</p>
              </div>

              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Excluded Leads</span>
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-slate-300 tabular-nums">
                  {summary.excludedCount.total}
                </div>
                <p className="text-[10px] text-slate-500">
                  {summary.excludedCount.replied} replied, {summary.excludedCount.unsubscribed} unsub, {summary.excludedCount.bounced} bounce
                </p>
              </div>
            </div>

            {/* Dispatch details */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-3 space-y-2 text-[11px]">
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-400 flex items-center gap-1.5 shrink-0">
                  <Mail className="h-3.5 w-3.5 text-blue-400" /> Connected Mailboxes:
                </span>
                <div className="flex flex-wrap items-center justify-end gap-1.5 font-mono text-white font-medium">
                  {summary.connectedMailboxes.length > 0 ? (
                    summary.connectedMailboxes.map((m: any) => (
                      <span key={m.id || m.email} className="inline-flex items-center gap-1">
                        <span>{m.email}</span>
                        {m.isTestMailbox && (
                          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 text-[9px] text-amber-300">
                            TEST RIG
                          </span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-rose-400">None connected (Required)</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" /> Estimated Duration:
                </span>
                <span className="font-mono text-slate-200">
                  ~{summary.estimatedDurationMinutes} minutes ({summary.timezone})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Delivery Format:</span>
                <span className="font-mono text-slate-200">
                  {summary.plainTextOnly ? 'Plain Text (High Inbox Placement)' : 'Clean Multipart HTML + Plain Text'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Open Rate Tracking:</span>
                <span
                  className={`font-mono ${
                    summary.openTrackingActive
                      ? 'text-emerald-400'
                      : summary.trackOpens && !summary.plainTextOnly
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {summary.plainTextOnly
                    ? 'Off (Plain-Text Mode)'
                    : !summary.trackOpens
                    ? 'Disabled in Campaign'
                    : summary.openTrackingActive
                    ? `Active (${summary.trackingBaseUrl})`
                    : 'Paused (Needs Public HTTPS URL)'}
                </span>
              </div>
            </div>

            {summary.trackOpens && !summary.plainTextOnly && !summary.openTrackingActive && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200 text-[11px] leading-relaxed">
                Open-tracking pixel skipped for localhost to protect Gmail primary-inbox placement. Set a public HTTPS Tracking URL in <strong>Settings</strong> (e.g. Cloudflare Tunnel) to record live open rates externally.
              </div>
            )}

            {summary.connectedMailboxes.length === 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>No active connected mailboxes assigned. Connect or reconnect a sending account in Email Accounts first.</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSendNow}
            disabled={isSubmitting || loading || (summary && summary.eligibleCount === 0) || (summary && summary.connectedMailboxes.length === 0)}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Starting Outreach...' : 'Confirm and Send Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
