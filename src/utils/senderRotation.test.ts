import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNextMailbox, getEligibleMailboxes, RotatableMailbox } from './senderRotation';

const mockAccounts: RotatableMailbox[] = [
  { id: 'mb-1', email: 'sales1@company.com', name: 'Sales 1', status: 'connected', dailyLimit: 50, sentToday: 50 }, // Exceeded
  { id: 'mb-2', email: 'sales2@company.com', name: 'Sales 2', status: 'paused', dailyLimit: 50, sentToday: 10 },    // Paused
  { id: 'mb-3', email: 'sales3@company.com', name: 'Sales 3', status: 'connected', dailyLimit: 50, sentToday: 15, lastSentAt: 1000 },
  { id: 'mb-4', email: 'sales4@company.com', name: 'Sales 4', status: 'connected', dailyLimit: 50, sentToday: 5, lastSentAt: 500 },
];

test('getEligibleMailboxes filters out paused accounts and accounts with exhausted quota', () => {
  const eligible = getEligibleMailboxes(mockAccounts);
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map(e => e.id), ['mb-3', 'mb-4']);
});

test('selectNextMailbox selects least recently used when strategy is least_recently_used', () => {
  const { selected } = selectNextMailbox(mockAccounts, 'least_recently_used');
  assert.ok(selected);
  assert.equal(selected.id, 'mb-4'); // lastSentAt 500 < 1000
});

test('selectNextMailbox selects lowest quota utilization when strategy is balanced', () => {
  const { selected } = selectNextMailbox(mockAccounts, 'balanced');
  assert.ok(selected);
  assert.equal(selected.id, 'mb-4'); // 5/50 < 15/50
});

test('selectNextMailbox returns null when no eligible mailboxes exist', () => {
  const allMaxed: RotatableMailbox[] = [
    { id: 'mb-1', email: 'a@c.com', name: 'A', status: 'connected', dailyLimit: 10, sentToday: 10 },
  ];
  const { selected } = selectNextMailbox(allMaxed);
  assert.equal(selected, null);
});
