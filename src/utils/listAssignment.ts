import { Lead, LeadList } from '../types';

export function recalculateListLeadCounts(leads: Lead[], lists: LeadList[]): LeadList[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.listId) {
      counts.set(lead.listId, (counts.get(lead.listId) || 0) + 1);
    }
  }
  return lists.map((list) => ({
    ...list,
    leadCount: counts.get(list.id) || 0,
  }));
}

export function assignLeadsToList(
  leads: Lead[],
  lists: LeadList[],
  leadIds: string[],
  targetListId: string
): { updatedLeads: Lead[]; updatedLists: LeadList[]; updatedCount: number } {
  const targetSet = new Set(leadIds);
  let updatedCount = 0;

  const updatedLeads = leads.map((lead) => {
    if (!targetSet.has(lead.id)) return lead;
    updatedCount++;
    return {
      ...lead,
      listId: targetListId,
    };
  });

  const updatedLists = recalculateListLeadCounts(updatedLeads, lists);
  return { updatedLeads, updatedLists, updatedCount };
}
