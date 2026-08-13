"use server"

import { canAccessClientById } from "@/lib/auth/scope"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

/**
 * One client's workpapers.
 *
 * GST reconciliations, ITR computations, financial statements and tax notices
 * all store a clientId — they are per-client work products — but each lived
 * only as a firm-level page you opened cold and then searched for the client
 * in. Real usage is "I'm working on Patel Enterprises' ITR", and Client 360 is
 * the screen already open, so this is what it needs to show.
 *
 * The firm-level pages stay as the cross-client index.
 */

export type WorkpaperItem = {
  id: string
  kind: "GST_RECON" | "ITR" | "FINANCIAL_STATEMENT" | "TAX_NOTICE"
  title: string
  subtitle: string | null
  /** ISO — sorts the combined list and shows recency. */
  at: string
  href: string
  /** Present on notices, which are the only workpaper with a live state. */
  status?: string | null
  /** Set when something is waiting on the firm, e.g. a reply deadline. */
  urgent?: boolean
}

export type ClientWorkpapers = {
  items: WorkpaperItem[]
  counts: {
    gstRecon: number
    itr: number
    financialStatements: number
    taxNotices: number
    openNotices: number
  }
}

export async function getClientWorkpapers(clientId: string): Promise<ClientWorkpapers> {
  const empty: ClientWorkpapers = {
    items: [],
    counts: { gstRecon: 0, itr: 0, financialStatements: 0, taxNotices: 0, openNotices: 0 },
  }

  const session = await getSession()
  if (!session) return empty
  // Employees see only their assigned clients; the same rule the rest of
  // Client 360 runs on.
  if (!(await canAccessClientById(session, clientId))) return empty

  const [recons, itrs, statements, notices] = await Promise.all([
    prisma.gstReconRun.findMany({
      where: { clientId },
      select: { id: true, period: true, createdAt: true, summary: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.itrComputation.findMany({
      where: { clientId },
      select: {
        id: true,
        financialYear: true,
        regimeChosen: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.financialStatement.findMany({
      where: { clientId },
      select: { id: true, financialYear: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.taxNotice.findMany({
      where: { clientId },
      select: {
        id: true,
        noticeType: true,
        section: true,
        referenceNo: true,
        status: true,
        replyDueDate: true,
        noticeDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ])

  const now = Date.now()
  const items: WorkpaperItem[] = [
    ...recons.map((r) => {
      // `summary` is free-form JSON; read defensively rather than assuming a
      // shape a past run may not have written.
      const s = (r.summary ?? {}) as Record<string, unknown>
      const matched = typeof s.matched === "number" ? s.matched : null
      const mismatched = typeof s.mismatched === "number" ? s.mismatched : null
      return {
        id: r.id,
        kind: "GST_RECON" as const,
        title: `GSTR-2B reconciliation — ${r.period}`,
        subtitle:
          matched !== null || mismatched !== null
            ? `${matched ?? 0} matched · ${mismatched ?? 0} to review`
            : null,
        at: r.createdAt.toISOString(),
        href: `/gst-reconciliation?runId=${r.id}`,
      }
    }),
    ...itrs.map((i) => ({
      id: i.id,
      kind: "ITR" as const,
      title: `ITR computation — FY ${i.financialYear}`,
      subtitle: i.regimeChosen ? `${i.regimeChosen} regime` : null,
      at: i.updatedAt.toISOString(),
      href: `/itr-computation?computationId=${i.id}`,
    })),
    ...statements.map((f) => ({
      id: f.id,
      kind: "FINANCIAL_STATEMENT" as const,
      title: `Financial statements — FY ${f.financialYear}`,
      subtitle: null,
      at: f.updatedAt.toISOString(),
      href: `/financial-statements?statementId=${f.id}`,
    })),
    ...notices.map((n) => {
      const due = n.replyDueDate?.getTime() ?? null
      return {
        id: n.id,
        kind: "TAX_NOTICE" as const,
        title: `${n.noticeType}${n.section ? ` u/s ${n.section}` : ""}`,
        subtitle: [
          n.referenceNo,
          n.replyDueDate ? `reply due ${n.replyDueDate.toLocaleDateString("en-IN")}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        at: (n.noticeDate ?? n.createdAt).toISOString(),
        href: `/notices?noticeId=${n.id}`,
        status: n.status,
        // An open notice past its reply date is the single most expensive thing
        // on this tab to miss.
        urgent: n.status !== "CLOSED" && due !== null && due < now,
      }
    }),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return {
    items,
    counts: {
      gstRecon: recons.length,
      itr: itrs.length,
      financialStatements: statements.length,
      taxNotices: notices.length,
      openNotices: notices.filter((n) => n.status !== "CLOSED").length,
    },
  }
}
