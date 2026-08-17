import { basePrisma } from "@/lib/prisma"

/**
 * Creates the firm behind a founding Partner's login.
 *
 * This exists as its own module because it has to be callable from two places.
 * Public signup calls it, and so does the guard — because signup is two
 * separate systems and only one of them is transactional. Supabase creates the
 * auth account first; the firm is created second. When the second half failed,
 * the person was left with a real login attached to nothing, and both doors
 * shut behind them at once: signing up again is refused because the email is
 * taken, and signing in throws because the account has no firm. There is no way
 * out of that from the UI, which is how a first-run signup error becomes a
 * permanently unusable account.
 *
 * So provisioning is idempotent and can be re-run later against an account that
 * is already half-made.
 *
 * Deliberately on `basePrisma`, not the tenant-scoped client: this runs before
 * a tenant exists, and it is the thing that brings one into being.
 */
export async function provisionFirmForPartner(input: {
  userId: string
  email: string
  name: string
  firmName: string
}): Promise<{ firmId: string }> {
  const name = input.name.trim() || input.email
  // Someone recovering an interrupted signup may have no firm name to hand.
  // A placeholder they can rename in Settings beats refusing them entry.
  const firmName = input.firmName.trim() || `${name}'s Practice`

  return basePrisma.$transaction(async (tx) => {
    // Re-entrant: if a previous attempt got this far, adopt what it made
    // rather than creating a second firm for the same person.
    const existing = await tx.user.findUnique({
      where: { id: input.userId },
      select: { firmId: true },
    })
    if (existing?.firmId) {
      const firm = await tx.firm.findUnique({
        where: { id: existing.firmId },
        select: { id: true },
      })
      if (firm) return { firmId: firm.id }
    }

    const firm = await tx.firm.create({
      data: {
        name: firmName,
        plan: "TRIAL",
        status: "ACTIVE",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    })

    await tx.user.upsert({
      where: { id: input.userId },
      update: { name, role: "PARTNER", firmId: firm.id },
      create: {
        id: input.userId,
        email: input.email,
        name,
        role: "PARTNER",
        firmId: firm.id,
      },
    })

    await tx.firmSettings.upsert({
      where: { firmId: firm.id },
      update: { firmName },
      create: { firmId: firm.id, firmName },
    })

    // The founding Partner needs an Employee row of their own. Everything in
    // the workforce module keys on one — sessions, attendance, hours, capacity
    // — so without it the person who owns the firm is the only member of staff
    // missing from their own team report.
    const employee = await tx.employee.findFirst({
      where: { firmId: firm.id, email: input.email },
      select: { id: true },
    })
    if (!employee) {
      await tx.employee.create({
        data: {
          firmId: firm.id,
          name,
          email: input.email,
          userId: input.userId,
          isActive: true,
        },
      })
    }

    return { firmId: firm.id }
  })
}
