/**
 * Resend Domains API client.
 *
 * WHY THIS EXISTS
 * The previous domain-verification flow was self-certifying: it invented a set
 * of DNS records (including a CNAME to `resend._domainkey.resend.com`, which is
 * not a real Resend record), asked the firm to publish them, then did its OWN
 * `dns.resolveTxt` lookup and flipped `domainVerified = true` on success.
 *
 * Resend was never told about the domain, so it remained an unverified sending
 * identity and rejected every send from it — which is why "verified" firms
 * still had no email arriving.
 *
 * Verification is not something we can assert. Only Resend can:
 *   1. the domain must be registered in the platform's Resend account,
 *   2. Resend generates a per-domain DKIM keypair and returns the exact records,
 *   3. the firm publishes those records,
 *   4. Resend re-checks DNS and flips the status itself.
 *
 * This module wraps that lifecycle. `domainVerified` must only ever mirror the
 * status Resend reports back.
 */

const RESEND_DOMAINS_URL = "https://api.resend.com/domains"

/** Resend's domain lifecycle states. Anything not `verified` cannot send. */
export type ResendDomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"

/** A DNS record exactly as Resend generated it — never hand-authored. */
export type ResendDnsRecord = {
  /** "DKIM" | "SPF" — which mechanism this record serves. */
  record: string
  type: "TXT" | "MX" | "CNAME"
  /** Fully-qualified host the firm must create (Resend returns it relative). */
  host: string
  value: string
  /** MX only. */
  priority?: number
  /** Per-record status once Resend has started checking. */
  status?: string
}

export type ResendDomain = {
  id: string
  name: string
  status: ResendDomainStatus
  records: ResendDnsRecord[]
}

export type DomainApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; /** true when the API key itself is missing/invalid */ configError?: boolean }

function apiKey(): string | null {
  return process.env.RESEND_API_KEY || null
}

/**
 * Resend returns record names RELATIVE to the domain ("send",
 * "resend._domainkey") and sometimes wraps TXT values in quotes. DNS panels
 * need the absolute host and a bare value, so normalise both here — getting
 * this wrong is the single most common reason a record "never verifies".
 */
export function normaliseRecords(raw: unknown, domain: string): ResendDnsRecord[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => {
    const rec = r as Record<string, unknown>
    const name = String(rec.name ?? "").trim()
    const host = !name || name === "@" ? domain : name.endsWith(domain) ? name : `${name}.${domain}`
    const value = String(rec.value ?? "").replace(/^"|"$/g, "")
    return {
      record: String(rec.record ?? ""),
      type: (String(rec.type ?? "TXT").toUpperCase() as ResendDnsRecord["type"]) ?? "TXT",
      host,
      value,
      ...(rec.priority !== undefined && rec.priority !== null
        ? { priority: Number(rec.priority) }
        : {}),
      ...(rec.status ? { status: String(rec.status) } : {}),
    }
  })
}

function toDomain(payload: Record<string, unknown>): ResendDomain {
  const name = String(payload.name ?? "")
  return {
    id: String(payload.id ?? ""),
    name,
    status: (String(payload.status ?? "not_started") as ResendDomainStatus) ?? "not_started",
    records: normaliseRecords(payload.records, name),
  }
}

async function call<T>(
  url: string,
  init: RequestInit,
  map: (payload: Record<string, unknown>) => T
): Promise<DomainApiResult<T>> {
  const key = apiKey()
  if (!key) {
    return {
      ok: false,
      configError: true,
      error: "RESEND_API_KEY is not set on the server — email cannot be configured.",
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    })
  } catch (err) {
    return {
      ok: false,
      error: `Could not reach Resend: ${err instanceof Error ? err.message : "network error"}`,
    }
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = (await response.json()) as Record<string, unknown>
  } catch {
    /* empty body — handled by status below */
  }

  if (!response.ok) {
    const message = String(payload.message ?? payload.error ?? `Resend returned ${response.status}`)
    return {
      ok: false,
      // 401/403 mean the key is wrong, which is an operator problem, not a
      // firm problem — the UI wording differs, so flag it.
      configError: response.status === 401 || response.status === 403,
      error: message,
    }
  }

  return { ok: true, data: map(payload) }
}

/** Register a domain with the platform's Resend account. */
export async function registerDomain(name: string): Promise<DomainApiResult<ResendDomain>> {
  return call(RESEND_DOMAINS_URL, { method: "POST", body: JSON.stringify({ name }) }, toDomain)
}

/** Current status + the authoritative DNS records for an already-registered domain. */
export async function fetchDomain(id: string): Promise<DomainApiResult<ResendDomain>> {
  return call(`${RESEND_DOMAINS_URL}/${id}`, { method: "GET" }, toDomain)
}

/** Ask Resend to re-check DNS now. Status updates asynchronously afterwards. */
export async function requestVerification(id: string): Promise<DomainApiResult<{ id: string }>> {
  return call(`${RESEND_DOMAINS_URL}/${id}/verify`, { method: "POST" }, (p) => ({
    id: String(p.id ?? id),
  }))
}

/**
 * Find a domain we already registered, by name. Used to recover when a firm's
 * `resendDomainId` is missing but the domain exists in the account — re-POSTing
 * an existing domain is rejected, so look before creating.
 */
export async function findDomainByName(
  name: string
): Promise<DomainApiResult<ResendDomain | null>> {
  const key = apiKey()
  if (!key) {
    return { ok: false, configError: true, error: "RESEND_API_KEY is not set on the server." }
  }
  const result = await call<ResendDomain[]>(
    RESEND_DOMAINS_URL,
    { method: "GET" },
    (payload) => {
      const list = Array.isArray(payload.data) ? payload.data : []
      return list.map((d) => toDomain(d as Record<string, unknown>))
    }
  )
  if (!result.ok) return result
  const match =
    result.data.find((d) => d.name.toLowerCase() === name.toLowerCase()) ?? null
  return { ok: true, data: match }
}

/**
 * Idempotent "get me this domain": reuse the stored id, else look it up by
 * name, else register it. Returns the domain plus whether it was just created.
 */
export async function ensureDomain(
  name: string,
  knownId: string | null
): Promise<DomainApiResult<{ domain: ResendDomain; created: boolean }>> {
  if (knownId) {
    const existing = await fetchDomain(knownId)
    if (existing.ok) return { ok: true, data: { domain: existing.data, created: false } }
    // A stored id that no longer resolves (deleted in the Resend dashboard)
    // should fall through to lookup/create rather than dead-end the firm.
    if (existing.configError) return existing
  }

  const found = await findDomainByName(name)
  if (found.ok && found.data) {
    return { ok: true, data: { domain: found.data, created: false } }
  }
  if (!found.ok && found.configError) return found

  const created = await registerDomain(name)
  if (!created.ok) return created
  return { ok: true, data: { domain: created.data, created: true } }
}
