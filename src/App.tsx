import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavigationItem } from './components/Sidebar';
import { Header } from './components/Header';
import { SimulateReplyModal } from './components/SimulateReplyModal';
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
import { Lead, LeadList, Campaign, MailboxAccount, Conversation, Deal, Automation } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationItem>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [openCreateCampaignWizard, setOpenCreateCampaignWizard] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined);
  const [isWorkerRunning, setIsWorkerRunning] = useState(false);

  // Core Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxAccount[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    try {
      const [leadsRes, listsRes, campsRes, mailboxesRes, inboxRes, crmRes, autoRes] = await Promise.all([
        fetch('/api/leads').then((r) => r.json()),
        fetch('/api/lists').then((r) => r.json()),
        fetch('/api/campaigns').then((r) => r.json()),
        fetch('/api/mailboxes').then((r) => r.json()),
        fetch('/api/inbox').then((r) => r.json()),
        fetch('/api/crm/deals').then((r) => r.json()),
        fetch('/api/automations').then((r) => r.json()),
      ]);

      if (leadsRes.leads) setLeads(leadsRes.leads);
      if (listsRes.lists) setLists(listsRes.lists);
      if (campsRes.campaigns) setCampaigns(campsRes.campaigns);
      if (mailboxesRes.mailboxes) setMailboxes(mailboxesRes.mailboxes);
      if (inboxRes.conversations) setConversations(inboxRes.conversations);
      if (crmRes.deals) setDeals(crmRes.deals);
      if (autoRes.automations) setAutomations(autoRes.automations);
    } catch (err) {
      console.error('Failed to load OutboundOS data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
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
    // If user searches and is on a dashboard, switch to leads or inbox
    if (currentTab === 'dashboard') {
      setCurrentTab('leads');
    }
  };

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
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onSearchChange={handleSearchGlobal}
          onRefreshData={fetchAllData}
          onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
          isWorkerRunning={isWorkerRunning}
          onTriggerWorker={handleTriggerWorker}
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
                  onSelectCampaign={(id) => {
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
                />
              )}

              {currentTab === 'leads' && (
                <LeadsPage
                  leads={leads}
                  lists={lists}
                  onRefreshLeads={fetchAllData}
                />
              )}

              {currentTab === 'lists' && (
                <ListsPage
                  lists={lists}
                  onRefreshLists={fetchAllData}
                  onSelectList={(listId) => {
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
                  onRefreshCampaigns={fetchAllData}
                  openCreateWizard={openCreateCampaignWizard}
                  onCloseCreateWizard={() => setOpenCreateCampaignWizard(false)}
                />
              )}

              {currentTab === 'mailboxes' && (
                <EmailAccountsPage
                  mailboxes={mailboxes}
                  onRefreshMailboxes={fetchAllData}
                />
              )}

              {currentTab === 'inbox' && (
                <UnifiedInboxPage
                  conversations={conversations}
                  onRefreshInbox={fetchAllData}
                  selectedConversationId={selectedConversationId}
                />
              )}

              {currentTab === 'deliverability' && <DeliverabilityPage />}

              {currentTab === 'warmup' && (
                <WarmupPage
                  mailboxes={mailboxes}
                  onRefreshMailboxes={fetchAllData}
                />
              )}

              {currentTab === 'analytics' && (
                <AnalyticsPage
                  campaigns={campaigns}
                  mailboxes={mailboxes}
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

              {currentTab === 'ai' && <AiAssistantPage />}

              {currentTab === 'integrations' && (
                <IntegrationsPage onRefreshAll={fetchAllData} />
              )}

              {currentTab === 'settings' && <SettingsPage />}
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
