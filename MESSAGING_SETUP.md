# Activating Email (Resend) & WhatsApp (Meta Cloud API)

Step-by-step activation guide for J-TACS messaging. Written 2026-07-05.

**Current state (verified):**
- Email: `RESEND_API_KEY` is live but the account has **no verified domain** → sandbox mode. Emails only deliver to the Resend account owner's own address, sent from `onboarding@resend.dev`.
- WhatsApp: fully integrated in code; activates the moment `WHATSAPP_API_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` exist in the environment.

---

## PART 1 — Email: verify your domain in Resend (~15 min + DNS wait)

### A. Verify the domain

1. Log in at **[resend.com](https://resend.com)** — use the account whose API key is in `.env` (`RESEND_API_KEY`).
2. Left sidebar → **Domains** → **Add Domain**.
3. Enter your domain (e.g. `taxwiseconsultants.com`) → **Add**.
4. Resend now shows **3–4 DNS records** (SPF TXT, DKIM CNAME/TXT, optionally DMARC). Keep this tab open.
5. Open your **DNS provider** (wherever you bought/manage the domain — GoDaddy, Hostinger, BigRock, Cloudflare…) → DNS Management for the domain.
6. Add each record **exactly** as Resend shows it (Type, Host/Name, Value). Common pitfall: some providers auto-append the domain to the Host field — if Resend says host `resend._domainkey.yourdomain.com` and the provider appends the domain, enter only `resend._domainkey`.
7. Back in Resend → click **Verify DNS Records**. Status flips to **Verified** (usually < 30 min, worst case a few hours). You can leave and come back.

### B. Wire it into J-TACS

8. Pick a sender address on that domain, e.g. `notifications@yourdomain.com`. It does **not** need a real mailbox — replies are routed by Reply-To.
9. Edit `.env` (local):
   ```
   FROM_EMAIL=notifications@yourdomain.com
   PLATFORM_FROM_EMAIL=notifications@yourdomain.com
   ```
10. Add the same two variables in your **hosting dashboard** (Vercel/Netlify → Project → Settings → Environment Variables) and **redeploy**.
11. In the app: **Settings → Firm Details** (as PARTNER):
    - **From Email** → `notifications@yourdomain.com` (this DB value overrides env on every send — today it holds a Gmail, which Resend can never send from)
    - **Reply-To Email** → `ca.akshayrjain1212@gmail.com` (or whichever inbox should receive client replies)
12. Fix bad client data: **Clients → Keystone Ventures → Edit** → replace the invalid email `keystoneventures` with the client's real address.
13. **Test:** Messaging → Send Message → channel **Email** → pick a client → send. Check the recipient inbox (and spam folder the first time — DMARC warms up).

> Until step 7 completes, sends still work but only deliver to the Resend account owner's email — fine for testing.

---

## PART 2 — WhatsApp: Meta Cloud API (~45–60 min active work)

**You need:** a Facebook account, and a phone number **not already registered** on the WhatsApp/WhatsApp Business app (fresh SIM, or a landline that can receive a voice call OTP). If you must reuse a number, delete its WhatsApp account first (WhatsApp → Settings → Account → Delete account).

### A. Create the Meta app (10 min)

1. Go to **[developers.facebook.com](https://developers.facebook.com)** → log in → **My Apps** → **Create App**.
2. Use case: **Other** → App type: **Business** → name it (e.g. `J-TACS Messaging`) → link/create your **Meta Business Account** when prompted.
3. On the app dashboard → **Add Product** → **WhatsApp** → **Set up**.
4. You land on **WhatsApp → API Setup**. Meta gives you instantly:
   - a **test phone number** (can message up to 5 opted-in numbers)
   - a **temporary access token** (expires in ~23 h)
   - the **Phone number ID** (under the test number dropdown)

### B. Quick smoke test — optional but recommended (5 min)

5. On API Setup → "To" field → **Manage phone number list** → add your own WhatsApp number → enter the OTP it sends you.
6. Copy the **temporary token** and **Phone number ID** into `.env`:
   ```
   WHATSAPP_API_TOKEN=<temporary token>
   WHATSAPP_PHONE_NUMBER_ID=<phone number id>
   ```
7. Restart the dev server → Messaging → Send Message → **WhatsApp** channel is now enabled → send yourself a test. (Send "hi" from your phone to the test number first — that opens the 24-hour window that free-form texts require.)

### C. Production credentials (15 min)

8. **Register your real business number:** WhatsApp → API Setup → phone-number dropdown → **Add phone number** → fill display name (e.g. "TaxWise Consultants"), category → verify the number via SMS or voice OTP. Copy its **Phone number ID**.
9. **Create a PERMANENT token** (the API Setup token dies in 23 h):
   1. Go to **[business.facebook.com](https://business.facebook.com)** → **Settings (⚙) → Business Settings**.
   2. **Users → System Users → Add** → name e.g. `jtacs-system`, role **Admin** → create.
   3. Select it → **Assign Assets** → **Apps** → pick your app → toggle **Manage app (full control)** → Save.
   4. **Generate New Token** → choose your app → token expiration **Never** → tick permissions **`whatsapp_business_messaging`** and **`whatsapp_business_management`** → Generate.
   5. **Copy the token now** — it is shown only once.
10. Put the production values in `.env` **and** in the hosting dashboard:
    ```
    WHATSAPP_API_TOKEN=<permanent system-user token>
    WHATSAPP_PHONE_NUMBER_ID=<production phone number id>
    ```

### D. Delivery-status webhook (10 min — needs the deployed HTTPS URL)

Enables real sent → delivered → read ticks in the app, plus staff notifications when clients reply.

11. Generate a random verify token (any random string; e.g. run `openssl rand -hex 24` in Git Bash) and add to env:
    ```
    WHATSAPP_WEBHOOK_VERIFY_TOKEN=<your random string>
    ```
12. App Dashboard → **App Settings → Basic** → copy **App Secret** → add to env:
    ```
    WHATSAPP_APP_SECRET=<app secret>
    ```
13. **Deploy** the app with all four WhatsApp env vars set.
14. App Dashboard → **WhatsApp → Configuration** → Webhook → **Edit**:
    - **Callback URL:** `https://<your-deployed-domain>/api/webhooks/whatsapp`
    - **Verify token:** the exact value from step 11
    - Click **Verify and save** (the app answers Meta's handshake automatically).
15. Same page → **Webhook fields** → **Manage** → subscribe to **`messages`**.

### E. Message templates — needed for automated cron reminders (15 min + approval wait)

Meta only lets a business message a client outside the 24-hour window via **pre-approved templates**. The cron reminders (compliance due, document expiry, document chasers) stay email-only until these exist.

16. **[business.facebook.com](https://business.facebook.com) → WhatsApp Manager → Message templates → Create template** — category **Utility**, language **English**. Create three:

    | Template name | Body text |
    |---|---|
    | `compliance_reminder` | `Dear {{1}}, this is a reminder that {{2}} is due on {{3}}. Please share any pending documents at the earliest. — TaxWise Consultants` |
    | `document_expiry` | `Dear {{1}}, your document "{{2}}" expires on {{3}}. Please arrange renewal and share the updated copy. — TaxWise Consultants` |
    | `document_request` | `Dear {{1}}, {{3}} document(s) are still awaited for "{{2}}". Please upload them via your client portal. — TaxWise Consultants` |

    (Variables are positional and are filled in exactly this order by the cron: name, title, date/count.)
17. Submit → approval usually takes minutes to 24 h (status shows in WhatsApp Manager).
18. Once **Approved**, add to env (locally + hosting) and redeploy:
    ```
    WHATSAPP_TEMPLATE_COMPLIANCE_REMINDER=compliance_reminder
    WHATSAPP_TEMPLATE_DOCUMENT_EXPIRY=document_expiry
    WHATSAPP_TEMPLATE_DOCUMENT_REQUEST=document_request
    ```

### F. Business verification — for scale (do in parallel, takes days)

Unverified businesses are capped (~250 business-initiated conversations/day and 2 phone numbers). Enough to start; verify to scale:

19. **Business Settings → Security Centre → Start verification** → upload proof (GST certificate / incorporation doc / utility bill matching the business name). Approval: 1–14 days.

### G. Final test

20. Restart/redeploy → **Messaging → Send Message → WhatsApp** → pick a client with a phone number → send.
21. Watch the message card badge go **SENT → DELIVERED → READ** (webhook working).
22. Reply from the client phone → Partners/Managers get an in-app notification ("WhatsApp reply from …").

---

## Cost notes (2026)

- **Resend:** free tier 3,000 emails/month, 100/day — plenty to start.
- **WhatsApp:** ~free for service conversations (client-initiated, 24h window). Business-initiated **utility template** conversations are billed per 24h conversation (India: roughly ₹0.12–0.35 each; check Meta's current rate card). ~1,000 free service conversations/month.

## The 24-hour window rule (why some sends fail)

Free-form (typed) WhatsApp messages only deliver if the **client messaged you within the last 24 hours**. Outside that window Meta rejects the send — use a template instead. The compose UI shows this hint on the WhatsApp channel; the cron reminders always use templates for exactly this reason.
