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
