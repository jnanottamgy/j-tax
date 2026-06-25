import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { generateRecurringComplianceTasks, seedDefaultTemplates } from "@/lib/compliance/recurring-engine"

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

    await seedDefaultTemplates()

    const result = await generateRecurringComplianceTasks()

    return NextResponse.json({
      success: true,
      message: `Generated ${result.created} compliance tasks/events.`,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error: unknown) {
    console.error("Compliance recurring CRON Error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}
