const STATUS_COLORS: Record<string, string> = {
  // Subscription & payment statuses
  active:      'bg-green-100 text-green-700',
  captured:    'bg-green-100 text-green-700',
  completed:   'bg-green-100 text-green-700',
  converted:   'bg-green-100 text-green-700',
  authenticated: 'bg-green-100 text-green-700',

  pending:     'bg-yellow-100 text-yellow-700',
  created:     'bg-yellow-100 text-yellow-700',
  authorized:  'bg-yellow-100 text-yellow-700',
  contacted:   'bg-yellow-100 text-yellow-700',

  processing:  'bg-blue-100 text-blue-700',
  new:         'bg-blue-100 text-blue-700',

  failed:      'bg-red-100 text-red-700',
  halted:      'bg-red-100 text-red-700',
  disputed:    'bg-red-100 text-red-700',
  no_faces:    'bg-red-100 text-red-700',

  cancelled:   'bg-gray-100 text-gray-600',
  closed:      'bg-gray-100 text-gray-600',
  paused:      'bg-gray-100 text-gray-600',

  // Boolean display
  true:        'bg-green-100 text-green-700',
  false:       'bg-gray-100 text-gray-600',
  enabled:     'bg-green-100 text-green-700',
  disabled:    'bg-gray-100 text-gray-600',

  // Plans
  free:        'bg-slate-100 text-slate-700',
  starter:     'bg-blue-100 text-blue-700',
  pro:         'bg-brand-100 text-brand-700',
  enterprise:  'bg-purple-100 text-purple-700',
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status.toLowerCase()] || 'bg-gray-100 text-gray-700';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass} ${className}`}
    >
      {label || status}
    </span>
  );
}
