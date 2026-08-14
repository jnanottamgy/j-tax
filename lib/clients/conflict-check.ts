/**
 * The check a firm is supposed to run before taking on a client.
 *
 * Nothing stood between "Add client" and a live engagement. A prospect could be
 * the opposing party in a dispute the firm is already acting on, a related
 * party of an audit client, or the same entity arriving under a second name —
 * and the app would create all three without comment. ICAI's Code of Ethics
 * treats acceptance as a decision that has to be made and recorded, and the
 * awkward cases are exactly the ones nobody notices at data entry.
 *
 * This finds candidates; it never decides. Every hit is something for a partner
 * to look at, and the point of recording the outcome is that "we looked and
 * accepted anyway, for this reason" is a perfectly good answer — as long as it
 * was written down at the time.
 *
 * Pure: the caller supplies the existing book.
 */

export type ExistingParty = {
  clientId: string
  name: string
  pan: string | null
  gstin: string | null
  /** Group the client belongs to, where the firm tracks one. */
  groupName: string | null
}

export type ConflictSeverity = "BLOCKING" | "REVIEW" | "NOTE"

export type Conflict = {
  severity: ConflictSeverity
  /** Machine-readable kind, so the UI can group without parsing prose. */
  kind: "SAME_PAN" | "SAME_GSTIN" | "SAME_NAME" | "SAME_GROUP" | "RELATED_PARTY"
  /** The existing client this collides with. */
  clientId: string
  clientName: string
  detail: string
}

/** Names differ by punctuation, case and the usual suffixes far more than by substance. */
export function normaliseEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"()&]/g, " ")
    .replace(
      /\b(private|pvt|limited|ltd|llp|inc|corporation|corp|company|co|and|the|india)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
}

export type ConflictCheckInput = {
  prospectName: string
  pan?: string | null
  gstin?: string | null
  /** Group companies, directors, partners — names the prospect is connected to. */
  relatedParties?: string[]
  existing: ExistingParty[]
}

/**
 * Everything worth a second look, most serious first.
 *
 * A shared PAN is blocking because it is not a conflict at all — it is the same
 * legal entity already on the books, and creating it twice splits one client's
 * filings across two records. Everything else is for a human.
 */
export function findConflicts(input: ConflictCheckInput): Conflict[] {
  const conflicts: Conflict[] = []
  const pan = input.pan?.trim().toUpperCase() || null
  const gstin = input.gstin?.trim().toUpperCase() || null
  const prospectKey = normaliseEntityName(input.prospectName)
  const related = (input.relatedParties ?? [])
    .map((r) => normaliseEntityName(r))
    .filter(Boolean)

  for (const party of input.existing) {
    const partyPan = party.pan?.trim().toUpperCase() || null
    const partyGstin = party.gstin?.trim().toUpperCase() || null

    if (pan && partyPan && pan === partyPan) {
      conflicts.push({
        severity: "BLOCKING",
        kind: "SAME_PAN",
        clientId: party.clientId,
        clientName: party.name,
        detail: `Same PAN as ${party.name}. This is the same legal entity — adding it again splits one client's filings across two records.`,
      })
      continue
    }

    if (gstin && partyGstin && gstin === partyGstin) {
      conflicts.push({
        severity: "BLOCKING",
        kind: "SAME_GSTIN",
        clientId: party.clientId,
        clientName: party.name,
        detail: `Same GSTIN as ${party.name}. A GSTIN identifies one registration — two client records cannot share it.`,
      })
      continue
    }

    const partyKey = normaliseEntityName(party.name)
    if (prospectKey && partyKey && prospectKey === partyKey) {
      conflicts.push({
        severity: "REVIEW",
        kind: "SAME_NAME",
        clientId: party.clientId,
        clientName: party.name,
        detail: `Name matches ${party.name} once suffixes are ignored. Confirm whether this is a second entity or the same one.`,
      })
      continue
    }

    // A related party naming an existing client is the independence question:
    // acting for both sides of a group, or auditing an entity connected to one
    // the firm already advises.
    const relatedHit = related.find((r) => r === partyKey)
    if (relatedHit) {
      conflicts.push({
        severity: "REVIEW",
        kind: "RELATED_PARTY",
        clientId: party.clientId,
        clientName: party.name,
        detail: `Declared as related to ${party.name}, who is already a client. Check independence before accepting attest work for either.`,
      })
      continue
    }

    if (party.groupName && related.some((r) => r === normaliseEntityName(party.groupName!))) {
      conflicts.push({
        severity: "NOTE",
        kind: "SAME_GROUP",
        clientId: party.clientId,
        clientName: party.name,
        detail: `Connected to the ${party.groupName} group, which ${party.name} belongs to.`,
      })
    }
  }

  const order: Record<ConflictSeverity, number> = { BLOCKING: 0, REVIEW: 1, NOTE: 2 }
  return conflicts.sort((a, b) => order[a.severity] - order[b.severity])
}

/** Can this prospect be onboarded without a written rationale? */
export function acceptanceVerdict(conflicts: Conflict[]): {
  clear: boolean
  needsRationale: boolean
  summary: string
} {
  if (conflicts.length === 0) {
    return { clear: true, needsRationale: false, summary: "No conflicts found." }
  }
  const blocking = conflicts.filter((c) => c.severity === "BLOCKING")
  if (blocking.length > 0) {
    return {
      clear: false,
      needsRationale: true,
      summary: `${blocking.length} match${blocking.length === 1 ? "" : "es"} an existing client's PAN or GSTIN. This is very likely the same entity.`,
    }
  }
  return {
    clear: false,
    needsRationale: true,
    summary: `${conflicts.length} thing${conflicts.length === 1 ? "" : "s"} to look at before accepting.`,
  }
}
