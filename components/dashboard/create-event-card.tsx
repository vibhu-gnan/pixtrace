import Link from 'next/link';

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function CreateEventCard() {
  return (
    <Link
      href="/events/new"
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 hover:border-brand-400 hover:bg-brand-50/40 transition-all duration-200 group min-h-[280px]"
    >
      <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center mb-3 group-hover:bg-brand-200 group-hover:scale-110 transition-all">
        <PlusIcon className="text-brand-500" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 group-hover:text-brand-600 transition-colors">New Event</h3>
    </Link>
  );
}
