import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { generateRecurringComplianceTasks, seedDefaultTemplates } from "@/lib/compliance/recurring-engine"
import { prisma } from "@/lib/prisma"
import { tenantContext } from "@/lib/tenant/context"

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return new NextResponse("CRON_SECRET not configured", { status: 503 })
    }

    const authHeader = request.headers.get("authorization") ?? ""
    if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Statutory templates are shared platform content — seed once, globally.
    await seedDefaultTemplates()

    // Multi-tenant: generate each firm's compliance events in its own context.
    const firms = await prisma.firm.findMany({ where: { status: "ACTIVE" }, select: { id: true } })
    let created = 0
    const errors: string[] = []
    for (const firm of firms) {
      await tenantContext.run({ firmId: firm.id }, async () => {
        const result = await generateRecurringComplianceTasks()
        created += result.created
        errors.push(...result.errors)
      })
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${created} compliance tasks/events across ${firms.length} firm(s).`,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    console.error("Compliance recurring CRON Error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}
