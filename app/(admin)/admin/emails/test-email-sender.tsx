'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { sendTestEmail } from '@/actions/admin';

const TEMPLATES = [
  { id: 'generic', label: 'Generic Test' },
  { id: 'welcome', label: 'Welcome' },
  { id: 'storage_warning', label: 'Storage Warning' },
  { id: 'storage_deleted', label: 'Storage Deleted' },
  { id: 'plan_change', label: 'Plan Change' },
] as const;

export function TestEmailSender() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [template, setTemplate] = useState('generic');
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Auto-clear success messages after 5 seconds
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (result?.type === 'success') {
      clearTimer.current = setTimeout(() => setResult(null), 5000);
    }
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, [result]);

  const handleSend = useCallback(() => {
    if (!email.trim() || isPending) return;
    setResult(null);

    startTransition(async () => {
      const res = await sendTestEmail({ to: email.trim(), template });
      if (res.error) {
        setResult({ type: 'error', message: res.error });
      } else {
        setResult({
          type: 'success',
          message: `Test email sent to ${email.trim()}`,
        });
      }
    });
  }, [email, template, isPending, startTransition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Send Test Email
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label
            htmlFor="test-email"
            className="block text-xs font-medium text-gray-500 mb-1"
          >
            Recipient
          </label>
          <input
            id="test-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="test@example.com"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            maxLength={320}
            autoComplete="email"
          />
        </div>
        <div className="min-w-[160px]">
          <label
            htmlFor="test-template"
            className="block text-xs font-medium text-gray-500 mb-1"
          >
            Template
          </label>
          <select
            id="test-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSend}
          disabled={isPending || !email.trim()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isPending ? 'Sending...' : 'Send Test'}
        </button>
      </div>
      {result && (
        <p
          className={`mt-2 text-sm ${result.type === 'error' ? 'text-red-600' : 'text-green-600'}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
