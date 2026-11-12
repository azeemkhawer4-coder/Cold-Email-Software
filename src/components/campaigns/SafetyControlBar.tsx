import React, { useState, useEffect } from 'react';
import { ShieldAlert, Pause, Trash2, Power, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface SafetyControlBarProps {
  onRefresh: () => void;
}

export const SafetyControlBar: React.FC<SafetyControlBarProps> = ({ onRefresh }) => {
  const [workerStatus, setWorkerStatus] = useState<{ isRunning: boolean; sendingActive: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKillModal, setShowKillModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/worker/status');
      if (res.ok) {
        const data = await res.json();
        setWorkerStatus({ isRunning: data.isRunning, sendingActive: data.sendingActive });
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleWorker = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/worker/toggle', { method: 'POST' });
      const data = await res.json();
      setWorkerStatus((prev) => prev ? { ...prev, sendingActive: data.sendingActive } : null);
      setActionFeedback(data.message);
      setTimeout(() => setActionFeedback(null), 4000);
      onRefresh();
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleKillSwitch = async () => {
    setLoading(true);
    setShowKillModal(false);
    try {
      const res = await fetch('/api/queue/kill-switch', { method: 'POST' });
      const data = await res.json();
      setActionFeedback(data.message);
      setTimeout(() => setActionFeedback(null), 5000);
      await fetchStatus();
      onRefresh();
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/queue/pause-all', { method: 'POST' });
      const data = await res.json();
      setActionFeedback(data.message);
      setTimeout(() => setActionFeedback(null), 4000);
      onRefresh();
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearQueue = async () => {
    if (!window.confirm('Are you sure you want to cancel all pending jobs in the sending queue?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/queue/clear-pending', { method: 'POST' });
      const data = await res.json();
      setActionFeedback(data.message);
      setTimeout(() => setActionFeedback(null), 4000);
      onRefresh();
    } catch (e: any) {
      console.error(e);
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
              {workerStatus?.sendingActive ? 'Active (Live Sending)' : 'Standby / Paused'}
            </span>
          </span>
        </div>

        {actionFeedback && (
          <span className="rounded bg-slate-900 border border-slate-700 px-2.5 py-0.5 text-[11px] text-blue-300 font-mono animate-in fade-in">
            {actionFeedback}
          </span>
        )}
      </div>

      {/* Right: Emergency & Pause Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggleWorker}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition font-medium cursor-pointer"
          title="Toggle sending loop active state"
        >
          <Power className="h-3.5 w-3.5 text-slate-400" />
          <span>{workerStatus?.sendingActive ? 'Pause Worker' : 'Resume Worker'}</span>
        </button>

        <button
          onClick={handlePauseAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition font-medium cursor-pointer"
          title="Pause all active & scheduled campaigns"
        >
          <Pause className="h-3.5 w-3.5 text-amber-400" />
          <span>Pause All</span>
        </button>

        <button
          onClick={handleClearQueue}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition font-medium cursor-pointer"
          title="Cancel pending jobs in the queue"
        >
          <Trash2 className="h-3.5 w-3.5 text-slate-400" />
          <span>Clear Queue</span>
        </button>

        <button
          onClick={() => setShowKillModal(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold transition shadow-xs cursor-pointer"
          title="Global Emergency Kill Switch: immediately halts all sending, pauses campaigns, and clears queue"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
          <span>Emergency Kill Switch</span>
        </button>
      </div>

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
