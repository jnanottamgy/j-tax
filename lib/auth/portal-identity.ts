/**
 * Which firm does a client-portal login belong to?
 *
 * A person can be a client of two firms that both subscribe to this app. They
 * are one human with one email address, and the platform has to decide whose
 * portal they see. Tenant scoping keeps the two firms' data apart correctly —
 * that was never in doubt — but the question of *which* tenant this login is
 * was answered by matching the session email against `Client.email`, and that
 * match is not unique. Two firms, same address, and the answer depended on
 * which row the database happened to return first.
 *
 * The rules here make the answer deterministic, and make "I cannot tell"
 * a real outcome rather than an arbitrary pick:
 *
 *   1. An explicit `Client.portalUserId` grant wins outright. It is an answer
 *      somebody gave, not an inference from a string that two records can
 *      share. One grant → that firm, whatever the email matches say.
 *   2. Grants in more than one firm are ambiguous. `@@unique([firmId,
 *      portalUserId])` permits it — one auth account may be linked in each
 *      firm — but a session belongs to exactly one firm, so there is no honest
 *      way to choose. Refuse.
 *   3. With no grant, fall back to the email match, which is what firms who
 *      hand-provisioned a login before invites existed still rely on. Exactly
 *      one → that firm. More than one → refuse.
 *
 * Refusing is the point. The failure mode this replaces is not a leak; it is
 * showing somebody the wrong firm's portal and being confident about it.
 *
 * Pure: the caller does the (deliberately cross-firm) lookups and hands the
 * candidates in.
 */

export type PortalCandidate = {
  clientId: string
  firmId: string
}

export type AdoptionDecision =
  | { ok: true; firmId: string; clientId: string; via: "link" | "email" }
  | { ok: false; reason: "none" | "ambiguous" }

export function chooseAdoptionFirm(input: {
  /** Clients whose portalUserId is this auth account — the explicit grants. */
  linked: PortalCandidate[]
  /** Clients whose email matches this login — the legacy inference. */
  byEmail: PortalCandidate[]
}): AdoptionDecision {
  const { linked, byEmail } = input

  if (linked.length === 1) {
    return { ok: true, firmId: linked[0].firmId, clientId: linked[0].clientId, via: "link" }
  }
  // Two firms have both granted this login portal access. Each grant is valid
  // on its own; together they have no single answer, and picking one would show
  // a client the wrong firm's deadlines and invoices.
  if (linked.length > 1) return { ok: false, reason: "ambiguous" }

  if (byEmail.length === 1) {
    return { ok: true, firmId: byEmail[0].firmId, clientId: byEmail[0].clientId, via: "email" }
  }
  // More than one client record shares this address. Note this is refused even
  // when both are in the same firm: the firm would be unambiguous, but which
  // client the visitor *is* would not, and that is the thing being decided.
  if (byEmail.length > 1) return { ok: false, reason: "ambiguous" }

  return { ok: false, reason: "none" }
}

/**
 * Thrown by requireAuth when a client login resolves to more than one firm.
 *
 * Distinct from the generic "not linked to a firm" so the sign-in surface can
 * say something true. The old message sent a client of two subscribing firms to
 * a dead end that neither firm could see, diagnose, or repair.
 */
export const AMBIGUOUS_CLIENT_IDENTITY = "AmbiguousClientIdentity"
