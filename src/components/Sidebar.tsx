import React from 'react';
import {
  LayoutDashboard,
  Users,
  ListFilter,
  Send,
  Mail,
  Inbox,
  ShieldCheck,
  Flame,
  BarChart3,
  KanbanSquare,
  Zap,
  Sparkles,
  Blocks,
  Settings,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

export type NavigationItem =
  | 'dashboard'
  | 'leads'
  | 'lists'
  | 'campaigns'
  | 'mailboxes'
  | 'inbox'
  | 'deliverability'
  | 'warmup'
  | 'analytics'
  | 'crm'
  | 'automations'
  | 'ai'
  | 'integrations'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationItem;
  onSelectTab: (tab: NavigationItem) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  unreadCount: number;
  onOpenCreateCampaign: () => void;
}

const navItems: { id: NavigationItem; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'lists', label: 'Lists & Segments', icon: ListFilter },
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'mailboxes', label: 'Email Accounts', icon: Mail },
  { id: 'inbox', label: 'Unified Inbox', icon: Inbox },
  { id: 'deliverability', label: 'Deliverability', icon: ShieldCheck },
  { id: 'warmup', label: 'Warm-up', icon: Flame },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'crm', label: 'CRM Pipeline', icon: KanbanSquare },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles },
  { id: 'integrations', label: 'Integrations', icon: Blocks },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  unreadCount,
  onOpenCreateCampaign,
}) => {
  return (
    <aside
      className={`relative flex flex-col border-r border-slate-800/80 bg-[#080d19]/95 backdrop-blur-xl transition-all duration-200 select-none z-20 ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-indigo-600 to-cyan-500 shadow-sm ring-1 ring-white/20">
            <Send className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                OutboundOS
                <span className="rounded bg-slate-800 border border-slate-700/80 px-1.5 py-0.2 text-[9px] font-mono font-medium text-slate-300 uppercase tracking-wider">
                  Pro
                </span>
              </span>
              <span className="text-[11px] text-slate-400 truncate">Enterprise Sales Engine</span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 transition cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Workspace Card */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between rounded-lg bg-slate-900/60 border border-slate-800 px-2.5 py-1.5 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-300 truncate">Apex Growth Labs</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      <div className="px-3 py-2.5">
        <button
          onClick={onOpenCreateCampaign}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-600 to-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-blue-500/50 hover:from-blue-500 hover:to-blue-600 transition cursor-pointer"
          title="Create New Campaign"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="tracking-tight">New Campaign</span>}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-[12.5px] transition cursor-pointer ${
                isActive
                  ? 'bg-blue-600/15 text-white font-medium border border-blue-500/25 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
              {!collapsed && item.id === 'inbox' && unreadCount > 0 && (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer & User Profile */}
      <div className="p-3 border-t border-slate-800/80 space-y-2.5 bg-slate-900/40">
        <PWAInstallButton />
        {!collapsed && (
          <div className="flex items-center gap-2.5 pt-1">
            <div className="relative">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
                AK
              </div>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#080d19]" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-medium text-slate-200 truncate">Azeem Khawer</span>
              <span className="text-[10px] text-slate-500 truncate font-mono">owner@apexoutbound.io</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
