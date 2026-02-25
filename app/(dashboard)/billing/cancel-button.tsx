'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelSubscription } from '@/actions/billing';

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    const result = await cancelSubscription();
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setConfirming(false);
      router.refresh();
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
      >
        Cancel subscription
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Are you sure? You&apos;ll keep access until the end of your current billing period, then be moved to the Free plan.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Cancelling...' : 'Yes, cancel'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Keep subscription
        </button>
      </div>
    </div>
  );
}
