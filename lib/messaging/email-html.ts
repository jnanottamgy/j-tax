/**
 * Plain-text → safe branded email HTML.
 *
 * Ad-hoc messages typed by staff are plain text. Before this helper existed
 * they were injected raw into the email `html` body — `<`/`&` broke rendering
 * and was an injection vector. Escape everything, then wrap in the same visual
 * shell the template emails use.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function renderPlainTextEmail(opts: {
  content: string
  firmName: string
  firmPhone?: string | null
  replyToEmail?: string | null
}): string {
  const body = escapeHtml(opts.content).replace(/\r?\n/g, "<br>")
  const firmName = escapeHtml(opts.firmName)
  const contactBits = [
    opts.replyToEmail ? `Email: ${escapeHtml(opts.replyToEmail)}` : "",
    opts.firmPhone ? `Phone: ${escapeHtml(opts.firmPhone)}` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ")

  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  </head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);padding:24px 30px;text-align:center;border-radius:10px 10px 0 0;">
      <h1 style="color:white;margin:0;font-size:24px;">${firmName}</h1>
    </div>
    <div style="background:#f9fafb;padding:30px;border-radius:0 0 10px 10px;">
      <p style="margin-top:0;">${body}</p>
      <div style="text-align:center;margin-top:30px;color:#6b7280;font-size:13px;">
        <p><strong>${firmName}</strong></p>
        ${contactBits ? `<p>${contactBits}</p>` : ""}
      </div>
    </div>
  </div>
</body></html>`
}
