import { getAdminEmailLogs } from '@/actions/admin';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { Pagination } from '@/components/admin/pagination';
import { FilterTabs } from '@/components/admin/filter-tabs';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEmailType(type: string): string {
  return type.replace(/_/g, ' ');
}

// ─── Table columns ──────────────────────────────────────────

type EmailLogRow = {
  id: string;
  recipient: string;
  subject: string;
  email_type: string;
  status: string;
  error: string | null;
  created_at: string;
};

const columns: Column<EmailLogRow>[] = [
  {
    key: 'date',
    header: 'Date',
    render: (row) => (
      <span className="text-sm text-gray-700 whitespace-nowrap">
        {formatDate(row.created_at)}
      </span>
    ),
  },
  {
    key: 'recipient',
    header: 'Recipient',
    render: (row) => (
      <span className="text-sm text-gray-900 truncate block max-w-[220px]" title={row.recipient}>
        {row.recipient}
      </span>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    render: (row) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">
        {formatEmailType(row.email_type)}
      </span>
    ),
  },
  {
    key: 'subject',
    header: 'Subject',
    render: (row) => (
      <span className="text-sm text-gray-600 truncate block max-w-[280px]" title={row.subject}>
        {row.subject}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'error',
    header: 'Error',
    render: (row) =>
      row.error ? (
        <span
          className="text-xs text-red-500 truncate block max-w-[200px]"
          title={row.error}
        >
          {row.error}
        </span>
      ) : (
        <span className="text-xs text-gray-300">&mdash;</span>
      ),
  },
];

const statusTabs = [
  { label: 'All', value: '' },
  { label: 'Sent', value: 'sent' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
];

const typeTabs = [
  { label: 'All Types', value: '' },
  { label: 'Welcome', value: 'welcome' },
  { label: 'Storage Warning', value: 'storage_warning' },
  { label: 'Storage Deleted', value: 'storage_deleted' },
];

interface Props {
  searchParams: Promise<{ page?: string; status?: string; type?: string }>;
}

export default async function AdminEmailsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const status = params.status || '';
  const emailType = params.type || '';

  const data = await getAdminEmailLogs({ page, status, emailType });
  const totalPages = Math.ceil(data.total / data.pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Email Logs</h1>
        <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
          {data.total}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <FilterTabs tabs={statusTabs} paramName="status" />
        <div className="h-5 w-px bg-gray-200 hidden sm:block" />
        <FilterTabs tabs={typeTabs} paramName="type" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={data.logs}
          rowKey={(row) => row.id}
          emptyMessage="No emails sent yet."
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={data.total}
          pageSize={data.pageSize}
        />
      </div>
    </div>
  );
}
