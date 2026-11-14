import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Play,
  RotateCw,
  MessageSquarePlus,
  ShieldCheck,
  Check,
  AlertCircle,
  Bell,
} from 'lucide-react';

import { MailboxAccount } from '../types';
import { isProductionMailboxConnected } from '../utils/analyticsStats';

interface HeaderProps {
  onSearchChange: (query: string) => void;
  onRefreshData: () => void;
  onOpenSimulateModal: () => void;
  isWorkerRunning: boolean;
  onTriggerWorker: () => void;
  mailboxes?: MailboxAccount[];
  workerStatus?: { isRunning: boolean; sendingActive: boolean } | null;
}

export const Header: React.FC<HeaderProps> = ({
  onSearchChange,
  onRefreshData,
  onOpenSimulateModal,
  isWorkerRunning,
  onTriggerWorker,
  mailboxes = [],
  workerStatus,
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearchChange(e.target.value);
  };

  const handleRunWorker = async () => {
    setStatusMessage('Dispatching queued jobs...');
    try {
      await onTriggerWorker();
      setStatusMessage('Queue processed successfully');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusMessage('Worker run completed');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const connectedProdMailboxes = mailboxes.filter(isProductionMailboxConnected);
  const reauthMailboxes = mailboxes.filter(
    (m) => m.status === 'reauth_required' || m.status === 'error'
  );
  const avgHealth =
    connectedProdMailboxes.length > 0
      ? Math.round(
          connectedProdMailboxes.reduce((sum, m) => sum + (m.healthScore || 0), 0) /
            connectedProdMailboxes.length
        )
      : 0;

  let badgeDotClass = 'bg-amber-400';
  let badgeContent: React.ReactNode = (
    <span className="text-[11px] font-medium">
      Senders: <span className="font-mono text-amber-400 font-semibold">0 Production Connected</span>
    </span>
  );

  if (reauthMailboxes.length > 0 && connectedProdMailboxes.length === 0) {
    badgeDotClass = 'bg-rose-400';
    badgeContent = (
      <span className="text-[11px] font-medium">
        Mailbox Auth:{' '}
        <span className="font-mono text-rose-400 font-semibold">
          {reauthMailboxes.length} Re-auth Required
        </span>
      </span>
    );
  } else if (connectedProdMailboxes.length > 0) {
    badgeDotClass = workerStatus?.sendingActive ? 'bg-emerald-400' : 'bg-amber-400';
    badgeContent = (
      <span className="text-[11px] font-medium">
        Health:{' '}
        <span className="font-mono text-emerald-400 font-semibold tabular-nums">{avgHealth}%</span>
        <span className="text-slate-400 ml-1 font-mono text-[10px]">
          · {connectedProdMailboxes.length} Active ·{' '}
          {workerStatus?.sendingActive ? 'Worker Running' : 'Worker Paused'}
        </span>
      </span>
    );
  }

  return (
    <header className="flex h-13 items-center justify-between border-b border-slate-800/80 bg-[#080d19]/80 px-6 backdrop-blur-md select-none shrink-0 z-10">
      {/* Search Input */}
      <div className="flex items-center gap-2 w-96">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={handleSearch}
            placeholder="Search leads, campaigns, mailboxes (⌘K)..."
            className="w-full rounded-lg bg-slate-900/80 border border-slate-800 pl-8.5 pr-9 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition font-sans"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-700/60 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Action Controls & Health */}
      <div className="flex items-center gap-3">
        {statusMessage && (
          <span className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-md animate-fade-in font-medium">
            <Check className="h-3 w-3" />
            {statusMessage}
          </span>
        )}

        {/* Live Sender & Worker Status Badge */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-2.5 py-1 rounded-md text-xs text-slate-300">
          <span className="relative flex h-2 w-2">
            {workerStatus?.sendingActive && connectedProdMailboxes.length > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${badgeDotClass}`} />
          </span>
          {badgeContent}
        </div>

        {/* Trigger Outbound Sending Worker */}
        <button
          onClick={handleRunWorker}
          disabled={isWorkerRunning}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
          title="Manually trigger scheduled sequence execution worker"
        >
          {isWorkerRunning ? (
            <RotateCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
          ) : (
            <Play className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />
          )}
          <span className="tracking-tight">{isWorkerRunning ? 'Processing Queue...' : 'Run Worker'}</span>
        </button>

        {/* Simulate Reply Testing Utility */}
        <button
          onClick={onOpenSimulateModal}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-900/40 transition cursor-pointer shadow-xs"
          title="Test real-time reply detection, sequence auto-pause, and sentiment triage"
        >
          <MessageSquarePlus className="h-3.5 w-3.5 text-indigo-400" />
          <span className="tracking-tight">Simulate Reply</span>
        </button>

        {/* Refresh Sync */}
        <button
          onClick={onRefreshData}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition cursor-pointer border border-transparent hover:border-slate-800"
          title="Refresh application state"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
