'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminCreateUser } from '@/actions/admin';

const PLANS = [
  { id: 'free', label: 'Free' },
  { id: 'starter', label: 'Starter' },
  { id: 'pro', label: 'Pro' },
  { id: 'enterprise', label: 'Enterprise' },
];

function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

export function CreateUserForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [planId, setPlanId] = useState('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [customStorageGB, setCustomStorageGB] = useState('');
  const [customMaxEvents, setCustomMaxEvents] = useState('');

  const handleGeneratePassword = () => {
    const pw = generatePassword();
    setPassword(pw);
    setShowPassword(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side NaN guard before sending to server
    let parsedStorage: number | null = null;
    let parsedEvents: number | null = null;
    if (planId === 'enterprise') {
      if (customStorageGB !== '') {
        const v = parseFloat(customStorageGB);
        if (Number.isNaN(v) || v < 0) {
          setError('Storage limit must be a valid non-negative number');
          return;
        }
        parsedStorage = v;
      }
      if (customMaxEvents !== '') {
        const v = parseInt(customMaxEvents, 10);
        if (Number.isNaN(v) || v < 0) {
          setError('Max events must be a valid non-negative number');
          return;
        }
        parsedEvents = v;
      }
    }

    startTransition(async () => {
      const result = await adminCreateUser({
        email: email.trim(),
        name: name.trim(),
        password,
        planId,
        isAdmin,
        customStorageLimitGB: parsedStorage,
        customMaxEvents: parsedEvents,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.userId) {
        setSuccess('User created successfully! Redirecting...');
        setTimeout(() => {
          router.push(`/admin/users/${result.userId}`);
        }, 1000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
      {/* Basic Info */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Account Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              placeholder="john@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 pr-10"
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
            >
              Generate
            </button>
          </div>
          {password && showPassword && (
            <p className="mt-1.5 text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded break-all">
              {password}
            </p>
          )}
        </div>
      </div>

      {/* Plan & Role */}
      <div className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Plan & Role</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="plan" className="block text-sm font-medium text-gray-700 mb-1">
              Plan
            </label>
            <select
              id="plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2.5 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="text-sm font-medium text-gray-700">Grant admin access</span>
            </label>
          </div>
        </div>

        {/* Enterprise custom limits */}
        {planId === 'enterprise' && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              Enterprise Custom Limits (optional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="storageLimit" className="block text-xs font-medium text-amber-700 mb-1">
                  Storage Limit (GB)
                </label>
                <input
                  id="storageLimit"
                  type="number"
                  min="0"
                  step="1"
                  value={customStorageGB}
                  onChange={(e) => setCustomStorageGB(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  placeholder="Empty = unlimited"
                />
              </div>
              <div>
                <label htmlFor="maxEvents" className="block text-xs font-medium text-amber-700 mb-1">
                  Max Events
                </label>
                <input
                  id="maxEvents"
                  type="number"
                  min="0"
                  step="1"
                  value={customMaxEvents}
                  onChange={(e) => setCustomMaxEvents(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  placeholder="Empty = unlimited (0 = unlimited)"
                />
              </div>
            </div>
            <p className="text-xs text-amber-600">
              Leave empty to use default enterprise limits (unlimited). Set 0 for unlimited.
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="p-6 flex items-center justify-between gap-4">
        <div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Creating...' : 'Create User'}
        </button>
      </div>
    </form>
  );
}
