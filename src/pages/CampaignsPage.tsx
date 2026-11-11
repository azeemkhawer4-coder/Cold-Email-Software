import React, { useState } from 'react';
import {
  Send,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit3,
  Calendar,
  Clock,
  Mail,
  Sparkles,
  Users,
  CheckCircle2,
  Split,
  ChevronRight,
  ArrowRight,
  Check,
  X,
  RotateCcw,
  Eye,
  Sliders,
  ShieldCheck,
  GitFork,
  AlertCircle,
  Copy,
  ChevronLeft,
  Settings,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Campaign, CampaignStep, LeadList, MailboxAccount, Lead, EmailVariant } from '../types';
import { interpolateTemplate } from '../utils/templateEngine';

interface CampaignsPageProps {
  campaigns: Campaign[];
  lists: LeadList[];
  mailboxes: MailboxAccount[];
  leads: Lead[];
  onRefreshCampaigns: () => void;
  openCreateWizard: boolean;
  onCloseCreateWizard: () => void;
}

export const CampaignsPage: React.FC<CampaignsPageProps> = ({
  campaigns,
  lists,
  mailboxes,
  leads,
  onRefreshCampaigns,
  openCreateWizard,
  onCloseCreateWizard,
}) => {
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(openCreateWizard);
  const [campaignToDelete, setCampaignToDelete] = useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    setIsBuilderOpen(openCreateWizard);
  }, [openCreateWizard]);

  const handleLaunchCampaign = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/launch`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        onRefreshCampaigns();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePauseCampaign = async (id: string) => {
    try {
      await fetch(`/api/campaigns/${id}/pause`, { method: 'POST' });
      onRefreshCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCampaign = (id: string, name: string) => {
    setCampaignToDelete({ id, name });
  };

  const confirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      await fetch(`/api/campaigns/${campaignToDelete.id}`, { method: 'DELETE' });
      setCampaignToDelete(null);
      onRefreshCampaigns();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenNewWizard = () => {
    setEditingCampaign(null);
    setIsBuilderOpen(true);
  };

  const handleCloseWizard = () => {
    setIsBuilderOpen(false);
    setEditingCampaign(null);
    onCloseCreateWizard();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Outreach Campaigns & Sequences
            <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20">
              {campaigns.length} Total
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated multi-step cold email sequences, conditional branching, A/B testing variants, and sender rotation.
          </p>
        </div>

        <button
          onClick={handleOpenNewWizard}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Create Campaign</span>
        </button>
      </div>

      {/* Autonomous Background Worker Status */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2.5 text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>
            <strong className="text-white">Autonomous Background Worker Active:</strong> Campaigns execute on schedule whenever OutboundOS is running locally, even when this browser tab is closed.
          </span>
        </div>
        <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
          $0.00 Relay Fees (Direct Provider Dispatch)
        </span>
      </div>

      {/* Campaigns Listing Table */}
      <div className="surface-card rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#090e1a]/95 backdrop-blur-md border-b border-slate-800 text-slate-400 select-none">
            <tr>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Campaign Name</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Status</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Sequence Structure</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Enrolled</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Sent</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Replies</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300">Meetings</th>
              <th className="py-2.5 px-4 font-semibold text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {(campaigns || []).map((camp) => {
              const campSteps = camp.steps || (camp as any).sequenceSteps || [];
              const emailStepsCount = campSteps.filter((s: any) => s.type === 'email').length;
              const hasConditions = campSteps.some((s: any) => s.type === 'condition');
              const hasVariants = campSteps.some((s: any) => s.emailData?.variants && s.emailData.variants.length > 1);
              const enrolled = camp.stats?.enrolled ?? camp.stats?.totalLeads ?? 0;
              const sent = camp.stats?.sent ?? camp.stats?.sentCount ?? 0;
              const delivered = camp.stats?.delivered ?? camp.stats?.deliveredCount ?? 0;
              const replied = camp.stats?.replied ?? camp.stats?.replyCount ?? 0;
              const positiveReplies = camp.stats?.positiveReplies ?? camp.stats?.interestedCount ?? 0;
              const meetingsBooked = camp.stats?.meetingsBooked ?? camp.stats?.meetingCount ?? 0;

              return (
                <tr key={camp.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-100 text-sm">{camp.name || 'Untitled Campaign'}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-sm">{camp.description || ''}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                        camp.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : camp.status === 'paused'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${camp.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {camp.status || 'draft'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-300 font-mono tabular-nums">{campSteps.length} Steps</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-blue-400 font-mono">{emailStepsCount} Emails</span>
                      {hasConditions && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/10 px-1.5 py-0.2 text-[9px] font-medium text-purple-400 border border-purple-500/20">
                          <GitFork className="h-2.5 w-2.5" />
                          Branching
                        </span>
                      )}
                      {hasVariants && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-indigo-500/10 px-1.5 py-0.2 text-[9px] font-medium text-indigo-400 border border-indigo-500/20">
                          <Split className="h-2.5 w-2.5" />
                          A/B Tested
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono tabular-nums">{enrolled}</td>
                  <td className="py-3 px-4">
                    <span className="text-slate-100 font-mono font-medium tabular-nums">{sent}</span>
                    <span className="text-slate-500 text-[10px] block font-mono">({delivered} delivered)</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-indigo-400 font-mono font-semibold tabular-nums">{replied}</span>
                    <span className="text-emerald-400 text-[10px] block font-mono font-medium">({positiveReplies} positive)</span>
                  </td>
                  <td className="py-3 px-4 text-emerald-400 font-bold font-mono tabular-nums">{meetingsBooked}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {camp.status === 'active' ? (
                        <button
                          onClick={() => handlePauseCampaign(camp.id)}
                          className="p-1.5 rounded-lg text-amber-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Pause sending"
                        >
                          <Pause className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLaunchCampaign(camp.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition font-medium cursor-pointer"
                          title="Launch live campaign"
                        >
                          <Play className="h-3 w-3 fill-emerald-400" />
                          <span>Launch</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingCampaign(camp);
                          setIsBuilderOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title="Edit campaign & sequence"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                        title="Delete campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CAMPAIGN BUILDER MODAL */}
      {isBuilderOpen && (
        <CampaignBuilderWizard
          campaign={editingCampaign}
          lists={lists}
          mailboxes={mailboxes}
          leads={leads}
          onClose={handleCloseWizard}
          onSaved={() => {
            handleCloseWizard();
            onRefreshCampaigns();
          }}
        />
      )}

      {/* DELETE CAMPAIGN CONFIRMATION MODAL */}
      {campaignToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in duration-150">
            <h3 className="text-base font-bold text-white">Delete Outreach Campaign?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-rose-400">"{campaignToDelete.name}"</span>? Any pending queued email dispatches for this campaign will be permanently cancelled.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCampaignToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCampaign}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
              >
                Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// VISUAL CAMPAIGN BUILDER WIZARD
// ==========================================
interface WizardProps {
  campaign: Campaign | null;
  lists: LeadList[];
  mailboxes: MailboxAccount[];
  leads: Lead[];
  onClose: () => void;
  onSaved: () => void;
}

const CampaignBuilderWizard: React.FC<WizardProps> = ({
  campaign,
  lists,
  mailboxes,
  leads,
  onClose,
  onSaved,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [name, setName] = useState(campaign?.name || 'High-Ticket Enterprise Outreach Q4');
  const [description, setDescription] = useState(campaign?.description || 'Automated multi-step sequence with conditional branching and A/B tested variants');
  const [selectedListId, setSelectedListId] = useState(campaign?.leadListId || lists[0]?.id || '');
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<string[]>(
    campaign?.mailboxAccountIds || mailboxes.map((m) => m.id)
  );

  // Sequence Steps
  const [steps, setSteps] = useState<CampaignStep[]>(
    campaign?.steps || [
      {
        id: `step-${Date.now()}-1`,
        campaignId: '',
        stepNumber: 1,
        type: 'email',
        delayHours: 0,
        emailData: {
          subject: 'Quick question about {{company}} infrastructure',
          body: 'Hi {{first_name | fallback: "there"}},\n\nI noticed your platform initiatives at {{company}}.\n\nWe recently helped several engineering teams cut egress overhead by 34% without modifying their Kubernetes configurations.\n\nGiven your team\'s focus on {{quarterly_priority | fallback: "modernizing platform scale"}}, would you be open to a brief 10-minute exchange this Thursday to review our benchmark data?\n\nBest,\nAzeem',
          variants: [
            {
              id: `var-${Date.now()}-a`,
              name: 'Variant A (Benchmark Proof)',
              subject: 'Quick question about {{company}} infrastructure',
              body: 'Hi {{first_name | fallback: "there"}},\n\nI noticed your platform initiatives at {{company}}.\n\nWe recently helped several engineering teams cut egress overhead by 34% without modifying their Kubernetes configurations.\n\nGiven your team\'s focus on {{quarterly_priority | fallback: "modernizing platform scale"}}, would you be open to a brief 10-minute exchange this Thursday to review our benchmark data?\n\nBest,\nAzeem',
              weight: 50,
              sentCount: 0,
              replyCount: 0,
            },
            {
              id: `var-${Date.now()}-b`,
              name: 'Variant B (Direct ROI)',
              subject: 'Cutting multi-cloud latency at {{company}}',
              body: 'Hi {{first_name | fallback: "there"}},\n\nQuick note regarding infrastructure costs at {{company}}.\n\nWould reducing cross-region data transfer latency by 40% be relevant to your platform roadmap this quarter?\n\nHappy to share our 60-second architecture diagram if you are interested.\n\nBest,\nAzeem',
              weight: 50,
              sentCount: 0,
              replyCount: 0,
            },
          ],
        },
      },
      {
        id: `step-${Date.now()}-2`,
        campaignId: '',
        stepNumber: 2,
        type: 'delay',
        delayHours: 48,
      },
      {
        id: `step-${Date.now()}-3`,
        campaignId: '',
        stepNumber: 3,
        type: 'condition',
        conditionType: 'if_replied',
        delayHours: 0,
        yesStepNumber: 4,
        noStepNumber: 5,
      },
      {
        id: `step-${Date.now()}-4`,
        campaignId: '',
        stepNumber: 4,
        type: 'email',
        delayHours: 0,
        emailData: {
          subject: 'Great to connect! Here is my booking link',
          body: 'Hi {{first_name | fallback: "there"}},\n\nThanks for getting back to me! You can grab whatever 15-minute slot suits your calendar here: https://cal.com/azeem-outbound/15min\n\nLooking forward to speaking.\n\nBest,\nAzeem',
          variants: [],
        },
      },
      {
        id: `step-${Date.now()}-5`,
        campaignId: '',
        stepNumber: 5,
        type: 'email',
        delayHours: 0,
        emailData: {
          subject: 'Re: Quick question about {{company}} infrastructure',
          body: 'Hi {{first_name | fallback: "there"}},\n\nCircling back on this in case my earlier note got buried in your inbox.\n\nHere is a 60-second Loom recording showing the exact workflow: https://outboundos.com/demo\n\nWould 15 minutes next Tuesday or Wednesday work better for your schedule?\n\nBest,\nAzeem',
          variants: [],
        },
      },
    ]
  );

  // Active A/B variant tab index per step index
  const [activeVariantTab, setActiveVariantTab] = useState<Record<number, number>>({});

  // Scheduling State
  const [dailyLimit, setDailyLimit] = useState(campaign?.settings?.dailyLimit || 60);
  const [mailboxRotation, setMailboxRotation] = useState<'round_robin' | 'least_recently_used' | 'balanced'>(
    campaign?.settings?.mailboxRotation || 'balanced'
  );
  const [stopOnReply, setStopOnReply] = useState(campaign?.settings?.stopOnReply !== false);
  const [stopOnUnsubscribe, setStopOnUnsubscribe] = useState(campaign?.settings?.stopOnUnsubscribe !== false);

  const [sendingDays, setSendingDays] = useState<number[]>(
    campaign?.schedule?.sendingDays || [1, 2, 3, 4, 5]
  );
  const [startTime, setStartTime] = useState(campaign?.schedule?.startTime || '08:30');
  const [endTime, setEndTime] = useState(campaign?.schedule?.endTime || '17:30');
  const [timezone, setTimezone] = useState(campaign?.schedule?.timezone || 'America/Los_Angeles');
  const [useRecipientTimezone, setUseRecipientTimezone] = useState(
    campaign?.schedule?.useRecipientTimezone !== false
  );
  const [minIntervalSeconds, setMinIntervalSeconds] = useState(
    campaign?.schedule?.minIntervalSeconds || 60
  );

  // Lead preview selector
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(0);
  const previewLead = leads[selectedLeadIndex] || leads[0] || {
    firstName: 'Alex',
    lastName: 'Rivera',
    fullName: 'Alex Rivera',
    company: 'Stripe',
    jobTitle: 'VP Infrastructure',
    email: 'alex@stripe.com',
    city: 'San Francisco',
    customFields: {
      quarterly_priority: 'latency reduction',
    },
  };

  // Custom Variable helper modal
  const [showCustomVarModal, setShowCustomVarModal] = useState(false);
  const [customVarTargetStepIdx, setCustomVarTargetStepIdx] = useState<number>(0);
  const [customVarField, setCustomVarField] = useState<string>('industry');
  const [customVarFallback, setCustomVarFallback] = useState<string>('your space');

  // AI Generator state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('B2B SaaS VPs of Engineering needing cloud cost reduction');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleToggleMailbox = (id: string) => {
    if (selectedMailboxIds.includes(id)) {
      if (selectedMailboxIds.length === 1) return; // Keep at least one
      setSelectedMailboxIds(selectedMailboxIds.filter((m) => m !== id));
    } else {
      setSelectedMailboxIds([...selectedMailboxIds, id]);
    }
  };

  const handleToggleSendingDay = (day: number) => {
    if (sendingDays.includes(day)) {
      if (sendingDays.length === 1) return; // Keep at least one day
      setSendingDays(sendingDays.filter((d) => d !== day));
    } else {
      setSendingDays([...sendingDays, day].sort());
    }
  };

  // Step Management
  const handleAddEmailStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: CampaignStep = {
      id: `step-${Date.now()}-${newStepNumber}`,
      campaignId: campaign?.id || '',
      stepNumber: newStepNumber,
      type: 'email',
      delayHours: 0,
      emailData: {
        subject: 'Quick follow up regarding {{company}}',
        body: 'Hi {{first_name | fallback: "there"}},\n\nWanted to check in one last time regarding our previous note.\n\nBest,\nAzeem',
        variants: [],
      },
    };
    setSteps([...steps, newStep]);
  };

  const handleAddDelayStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: CampaignStep = {
      id: `step-${Date.now()}-${newStepNumber}`,
      campaignId: campaign?.id || '',
      stepNumber: newStepNumber,
      type: 'delay',
      delayHours: 48,
    };
    setSteps([...steps, newStep]);
  };

  const handleAddConditionStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: CampaignStep = {
      id: `step-${Date.now()}-${newStepNumber}`,
      campaignId: campaign?.id || '',
      stepNumber: newStepNumber,
      type: 'condition',
      conditionType: 'if_replied',
      delayHours: 0,
      yesStepNumber: undefined,
      noStepNumber: undefined,
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    const next = [...steps];
    next.splice(index, 1);
    next.forEach((s, i) => (s.stepNumber = i + 1));
    setSteps(next);
  };

  // A/B Variant Management
  const handleAddVariant = (stepIdx: number) => {
    const step = steps[stepIdx];
    if (!step.emailData) return;

    const currentVariants = step.emailData.variants || [];
    // If no variants existed yet, initialize Variant A from base emailData
    const newVariants: EmailVariant[] = [...currentVariants];
    if (newVariants.length === 0) {
      newVariants.push({
        id: `var-${Date.now()}-a`,
        name: 'Variant A (Original)',
        subject: step.emailData.subject,
        body: step.emailData.body,
        weight: 50,
        sentCount: 0,
        replyCount: 0,
      });
    }

    const nextLetter = String.fromCharCode(65 + newVariants.length);
    newVariants.push({
      id: `var-${Date.now()}-${nextLetter.toLowerCase()}`,
      name: `Variant ${nextLetter}`,
      subject: step.emailData.subject,
      body: step.emailData.body,
      weight: Math.round(100 / (newVariants.length + 1)),
      sentCount: 0,
      replyCount: 0,
    });

    // Re-balance weights evenly
    const evenWeight = Math.floor(100 / newVariants.length);
    newVariants.forEach((v, i) => {
      v.weight = i === newVariants.length - 1 ? 100 - evenWeight * (newVariants.length - 1) : evenWeight;
    });

    const nextSteps = [...steps];
    nextSteps[stepIdx].emailData!.variants = newVariants;
    setSteps(nextSteps);
    setActiveVariantTab({ ...activeVariantTab, [stepIdx]: newVariants.length - 1 });
  };

  const handleRemoveVariant = (stepIdx: number, varIdx: number) => {
    const step = steps[stepIdx];
    if (!step.emailData?.variants) return;

    const nextVariants = [...step.emailData.variants];
    nextVariants.splice(varIdx, 1);

    if (nextVariants.length > 0) {
      const evenWeight = Math.floor(100 / nextVariants.length);
      nextVariants.forEach((v, i) => {
        v.weight = i === nextVariants.length - 1 ? 100 - evenWeight * (nextVariants.length - 1) : evenWeight;
      });
    }

    const nextSteps = [...steps];
    nextSteps[stepIdx].emailData!.variants = nextVariants;
    setSteps(nextSteps);
    setActiveVariantTab({ ...activeVariantTab, [stepIdx]: 0 });
  };

  const handleInsertVariableSnippet = (stepIdx: number, snippet: string) => {
    const nextSteps = [...steps];
    const step = nextSteps[stepIdx];
    if (!step.emailData) return;

    const variants = step.emailData.variants;
    const currentTab = activeVariantTab[stepIdx] || 0;

    if (variants && variants.length > 0 && variants[currentTab]) {
      variants[currentTab].body += ` ${snippet}`;
    } else {
      step.emailData.body += ` ${snippet}`;
    }
    setSteps(nextSteps);
  };

  const handleSaveCampaign = async (launchImmediately = false) => {
    const payload = {
      name,
      description,
      leadListId: selectedListId,
      mailboxAccountIds: selectedMailboxIds,
      schedule: {
        startDate: campaign?.schedule?.startDate || new Date().toISOString().split('T')[0],
        endDate: campaign?.schedule?.endDate,
        sendingDays,
        startTime,
        endTime,
        timezone,
        useRecipientTimezone,
        minIntervalSeconds,
      },
      settings: {
        dailyLimit,
        maxNewLeadsPerDay: 25,
        maxPerDomainPerDay: 2,
        mailboxRotation,
        stopOnReply,
        stopOnUnsubscribe,
        trackOpens: true,
        trackClicks: true,
        plainTextOnly: false,
      },
      steps,
    };

    try {
      let savedCampId = campaign?.id;
      if (campaign?.id) {
        await fetch(`/api/campaigns/${campaign.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        savedCampId = data.campaign.id;
      }

      if (launchImmediately && savedCampId) {
        await fetch(`/api/campaigns/${savedCampId}/launch`, { method: 'POST' });
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      onSaved();
    } catch (err) {
      console.error(err);
    }
  };

  const dayLabels = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 7, label: 'Sun' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-5xl h-[90vh] rounded-2xl bg-[#080d19] border border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Wizard Header & Stepper */}
        <div className="p-4 px-6 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shadow-xs">
              {currentStep}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                {currentStep === 1 && 'Step 1: Campaign Information & Targets'}
                {currentStep === 2 && 'Step 2: Audience, Lists & Compliance Safeguards'}
                {currentStep === 3 && 'Step 3: Multi-Step Visual Sequence & A/B Variants'}
                {currentStep === 4 && 'Step 4: Dispatch Schedule, Multi-Sender Balancing & Safeguards'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {currentStep === 3
                  ? 'Visual flowchart editor with conditional branches and weighted variants'
                  : 'Enterprise outbound automation engine'}
              </p>
            </div>
          </div>

          {/* Stepper Buttons */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => setCurrentStep(s as any)}
                className={`flex h-7 items-center justify-center rounded-lg px-2.5 text-xs font-medium transition cursor-pointer ${
                  currentStep === s
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {s === 1 && '1. Info'}
                {s === 2 && '2. Audience'}
                {s === 3 && '3. Sequence Flow'}
                {s === 4 && '4. Senders & Schedule'}
              </button>
            ))}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Wizard Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#070b14]">
          {/* STEP 1: INFO */}
          {currentStep === 1 && (
            <div className="max-w-xl mx-auto space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2 text-slate-100 text-sm focus:border-blue-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Campaign Goal & Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-slate-100 focus:border-blue-500/60 focus:outline-none"
                />
              </div>

              <div className="surface-card rounded-xl p-4 space-y-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">Assigned Campaign Owner</span>
                <div className="flex items-center gap-2 text-slate-200">
                  <div className="h-6 w-6 rounded-full bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                    AK
                  </div>
                  <span className="font-medium">Azeem Khawer (Workspace Owner)</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: AUDIENCE */}
          {currentStep === 2 && (
            <div className="max-w-xl mx-auto space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Target Prospect List *</label>
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-slate-100 text-sm focus:border-blue-500/60 focus:outline-none"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.leadCount} verified prospects)
                    </option>
                  ))}
                </select>
              </div>

              <div className="surface-card rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
                  Autonomous Protection & Deliverability Rules
                </h4>
                <div className="space-y-2.5 text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Global Suppression Check</span>
                      <span className="text-[11px] text-slate-400">
                        Prospects who previously unsubscribed, requested opt-out, or bounced are suppressed automatically.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Durable Idempotency Keys</span>
                      <span className="text-[11px] text-slate-400">
                        Zero risk of accidental duplicate emails during network reconnects or background restarts.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Sender Health Balancing</span>
                      <span className="text-[11px] text-slate-400">
                        Outreach is distributed across selected connected mailboxes without surpassing provider quotas.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: VISUAL SEQUENCE BUILDER */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    Visual Sequence Flow
                    <span className="text-xs font-mono font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {steps.length} Steps
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Design email touchpoints, delays, conditional decision branches, and weighted A/B variants.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowAiModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/60 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-900/40 transition cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                    <span>AI Copywriter</span>
                  </button>

                  <button
                    onClick={handleAddEmailStep}
                    className="flex items-center gap-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 text-xs font-medium hover:bg-blue-600/30 transition cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>+ Email</span>
                  </button>

                  <button
                    onClick={handleAddDelayStep}
                    className="flex items-center gap-1 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 text-xs font-medium hover:bg-cyan-600/30 transition cursor-pointer"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>+ Delay</span>
                  </button>

                  <button
                    onClick={handleAddConditionStep}
                    className="flex items-center gap-1 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 text-xs font-medium hover:bg-purple-600/30 transition cursor-pointer"
                  >
                    <GitFork className="h-3.5 w-3.5" />
                    <span>+ Condition Branch</span>
                  </button>
                </div>
              </div>

              {/* Prospect Preview Switcher */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-300 font-medium">Live Interpolation Preview:</span>
                  <span className="text-white font-semibold">{previewLead.fullName}</span>
                  <span className="text-slate-400 font-mono">({previewLead.jobTitle} @ {previewLead.company})</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedLeadIndex((prev) => (prev > 0 ? prev - 1 : Math.max(leads.length - 1, 0)))}
                    className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="Previous Prospect"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-slate-400">
                    Lead {selectedLeadIndex + 1} of {Math.max(leads.length, 1)}
                  </span>
                  <button
                    onClick={() => setSelectedLeadIndex((prev) => (prev < leads.length - 1 ? prev + 1 : 0))}
                    className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="Next Prospect"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Steps Flow Nodes */}
              <div className="space-y-4">
                {steps.map((step, idx) => {
                  const variants = step.emailData?.variants || [];
                  const activeVarIdx = activeVariantTab[idx] || 0;
                  const currentVariant = variants[activeVarIdx];

                  return (
                    <div key={step.id} className="relative">
                      {/* Flow Connector Line */}
                      {idx > 0 && (
                        <div className="flex flex-col items-center my-2">
                          <div className="h-4 w-0.5 bg-slate-800" />
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                        </div>
                      )}

                      {/* STEP NODE CARD */}
                      <div
                        className={`surface-card rounded-xl p-4.5 border transition ${
                          step.type === 'condition'
                            ? 'border-purple-500/40 bg-purple-950/10'
                            : step.type === 'delay'
                            ? 'border-cyan-500/30 bg-cyan-950/10'
                            : 'border-slate-800'
                        }`}
                      >
                        {/* Step Header */}
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                                step.type === 'condition'
                                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40'
                                  : step.type === 'delay'
                                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40'
                                  : 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                              }`}
                            >
                              {step.stepNumber}
                            </span>
                            <span className="text-white">
                              {step.type === 'email' && 'Email Touchpoint'}
                              {step.type === 'delay' && 'Wait Delay Window'}
                              {step.type === 'condition' && 'Conditional Branch Rule'}
                            </span>

                            {step.type === 'email' && variants.length > 1 && (
                              <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400 border border-indigo-500/20 font-mono">
                                A/B Test ({variants.map((v) => `${v.weight}%`).join(' / ')})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {step.type === 'email' && (
                              <button
                                onClick={() => handleAddVariant(idx)}
                                className="flex items-center gap-1 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500/50 px-2.5 py-1 text-[11px] font-medium text-indigo-300 transition cursor-pointer"
                              >
                                <Split className="h-3 w-3" />
                                <span>+ Add Variant (A/B)</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleRemoveStep(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Step"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* STEP CONTENT: DELAY */}
                        {step.type === 'delay' && (
                          <div className="flex items-center gap-3 text-xs text-slate-300 py-2">
                            <Clock className="h-4 w-4 text-cyan-400 shrink-0" />
                            <span>Wait for</span>
                            <input
                              type="number"
                              min={1}
                              value={step.delayHours}
                              onChange={(e) => {
                                const next = [...steps];
                                next[idx].delayHours = parseInt(e.target.value) || 24;
                                setSteps(next);
                              }}
                              className="w-20 rounded bg-slate-900 border border-slate-700 px-2.5 py-1 text-center font-mono text-xs text-cyan-200 font-bold focus:outline-none focus:border-cyan-500"
                            />
                            <span>hours ({Math.round(step.delayHours / 24)} days) before evaluating or executing the next step.</span>
                          </div>
                        )}

                        {/* STEP CONTENT: CONDITION */}
                        {step.type === 'condition' && (
                          <div className="space-y-4 py-2 text-xs">
                            <div className="flex items-center gap-3">
                              <label className="text-slate-300 font-medium">Condition Trigger:</label>
                              <select
                                value={step.conditionType || 'if_replied'}
                                onChange={(e) => {
                                  const next = [...steps];
                                  next[idx].conditionType = e.target.value as any;
                                  setSteps(next);
                                }}
                                className="rounded-lg bg-slate-900 border border-purple-500/40 px-3 py-1.5 text-purple-200 font-semibold focus:outline-none"
                              >
                                <option value="if_replied">If Prospect Replied to Any Touchpoint</option>
                                <option value="if_opened">If Prospect Opened Any Previous Email</option>
                                <option value="if_clicked">If Prospect Clicked Link in Previous Email</option>
                              </select>
                            </div>

                            {/* Branch Forking Visual */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                              {/* YES BRANCH */}
                              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                                    <Check className="h-3.5 w-3.5" />
                                    IF YES (Condition Met)
                                  </span>
                                  <span className="text-[10px] text-emerald-500 font-mono">High Intent Path</span>
                                </div>
                                <p className="text-[11px] text-slate-300">
                                  Prospect engaged with outreach. Route immediately to:
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-xs">Target:</span>
                                  <select
                                    value={step.yesStepNumber || ''}
                                    onChange={(e) => {
                                      const next = [...steps];
                                      next[idx].yesStepNumber = e.target.value ? parseInt(e.target.value) : undefined;
                                      setSteps(next);
                                    }}
                                    className="flex-1 rounded bg-slate-900 border border-emerald-500/40 px-2.5 py-1 text-emerald-200 font-mono text-xs focus:outline-none"
                                  >
                                    <option value="">Next Sequential Step (Step {step.stepNumber + 1})</option>
                                    {steps
                                      .filter((s) => s.stepNumber > step.stepNumber)
                                      .map((s) => (
                                        <option key={s.id} value={s.stepNumber}>
                                          Step {s.stepNumber} ({s.type}) {s.emailData?.subject ? `- ${s.emailData.subject.slice(0, 24)}...` : ''}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>

                              {/* NO BRANCH */}
                              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                                    <X className="h-3.5 w-3.5" />
                                    IF NO (Condition Not Met)
                                  </span>
                                  <span className="text-[10px] text-rose-400 font-mono">Cold Follow-up Path</span>
                                </div>
                                <p className="text-[11px] text-slate-300">
                                  No engagement detected within delay window. Route to:
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-xs">Target:</span>
                                  <select
                                    value={step.noStepNumber || ''}
                                    onChange={(e) => {
                                      const next = [...steps];
                                      next[idx].noStepNumber = e.target.value ? parseInt(e.target.value) : undefined;
                                      setSteps(next);
                                    }}
                                    className="flex-1 rounded bg-slate-900 border border-rose-500/40 px-2.5 py-1 text-rose-200 font-mono text-xs focus:outline-none"
                                  >
                                    <option value="">Next Sequential Step (Step {step.stepNumber + 1})</option>
                                    {steps
                                      .filter((s) => s.stepNumber > step.stepNumber)
                                      .map((s) => (
                                        <option key={s.id} value={s.stepNumber}>
                                          Step {s.stepNumber} ({s.type}) {s.emailData?.subject ? `- ${s.emailData.subject.slice(0, 24)}...` : ''}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* STEP CONTENT: EMAIL */}
                        {step.type === 'email' && step.emailData && (
                          <div className="space-y-3.5 pt-2 text-xs">
                            {/* A/B Variant Tabs */}
                            {variants.length > 0 && (
                              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-1.5">
                                  {variants.map((v, vIdx) => (
                                    <button
                                      key={v.id}
                                      onClick={() => setActiveVariantTab({ ...activeVariantTab, [idx]: vIdx })}
                                      className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                                        activeVarIdx === vIdx
                                          ? 'bg-blue-600 text-white shadow-xs'
                                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      <span>{v.name || `Variant ${String.fromCharCode(65 + vIdx)}`}</span>
                                      <span className="rounded bg-black/30 px-1 py-0.2 font-mono text-[10px]">
                                        {v.weight}%
                                      </span>
                                    </button>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-slate-400">Variant Weight:</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={currentVariant?.weight || 50}
                                    onChange={(e) => {
                                      const next = [...steps];
                                      if (next[idx].emailData?.variants[activeVarIdx]) {
                                        next[idx].emailData!.variants[activeVarIdx].weight = parseInt(e.target.value) || 50;
                                      }
                                      setSteps(next);
                                    }}
                                    className="w-14 rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-center font-mono text-xs text-white"
                                  />
                                  <span className="text-slate-500 font-mono">%</span>
                                  {variants.length > 1 && (
                                    <button
                                      onClick={() => handleRemoveVariant(idx, activeVarIdx)}
                                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                                      title="Delete this variant"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Subject Line */}
                            <div>
                              <label className="block text-slate-400 mb-1 font-medium">Subject Line</label>
                              <input
                                type="text"
                                value={currentVariant ? currentVariant.subject : step.emailData.subject}
                                onChange={(e) => {
                                  const next = [...steps];
                                  if (currentVariant) {
                                    next[idx].emailData!.variants[activeVarIdx].subject = e.target.value;
                                  } else {
                                    next[idx].emailData!.subject = e.target.value;
                                  }
                                  setSteps(next);
                                }}
                                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-2 text-slate-100 font-mono text-xs focus:border-blue-500/60 focus:outline-none"
                              />
                            </div>

                            {/* Email Body */}
                            <div>
                              <label className="block text-slate-400 mb-1 font-medium">Email Body</label>
                              <textarea
                                rows={6}
                                value={currentVariant ? currentVariant.body : step.emailData.body}
                                onChange={(e) => {
                                  const next = [...steps];
                                  if (currentVariant) {
                                    next[idx].emailData!.variants[activeVarIdx].body = e.target.value;
                                  } else {
                                    next[idx].emailData!.body = e.target.value;
                                  }
                                  setSteps(next);
                                }}
                                className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-slate-100 font-mono text-xs leading-relaxed focus:border-blue-500/60 focus:outline-none"
                              />
                            </div>

                            {/* Variable Insertion Chips */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 pt-1">
                              <span className="font-mono text-[10px] text-slate-500">Insert tag:</span>
                              {[
                                '{{first_name | fallback: "there"}}',
                                '{{company | fallback: "your company"}}',
                                '{{job_title | fallback: "leader"}}',
                                '{{city | fallback: "your city"}}',
                                '{{quarterly_priority | fallback: "scaling growth"}}',
                              ].map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => handleInsertVariableSnippet(idx, v)}
                                  className="rounded bg-slate-900 border border-slate-800 hover:border-slate-700 px-2 py-0.5 font-mono text-cyan-300 text-[10px] cursor-pointer"
                                >
                                  + {v}
                                </button>
                              ))}

                              <button
                                type="button"
                                onClick={() => {
                                  setCustomVarTargetStepIdx(idx);
                                  setShowCustomVarModal(true);
                                }}
                                className="rounded bg-indigo-950/40 border border-indigo-800/60 hover:bg-indigo-900/40 px-2 py-0.5 font-mono text-indigo-300 text-[10px] cursor-pointer"
                              >
                                + Custom Fallback Tag
                              </button>
                            </div>

                            {/* Live Lead Interpolated Preview */}
                            <div className="rounded-xl bg-slate-950/80 border border-slate-800/90 p-3.5 mt-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-mono">
                                  Rendered Preview for {previewLead.fullName} ({previewLead.company})
                                </span>
                                <span className="text-[10px] font-mono text-emerald-400">
                                  {currentVariant ? currentVariant.name : 'Primary'}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-200 text-xs">
                                {interpolateTemplate(
                                  currentVariant ? currentVariant.subject : step.emailData.subject,
                                  previewLead
                                )}
                              </p>
                              <p className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                                {interpolateTemplate(
                                  currentVariant ? currentVariant.body : step.emailData.body,
                                  previewLead
                                )}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: SENDERS & SCHEDULE */}
          {currentStep === 4 && (
            <div className="max-w-2xl mx-auto space-y-5 text-xs">
              {/* Connected Mailboxes Selection */}
              <div className="surface-card rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight">Active Connected Mailbox Senders</h3>
                    <p className="text-xs text-slate-400">
                      Outreach is load-balanced across selected accounts to safeguard deliverability.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {selectedMailboxIds.length} Senders Active
                  </span>
                </div>

                <div className="space-y-2">
                  {mailboxes.map((mb) => {
                    const isChecked = selectedMailboxIds.includes(mb.id);
                    return (
                      <div
                        key={mb.id}
                        onClick={() => handleToggleMailbox(mb.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                          isChecked
                            ? 'bg-blue-600/15 border-blue-500/40 text-blue-200 shadow-xs'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="rounded border-slate-700 text-blue-600 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">{mb.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase">({mb.provider})</span>
                              {mb.isTestMailbox && (
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-mono text-amber-400 border border-amber-500/20">
                                  Test Mailbox
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">{mb.email}</span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-slate-300 font-medium block tabular-nums">
                            {mb.sentToday} / {mb.dailyLimit} sent today
                          </span>
                          <span className="text-emerald-400 text-[10px]">Health: {mb.healthScore}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mailbox Rotation Strategy */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Rotation Strategy</label>
                    <select
                      value={mailboxRotation}
                      onChange={(e) => setMailboxRotation(e.target.value as any)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                    >
                      <option value="balanced">Balanced Quota (Recommended)</option>
                      <option value="round_robin">Fair Round-Robin</option>
                      <option value="least_recently_used">Least-Recently-Used</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Daily Campaign Limit</label>
                    <input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(parseInt(e.target.value) || 50)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Weekly Dispatch Schedule & Window */}
              <div className="surface-card rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white tracking-tight">Weekly Dispatch Schedule Window</h3>

                {/* Day of Week Chips */}
                <div>
                  <label className="block text-slate-400 mb-1.5">Sending Days</label>
                  <div className="flex items-center gap-2">
                    {dayLabels.map(({ day, label }) => {
                      const isActive = sendingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleSendingDay(day)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold font-mono transition cursor-pointer border ${
                            isActive
                              ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Window & Timezone */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">End Time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-slate-100 font-mono text-[11px]"
                    >
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="UTC">UTC Universal</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useRecipientTimezone}
                      onChange={(e) => setUseRecipientTimezone(e.target.checked)}
                      className="rounded border-slate-700 text-blue-600"
                    />
                    <span className="text-slate-300">Deliver in recipient's local business hours when location is known</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Throttle Interval:</span>
                    <input
                      type="number"
                      value={minIntervalSeconds}
                      onChange={(e) => setMinIntervalSeconds(parseInt(e.target.value) || 60)}
                      className="w-16 rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-center font-mono text-xs text-slate-100"
                    />
                    <span className="text-slate-500 font-mono">sec</span>
                  </div>
                </div>
              </div>

              {/* Safeguards Checkboxes */}
              <div className="surface-card rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white tracking-tight">Sequence Termination Safeguards</h3>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stopOnReply}
                    onChange={(e) => setStopOnReply(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600"
                  />
                  <span className="text-slate-300">
                    Automatically terminate sequence for a prospect immediately when an inbound reply is detected.
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stopOnUnsubscribe}
                    onChange={(e) => setStopOnUnsubscribe(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600"
                  />
                  <span className="text-slate-300">
                    Automatically suppress and stop sequence if unsubscribe request is detected.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div className="p-4 px-6 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (currentStep > 1 ? setCurrentStep((currentStep - 1) as any) : onClose())}
            className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {currentStep > 1 ? 'Back' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSaveCampaign(false)}
              className="rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              Save Sequence as Draft
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep + 1) as any)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-xs cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveCampaign(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Launch Campaign Now</span>
              </button>
            )}
          </div>
        </div>

        {/* CUSTOM VARIABLE MODAL */}
        {showCustomVarModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-white">Insert Variable with Fallback</h4>
                <button onClick={() => setShowCustomVarModal(false)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-slate-400 text-xs mb-1">Variable Field Name</label>
                <input
                  type="text"
                  value={customVarField}
                  onChange={(e) => setCustomVarField(e.target.value)}
                  placeholder="e.g. industry, tech_stack, city"
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs mb-1">Fallback Value (Used if field is empty)</label>
                <input
                  type="text"
                  value={customVarFallback}
                  onChange={(e) => setCustomVarFallback(e.target.value)}
                  placeholder='e.g. "your industry", "there"'
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="rounded bg-slate-950 p-2 font-mono text-[11px] text-cyan-300">
                Preview: {`{{${customVarField.trim()} | fallback: "${customVarFallback.trim()}"}}`}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomVarModal(false)}
                  className="rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tag = `{{${customVarField.trim()} | fallback: "${customVarFallback.trim()}"}}`;
                    handleInsertVariableSnippet(customVarTargetStepIdx, tag);
                    setShowCustomVarModal(false);
                  }}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  Insert Variable
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI COPYWRITER POPUP */}
        {showAiModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Sparkles className="h-4 w-4" />
                  <h4 className="text-xs font-semibold text-white">AI Cold Outreach Sequence Generator</h4>
                </div>
                <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Describe your target persona, product value proposition, and desired outcome:
              </p>

              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-xs text-slate-100"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowAiModal(false)}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsGeneratingAi(true);
                    try {
                      const res = await fetch('/api/ai/generate-sequence', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          targetAudience: aiPrompt,
                          valueProposition: 'High performance cold email outreach',
                          stepCount: 3,
                        }),
                      });
                      const data = await res.json();
                      if (data.success && data.sequence?.steps) {
                        const generatedSteps: CampaignStep[] = [];
                        data.sequence.steps.forEach((s: any, idx: number) => {
                          if (idx > 0) {
                            generatedSteps.push({
                              id: `step-delay-${idx}`,
                              campaignId: '',
                              stepNumber: generatedSteps.length + 1,
                              type: 'delay',
                              delayHours: 48,
                            });
                          }
                          generatedSteps.push({
                            id: `step-email-${idx}`,
                            campaignId: '',
                            stepNumber: generatedSteps.length + 1,
                            type: 'email',
                            delayHours: 0,
                            emailData: {
                              subject: s.subject,
                              body: s.body,
                              variants: s.variantSubject
                                ? [
                                    {
                                      id: `var-${Date.now()}-a`,
                                      name: 'Variant A',
                                      subject: s.subject,
                                      body: s.body,
                                      weight: 50,
                                      sentCount: 0,
                                      replyCount: 0,
                                    },
                                    {
                                      id: `var-${Date.now()}-b`,
                                      name: 'Variant B',
                                      subject: s.variantSubject,
                                      body: s.variantBody || s.body,
                                      weight: 50,
                                      sentCount: 0,
                                      replyCount: 0,
                                    },
                                  ]
                                : [],
                            },
                          });
                        });
                        setSteps(generatedSteps);
                        setShowAiModal(false);
                      }
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsGeneratingAi(false);
                    }
                  }}
                  disabled={isGeneratingAi}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingAi ? 'Generating Copy...' : 'Generate 3-Step Sequence'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
