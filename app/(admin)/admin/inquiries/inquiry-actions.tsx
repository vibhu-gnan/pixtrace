'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateInquiryStatus } from '@/actions/admin';

interface InquiryActionsProps {
  inquiryId: string;
  currentStatus: string;
  currentNotes: string | null;
  additionalNeeds: string | null;
}

const STATUSES = ['new', 'contacted', 'converted', 'closed'] as const;

export function InquiryActions({
  inquiryId,
  currentStatus,
  currentNotes,
  additionalNeeds,
}: InquiryActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(currentNotes || '');
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const handleSave = () => {
    startTransition(async () => {
      await updateInquiryStatus(inquiryId, selectedStatus, notes || undefined);
      setExpanded(false);
      router.refresh();
    });
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        Manage
      </button>
    );
  }

  return (
    <div className="space-y-3 min-w-[240px]">
      {additionalNeeds && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
          <span className="font-medium text-gray-600">Needs: </span>
          {additionalNeeds}
        </div>
      )}

      <select
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
        className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes..."
        rows={2}
        className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 bg-white text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-3 py-1 text-xs font-medium rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="px-3 py-1 text-xs font-medium rounded text-gray-500 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
