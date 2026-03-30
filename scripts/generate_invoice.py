"""Generate Pixtrace Invoice PDF"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas
import os

OUTPUT_PATH = os.path.expanduser(r"~\Downloads\Pixtrace_Invoice_01240220260001.pdf")
LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "logo.png")

# Colors
ACCENT = HexColor("#E8553A")
MEDIUM_GRAY = HexColor("#999999")
DARK = HexColor("#333333")
BORDER_GRAY = HexColor("#DDDDDD")
GREEN = HexColor("#2E7D32")

LEFT = 25 * mm
RIGHT_EDGE = A4[0] - 25 * mm


def draw_invoice(c, width, height):
    y = height - 30 * mm

    # =========== LOGO + PIXTRACE branding (top right) ===========
    if os.path.exists(LOGO_PATH):
        logo_size = 28 * mm
        brand_text = "PIXTRACE"
        font_size = 24
        c.setFont("Helvetica-Bold", font_size)
        text_w = c.stringWidth(brand_text, "Helvetica-Bold", font_size)
        gap = -7.5 * mm
        total_w = logo_size + gap + text_w
        brand_x = RIGHT_EDGE - total_w
        logo_y = y - 20 * mm
        c.drawImage(LOGO_PATH, brand_x, logo_y, width=logo_size, height=logo_size,
                     preserveAspectRatio=True, mask='auto')
        text_y = logo_y + (logo_size / 2) - (font_size * 0.35)
        c.setFillColor(DARK)
        c.setFont("Helvetica-Bold", font_size)
        c.drawString(brand_x + logo_size + gap, text_y, brand_text)

    # =========== FROM ===========
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(MEDIUM_GRAY)
    c.drawString(LEFT, y, "From:")
    y -= 6 * mm
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(DARK)
    c.drawString(LEFT, y, "Pixtrace")
    y -= 5 * mm
    c.setFont("Helvetica", 8.5)
    for line in [
        "Nadimuru, Vinjamuru, Vinjamuru Mandalam,",
        "Nandigunta, Nellore,",
        "Andhra Pradesh 524228, India",
    ]:
        y -= 4 * mm
        c.drawString(LEFT, y, line)
    y -= 4.5 * mm
    c.setFillColor(ACCENT)
    c.drawString(LEFT, y, "support@pixtrace.in")
    y -= 4.5 * mm
    c.setFillColor(DARK)
    c.drawString(LEFT, y, "PAN: CRTPV2751H")

    # =========== TO ===========
    y -= 9 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(MEDIUM_GRAY)
    c.drawString(LEFT, y, "To:")
    y -= 6 * mm
    c.setFont("Helvetica-Bold", 10.5)
    c.setFillColor(DARK)
    c.drawString(LEFT, y, "ACIC BMU Foundation")
    y -= 4.5 * mm
    c.setFont("Helvetica", 8.5)
    for line in [
        "2nd Floor, Gateway-B, BML Munjal University,",
        "ACIC-BMU Foundation, 67, KM-Stone,",
        "Sidhrawali, Haryana 122413, India",
    ]:
        y -= 4 * mm
        c.drawString(LEFT, y, line)
    y -= 4.5 * mm
    c.setFillColor(ACCENT)
    c.drawString(LEFT, y, "acic@bmu.edu.in")

    # =========== INVOICE DETAILS (right side, aligned with To section) ===========
    label_x = 115 * mm
    det_y = y + 26 * mm  # Align with the To section area
    for label, value in [
        ("Invoice #:", "01240220260001"),
        ("Date of Issue:", "February 24, 2026"),
        ("Next payment due:", "March 24, 2026"),
        ("Balance:", "Rs. 2,499.00"),
        ("Currency:", "INR"),
    ]:
        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(DARK)
        c.drawString(label_x, det_y, label)
        c.setFont("Helvetica", 8.5)
        c.drawRightString(RIGHT_EDGE, det_y, value)
        det_y -= 6 * mm

    # PAID badge — clean rounded rect below details
    det_y -= 2 * mm
    bw, bh = 24 * mm, 7.5 * mm
    bx = RIGHT_EDGE - bw
    c.setFillColor(GREEN)
    c.roundRect(bx, det_y, bw, bh, 3.5 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(bx + bw / 2, det_y + 2 * mm, "PAID")

    # =========== BILLING TABLE ===========
    table_y = y - 14 * mm

    # Header accent line
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.5)
    c.line(LEFT, table_y + 4 * mm, RIGHT_EDGE, table_y + 4 * mm)

    # Column positions
    cols = {
        "prod": LEFT,
        "desc": 68 * mm,
        "price": 112 * mm,
        "qty": 132 * mm,
        "disc": 148 * mm,
    }

    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(DARK)
    c.drawString(cols["prod"], table_y - 1.5 * mm, "Product/Service")
    c.drawString(cols["desc"], table_y - 1.5 * mm, "Description")
    c.drawString(cols["price"], table_y - 1.5 * mm, "Price")
    c.drawString(cols["qty"], table_y - 1.5 * mm, "QTY")
    c.drawString(cols["disc"], table_y - 1.5 * mm, "Discount")
    c.drawRightString(RIGHT_EDGE, table_y - 1.5 * mm, "Total")

    table_y -= 4.5 * mm
    c.setStrokeColor(BORDER_GRAY)
    c.setLineWidth(0.5)
    c.line(LEFT, table_y, RIGHT_EDGE, table_y)

    # Row
    table_y -= 7 * mm
    c.setFont("Helvetica", 8.5)
    c.setFillColor(DARK)
    c.drawString(cols["prod"], table_y, "Pixtrace Starter Plan")
    c.drawString(cols["desc"], table_y, "AI-powered photo search")
    c.drawString(cols["desc"], table_y - 4 * mm, "& event gallery platform")
    c.drawString(cols["price"], table_y, "Rs. 2,499")
    c.drawString(cols["qty"], table_y, "1")
    c.drawString(cols["disc"], table_y, "-")
    c.drawRightString(RIGHT_EDGE, table_y, "Rs. 2,499.00")

    table_y -= 11 * mm
    c.setStrokeColor(BORDER_GRAY)
    c.line(LEFT, table_y, RIGHT_EDGE, table_y)

    # =========== SUMMARY ===========
    sum_y = table_y - 8 * mm
    slx = 115 * mm

    for label, value, bold in [
        ("Subtotal:", "Rs. 2,499.00", False),
        ("Tax:", "Rs. 0.00", False),
    ]:
        font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFont(font, 8.5)
        c.setFillColor(DARK)
        c.drawString(slx, sum_y, label)
        c.drawRightString(RIGHT_EDGE, sum_y, value)
        sum_y -= 5.5 * mm

    # GST note
    c.setFont("Helvetica", 7)
    c.setFillColor(MEDIUM_GRAY)
    c.drawRightString(RIGHT_EDGE, sum_y + 2 * mm, "(Not registered under GST)")
    sum_y -= 4 * mm

    # Total
    c.setFont("Helvetica-Bold", 9.5)
    c.setFillColor(DARK)
    c.drawString(slx, sum_y, "Total:")
    c.drawRightString(RIGHT_EDGE, sum_y, "Rs. 2,499.00")
    sum_y -= 5.5 * mm

    c.setFont("Helvetica", 8.5)
    c.drawString(slx, sum_y, "Amount Paid:")
    c.drawRightString(RIGHT_EDGE, sum_y, "Rs. 2,499.00")
    sum_y -= 4 * mm

    # Separator
    c.setStrokeColor(DARK)
    c.setLineWidth(0.8)
    c.line(slx, sum_y, RIGHT_EDGE, sum_y)
    sum_y -= 5.5 * mm

    # Balance
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(DARK)
    c.drawString(slx, sum_y, "Balance Due:")
    c.setFillColor(GREEN)
    c.drawRightString(RIGHT_EDGE, sum_y, "Rs. 0.00")

    # =========== PAYMENT INFO ===========
    pay_y = sum_y - 12 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK)
    c.drawString(LEFT, pay_y, "Payment Information")
    pay_y -= 2.5 * mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1)
    c.line(LEFT, pay_y, 88 * mm, pay_y)
    pay_y -= 5.5 * mm

    for label, value in [
        ("Method:", "UPI via Razorpay"),
        ("Transaction ID:", "T26022402020132473I1087"),
        ("UTR:", "605502569653"),
        ("Date:", "February 24, 2026, 02:01 AM"),
        ("Amount:", "Rs. 2,499.00"),
    ]:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(DARK)
        c.drawString(LEFT, pay_y, label)
        c.setFont("Helvetica", 8)
        c.drawString(57 * mm, pay_y, value)
        pay_y -= 4.5 * mm

    # =========== NOTES ===========
    notes_y = pay_y - 7 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK)
    c.drawString(LEFT, notes_y, "Notes")
    notes_y -= 2.5 * mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1)
    c.line(LEFT, notes_y, 48 * mm, notes_y)
    notes_y -= 5.5 * mm
    c.setFont("Helvetica", 8.5)
    c.setFillColor(DARK)
    c.drawString(LEFT, notes_y, "Thank you for subscribing to Pixtrace! For support, reach out at ")
    c.setFillColor(ACCENT)
    c.drawString(LEFT + c.stringWidth("Thank you for subscribing to Pixtrace! For support, reach out at ", "Helvetica", 8.5), notes_y, "support@pixtrace.in")

    # =========== TERMS ===========
    terms_y = notes_y - 9 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(DARK)
    c.drawString(LEFT, terms_y, "Terms")
    terms_y -= 2.5 * mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1)
    c.line(LEFT, terms_y, 48 * mm, terms_y)
    terms_y -= 5.5 * mm
    c.setFont("Helvetica", 8)
    c.setFillColor(DARK)
    c.drawString(LEFT, terms_y, "All payments are non-refundable. Access is granted immediately upon payment.")
    terms_y -= 4 * mm
    c.drawString(LEFT, terms_y, "For issues, contact support within 7 days of purchase.")

    # =========== FOOTER ===========
    footer_y = 18 * mm
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1)
    c.line(LEFT, footer_y, RIGHT_EDGE, footer_y)
    c.setFont("Helvetica", 7)
    c.setFillColor(MEDIUM_GRAY)
    c.drawCentredString(width / 2, footer_y - 4.5 * mm, "This is a computer-generated invoice and does not require a signature.")


def main():
    width, height = A4
    c = canvas.Canvas(OUTPUT_PATH, pagesize=A4)
    c.setTitle("Invoice - Pixtrace - 01240220260001")
    c.setAuthor("Pixtrace")
    draw_invoice(c, width, height)
    c.save()
    print(f"Invoice saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
