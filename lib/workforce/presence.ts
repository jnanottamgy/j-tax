/**
 * How long somebody was actually here.
 *
 * Presence used to be inferred from session lifecycle events: minutes were
 * `logoutAt - loginAt`, and the attendance record was only written by the
 * sign-out handler. That has three failure modes and the app hit all of them.
 *
 *   - Nobody signs out. They close the tab. The sign-out handler never ran, so
 *     `durationMinutes` stayed null and the day's `workMinutes` were never
 *     written — every such day recorded as zero hours worked.
 *   - A session left open read as `now - loginAt` on the dashboard, so a tab
 *     forgotten on Friday showed seventy-two hours on Monday.
 *   - Even a clean sign-out measured wall clock. Log in at nine, go to lunch,
 *     sign out at nine — twelve hours.
 *
 * The heartbeat already existed and was already firing every five minutes; it
 * just wasn't counted. So presence is now accumulated forward from it: each
 * beat credits the time since the last one, capped, and that total *is* the
 * worked time. A closed tab stops sending beats and therefore stops counting,
 * which is the behaviour everyone assumed was already there.
 *
 * Pure arithmetic — no database, no clock of its own.
 */

/** How often the browser sends a beat. */
export const HEARTBEAT_INTERVAL_MINUTES = 5

/**
 * The most one beat may credit.
 *
 * A beat carries no proof of what happened before it, only that someone is here
 * now. Crediting the raw gap would hand a full night's pay to a laptop that
 * woke from sleep at 9am. One interval plus a minute of slack covers a slow
 * request without covering an absence.
 */
export const MAX_CREDIT_PER_BEAT_MINUTES = HEARTBEAT_INTERVAL_MINUTES + 1

/**
 * Silence after which somebody is considered gone and the session is closed.
 *
 * Must be longer than IDLE_AFTER_MINUTES, or a session would be declared over
 * before it could ever be shown as idle — which is exactly what the first cut
 * of this did, making IDLE unreachable.
 *
 * Nine missed beats. Long enough to cover a long meeting or a client visit
 * without closing somebody's day behind their back, short enough that a
 * forgotten tab is reaped the same evening. Nothing is over-credited by the
 * wait: a beat can only ever add MAX_CREDIT_PER_BEAT_MINUTES, so a quiet
 * session accrues nothing while it waits to be closed.
 */
export const STALE_AFTER_MINUTES = 45

/**
 * Silence after which somebody is shown as idle rather than online.
 *
 * Deliberately longer than the old fifteen minutes. Reading a return or taking
 * a client call is work, and flagging it as idleness is what turns a workforce
 * tool into something people resent. Being *shown* idle no longer costs anyone
 * minutes either — those are counted from beats, not from this.
 */
export const IDLE_AFTER_MINUTES = 20

// A session must be able to look idle before it is declared over.
if (IDLE_AFTER_MINUTES >= STALE_AFTER_MINUTES) {
  throw new Error("IDLE_AFTER_MINUTES must be shorter than STALE_AFTER_MINUTES")
}

export type PresenceStatus = "ONLINE" | "IDLE" | "OFFLINE"

/**
 * What one heartbeat is worth.
 *
 * Returns whole minutes to credit. Zero when the gap is negative (clock skew)
 * or when beats arrive faster than they should — a tab duplicated across two
 * windows must not count double.
 */
export function creditForBeat(lastActiveAt: Date, now: Date): number {
  const gapMs = now.getTime() - lastActiveAt.getTime()
  if (!(gapMs > 0)) return 0
  const gapMinutes = gapMs / 60_000
  return Math.round(Math.min(gapMinutes, MAX_CREDIT_PER_BEAT_MINUTES))
}

/** Has this session gone quiet long enough to be closed? */
export function isStale(lastActiveAt: Date, now: Date): boolean {
  return now.getTime() - lastActiveAt.getTime() > STALE_AFTER_MINUTES * 60_000
}

/**
 * Where a session should be closed off.
 *
 * At the last beat, never at "now". The person left when the beats stopped; a
 * sweep that runs at 2am must not stamp 2am on a session that went quiet at
 * six in the evening. This is what made `logoutAt` untrue in the old data.
 */
export function closingTimeFor(lastActiveAt: Date): Date {
  return new Date(lastActiveAt)
}

/** Online, idle, or gone — from the last beat alone. */
export function presenceStatus(
  lastActiveAt: Date | null | undefined,
  now: Date
): PresenceStatus {
  if (!lastActiveAt) return "OFFLINE"
  const quietMinutes = (now.getTime() - new Date(lastActiveAt).getTime()) / 60_000
  if (quietMinutes > STALE_AFTER_MINUTES) return "OFFLINE"
  return quietMinutes > IDLE_AFTER_MINUTES ? "IDLE" : "ONLINE"
}

/**
 * Minutes to show for a session that is still open.
 *
 * The accumulated total, plus at most one beat's worth for the stretch since
 * the last one — so a live session ticks up rather than jumping every five
 * minutes, without ever running away from reality the way `now - loginAt` did.
 */
export function liveSessionMinutes(
  session: { activeMinutes: number; lastActiveAt: Date },
  now: Date
): number {
  return session.activeMinutes + creditForBeat(session.lastActiveAt, now)
}

export type UtilisationInput = {
  /** Minutes present, from heartbeats. */
  presentMinutes: number
  /** Minutes booked to clients on the timesheet. */
  bookedMinutes: number
}

/**
 * How much of the time someone was here ended up against a client.
 *
 * Attendance and the timesheet were two unrelated numbers that never met, and
 * the gap between them is the one a firm actually wants: nine hours present and
 * two hours booked is not a productivity problem to guess at, it is a question
 * to go and ask. Null when nobody was here — a rate of zero out of zero reads
 * as a failure rather than as an absence.
 */
export function utilisation(input: UtilisationInput): number | null {
  if (!(input.presentMinutes > 0)) return null
  const pct = (input.bookedMinutes / input.presentMinutes) * 100
  // Booking more than you were online is possible and legitimate — work done
  // offline, or time entered later — so this is not clamped to 100.
  return Math.round(pct * 10) / 10
}
