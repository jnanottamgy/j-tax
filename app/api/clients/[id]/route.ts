import { NextResponse } from "next/server"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import {
  getClientDetail,
  updateClient,
} from "@/lib/clients/queries"
import { updateClientSchema } from "@/lib/validations/client"

type ClientRouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: ClientRouteContext) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const client = await getClientDetail(id, {
      role: session.user.role,
      userId: session.user.id,
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json({ data: client })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[GET /api/clients/:id]", error)
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: ClientRouteContext) {
  try {
    await requirePartnerOrManager()
    const { id } = await params
    const body = await request.json()
    const parsed = updateClientSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const client = await updateClient(id, parsed.data)
    return NextResponse.json({ data: client })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("[PATCH /api/clients/:id]", error)
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    )
  }
}
