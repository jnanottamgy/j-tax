import { SettingsPageClient } from "@/components/settings/settings-page-client"
import { getNotificationPreferences, loadFirmSettings } from "@/app/actions/settings"
import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const [notificationPrefs, firmSettings] = await Promise.all([
    getNotificationPreferences(),
    loadFirmSettings(),
  ])

  return (
    <SettingsPageClient
      initialNotificationPrefs={notificationPrefs}
      initialFirmSettings={firmSettings}
      userRole={session.user.role}
    />
  )
}
