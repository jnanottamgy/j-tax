import { SettingsPageClient } from "@/components/settings/settings-page-client"
import { getNotificationPreferences } from "@/app/actions/settings"

export default async function SettingsPage() {
  const notificationPrefs = await getNotificationPreferences()
  return <SettingsPageClient initialNotificationPrefs={notificationPrefs} />
}
