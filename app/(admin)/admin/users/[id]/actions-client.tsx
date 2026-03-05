'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleUserAdmin, changeUserPlan } from '@/actions/admin';

interface UserAdminActionsProps {
  userId: string;
  isAdmin: boolean;
  currentPlan: string;
}

const PLANS = [
  { id: 'free', label: 'Free' },
  { id: 'starter', label: 'Starter' },
  { id: 'pro', label: 'Pro' },
  { id: 'enterprise', label: 'Enterprise' },
];

export function UserAdminActions({ userId, isAdmin, currentPlan }: UserAdminActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);

  const handleToggleAdmin = () => {
    setError(null);
    startTransition(async () => {
      const result = await toggleUserAdmin(userId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleChangePlan = () => {
    if (selectedPlan === currentPlan) return;
    setError(null);
    startTransition(async () => {
      const result = await changeUserPlan(userId, selectedPlan);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Toggle Admin */}
      <button
        onClick={handleToggleAdmin}
        disabled={isPending}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
          isAdmin
            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
        }`}
      >
        {isAdmin ? 'Remove Admin' : 'Make Admin'}
      </button>

      {/* Change Plan */}
      <div className="flex items-center gap-2">
        <select
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleChangePlan}
          disabled={isPending || selectedPlan === currentPlan}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Update Plan
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
