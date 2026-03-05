import { getAdminInquiries } from '@/actions/admin';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { Pagination } from '@/components/admin/pagination';
import { FilterTabs } from '@/components/admin/filter-tabs';
import { InquiryActions } from './inquiry-actions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type InquiryRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  category: string | null;
  events_per_month: number | null;
  photos_per_event: number | null;
  additional_needs: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

const columns: Column<InquiryRow>[] = [
  {
    key: 'contact',
    header: 'Contact',
    render: (row) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
        <p className="text-xs text-gray-400 truncate">{row.email}</p>
        {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
      </div>
    ),
  },
  {
    key: 'organization',
    header: 'Organization',
    render: (row) => (
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate">{row.organization || '—'}</p>
        {row.category && (
          <p className="text-xs text-gray-400 capitalize">{row.category}</p>
        )}
      </div>
    ),
  },
  {
    key: 'scale',
    header: 'Scale',
    render: (row) => (
      <div className="text-sm text-gray-500">
        <p>{row.events_per_month ? `${row.events_per_month} events/mo` : '—'}</p>
        <p className="text-xs text-gray-400">
          {row.photos_per_event ? `${row.photos_per_event} photos/event` : ''}
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'created',
    header: 'Submitted',
    render: (row) => <span className="text-sm text-gray-500">{formatDate(row.created_at)}</span>,
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (row) => (
      <InquiryActions
        inquiryId={row.id}
        currentStatus={row.status}
        currentNotes={row.notes}
        additionalNeeds={row.additional_needs}
      />
    ),
    headerClassName: 'w-40',
  },
];

const statusTabs = [
  { label: 'All', value: '' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Converted', value: 'converted' },
  { label: 'Closed', value: 'closed' },
];

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function AdminInquiriesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const status = params.status || '';

  const { inquiries, total, pageSize } = await getAdminInquiries({ page, status });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Enterprise Inquiries</h1>
        <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
          {total}
        </span>
      </div>

      <FilterTabs tabs={statusTabs} paramName="status" />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={inquiries}
          rowKey={(row) => row.id}
          emptyMessage="No inquiries found."
        />
        <Pagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={pageSize} />
      </div>
    </div>
  );
}
