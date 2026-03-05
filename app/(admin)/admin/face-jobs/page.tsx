import { getAdminFaceJobs } from '@/actions/admin';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { Pagination } from '@/components/admin/pagination';
import { FilterTabs } from '@/components/admin/filter-tabs';
import { RetryJobsButton } from './retry-jobs-button';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type FaceJobRow = {
  id: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  faces_found: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  events: { name: string } | null;
  media: { original_filename: string } | null;
};

const columns: Column<FaceJobRow>[] = [
  {
    key: 'event',
    header: 'Event',
    render: (row) => (
      <span className="text-sm text-gray-900 truncate block max-w-[160px]">
        {row.events?.name || '—'}
      </span>
    ),
  },
  {
    key: 'file',
    header: 'File',
    render: (row) => (
      <span className="text-sm text-gray-500 truncate block max-w-[160px]">
        {row.media?.original_filename || '—'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'faces',
    header: 'Faces',
    render: (row) => (
      <span className="text-sm text-gray-700">
        {row.faces_found !== null ? row.faces_found : '—'}
      </span>
    ),
  },
  {
    key: 'attempts',
    header: 'Attempts',
    render: (row) => (
      <span className="text-sm text-gray-500">
        {row.attempt_count}/{row.max_attempts}
      </span>
    ),
  },
  {
    key: 'error',
    header: 'Error',
    render: (row) => (
      <span
        className="text-xs text-red-600 truncate block max-w-[200px]"
        title={row.error_message || undefined}
      >
        {row.error_message || '—'}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Created',
    render: (row) => <span className="text-xs text-gray-500">{formatDate(row.created_at)}</span>,
  },
];

const statusTabs = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'No Faces', value: 'no_faces' },
];

const STATUS_CARD_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  processing: 'bg-blue-50 border-blue-200 text-blue-700',
  completed: 'bg-green-50 border-green-200 text-green-700',
  failed: 'bg-red-50 border-red-200 text-red-700',
};

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function AdminFaceJobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const status = params.status || '';

  const { jobs, total, pageSize } = await getAdminFaceJobs({ page, status });
  const totalPages = Math.ceil(total / pageSize);

  // Quick counts for the status cards (from current page, approximate)
  // For exact counts we'd need separate queries, but this gives a useful overview
  const failedJobIds = jobs.filter((j: any) => j.status === 'failed' || j.status === 'no_faces').map((j: any) => j.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Face Processing Jobs</h1>
          <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
            {total}
          </span>
        </div>

        {failedJobIds.length > 0 && (
          <RetryJobsButton jobIds={failedJobIds} count={failedJobIds.length} />
        )}
      </div>

      <FilterTabs tabs={statusTabs} paramName="status" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={jobs}
          rowKey={(row) => row.id}
          emptyMessage="No face processing jobs found."
        />
        <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={pageSize} />
      </div>
    </div>
  );
}
