import { getAdminEvents } from '@/actions/admin';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { Pagination } from '@/components/admin/pagination';
import { SearchInput } from '@/components/admin/search-input';
import { TogglePublicButton } from './toggle-public-button';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type EventRow = {
  id: string;
  name: string;
  event_hash: string;
  is_public: boolean;
  face_search_enabled?: boolean;
  created_at: string;
  media_count: number;
  organizers: { name: string | null; email: string } | null;
};

const columns: Column<EventRow>[] = [
  {
    key: 'name',
    header: 'Event',
    render: (row) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
        <p className="text-xs text-gray-400 font-mono">{row.event_hash}</p>
      </div>
    ),
  },
  {
    key: 'organizer',
    header: 'Organizer',
    render: (row) => (
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate">
          {row.organizers?.name || row.organizers?.email?.split('@')[0] || '—'}
        </p>
        <p className="text-xs text-gray-400 truncate">{row.organizers?.email}</p>
      </div>
    ),
  },
  {
    key: 'photos',
    header: 'Photos',
    render: (row) => <span className="text-sm text-gray-700">{row.media_count}</span>,
  },
  {
    key: 'face',
    header: 'Face Search',
    render: (row) => (
      <StatusBadge
        status={row.face_search_enabled ? 'enabled' : 'disabled'}
        label={row.face_search_enabled ? 'On' : 'Off'}
      />
    ),
  },
  {
    key: 'public',
    header: 'Visibility',
    render: (row) => (
      <TogglePublicButton eventId={row.id} isPublic={row.is_public} />
    ),
  },
  {
    key: 'created',
    header: 'Created',
    render: (row) => <span className="text-sm text-gray-500">{formatDate(row.created_at)}</span>,
  },
];

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function AdminEventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const search = params.search || '';

  const { events, total, pageSize } = await getAdminEvents({ page, search });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
            {total}
          </span>
        </div>
      </div>

      <SearchInput placeholder="Search by event name or hash..." />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <DataTable columns={columns} data={events} rowKey={(row) => row.id} emptyMessage="No events found." />
        <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={pageSize} />
      </div>
    </div>
  );
}
