'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useTransition, useOptimistic } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

export function Pagination({ currentPage, totalPages, totalItems, pageSize }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticPage, setOptimisticPage] = useOptimistic(currentPage);

  const goToPage = useCallback(
    (page: number) => {
      if (page === optimisticPage) return;
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) {
        params.delete('page');
      } else {
        params.set('page', String(page));
      }
      startTransition(() => {
        setOptimisticPage(page);
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams, optimisticPage, startTransition, setOptimisticPage]
  );

  if (totalPages <= 1) return null;

  const start = (optimisticPage - 1) * pageSize + 1;
  const end = Math.min(optimisticPage * pageSize, totalItems);

  // Build visible page numbers (max 5 with ellipsis)
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (optimisticPage > 3) pages.push('ellipsis');
    for (
      let i = Math.max(2, optimisticPage - 1);
      i <= Math.min(totalPages - 1, optimisticPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (optimisticPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <div className={`flex items-center justify-between px-6 py-4 border-t border-gray-100 ${isPending ? 'opacity-60' : ''}`}>
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{start}</span>–
        <span className="font-medium text-gray-700">{end}</span> of{' '}
        <span className="font-medium text-gray-700">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(optimisticPage - 1)}
          disabled={optimisticPage <= 1}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e-${i}`} className="px-2 text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                p === optimisticPage
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => goToPage(optimisticPage + 1)}
          disabled={optimisticPage >= totalPages}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
