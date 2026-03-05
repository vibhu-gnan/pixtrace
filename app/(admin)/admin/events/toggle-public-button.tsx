'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleEventPublic } from '@/actions/admin';

interface TogglePublicButtonProps {
  eventId: string;
  isPublic: boolean;
}

export function TogglePublicButton({ eventId, isPublic }: TogglePublicButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await toggleEventPublic(eventId);
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
        isPublic
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {isPublic ? 'Public' : 'Private'}
    </button>
  );
}
