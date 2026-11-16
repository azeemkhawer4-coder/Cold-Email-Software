import test from 'node:test';
import assert from 'node:assert/strict';
import { assignLeadsToList, recalculateListLeadCounts } from './listAssignment';
import { Lead, LeadList } from '../types';

const makeLead = (id: string, listId?: string): Lead => ({
  id,
  workspaceId: 'ws-1',
  firstName: 'Test',
  lastName: id,
  fullName: `Test ${id}`,
  email: `${id}@example.com`,
  jobTitle: 'Founder',
  company: 'Acme',
  website: 'acme.com',
  domain: 'acme.com',
  industry: 'SaaS',
  country: 'United States',
  city: 'San Francisco',
  linkedinUrl: '',
  phone: '',
  source: 'CSV',
  verificationStatus: 'valid',
  status: 'new',
  assignedOwner: 'Owner',
  customFields: {},
  notes: '',
  tags: [],
  dateAdded: '2026-11-16T00:00:00.000Z',
  unsubscribeStatus: false,
  bounceStatus: false,
  listId,
});

const makeList = (id: string, name: string, leadCount = 0): LeadList => ({
  id,
  workspaceId: 'ws-1',
  name,
  description: '',
  leadCount,
  tags: ['Outreach'],
  type: 'static',
  createdAt: '2026-11-16T00:00:00.000Z',
});

test('assignLeadsToList moves selected leads to target list and recalculates counts', () => {
  const leads = [
    makeLead('l1', 'list-a'),
    makeLead('l2'),
    makeLead('l3', 'list-a'),
  ];
  const lists = [makeList('list-a', 'List A', 2), makeList('list-b', 'List B', 0)];

  const result = assignLeadsToList(leads, lists, ['l1', 'l2'], 'list-b');

  assert.equal(result.updatedCount, 2);
  assert.equal(result.updatedLeads.find((l) => l.id === 'l1')?.listId, 'list-b');
  assert.equal(result.updatedLeads.find((l) => l.id === 'l2')?.listId, 'list-b');
  assert.equal(result.updatedLeads.find((l) => l.id === 'l3')?.listId, 'list-a');
  assert.equal(result.updatedLists.find((l) => l.id === 'list-a')?.leadCount, 1);
  assert.equal(result.updatedLists.find((l) => l.id === 'list-b')?.leadCount, 2);
});

test('recalculateListLeadCounts zeros empty lists cleanly', () => {
  const leads = [makeLead('l1', 'list-b')];
  const lists = [makeList('list-a', 'List A', 5), makeList('list-b', 'List B', 0)];
  const recalculated = recalculateListLeadCounts(leads, lists);
  assert.equal(recalculated[0].leadCount, 0);
  assert.equal(recalculated[1].leadCount, 1);
});
