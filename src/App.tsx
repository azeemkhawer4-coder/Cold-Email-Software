import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavigationItem } from './components/Sidebar';
import { Header } from './components/Header';
import { SimulateReplyModal } from './components/SimulateReplyModal';
import { LocalAuthModal } from './components/LocalAuthModal';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { ListsPage } from './pages/ListsPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { EmailAccountsPage } from './pages/EmailAccountsPage';
import { UnifiedInboxPage } from './pages/UnifiedInboxPage';
import { DeliverabilityPage } from './pages/DeliverabilityPage';
import { WarmupPage } from './pages/WarmupPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { CrmPage } from './pages/CrmPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  Lead,
  LeadList,
  Campaign,
  MailboxAccount,
  Conversation,
  Deal,
  Automation,
  SendingJob,
  WorkspaceSettings,
  ZeroCostStatus,
} from './types';
import {
  parseOAuthHashRoute,
  getGoogleOAuthFeedback,
  OAuthFeedback,
} from './utils/oauthHash';

const LOCAL_UNLOCK_KEY = 'outboundos_local_unlocked';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationItem>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const parsed = parseOAuthHashRoute(window.location.hash);
    return (parsed.tab as NavigationItem) || 'dashboard';
  });
  const [oauthFeedback, setOAuthFeedback] = useState<OAuthFeedback | null>(() => {
    if (typeof window === 'undefined') return null;
    const parsed = parseOAuthHashRoute(window.location.hash);
    return getGoogleOAuthFeedback(parsed);
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [openCreateCampaignWizard, setOpenCreateCampaignWizard] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined);
  const [selectedLeadListFilter, setSelectedLeadListFilter] = useState<string | undefined>(undefined);
  const [isWorkerRunning, setIsWorkerRunning] = useState(false);

  // Core Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxAccount[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [sendingJobs, setSendingJobs] = useState<SendingJob[]>([]);
  const [workerStatus, setWorkerStatus] = useState<{ isRunning: boolean; sendingActive: boolean } | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceSettings | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<ZeroCostStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth Gate State
  const [authStatus, setAuthStatus] = useState<{ isSetup: boolean; authenticated: boolean; user?: any } | null>(null);
  const [localUnlocked, setLocalUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(LOCAL_UNLOCK_KEY) === 'true';
  });
  const [forceAuthSetup, setForceAuthSetup] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/lists'),
        fetch('/api/campaigns'),
        fetch('/api/mailboxes'),
        fetch('/api/inbox'),
        fetch('/api/crm/deals'),
        fetch('/api/automations'),
        fetch('/api/queue'),
        fetch('/api/worker/status'),
        fetch('/api/workspace'),
        fetch('/api/budget/status'),
      ]);

      if (responses.some((r) => r.status === 401)) {
        setAuthStatus((prev) => (prev ? { ...prev, authenticated: false } : { isSetup: true, authenticated: false }));
        setIsLoading(false);
        return;
      }

      const [
        leadsRes,
        listsRes,
        campsRes,
        mailboxesRes,
        inboxRes,
        crmRes,
        autoRes,
        queueRes,
        workerRes,
        workspaceRes,
        budgetRes,
      ] = await Promise.all(
        responses.map((r) => (r.ok ? r.json().catch(() => ({})) : Promise.resolve({})))
      );

      if (leadsRes.leads) setLeads(leadsRes.leads);
      if (listsRes.lists) setLists(listsRes.lists);
      if (campsRes.campaigns) setCampaigns(campsRes.campaigns);
      if (mailboxesRes.mailboxes) setMailboxes(mailboxesRes.mailboxes);
      if (inboxRes.conversations) setConversations(inboxRes.conversations);
      if (crmRes.deals) setDeals(crmRes.deals);
      if (autoRes.automations) setAutomations(autoRes.automations);
      if (queueRes.jobs) setSendingJobs(queueRes.jobs);
      if (typeof workerRes.sendingActive === 'boolean') {
        setWorkerStatus({
          isRunning: Boolean(workerRes.isRunning),
          sendingActive: workerRes.sendingActive,
        });
      }
      if (workspaceRes.workspace) setWorkspace(workspaceRes.workspace);
      if (budgetRes && typeof budgetRes.monthlyOperatingCost === 'number') setBudgetStatus(budgetRes);
    } catch (err) {
      console.error('Failed to load OutboundOS data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
        const canAccess = data.isSetup ? data.authenticated : localUnlocked;
        if (canAccess) {
          fetchAllData();
        } else {
          setIsLoading(false);
        }
      } else {
        setAuthStatus({ isSetup: false, authenticated: false });
        if (localUnlocked) {
          fetchAllData();
        } else {
          setIsLoading(false);
        }
      }
    } catch {
      setAuthStatus({ isSetup: false, authenticated: false });
      setIsLoading(false);
    }
  }, [fetchAllData, localUnlocked]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle hash redirects from OAuth callbacks (e.g. /#mailboxes?connected=google)
  useEffect(() => {
    const syncHashRoute = () => {
      if (typeof window === 'undefined') return;
      const parsed = parseOAuthHashRoute(window.location.hash);
      if (parsed.tab) {
        setCurrentTab(parsed.tab as NavigationItem);
      }
      const feedback = getGoogleOAuthFeedback(parsed);
      if (feedback) {
        setOAuthFeedback(feedback);
        if (parsed.connected === 'google') {
          fetchAllData();
        }
        window.history.replaceState(null, '', `#${parsed.tab || 'mailboxes'}`);
      }
    };

    syncHashRoute();
    window.addEventListener('hashchange', syncHashRoute);
    return () => window.removeEventListener('hashchange', syncHashRoute);
  }, [fetchAllData]);

  const handleTriggerWorker = async () => {
    setIsWorkerRunning(true);
    try {
      await fetch('/api/worker/run-now', { method: 'POST' });
      await fetchAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsWorkerRunning(false);
    }
  };

  const handleSearchGlobal = (query: string) => {
    if (!query) return;
    if (currentTab === 'dashboard') {
      setCurrentTab('leads');
    }
  };

  const handleAuthSuccess = (user: any) => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCAL_UNLOCK_KEY);
    }
    setLocalUnlocked(true);
    setForceAuthSetup(false);
    setAuthStatus({ isSetup: true, authenticated: true, user });
    setIsLoading(true);
    fetchAllData();
  };

  const handleContinueLocal = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_UNLOCK_KEY, 'true');
    }
    setLocalUnlocked(true);
    setForceAuthSetup(false);
    setIsLoading(true);
    fetchAllData();
  };

  const handleSignedOut = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LOCAL_UNLOCK_KEY);
    }
    setLocalUnlocked(false);
    setForceAuthSetup(false);
    setAuthStatus({ isSetup: true, authenticated: false });
  };

  // Show standalone loading gate while initial /api/auth/status is resolving
  if (authStatus === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070b14] text-slate-400 text-xs gap-2">
        <span className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <span>Verifying OutboundOS Local Session...</span>
      </div>
    );
  }

  // Standalone Auth Gate: never render Sidebar/Header/Dashboard data underneath when gated
  const needsAuthGate = forceAuthSetup || (authStatus.isSetup ? !authStatus.authenticated : !localUnlocked);
  if (needsAuthGate) {
    return (
      <LocalAuthModal
        isSetup={forceAuthSetup ? false : authStatus.isSetup}
        onAuthSuccess={handleAuthSuccess}
        onContinueLocal={!authStatus.isSetup ? handleContinueLocal : undefined}
      />
    );
  }

  const unreadCount = conversations.filter((c) => c.status === 'unread').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
      {/* Collapsible Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        unreadCount={unreadCount}
        onOpenCreateCampaign={() => {
          setCurrentTab('campaigns');
          setOpenCreateCampaignWizard(true);
        }}
        workspace={workspace}
        currentUser={authStatus.user || null}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onSearchChange={handleSearchGlobal}
          onRefreshData={fetchAllData}
          onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
          isWorkerRunning={isWorkerRunning}
          onTriggerWorker={handleTriggerWorker}
          mailboxes={mailboxes}
          workerStatus={workerStatus}
        />

        <main className="flex-1 flex overflow-hidden relative">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <span>Loading OutboundOS Workspace...</span>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardPage
                  leads={leads}
                  campaigns={campaigns}
                  mailboxes={mailboxes}
                  conversations={conversations}
                  sendingJobs={sendingJobs}
                  deals={deals}
                  workerStatus={workerStatus}
                  onSelectCampaign={() => {
                    setCurrentTab('campaigns');
                  }}
                  onOpenConversation={(id) => {
                    setSelectedConversationId(id);
                    setCurrentTab('inbox');
                  }}
                  onOpenCreateCampaign={() => {
                    setCurrentTab('campaigns');
                    setOpenCreateCampaignWizard(true);
                  }}
                  onNavigateTab={(tab) => setCurrentTab(tab)}
                />
              )}

              {currentTab === 'leads' && (
                <LeadsPage
                  leads={leads}
                  lists={lists}
                  selectedListId={selectedLeadListFilter}
                  onClearListFilter={() => setSelectedLeadListFilter(undefined)}
                  onRefreshLeads={fetchAllData}
                />
              )}

              {currentTab === 'lists' && (
                <ListsPage
                  lists={lists}
                  leads={leads}
                  onRefreshLists={fetchAllData}
                  onSelectList={(listId) => {
                    setSelectedLeadListFilter(listId);
                    setCurrentTab('leads');
                  }}
                />
              )}

              {currentTab === 'campaigns' && (
                <CampaignsPage
                  campaigns={campaigns}
                  lists={lists}
                  mailboxes={mailboxes}
                  leads={leads}
                  workspace={workspace}
                  workerStatus={workerStatus}
                  onRefreshCampaigns={fetchAllData}
                  onNavigateToMailboxes={() => setCurrentTab('mailboxes')}
                  onNavigateToDeliverability={() => setCurrentTab('deliverability')}
                  openCreateWizard={openCreateCampaignWizard}
                  onCloseCreateWizard={() => setOpenCreateCampaignWizard(false)}
                />
              )}

              {currentTab === 'mailboxes' && (
                <EmailAccountsPage
                  mailboxes={mailboxes}
                  onRefreshMailboxes={fetchAllData}
                  oauthFeedback={oauthFeedback}
                  onClearOAuthFeedback={() => setOAuthFeedback(null)}
                />
              )}

              {currentTab === 'inbox' && (
                <UnifiedInboxPage
                  conversations={conversations}
                  onRefreshInbox={fetchAllData}
                  selectedConversationId={selectedConversationId}
                />
              )}

              {currentTab === 'deliverability' && (
                <DeliverabilityPage
                  campaigns={campaigns}
                  onRefreshAll={fetchAllData}
                />
              )}

              {currentTab === 'warmup' && (
                <WarmupPage
                  mailboxes={mailboxes}
                  onRefreshMailboxes={fetchAllData}
                  onNavigateToDeliverability={() => setCurrentTab('deliverability')}
                />
              )}

              {currentTab === 'analytics' && (
                <AnalyticsPage
                  campaigns={campaigns}
                  mailboxes={mailboxes}
                  leads={leads}
                  conversations={conversations}
                  sendingJobs={sendingJobs}
                  deals={deals}
                />
              )}

              {currentTab === 'crm' && (
                <CrmPage
                  deals={deals}
                  leads={leads}
                  onRefreshDeals={fetchAllData}
                />
              )}

              {currentTab === 'automations' && (
                <AutomationsPage
                  automations={automations}
                  onRefreshAutomations={fetchAllData}
                />
              )}

              {currentTab === 'ai' && <AiAssistantPage budgetStatus={budgetStatus} />}

              {currentTab === 'integrations' && (
                <IntegrationsPage
                  mailboxes={mailboxes}
                  budgetStatus={budgetStatus}
                  onRefreshAll={fetchAllData}
                />
              )}

              {currentTab === 'settings' && (
                <SettingsPage
                  authStatus={authStatus}
                  onRequireAuthSetup={() => setForceAuthSetup(true)}
                  onWorkspaceUpdated={fetchAllData}
                  onSignedOut={handleSignedOut}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Interactive Reply Simulator Modal */}
      <SimulateReplyModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        leads={leads}
        onReplySimulated={fetchAllData}
      />
    </div>
  );
}
