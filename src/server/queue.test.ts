import test from 'node:test';
import assert from 'node:assert/strict';
import { generateIdempotencyKey, calcNextAttemptTime } from './queue';
import { isWithinScheduleWindow } from './scheduler';

test('generateIdempotencyKey produces deterministic unique key per campaign, step, and lead', () => {
  const key1 = generateIdempotencyKey('camp-1', 'step-1', 'lead-1');
  const key2 = generateIdempotencyKey('camp-1', 'step-1', 'lead-1');
  const key3 = generateIdempotencyKey('camp-1', 'step-2', 'lead-1');

  assert.equal(key1, 'ik_camp-1_step-1_lead-1');
  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
});

test('calcNextAttemptTime scales delay with exponential backoff on retries', () => {
  const now = Date.now();
  const attempt1Iso = calcNextAttemptTime(1);
  const attempt2Iso = calcNextAttemptTime(2);
  const attempt3Iso = calcNextAttemptTime(3);

  const t1 = new Date(attempt1Iso).getTime();
  const t2 = new Date(attempt2Iso).getTime();
  const t3 = new Date(attempt3Iso).getTime();

  assert.ok(t1 > now, 'Attempt 1 is in the future');
  assert.ok(t2 > t1, 'Attempt 2 is scheduled after attempt 1');
  assert.ok(t3 > t2, 'Attempt 3 is scheduled after attempt 2');
});

test('isWithinScheduleWindow validates allowed sending days', () => {
  const schedule = {
    startDate: '2026-01-01',
    sendingDays: [1, 2, 3, 4, 5], // Mon to Fri
    startTime: '00:00',
    endTime: '23:59',
    timezone: 'UTC',
    useRecipientTimezone: false,
    minIntervalSeconds: 30,
  };

  // 2026-11-09 is Monday (jsDay = 1)
  const monday = new Date('2026-11-09T10:00:00.000Z');
  assert.equal(isWithinScheduleWindow(schedule, monday), true);

  // 2026-11-15 is Sunday (jsDay = 0 -> campaignDay = 7)
  const sunday = new Date('2026-11-15T10:00:00.000Z');
  assert.equal(isWithinScheduleWindow(schedule, sunday), false);
});

test('isWithinScheduleWindow validates hours window', () => {
  const schedule = {
    startDate: '2026-01-01',
    sendingDays: [1, 2, 3, 4, 5, 6, 7],
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'UTC',
    useRecipientTimezone: false,
    minIntervalSeconds: 30,
  };

  const insideHours = new Date(2026, 10, 9, 14, 0); // 14:00
  assert.equal(isWithinScheduleWindow(schedule, insideHours), true);

  const outsideHours = new Date(2026, 10, 9, 21, 0); // 21:00
  assert.equal(isWithinScheduleWindow(schedule, outsideHours), false);
});
