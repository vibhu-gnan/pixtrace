'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { retryFailedFaceJobs } from '@/actions/admin';

interface RetryJobsButtonProps {
  jobIds: string[];
  count: number;
}

export function RetryJobsButton({ jobIds, count }: RetryJobsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRetry = () => {
    startTransition(async () => {
      const result = await retryFailedFaceJobs(jobIds);
      if (result.success) {
        router.refresh();
      }
    });
  };

  return (
    <button
      onClick={handleRetry}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors shadow-sm"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
      {isPending ? 'Retrying...' : `Retry ${count} Failed`}
    </button>
  );
}
