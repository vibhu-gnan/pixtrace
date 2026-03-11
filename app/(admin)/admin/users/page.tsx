import Link from 'next/link';
import { getAdminUsers } from '@/actions/admin';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { Pagination } from '@/components/admin/pagination';
import { SearchInput } from '@/components/admin/search-input';
import { FilterTabs } from '@/components/admin/filter-tabs';

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  plan_id: string;
  is_admin: boolean;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  event_count: number;
  max_events: number;
  created_at: string;
};

const columns: Column<UserRow>[] = [
  {
    key: 'user',
    header: 'User',
    render: (row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-white">
            {(row.name || row.email)?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div className="min-w-0">
          <Link
            href={`/admin/users/${row.id}`}
            className="text-sm font-medium text-gray-900 hover:text-brand-600 truncate block"
          >
            {row.name || row.email.split('@')[0]}
          </Link>
          <p className="text-xs text-gray-400 truncate">{row.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'plan',
    header: 'Plan',
    render: (row) => (
      <div className="flex items-center gap-1.5">
        <StatusBadge status={row.plan_id} />
        {row.is_admin && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700">
            Admin
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'events',
    header: 'Events',
    render: (row) => {
      const atLimit = row.max_events > 0 && row.event_count >= row.max_events;
      return (
        <span className={`text-sm ${atLimit ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
          {row.event_count}
          <span className="text-gray-400">
            /{row.max_events === 0 ? '\u221E' : row.max_events}
          </span>
        </span>
      );
    },
  },
  {
    key: 'storage',
    header: 'Storage',
    render: (row) => {
      const pct = row.storage_limit_bytes > 0
        ? (row.storage_used_bytes / row.storage_limit_bytes)
        : 0;
      const colorClass = pct > 0.9 ? 'bg-red-500' : pct > 0.7 ? 'bg-amber-500' : 'bg-brand-500';
      return (
        <div className="min-w-[80px]">
          <span className="text-sm text-gray-500">
            {formatBytes(row.storage_used_bytes)}
            <span className="text-gray-400">
              /{row.storage_limit_bytes === 0 ? '\u221E' : formatBytes(row.storage_limit_bytes)}
            </span>
          </span>
          {row.storage_limit_bytes > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
              <div
                className={`h-1 rounded-full ${colorClass}`}
                style={{ width: `${Math.min(100, pct * 100)}%` }}
              />
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: 'created',
    header: 'Joined',
    render: (row) => <span className="text-sm text-gray-500">{formatDate(row.created_at)}</span>,
  },
  {
    key: 'actions',
    header: '',
    render: (row) => (
      <Link
        href={`/admin/users/${row.id}`}
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        View
      </Link>
    ),
    headerClassName: 'w-16',
  },
];

const planTabs = [
  { label: 'All Plans', value: '' },
  { label: 'Free', value: 'free' },
  { label: 'Starter', value: 'starter' },
  { label: 'Pro', value: 'pro' },
  { label: 'Enterprise', value: 'enterprise' },
];

interface Props {
  searchParams: Promise<{ page?: string; search?: string; plan?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const search = params.search || '';
  const plan = params.plan || '';

  const { users, total, pageSize } = await getAdminUsers({ page, search, plan });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
            {total}
          </span>
        </div>
        <Link
          href="/admin/users/create"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
        >
          <PlusIcon />
          Create User
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <SearchInput placeholder="Search by name or email..." />
        <FilterTabs tabs={planTabs} paramName="plan" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <DataTable columns={columns} data={users} rowKey={(row) => row.id} emptyMessage="No users found." />
        <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={pageSize} />
      </div>
    </div>
  );
}
