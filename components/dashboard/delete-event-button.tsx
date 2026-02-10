'use client';

import { useState } from 'react';
import { deleteEvent } from '@/actions/events';

export function DeleteEventButton({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteEvent(eventId);
    } catch {
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">Delete &quot;{eventName}&quot;?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Yes, Delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-red-500 hover:text-red-700 transition-colors"
    >
      Delete
    </button>
  );
}
