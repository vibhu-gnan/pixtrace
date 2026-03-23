'use client';

import { useState, useTransition } from 'react';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { InvoiceModal, type InvoiceModalPrefill } from '@/components/admin/invoice-modal';
import { getPaymentForInvoice } from '@/actions/admin';
import type { InvoiceLineItem } from '@/lib/invoice/types';
import { INVOICE_DEFAULTS } from '@/lib/invoice/constants';

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  method: string | null;
  paid_at: string | null;
  created_at: string;
  razorpay_payment_id: string | null;
  organizers: { name: string | null; email: string } | null;
};

function formatAmount(paise: number): string {
  return `\u20B9${(paise / 100).toLocaleString('en-IN')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface PaymentHistorySectionProps {
  paymentsData: PaymentRow[];
  paymentsTotal: number;
  paymentsPage: number;
  paymentsTotalPages: number;
}

export function PaymentHistorySection({
  paymentsData,
  paymentsTotal,
  paymentsPage,
  paymentsTotalPages,
}: PaymentHistorySectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<InvoiceModalPrefill | null>(null);
  const [loadingPaymentId, setLoadingPaymentId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleInvoiceClick(payment: PaymentRow) {
    setLoadingPaymentId(payment.id);

    startTransition(async () => {
      try {
        const result = await getPaymentForInvoice(payment.id);

        if (result.data) {
          const d = result.data;
          const lineItem: InvoiceLineItem = {
            product: d.planName,
            description: 'AI-powered photo search\n& event gallery platform',
            price: d.amountRupees,
            quantity: 1,
            discount: 0,
          };

          // Pass raw ISO dates — the modal's formatDateForInput handles conversion
          const rawDate = d.paidAt || d.createdAt;
          setPrefillData({
            planId: d.planId,
            organizerId: d.organizerId,
            paymentId: d.paymentId,
            dateOfIssue: rawDate,
            dueDate: rawDate,
            currency: 'INR',
            status: 'paid',
            recipient: {
              name: d.recipientName,
              addressLines: [],
              email: d.recipientEmail,
            },
            lineItems: [lineItem],
            taxRate: 0,
            payment: {
              method: d.method ? `${d.method} via Razorpay` : 'Razorpay',
              transactionId: d.razorpayPaymentId || '',
              utr: '',
              date: rawDate,
              amount: d.amountRupees,
            },
            notes: INVOICE_DEFAULTS.notes,
            terms: INVOICE_DEFAULTS.terms.join('\n'),
          });
        } else {
          // Fallback: use the row data directly with raw ISO dates
          setPrefillData({
            planId: null,
            organizerId: null,
            paymentId: payment.id,
            status: 'paid',
            dateOfIssue: payment.paid_at || payment.created_at,
            dueDate: payment.paid_at || payment.created_at,
            recipient: {
              name: payment.organizers?.name || payment.organizers?.email?.split('@')[0] || '',
              addressLines: [],
              email: payment.organizers?.email || '',
            },
            lineItems: [
              {
                product: 'Pixtrace Plan',
                description: '',
                price: payment.amount / 100,
                quantity: 1,
                discount: 0,
              },
            ],
            payment: {
              method: payment.method || 'Razorpay',
              transactionId: payment.razorpay_payment_id || '',
              utr: '',
              date: payment.paid_at || payment.created_at,
              amount: payment.amount / 100,
            },
          });
        }

        setModalOpen(true);
      } catch (err) {
        console.error('Failed to load payment for invoice:', err);
        // Open modal with basic data anyway
        setPrefillData(null);
        setModalOpen(true);
      } finally {
        setLoadingPaymentId(null);
      }
    });
  }

  function handleManualInvoice() {
    setPrefillData(null);
    setModalOpen(true);
  }

  const paymentColumns: Column<PaymentRow>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="text-sm text-gray-700">{formatDate(row.paid_at || row.created_at)}</span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-gray-900 truncate">
            {row.organizers?.name || row.organizers?.email?.split('@')[0] || '\u2014'}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <span className="text-sm font-medium text-gray-900">{formatAmount(row.amount)}</span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => (
        <span className="text-sm text-gray-500 capitalize">{row.method || '\u2014'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'razorpay',
      header: 'Payment ID',
      render: (row) => (
        <span className="text-xs font-mono text-gray-400 truncate block max-w-[180px]">
          {row.razorpay_payment_id || '\u2014'}
        </span>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice',
      render: (row) => (
        <button
          onClick={() => handleInvoiceClick(row)}
          disabled={loadingPaymentId === row.id || isPending}
          className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-[#E8553A] transition-colors disabled:opacity-50"
          title="Generate Invoice"
        >
          {loadingPaymentId === row.id ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
            <span className="text-sm text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
              {paymentsTotal}
            </span>
          </div>
          <button
            onClick={handleManualInvoice}
            className="px-3.5 py-1.5 text-sm font-medium text-[#E8553A] border border-[#E8553A]/30 hover:bg-[#E8553A]/5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Invoice
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <DataTable
            columns={paymentColumns}
            data={paymentsData}
            rowKey={(row) => row.id}
            emptyMessage="No payments recorded."
          />
          {paymentsTotalPages > 1 && (
            <div className="border-t border-gray-100 px-6 py-3 text-sm text-gray-400">
              Showing page {paymentsPage} of {paymentsTotalPages} ({paymentsTotal} total payments)
            </div>
          )}
        </div>
      </div>

      <InvoiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        prefillData={prefillData}
      />
    </>
  );
}
