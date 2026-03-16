'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition, useOptimistic } from 'react';

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
  const current = searchParams.get(paramName) || defaultValue;
  const [isPending, startTransition] = useTransition();
  const [optimisticValue, setOptimisticValue] = useOptimistic(current);

  const handleClick = (value: string) => {
    // Skip if already on this tab
    if (value === optimisticValue) return;

    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    params.delete('page');
    startTransition(() => {
      setOptimisticValue(value);
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = optimisticValue === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => handleClick(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            } ${isPending && !isActive ? 'opacity-60' : ''}`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 text-xs ${
                  isActive ? 'text-brand-200' : 'text-gray-400'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
