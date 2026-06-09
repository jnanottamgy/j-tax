const BRAND = "#1e3a8a"

function baseLayout(content: string, firmName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Quotation — ${firmName}</title>
<style>
  body{font-family:Arial,sans-serif;line-height:1.6;color:#111827;background:#f3f4f6;margin:0;padding:0}
  .wrap{max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .hdr{background:${BRAND};padding:32px 40px;color:#fff}
  .hdr h1{margin:0;font-size:26px;letter-spacing:-.5px}
  .hdr p{margin:4px 0 0;font-size:13px;opacity:.8}
  .body{padding:36px 40px}
  .pill{display:inline-block;background:#dbeafe;color:${BRAND};font-weight:700;font-size:13px;padding:4px 14px;border-radius:999px;margin-bottom:24px}
  .quote-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0}
  .quote-box table{width:100%;border-collapse:collapse}
  .quote-box td{padding:6px 0;font-size:14px;vertical-align:top}
  .quote-box td:last-child{text-align:right;font-weight:600}
  .cta{display:block;text-align:center;margin:28px 0}
  .cta a{display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:.3px}
  .total-row td{border-top:1px solid #e5e7eb;padding-top:12px;font-size:16px;font-weight:700;color:${BRAND}}
  .footer{border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;font-size:12px;color:#9ca3af}
</style>
</head>
<body>
<div class="wrap">
${content}
<div class="footer">${firmName} · This is an automated email — please do not reply directly.</div>
</div>
</body>
</html>`
}

export interface QuotationEmailVars {
  firmName: string
  firmEmail: string
  clientName: string
  quotationNumber: string
  total: string
  validUntil: string
  viewUrl: string
  items: Array<{ description: string; total: string }>
  subtotal: string
  taxAmount: string
  notes?: string
}

export function quotationEmailHTML(v: QuotationEmailVars): string {
  const itemRows = v.items
    .map((i) => `<tr><td>${i.description}</td><td>${i.total}</td></tr>`)
    .join("")

  return baseLayout(
    `<div class="hdr">
  <h1>${v.firmName}</h1>
  <p>${v.firmEmail}</p>
</div>
<div class="body">
  <div class="pill">New Quotation</div>
  <p>Dear <strong>${v.clientName}</strong>,</p>
  <p>Thank you for your enquiry. Please find your quotation details below. This proposal is valid until <strong>${v.validUntil}</strong>.</p>
  <div class="quote-box">
    <p style="margin:0 0 12px;font-weight:700;font-size:15px">Quotation #${v.quotationNumber}</p>
    <table>
      ${itemRows}
      <tr><td colspan="2" style="padding:8px 0"></td></tr>
      <tr><td>Subtotal</td><td>${v.subtotal}</td></tr>
      <tr><td>GST / Tax</td><td>${v.taxAmount}</td></tr>
      <tr class="total-row"><td>Total Due</td><td>${v.total}</td></tr>
    </table>
  </div>
  ${v.notes ? `<p style="color:#6b7280;font-size:13px">${v.notes}</p>` : ""}
  <div class="cta"><a href="${v.viewUrl}">View & Accept Quotation</a></div>
  <p style="font-size:13px;color:#6b7280;text-align:center">You can review, accept, or request changes via the link above.</p>
</div>`,
    v.firmName
  )
}

export interface FollowUpEmailVars {
  firmName: string
  firmEmail: string
  clientName: string
  quotationNumber: string
  total: string
  viewUrl: string
  dayNumber: 3 | 7 | 14
}

export function followUpEmailHTML(v: FollowUpEmailVars): string {
  const isLast = v.dayNumber === 14
  const subject = isLast
    ? `Final reminder: Quotation #${v.quotationNumber} expires soon`
    : `Friendly reminder: Quotation #${v.quotationNumber} awaiting your response`

  const bodyText = isLast
    ? `This is our final follow-up regarding Quotation <strong>#${v.quotationNumber}</strong>. The proposal totalling <strong>${v.total}</strong> will expire if not accepted. Please review at your earliest convenience.`
    : `We wanted to follow up on Quotation <strong>#${v.quotationNumber}</strong> sent ${v.dayNumber} days ago. We'd love to work with you — please take a moment to review the proposal.`

  const html = baseLayout(
    `<div class="hdr">
  <h1>${v.firmName}</h1>
  <p>${v.firmEmail}</p>
</div>
<div class="body">
  <div class="pill">${isLast ? "Final Reminder" : "Follow-up"}</div>
  <p>Dear <strong>${v.clientName}</strong>,</p>
  <p>${bodyText}</p>
  <div class="quote-box">
    <table>
      <tr><td>Quotation Number</td><td>#${v.quotationNumber}</td></tr>
      <tr><td>Proposal Value</td><td>${v.total}</td></tr>
    </table>
  </div>
  <div class="cta"><a href="${v.viewUrl}">${isLast ? "Accept Before Expiry" : "Review Quotation"}</a></div>
  <p style="font-size:13px;color:#6b7280;text-align:center">Questions? Reply to this email or contact us at ${v.firmEmail}</p>
</div>`,
    v.firmName
  )

  return html
}

export function quotationSubject(quotationNumber: string, firmName: string): string {
  return `Quotation #${quotationNumber} from ${firmName}`
}

export function followUpSubject(quotationNumber: string, dayNumber: number, firmName: string): string {
  if (dayNumber === 14) return `Final reminder — Quotation #${quotationNumber} | ${firmName}`
  return `Follow-up — Quotation #${quotationNumber} | ${firmName}`
}
