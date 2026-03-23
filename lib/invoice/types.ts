export interface InvoiceLineItem {
  product: string;
  description: string;
  price: number; // in rupees (not paise)
  quantity: number;
  discount: number; // percentage (0-100)
}

export interface InvoicePaymentInfo {
  method: string;
  transactionId: string;
  utr: string;
  date: string; // formatted date string
  amount: number; // in rupees
}

export interface InvoiceRecipient {
  name: string;
  addressLines: string[];
  email: string;
}

export type InvoiceStatus = 'paid' | 'unpaid' | 'partial';

export interface InvoiceData {
  invoiceNumber: string;
  dateOfIssue: string; // formatted date string
  dueDate: string;
  currency: string;
  status: InvoiceStatus;
  recipient: InvoiceRecipient;
  lineItems: InvoiceLineItem[];
  taxRate: number; // percentage (0-100), typically 0 since not GST registered
  payment: InvoicePaymentInfo | null;
  notes: string;
  terms: string;
}

/** Safely coerce to non-negative finite number */
function safeNum(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Helper to compute line item total after discount */
export function lineItemTotal(item: InvoiceLineItem): number {
  const price = safeNum(item.price);
  const qty = safeNum(item.quantity) || 1;
  const discount = Math.min(100, Math.max(0, item.discount || 0));
  const subtotal = price * qty;
  return subtotal - subtotal * (discount / 100);
}

/** Compute invoice subtotal */
export function invoiceSubtotal(items: InvoiceLineItem[]): number {
  if (!items?.length) return 0;
  return items.reduce((sum, item) => sum + lineItemTotal(item), 0);
}

/** Compute invoice tax */
export function invoiceTax(items: InvoiceLineItem[], taxRate: number): number {
  const rate = Math.min(100, Math.max(0, taxRate || 0));
  return invoiceSubtotal(items) * (rate / 100);
}

/** Compute invoice grand total */
export function invoiceTotal(items: InvoiceLineItem[], taxRate: number): number {
  return invoiceSubtotal(items) + invoiceTax(items, taxRate);
}

/** Format amount in INR — guards against NaN/Infinity */
export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `Rs. ${safe.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
