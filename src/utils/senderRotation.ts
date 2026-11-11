import { MailboxAccount } from '../types';

export type { MailboxAccount };
export type RotationStrategy = 'round_robin' | 'least_recently_used' | 'balanced';

export type RotatableMailbox = Pick<
  MailboxAccount,
  'id' | 'email' | 'name' | 'status' | 'dailyLimit' | 'sentToday'
> &
  Partial<MailboxAccount>;

export function getEligibleMailboxes<T extends RotatableMailbox>(
  mailboxes: T[],
  allowedAccountIds?: string[]
): T[] {
  return mailboxes.filter((mb) => {
    // If specific accounts are assigned to campaign, check membership
    if (allowedAccountIds && allowedAccountIds.length > 0) {
      if (!allowedAccountIds.includes(mb.id)) return false;
    }
    // Must be active and connected
    if (mb.status !== 'connected') return false;
    // Must have remaining daily quota
    if (mb.sentToday >= mb.dailyLimit) return false;
    return true;
  });
}

export function selectNextMailbox<T extends RotatableMailbox>(
  mailboxes: T[],
  strategy: RotationStrategy = 'round_robin',
  lastUsedIndex = -1,
  allowedAccountIds?: string[]
): { selected: T | null; nextIndex: number } {
  const eligible = getEligibleMailboxes(mailboxes, allowedAccountIds);

  if (eligible.length === 0) {
    return { selected: null, nextIndex: lastUsedIndex };
  }

  if (strategy === 'least_recently_used') {
    // Sort by lastSentAt ascending (null/undefined treated as 0, meaning earliest)
    const sorted = [...eligible].sort((a, b) => (a.lastSentAt || 0) - (b.lastSentAt || 0));
    const selected = sorted[0];
    const originalIndex = mailboxes.findIndex((m) => m.id === selected.id);
    return { selected, nextIndex: originalIndex };
  }

  if (strategy === 'balanced') {
    // Pick the one with lowest percentage of quota used
    const sorted = [...eligible].sort((a, b) => {
      const ratioA = a.sentToday / Math.max(1, a.dailyLimit);
      const ratioB = b.sentToday / Math.max(1, b.dailyLimit);
      return ratioA - ratioB;
    });
    const selected = sorted[0];
    const originalIndex = mailboxes.findIndex((m) => m.id === selected.id);
    return { selected, nextIndex: originalIndex };
  }

  // Default: Round-robin across eligible
  const nextEligibleIdx = (lastUsedIndex + 1) % eligible.length;
  const selected = eligible[nextEligibleIdx];
  return { selected, nextIndex: nextEligibleIdx };
}
