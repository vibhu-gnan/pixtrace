'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useRef, useEffect, useCallback, useTransition } from 'react';
import { LoadingSpinner } from '@/components/UI/LoadingStates';

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

interface SearchInputProps {
  placeholder?: string;
  paramName?: string;
}

export function SearchInput({ placeholder = 'Search...', paramName = 'search' }: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentValue = searchParams.get(paramName) || '';

  // Sync input value on mount / URL change
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = currentValue;
    }
  }, [currentValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set(paramName, value);
        } else {
          params.delete(paramName);
        }
        // Reset to page 1 on search
        params.delete('page');
        startTransition(() => {
          router.push(`${pathname}?${params.toString()}`);
        });
      }, 300);
    },
    [router, pathname, searchParams, paramName]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative w-full max-w-sm">
      {isPending ? (
        <LoadingSpinner size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500" />
      ) : (
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      )}
      <input
        ref={inputRef}
        type="text"
        defaultValue={currentValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full pl-10 pr-4 py-2 bg-white rounded-lg text-sm text-gray-700 placeholder:text-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-300 transition-all ${isPending ? 'border-brand-300' : ''}`}
      />
    </div>
  );
}
