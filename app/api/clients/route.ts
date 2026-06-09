import { NextResponse } from "next/server"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import {
  createClientWithOnboarding,
  listClients,
  seedEmployeesIfEmpty,
} from "@/lib/clients/queries"
import { createClientSchema } from "@/lib/validations/client"

export async function GET() {
  try {
    const session = await requireAuth()
    await seedEmployeesIfEmpty()
    const clients = await listClients({
      role: session.user.role,
      userId: session.user.id,
    })
    return NextResponse.json({ data: clients })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("[GET /api/clients]", error)
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    await requirePartnerOrManager()
    const body = await request.json()
    const parsed = createClientSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const client = await createClientWithOnboarding(parsed.data)
    return NextResponse.json({ data: client }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("[POST /api/clients]", error)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}
