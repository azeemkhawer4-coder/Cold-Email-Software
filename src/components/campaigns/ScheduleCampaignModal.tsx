import React, { useState } from 'react';
import { Calendar, Clock, X, Check, Mail, Sliders, AlertCircle } from 'lucide-react';
import { Campaign, MailboxAccount } from '../../types';

interface ScheduleCampaignModalProps {
  campaign: Campaign;
  mailboxes: MailboxAccount[];
  onClose: () => void;
  onScheduled: (campaign: Campaign, message: string) => void;
}

export const ScheduleCampaignModal: React.FC<ScheduleCampaignModalProps> = ({
  campaign,
  mailboxes,
  onClose,
  onScheduled,
}) => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(campaign.schedule?.startDate || tomorrow);
  const [startTime, setStartTime] = useState(campaign.schedule?.startTime || '09:00');
  const [endTime, setEndTime] = useState(campaign.schedule?.endTime || '17:00');
  const [timezone, setTimezone] = useState(campaign.schedule?.timezone || 'America/Los_Angeles');
  const [sendingDays, setSendingDays] = useState<number[]>(
    campaign.schedule?.sendingDays && campaign.schedule.sendingDays.length > 0
      ? campaign.schedule.sendingDays
      : [1, 2, 3, 4, 5]
  );
  const [dailyLimit, setDailyLimit] = useState(campaign.settings?.dailyLimit || 50);
  const [minIntervalSeconds, setMinIntervalSeconds] = useState(
    campaign.schedule?.minIntervalSeconds || 90
  );
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<string[]>(
    campaign.mailboxAccountIds && campaign.mailboxAccountIds.length > 0
      ? campaign.mailboxAccountIds
      : mailboxes.filter((m) => m.status === 'connected').map((m) => m.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    if (sendingDays.includes(day)) {
      if (sendingDays.length === 1) return; // Keep at least one day
      setSendingDays(sendingDays.filter((d) => d !== day));
    } else {
      setSendingDays([...sendingDays, day].sort());
    }
  };

  const toggleMailbox = (id: string) => {
    if (selectedMailboxIds.includes(id)) {
      setSelectedMailboxIds(selectedMailboxIds.filter((m) => m !== id));
    } else {
      setSelectedMailboxIds([...selectedMailboxIds, id]);
    }
  };

  const dayNames = [
    { num: 1, label: 'Mon' },
    { num: 2, label: 'Tue' },
    { num: 3, label: 'Wed' },
    { num: 4, label: 'Thu' },
    { num: 5, label: 'Fri' },
    { num: 6, label: 'Sat' },
    { num: 7, label: 'Sun' },
  ];

  const handleSaveSchedule = async () => {
    setIsSubmitting(true);
    setError(null);

    const scheduledStartAt = `${startDate}T${startTime}:00`;

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledStartAt,
          mailboxAccountIds: selectedMailboxIds,
          schedule: {
            startDate,
            startTime,
            endTime,
            timezone,
            sendingDays,
            minIntervalSeconds,
            useRecipientTimezone: true,
          },
          settings: {
            ...campaign.settings,
            dailyLimit,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to schedule campaign');
      }

      onScheduled(data.campaign, data.message);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="surface-card rounded-2xl border border-slate-700 p-6 max-w-lg w-full space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Schedule Sequence Delivery</h3>
              <p className="text-xs text-slate-400">Automate future dispatch times and delivery throttling</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Start Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Launch Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Daily Start Window</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Daily End Window</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Target Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="UTC">UTC Standard</option>
              </select>
            </div>
          </div>

          {/* Sending Days */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Sending Days</label>
            <div className="flex items-center gap-1.5">
              {dayNames.map((d) => {
                const isSelected = sendingDays.includes(d.num);
                return (
                  <button
                    key={d.num}
                    type="button"
                    onClick={() => toggleDay(d.num)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/25 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Limits & Intervals */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Daily Sending Limit</label>
              <input
                type="number"
                min={1}
                max={500}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value) || 25)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Interval Between Sends</label>
              <select
                value={minIntervalSeconds}
                onChange={(e) => setMinIntervalSeconds(parseInt(e.target.value))}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-xs font-mono"
              >
                <option value={45}>45 seconds</option>
                <option value={60}>60 seconds (Recommended)</option>
                <option value={90}>90 seconds</option>
                <option value={120}>2 minutes</option>
              </select>
            </div>
          </div>

          {/* Mailbox Selection */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Assigned Sending Mailboxes</label>
            <div className="space-y-1.5 max-h-32 overflow-y-auto rounded-lg bg-slate-950 p-2 border border-slate-800">
              {mailboxes.length === 0 ? (
                <p className="text-slate-500 text-[11px] p-1">No mailboxes connected. Add one in Email Accounts.</p>
              ) : (
                mailboxes.map((mb) => {
                  const isChecked = selectedMailboxIds.includes(mb.id);
                  return (
                    <label
                      key={mb.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-900 transition cursor-pointer text-[11px]"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMailbox(mb.id)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-0"
                      />
                      <span className="font-mono text-slate-200">{mb.email}</span>
                      <span className="text-[10px] text-slate-500">({mb.provider})</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Schedule Preview Summary */}
          <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1 text-[11px] text-slate-300">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 block font-mono">
              Schedule Summary
            </span>
            <p>
              Will start sending on <span className="font-semibold text-white">{startDate}</span> at <span className="font-semibold text-white">{startTime}</span>.
            </p>
            <p className="text-slate-400 text-[10px]">
              Active window: {startTime} – {endTime} {timezone} on selected days ({sendingDays.length} days/week), up to {dailyLimit} emails/day.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveSchedule}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Saving Schedule...' : 'Save & Schedule Campaign'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
