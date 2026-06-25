/**
 * Reads the firm_settings singleton from the live DB and reports whether the
 * stored verificationToken still uses the legacy `jtax-verify=` prefix.
 * A stale token won't cause functional breakage (it's just an opaque string
 * matched against DNS) but it does mean any firm that already published the
 * `_jtax-verify.<domain>` DNS record needs to re-publish with the new prefix
 * to pass live verification.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const row = await prisma.firmSettings.findUnique({ where: { id: "singleton" } })
    if (!row) {
      console.log("FIRM_SETTINGS: (no row)")
    } else {
      console.log("firmName        :", row.firmName)
      console.log("fromEmail       :", row.fromEmail)
      console.log("firmDomain      :", row.firmDomain || "(unset)")
      console.log("domainVerified  :", row.domainVerified)
      console.log("verificationToken prefix:", row.verificationToken?.slice(0, 14) || "(none)")
      console.log("platformFallback:", row.platformFallbackEnabled)
      const stale = row.verificationToken?.startsWith("jtax-verify=") ?? false
      console.log("TOKEN_USES_LEGACY_JTAX_PREFIX:", stale)
    }
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.message : String(e))
  }
  await prisma.$disconnect()
}
main()
