import React, { useState, useEffect } from 'react';
import { ShieldAlert, Pause, Trash2, Power, AlertTriangle } from 'lucide-react';

interface WorkerStatus {
  isRunning: boolean;
  sendingActive: boolean;
}

interface SafetyControlBarProps {
  onRefresh: () => void;
  onStatusChange?: (status: WorkerStatus) => void;
}

export const SafetyControlBar: React.FC<SafetyControlBarProps> = ({ onRefresh, onStatusChange }) => {
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKillModal, setShowKillModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/worker/status');
      if (res.ok) {
        const data = await res.json();
        const nextStatus = { isRunning: Boolean(data.isRunning), sendingActive: Boolean(data.sendingActive) };
        setWorkerStatus(nextStatus);
        onStatusChange?.(nextStatus);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const showNotice = (text: string, isError = false, timeout = 4000) => {
    setActionFeedback({ text, isError });
    setTimeout(() => setActionFeedback(null), timeout);
  };

  const handleToggleWorker = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/worker/toggle', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(data.error || 'Failed to toggle worker dispatch', true);
        return;
      }
      setWorkerStatus((prev) => {
        const next = prev
          ? { ...prev, sendingActive: Boolean(data.sendingActive) }
          : { isRunning: true, sendingActive: Boolean(data.sendingActive) };
        onStatusChange?.(next);
        return next;
      });
      showNotice(data.message || (data.sendingActive ? 'Worker Dispatch resumed' : 'Worker Dispatch paused'));
      onRefresh();
    } catch (e: any) {
      showNotice(e?.message || 'Failed to toggle worker', true);
    } finally {
      setLoading(false);
    }
  };

  const handleKillSwitch = async () => {
    setLoading(true);
    setShowKillModal(false);
    try {
      const res = await fetch('/api/queue/kill-switch', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(data.error || 'Kill switch request failed', true);
        return;
      }
      showNotice(data.message || 'Emergency kill switch engaged', false, 5000);
      await fetchStatus();
      onRefresh();
    } catch (e: any) {
      showNotice(e?.message || 'Kill switch failed', true);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/queue/pause-all', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(data.error || 'Failed to pause campaigns', true);
        return;
      }
      showNotice(data.message || 'All active campaigns paused');
      onRefresh();
    } catch (e: any) {
      showNotice(e?.message || 'Failed to pause campaigns', true);
    } finally {
      setLoading(false);
    }
  };

  const handleClearQueueConfirmed = async () => {
    setLoading(true);
    setShowClearModal(false);
    try {
      const res = await fetch('/api/queue/clear-pending', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(data.error || 'Failed to clear queue', true);
        return;
      }
      showNotice(data.message || 'Pending queue jobs cancelled');
      onRefresh();
    } catch (e: any) {
      showNotice(e?.message || 'Failed to clear queue', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card rounded-xl p-3 px-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Left: Worker status indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {workerStatus?.sendingActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            )}
          </span>
          <span className="font-semibold text-slate-200">
            Worker Dispatch:{' '}
            <span className={workerStatus?.sendingActive ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
              {workerStatus?.sendingActive ? 'Running' : 'Paused'}
            </span>
          </span>
        </div>

        {actionFeedback && (
          <span
            className={`rounded border px-2.5 py-0.5 text-[11px] font-mono animate-in fade-in ${
              actionFeedback.isError
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                : 'bg-slate-900 border-slate-700 text-blue-300'
            }`}
          >
            {actionFeedback.text}
          </span>
        )}
      </div>

      {/* Right: Emergency & Pause Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleToggleWorker}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition font-medium cursor-pointer disabled:opacity-50"
          title="Toggle sending loop active state"
        >
          <Power className="h-3.5 w-3.5 text-slate-400" />
          <span>{workerStatus?.sendingActive ? 'Pause Worker' : 'Resume Worker'}</span>
        </button>

        <button
          onClick={handlePauseAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition font-medium cursor-pointer disabled:opacity-50"
          title="Pause all active & scheduled campaigns"
        >
          <Pause className="h-3.5 w-3.5 text-amber-400" />
          <span>Pause All</span>
        </button>

        <button
          onClick={() => setShowClearModal(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition font-medium cursor-pointer disabled:opacity-50"
          title="Cancel pending jobs in the queue"
        >
          <Trash2 className="h-3.5 w-3.5 text-slate-400" />
          <span>Clear Queue</span>
        </button>

        <button
          onClick={() => setShowKillModal(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
          title="Global Emergency Kill Switch: immediately halts all sending, pauses campaigns, and clears queue"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
          <span>Emergency Kill Switch</span>
        </button>
      </div>

      {/* CLEAR QUEUE CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface-card rounded-2xl border border-amber-500/40 p-6 max-w-md w-full space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clear Pending Queue?</h3>
                <p className="text-xs text-amber-300">Cancels queued and retrying jobs</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to cancel all pending jobs currently waiting in the durable sending queue? Previously delivered logs will remain intact.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearQueueConfirmed}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition cursor-pointer"
              >
                Confirm Clear Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KILL SWITCH CONFIRMATION MODAL */}
      {showKillModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="surface-card rounded-2xl border border-rose-600/50 p-6 max-w-md w-full space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Engage Emergency Kill Switch?</h3>
                <p className="text-xs text-rose-300">Immediate system-wide outreach shutdown</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action will immediately:
            </p>
            <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5 font-mono text-[11px]">
              <li>Halt background worker outbound sending engine</li>
              <li>Pause all active and scheduled campaigns</li>
              <li>Cancel all pending and retrying sending jobs in the queue</li>
            </ul>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowKillModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleKillSwitch}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                Confirm Emergency Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
