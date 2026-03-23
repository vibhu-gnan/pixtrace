import jsPDF from 'jspdf';
import {
  type InvoiceData,
  formatINR,
  invoiceSubtotal,
  invoiceTax,
  invoiceTotal,
  lineItemTotal,
} from './types';
import {
  PIXTRACE_BUSINESS,
  INVOICE_COLORS,
  LOGO_BASE64,
} from './constants';

// A4 in mm
const PAGE_W = 210;
const PAGE_H = 297;
const LEFT = 25;
const RIGHT_EDGE = PAGE_W - 25;
const FOOTER_ZONE = PAGE_H - 25; // content must stay above this y
const MAX_LINE_ITEMS_PER_PAGE = 12;

/**
 * Generate a Pixtrace invoice PDF (client-side).
 * Returns a jsPDF instance — call .save() or .output() on it.
 */
export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({
    title: `Invoice - Pixtrace - ${data.invoiceNumber || 'DRAFT'}`,
    author: 'Pixtrace',
  });

  let y = 30;

  // =========== LOGO + PIXTRACE branding (top right) ===========
  drawBranding(doc, y);

  // =========== FROM ===========
  y = drawFromSection(doc, y);

  // =========== TO ===========
  y = drawToSection(doc, y, data);

  // =========== INVOICE DETAILS (right side) ===========
  drawInvoiceDetails(doc, y, data);

  // =========== BILLING TABLE ===========
  y = drawBillingTable(doc, y, data);

  // =========== SUMMARY ===========
  y = drawSummary(doc, y, data);

  // Page break check before payment/notes/terms
  y = ensureSpace(doc, y, 60);

  // =========== PAYMENT INFO ===========
  y = drawPaymentInfo(doc, y, data);

  // =========== NOTES ===========
  y = drawNotes(doc, y, data.notes);

  // =========== TERMS ===========
  y = drawTerms(doc, y, data.terms);

  // =========== FOOTER (on every page) ===========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc);
  }

  return doc;
}

// ─── Page overflow helper ────────────────────────────────────

/** If y + needed space would exceed the footer zone, add a new page and reset y */
function ensureSpace(doc: jsPDF, y: number, neededMm: number): number {
  if (y + neededMm > FOOTER_ZONE) {
    doc.addPage();
    return 25; // top margin on new page
  }
  return y;
}

// ─── Branding ────────────────────────────────────────────────

function drawBranding(doc: jsPDF, y: number) {
  const brandText = 'PIXTRACE';
  const fontSize = 24;

  const logoSize = 28;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const textW = doc.getTextWidth(brandText);
  const gap = -7.5;
  const totalW = logoSize + gap + textW;
  const brandX = RIGHT_EDGE - totalW;
  const logoY = y - 4;

  try {
    doc.addImage(LOGO_BASE64, 'PNG', brandX, logoY, logoSize, logoSize);
  } catch {
    // Logo failed to load — skip silently
  }

  const textY = logoY + logoSize / 2 + fontSize * 0.012;
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.text(brandText, brandX + logoSize + gap, textY);
}

// ─── From Section ────────────────────────────────────────────

