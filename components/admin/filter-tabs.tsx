'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { LoadingSpinner } from '@/components/UI/LoadingStates';

interface FilterTab {
  label: string;
  value: string;
  count?: number;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  paramName?: string;
  defaultValue?: string;
}

export function FilterTabs({ tabs, paramName = 'status', defaultValue = '' }: FilterTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get(paramName) || defaultValue;

  const handleClick = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    params.delete('page');
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className={`flex flex-wrap gap-2 transition-opacity duration-200 ${isPending ? 'opacity-70' : ''}`}>
      {tabs.map((tab) => {
        const isActive = current === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => handleClick(tab.value)}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:cursor-wait ${
              isActive
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`text-xs ${
                  isActive ? 'text-brand-200' : 'text-gray-400'
                }`}
              >
                {tab.count}
              </span>
            )}
            {isPending && isActive && (
              <LoadingSpinner size="sm" className="text-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}
