import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"

export default async function PaymentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  // Verify role access (Only PARTNER and MANAGER allowed)
  if (session?.user.role !== "PARTNER" && session?.user.role !== "MANAGER") {
    redirect("/unauthorized")
  }

  return <>{children}</>
}
