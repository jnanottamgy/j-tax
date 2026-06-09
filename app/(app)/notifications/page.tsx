import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { NotificationsClient } from "./notifications-client"

export default async function NotificationsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  // Find the User record for this Supabase auth user
  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  })

  const notifications = userRecord
    ? await prisma.notification.findMany({
        where: { userId: userRecord.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : []

  const serialized = notifications.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }))

  return <NotificationsClient initialNotifications={serialized} />
}