function drawFromSection(doc: jsPDF, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INVOICE_COLORS.mediumGray);
  doc.text('From:', LEFT, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text(PIXTRACE_BUSINESS.name, LEFT, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  for (const line of PIXTRACE_BUSINESS.addressLines) {
    y += 4;
    doc.text(line, LEFT, y);
  }

  y += 4.5;
  doc.setTextColor(INVOICE_COLORS.accent);
  doc.text(PIXTRACE_BUSINESS.email, LEFT, y);

  y += 4.5;
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text(`PAN: ${PIXTRACE_BUSINESS.pan}`, LEFT, y);

  return y;
}

// ─── To Section ──────────────────────────────────────────────

function drawToSection(doc: jsPDF, y: number, data: InvoiceData): number {
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INVOICE_COLORS.mediumGray);
  doc.text('To:', LEFT, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text(safeText(data.recipient.name, 'N/A'), LEFT, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  // Cap address lines to prevent overflow (max 5 lines)
  const addressLines = (data.recipient.addressLines || []).slice(0, 5);
  for (const line of addressLines) {
    if (!line.trim()) continue;
    y += 4;
    doc.text(truncate(line, 60), LEFT, y);
  }

  if (data.recipient.email) {
    y += 4.5;
    doc.setTextColor(INVOICE_COLORS.accent);
    doc.text(truncate(data.recipient.email, 50), LEFT, y);
  }

  return y;
}

// ─── Invoice Details (right column) ──────────────────────────

function drawInvoiceDetails(doc: jsPDF, toSectionEndY: number, data: InvoiceData) {
  const labelX = 115;
  const total = invoiceTotal(data.lineItems, data.taxRate);
  const amountPaid = data.payment?.amount ?? 0;
  const balance = Math.max(0, total - amountPaid);

  let detY = toSectionEndY - 26;

  const details: [string, string][] = [
    ['Invoice #:', safeText(data.invoiceNumber, 'DRAFT')],
    ['Date of Issue:', safeText(data.dateOfIssue, '-')],
    ['Next Payment Due:', safeText(data.dueDate, '-')],
    ['Balance:', formatINR(balance)],
    ['Currency:', safeText(data.currency, 'INR')],
  ];

  for (const [label, value] of details) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(INVOICE_COLORS.dark);
    doc.text(label, labelX, detY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, RIGHT_EDGE, detY, { align: 'right' });
    detY += 6;
  }

  // Status badge
  detY += 2;
  const statusConfig: Record<string, { color: string; label: string }> = {
    paid: { color: INVOICE_COLORS.green, label: 'PAID' },
    partial: { color: '#F59E0B', label: 'PARTIAL' },
    unpaid: { color: INVOICE_COLORS.accent, label: 'UNPAID' },
  };
  const badge = statusConfig[data.status] || statusConfig.unpaid;
  drawStatusBadge(doc, RIGHT_EDGE, detY, badge.color, badge.label);
}

function drawStatusBadge(doc: jsPDF, rightX: number, y: number, color: string, label: string) {
  const bw = 24;
  const bh = 7.5;
  const bx = rightX - bw;
  doc.setFillColor(color);
  doc.roundedRect(bx, y, bw, bh, 3.5, 3.5, 'F');
  doc.setTextColor(INVOICE_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, bx + bw / 2, y + bh / 2 + 1, { align: 'center' });
}

// ─── Billing Table ───────────────────────────────────────────

function drawBillingTable(doc: jsPDF, y: number, data: InvoiceData): number {
  let tableY = y + 14;

  // Header accent line
  doc.setDrawColor(INVOICE_COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(LEFT, tableY - 4, RIGHT_EDGE, tableY - 4);

  const cols = {
    prod: LEFT,
    desc: 68,
    price: 112,
    qty: 132,
    disc: 148,
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text('Product/Service', cols.prod, tableY + 1.5);
  doc.text('Description', cols.desc, tableY + 1.5);
  doc.text('Price', cols.price, tableY + 1.5);
  doc.text('QTY', cols.qty, tableY + 1.5);
  doc.text('Discount', cols.disc, tableY + 1.5);
  doc.text('Total', RIGHT_EDGE, tableY + 1.5, { align: 'right' });

  tableY += 4.5;
  doc.setDrawColor(INVOICE_COLORS.borderGray);
  doc.setLineWidth(0.2);
  doc.line(LEFT, tableY, RIGHT_EDGE, tableY);

  // Rows — cap at MAX_LINE_ITEMS_PER_PAGE to prevent overflow
  const items = (data.lineItems || []).slice(0, MAX_LINE_ITEMS_PER_PAGE);

  if (items.length === 0) {
    // Empty state
    tableY += 7;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(INVOICE_COLORS.mediumGray);
    doc.text('No items', LEFT, tableY);
    tableY += 7;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(INVOICE_COLORS.dark);

    for (const item of items) {
      // Check page overflow before each row
      tableY = ensureSpace(doc, tableY, 14);

      tableY += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(INVOICE_COLORS.dark);

      doc.text(truncate(item.product, 22), cols.prod, tableY);

      // Description — split into max 2 lines
      const desc = item.description || '';
      const descLines = desc ? doc.splitTextToSize(desc, 40) : [''];
      doc.text(descLines[0] || '', cols.desc, tableY);
      if (descLines[1]) {
        doc.text(truncate(descLines[1], 25), cols.desc, tableY + 4);
      }

      doc.text(formatINR(item.price), cols.price, tableY);
      doc.text(String(Math.max(0, item.quantity || 1)), cols.qty, tableY);
      doc.text(item.discount > 0 ? `${item.discount}%` : '-', cols.disc, tableY);
      doc.text(formatINR(lineItemTotal(item)), RIGHT_EDGE, tableY, { align: 'right' });

      tableY += descLines.length > 1 ? 4 : 0;
    }

    // Show truncation notice if items were capped
    if (data.lineItems.length > MAX_LINE_ITEMS_PER_PAGE) {
      tableY += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(INVOICE_COLORS.mediumGray);
      doc.text(
        `+ ${data.lineItems.length - MAX_LINE_ITEMS_PER_PAGE} more item(s) not shown`,
        LEFT,
        tableY,
      );
    }

    tableY += 7;
  }

  doc.setDrawColor(INVOICE_COLORS.borderGray);
  doc.line(LEFT, tableY, RIGHT_EDGE, tableY);

  return tableY;
}

// ─── Summary ─────────────────────────────────────────────────

function drawSummary(doc: jsPDF, tableEndY: number, data: InvoiceData): number {
  let sumY = tableEndY + 8;
  const slx = 115;

  const subtotal = invoiceSubtotal(data.lineItems);
  const tax = invoiceTax(data.lineItems, data.taxRate);
  const total = invoiceTotal(data.lineItems, data.taxRate);
  const amountPaid = data.payment?.amount ?? 0;
  const balance = Math.max(0, total - amountPaid);

  sumY = ensureSpace(doc, sumY, 40);

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text('Subtotal:', slx, sumY);
  doc.text(formatINR(subtotal), RIGHT_EDGE, sumY, { align: 'right' });
  sumY += 5.5;

  // Tax
  doc.text('Tax:', slx, sumY);
  doc.text(formatINR(tax), RIGHT_EDGE, sumY, { align: 'right' });
  sumY += 3;

  // GST note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(INVOICE_COLORS.mediumGray);
  doc.text(PIXTRACE_BUSINESS.gstNote, RIGHT_EDGE, sumY, { align: 'right' });
  sumY += 4;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text('Total:', slx, sumY);
  doc.text(formatINR(total), RIGHT_EDGE, sumY, { align: 'right' });
  sumY += 5.5;

  // Amount Paid
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Amount Paid:', slx, sumY);
  doc.text(formatINR(amountPaid), RIGHT_EDGE, sumY, { align: 'right' });
  sumY += 4;

  // Separator
  doc.setDrawColor(INVOICE_COLORS.dark);
  doc.setLineWidth(0.3);
  doc.line(slx, sumY, RIGHT_EDGE, sumY);
  sumY += 5.5;

  // Balance Due
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Balance Due:', slx, sumY);
  doc.setTextColor(balance === 0 ? INVOICE_COLORS.green : INVOICE_COLORS.accent);
  doc.text(formatINR(balance), RIGHT_EDGE, sumY, { align: 'right' });

  return sumY;
}

// ─── Payment Info ────────────────────────────────────────────

function drawPaymentInfo(doc: jsPDF, sumEndY: number, data: InvoiceData): number {
  if (!data.payment) return sumEndY;

  let payY = sumEndY + 12;
  payY = ensureSpace(doc, payY, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text('Payment Information', LEFT, payY);
  payY += 2.5;

  doc.setDrawColor(INVOICE_COLORS.accent);
  doc.setLineWidth(0.4);
  doc.line(LEFT, payY, 88, payY);
  payY += 5.5;

  const rows: [string, string][] = [
    ['Method:', safeText(data.payment.method, '-')],
    ['Transaction ID:', truncate(safeText(data.payment.transactionId, '-'), 40)],
  ];
  if (data.payment.utr) {
    rows.push(['UTR:', truncate(data.payment.utr, 30)]);
  }
  rows.push(
    ['Date:', safeText(data.payment.date, '-')],
    ['Amount:', formatINR(data.payment.amount)],
  );

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(INVOICE_COLORS.dark);
    doc.text(label, LEFT, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 57, payY);
    payY += 4.5;
  }

  return payY;
}

// ─── Notes ───────────────────────────────────────────────────

function drawNotes(doc: jsPDF, y: number, notes: string): number {
  if (!notes?.trim()) return y;

  y += 7;
  y = ensureSpace(doc, y, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text('Notes', LEFT, y);
  y += 2.5;

  doc.setDrawColor(INVOICE_COLORS.accent);
  doc.setLineWidth(0.4);
  doc.line(LEFT, y, 48, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(INVOICE_COLORS.dark);

  const lines: string[] = doc.splitTextToSize(notes, RIGHT_EDGE - LEFT);
  // Cap to prevent runaway notes
  const cappedLines = lines.slice(0, 6);
  doc.text(cappedLines, LEFT, y);
  y += cappedLines.length * 4;

  return y;
}

// ─── Terms ───────────────────────────────────────────────────

function drawTerms(doc: jsPDF, y: number, terms: string): number {
  if (!terms?.trim()) return y;

  y += 5;
  y = ensureSpace(doc, y, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INVOICE_COLORS.dark);
  doc.text('Terms', LEFT, y);
  y += 2.5;

  doc.setDrawColor(INVOICE_COLORS.accent);
  doc.setLineWidth(0.4);
  doc.line(LEFT, y, 48, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(INVOICE_COLORS.dark);

  const termsLines = terms.split('\n').filter(Boolean).slice(0, 8);
  for (const line of termsLines) {
    const wrapped: string[] = doc.splitTextToSize(line, RIGHT_EDGE - LEFT);
    const cappedWrapped = wrapped.slice(0, 3);
    doc.text(cappedWrapped, LEFT, y);
    y += cappedWrapped.length * 3.5 + 1;
  }

  return y;
}

// ─── Footer ──────────────────────────────────────────────────

function drawFooter(doc: jsPDF) {
  const footerY = PAGE_H - 18;
  doc.setDrawColor(INVOICE_COLORS.accent);
  doc.setLineWidth(0.4);
  doc.line(LEFT, footerY, RIGHT_EDGE, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(INVOICE_COLORS.mediumGray);
  doc.text(
    'This is a computer-generated invoice and does not require a signature.',
    PAGE_W / 2,
    footerY + 4.5,
    { align: 'center' },
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/** Return value or fallback — never empty string for required fields */
function safeText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}
