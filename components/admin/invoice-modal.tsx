'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  type InvoiceData,
  type InvoiceLineItem,
  type InvoiceStatus,
} from '@/lib/invoice/types';
import { INVOICE_DEFAULTS } from '@/lib/invoice/constants';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillData?: Partial<InvoiceData> | null;
}

const EMPTY_LINE_ITEM: InvoiceLineItem = {
  product: '',
  description: '',
  price: 0,
  quantity: 1,
  discount: 0,
};

const MAX_LINE_ITEMS = 12;

function generateInvoiceNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `INV${yy}${mm}${dd}${rand}`;
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0];
  }
  // If already in YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function formatDateForDisplay(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function InvoiceModal({ isOpen, onClose, prefillData }: InvoiceModalProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dateOfIssue, setDateOfIssue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [status, setStatus] = useState<InvoiceStatus>('paid');

  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [taxRate, setTaxRate] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentUtr, setPaymentUtr] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);

  const [notes, setNotes] = useState(INVOICE_DEFAULTS.notes);
  const [terms, setTerms] = useState(INVOICE_DEFAULTS.terms.join('\n'));

  const resetToDefaults = useCallback(
    (prefill?: Partial<InvoiceData> | null) => {
      const today = new Date().toISOString().split('T')[0];

      setInvoiceNumber(prefill?.invoiceNumber || generateInvoiceNumber());
      setDateOfIssue(formatDateForInput(prefill?.dateOfIssue) || today);
      setDueDate(formatDateForInput(prefill?.dueDate) || today);
      setCurrency(prefill?.currency || 'INR');
      setStatus(prefill?.status || 'paid');

      setRecipientName(prefill?.recipient?.name || '');
      setRecipientAddress(prefill?.recipient?.addressLines?.join('\n') || '');
      setRecipientEmail(prefill?.recipient?.email || '');

      setLineItems(
        prefill?.lineItems?.length
          ? prefill.lineItems
          : [{ ...EMPTY_LINE_ITEM }],
      );
      setTaxRate(prefill?.taxRate ?? 0);

      setPaymentMethod(prefill?.payment?.method || '');
      setTransactionId(prefill?.payment?.transactionId || '');
      setPaymentUtr(prefill?.payment?.utr || '');
      setPaymentDate(formatDateForInput(prefill?.payment?.date) || today);
      setPaymentAmount(prefill?.payment?.amount || 0);

      setNotes(prefill?.notes || INVOICE_DEFAULTS.notes);
      setTerms(prefill?.terms || INVOICE_DEFAULTS.terms.join('\n'));

      setError('');
    },
    [],
  );

  useEffect(() => {
    if (isOpen) {
      resetToDefaults(prefillData);
    }
  }, [isOpen, prefillData, resetToDefaults]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll lock when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  function updateLineItem(index: number, field: keyof InvoiceLineItem, value: string | number) {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addLineItem() {
    if (lineItems.length >= MAX_LINE_ITEMS) return;
    setLineItems((prev) => [...prev, { ...EMPTY_LINE_ITEM }]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleGenerate() {
    // Validate
    if (!recipientName.trim()) {
      setError('Recipient name is required');
      return;
    }
    if (!recipientEmail.trim()) {
      setError('Recipient email is required');
      return;
    }
    if (lineItems.every((item) => !item.product.trim())) {
      setError('At least one line item with a product name is required');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      // Dynamic import to avoid loading jspdf on page load
      const { generateInvoicePdf } = await import('@/lib/invoice/generate-invoice-pdf');

      const hasPayment = paymentMethod || transactionId;

      const invoiceData: InvoiceData = {
        invoiceNumber,
        dateOfIssue: formatDateForDisplay(dateOfIssue),
        dueDate: formatDateForDisplay(dueDate),
        currency,
        status,
        recipient: {
          name: recipientName.trim(),
          addressLines: recipientAddress
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
          email: recipientEmail.trim(),
        },
        lineItems: lineItems.filter((item) => item.product.trim()),
        taxRate,
        payment: hasPayment
          ? {
              method: paymentMethod || '-',
              transactionId: transactionId || '-',
              utr: paymentUtr,
              date: paymentDate ? formatDateForDisplay(paymentDate) : '-',
              amount: paymentAmount,
            }
          : null,
        notes,
        terms,
      };

      const doc = generateInvoicePdf(invoiceData);
      // Sanitize invoice number for safe filename
      const safeNum = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_') || 'DRAFT';
      doc.save(`Pixtrace_Invoice_${safeNum}.pdf`);
    } catch (err) {
      console.error('Invoice generation error:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {prefillData ? 'Generate Invoice' : 'Create Invoice'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fill in the details below to generate a PDF invoice
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Invoice Info */}
              <Section title="Invoice Details">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} />
                  <SelectField
                    label="Status"
                    value={status}
                    onChange={(v) => setStatus(v as InvoiceStatus)}
                    options={[
                      { value: 'paid', label: 'Paid' },
                      { value: 'unpaid', label: 'Unpaid' },
                      { value: 'partial', label: 'Partial' },
                    ]}
                  />
                  <Field label="Date of Issue" value={dateOfIssue} onChange={setDateOfIssue} type="date" />
                  <Field label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
                  <Field label="Currency" value={currency} onChange={setCurrency} />
                </div>
              </Section>

              {/* Recipient */}
              <Section title="Recipient (To)">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" value={recipientName} onChange={setRecipientName} required />
                  <Field label="Email" value={recipientEmail} onChange={setRecipientEmail} type="email" required />
                </div>
                <TextArea
                  label="Address (one line per row)"
                  value={recipientAddress}
                  onChange={setRecipientAddress}
                  rows={3}
                />
              </Section>

              {/* Line Items */}
              <Section title="Line Items">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start mb-2">
                    <div className="grid grid-cols-5 gap-2 flex-1">
                      <Field
                        label={idx === 0 ? 'Product' : undefined}
                        value={item.product}
                        onChange={(v) => updateLineItem(idx, 'product', v)}
                        placeholder="Product/Service"
                      />
                      <Field
                        label={idx === 0 ? 'Description' : undefined}
                        value={item.description}
                        onChange={(v) => updateLineItem(idx, 'description', v)}
                        placeholder="Description"
                      />
                      <Field
                        label={idx === 0 ? 'Price (Rs)' : undefined}
                        value={String(item.price)}
                        onChange={(v) => updateLineItem(idx, 'price', parseFloat(v) || 0)}
                        type="number"
                      />
                      <Field
                        label={idx === 0 ? 'QTY' : undefined}
                        value={String(item.quantity)}
                        onChange={(v) => updateLineItem(idx, 'quantity', parseInt(v) || 1)}
                        type="number"
                      />
                      <Field
                        label={idx === 0 ? 'Disc %' : undefined}
                        value={String(item.discount)}
                        onChange={(v) => updateLineItem(idx, 'discount', parseFloat(v) || 0)}
                        type="number"
                      />
                    </div>
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(idx)}
                        className={`p-1.5 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors ${idx === 0 ? 'mt-6' : ''}`}
                        title="Remove item"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addLineItem}
                  disabled={lineItems.length >= MAX_LINE_ITEMS}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  + Add Line Item{lineItems.length >= MAX_LINE_ITEMS ? ` (max ${MAX_LINE_ITEMS})` : ''}
                </button>
                <div className="mt-3 w-40">
                  <Field
                    label="Tax Rate %"
                    value={String(taxRate)}
                    onChange={(v) => setTaxRate(parseFloat(v) || 0)}
                    type="number"
                  />
                </div>
              </Section>

              {/* Payment Info */}
              <Section title="Payment Information" optional>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Method" value={paymentMethod} onChange={setPaymentMethod} placeholder="e.g. UPI via Razorpay" />
                  <Field label="Transaction ID" value={transactionId} onChange={setTransactionId} />
                  <Field label="UTR" value={paymentUtr} onChange={setPaymentUtr} />
                  <Field label="Date" value={paymentDate} onChange={setPaymentDate} type="date" />
                  <Field
                    label="Amount Paid (Rs)"
                    value={String(paymentAmount)}
                    onChange={(v) => setPaymentAmount(parseFloat(v) || 0)}
                    type="number"
                  />
                </div>
              </Section>

              {/* Notes & Terms */}
              <Section title="Notes & Terms">
                <TextArea label="Notes" value={notes} onChange={setNotes} rows={2} />
                <TextArea label="Terms" value={terms} onChange={setTerms} rows={3} />
              </Section>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
              {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
              {!error && <div className="flex-1" />}

              <div className="flex items-center gap-2">
                {prefillData && (
                  <button
                    onClick={() => resetToDefaults(prefillData)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-5 py-2 text-sm font-medium text-white bg-[#E8553A] hover:bg-[#d14a32] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Reusable form components ────────────────────────────────

function Section({
  title,
  optional,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        {title}
        {optional && <span className="text-xs text-gray-400 font-normal">(optional)</span>}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      {label && (
        <label className="block text-xs text-gray-500 mb-1">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 outline-none transition-colors"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 outline-none transition-colors resize-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 outline-none transition-colors bg-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
