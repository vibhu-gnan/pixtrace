export { LOGO_BASE64 } from './logo-base64';

export const PIXTRACE_BUSINESS = {
  name: 'Pixtrace',
  addressLines: [
    'Nadimuru, Vinjamuru, Vinjamuru Mandalam,',
    'Nandigunta, Nellore,',
    'Andhra Pradesh 524228, India',
  ],
  email: 'support@pixtrace.in',
  pan: 'CRTPV2751H',
  gstNote: '(Not registered under GST)',
} as const;

export const INVOICE_COLORS = {
  accent: '#E8553A',
  dark: '#333333',
  mediumGray: '#999999',
  borderGray: '#DDDDDD',
  green: '#2E7D32',
  white: '#FFFFFF',
} as const;

/**
 * Plan ID → 2-digit invoice code mapping.
 * Format: {planCode}{DDMMYYYY}{dailySeq4}
 * Example: 01240220260001 = Starter plan, 24 Feb 2026, 1st invoice of day
 */
export const PLAN_INVOICE_CODES: Record<string, string> = {
  free: '00',
  starter: '01',
  pro: '02',
  enterprise: '03',
};

/** Fallback code for manual/unknown plans */
export const DEFAULT_PLAN_CODE = '99';

/** Get 2-digit plan code from plan_id */
export function getPlanCode(planId: string | null | undefined): string {
  if (!planId) return DEFAULT_PLAN_CODE;
  const normalized = planId.toLowerCase().trim();
  return PLAN_INVOICE_CODES[normalized] || DEFAULT_PLAN_CODE;
}

/**
 * Build invoice number from parts.
 * Format: {planCode}{DDMMYYYY}{seq} — e.g. 01240220260001
 */
export function buildInvoiceNumber(
  planCode: string,
  date: Date,
  dailySequence: number,
): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const seq = String(Math.max(1, dailySequence)).padStart(4, '0');
  return `${planCode}${dd}${mm}${yyyy}${seq}`;
}

export const INVOICE_DEFAULTS: {
  notes: string;
  terms: string[];
  currency: string;
  taxRate: number;
} = {
  notes:
    'Thank you for subscribing to Pixtrace! For support, reach out at support@pixtrace.in',
  terms: [
    'All payments are non-refundable. Access is granted immediately upon payment.',
    'For issues, contact support within 7 days of purchase.',
  ],
  currency: 'INR',
  taxRate: 0,
};
