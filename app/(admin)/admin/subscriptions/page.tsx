import { getAdminSubscriptions, getAdminPayments } from '@/actions/admin';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { Pagination } from '@/components/admin/pagination';
import { FilterTabs } from '@/components/admin/filter-tabs';
import { PaymentHistorySection } from '@/components/admin/payment-history-section';

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Subscription table columns ──────────────────────────────

type SubRow = {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  razorpay_subscription_id: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  organizers: { name: string | null; email: string } | null;
  plans: { name: string; price_monthly: number } | null;
};

const subColumns: Column<SubRow>[] = [
  {
    key: 'user',
    header: 'User',
    render: (row) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {row.organizers?.name || row.organizers?.email?.split('@')[0] || '—'}
        </p>
        <p className="text-xs text-gray-400 truncate">{row.organizers?.email}</p>
      </div>
    ),
  },
  {
    key: 'plan',
    header: 'Plan',
    render: (row) => (
      <div>
        <p className="text-sm font-medium text-gray-900">{row.plans?.name || row.plan_id}</p>
        {row.plans?.price_monthly ? (
          <p className="text-xs text-gray-400">{formatAmount(row.plans.price_monthly)}/mo</p>
        ) : null}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <div className="flex items-center gap-1.5">
        <StatusBadge status={row.status} />
        {row.cancel_at_period_end && (
          <span className="text-[10px] text-orange-600 font-medium">Cancelling</span>
        )}
      </div>
    ),
  },
  {
    key: 'period',
    header: 'Current Period',
    render: (row) => (
      <span className="text-sm text-gray-500">
        {formatDate(row.current_period_start)} – {formatDate(row.current_period_end)}
      </span>
    ),
  },
  {
    key: 'razorpay',
    header: 'Razorpay ID',
    render: (row) => (
      <span className="text-xs font-mono text-gray-400 truncate block max-w-[180px]">
        {row.razorpay_subscription_id || '—'}
      </span>
    ),
  },
];

// Payment columns are now defined in PaymentHistorySection client component

const statusTabs = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Halted', value: 'halted' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Completed', value: 'completed' },
];

interface Props {
  searchParams: Promise<{ page?: string; status?: string; payments_page?: string }>;
}

export default async function AdminSubscriptionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const status = params.status || '';
  const paymentsPage = parseInt(params.payments_page || '1', 10);

  const [subsData, paymentsData] = await Promise.all([
    getAdminSubscriptions({ page, status }),
    getAdminPayments({ page: paymentsPage }),
  ]);

  const subsTotalPages = Math.ceil(subsData.total / subsData.pageSize);
  const paymentsTotalPages = Math.ceil(paymentsData.total / paymentsData.pageSize);

  return (
    <div className="space-y-8">
      {/* Subscriptions Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
            {subsData.total}
          </span>
        </div>

        <FilterTabs tabs={statusTabs} paramName="status" />

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <DataTable
            columns={subColumns}
            data={subsData.subscriptions}
            rowKey={(row) => row.id}
            emptyMessage="No subscriptions found."
          />
          <Pagination
            currentPage={page}
            totalPages={subsTotalPages}
            totalItems={subsData.total}
            pageSize={subsData.pageSize}
          />
        </div>
      </div>

      {/* Payments Section (client component with invoice modal) */}
      <PaymentHistorySection
        paymentsData={paymentsData.payments}
        paymentsTotal={paymentsData.total}
        paymentsPage={paymentsPage}
        paymentsTotalPages={paymentsTotalPages}
      />
    </div>
  );
}
