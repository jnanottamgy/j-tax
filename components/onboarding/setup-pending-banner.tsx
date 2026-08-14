/**
 * "The firm's setup isn't finished, and it isn't yours to finish."
 *
 * The setup wizard is Partner-only, correctly — its first step writes firm
 * settings the server refuses for a Manager. But a Manager signing into a
 * half-configured firm saw an ordinary empty app with no explanation: no
 * clients, no services, no branding on anything, and nothing saying why. That
 * reads as a broken product rather than a deliberate boundary.
 */
export function SetupPendingBanner() {
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-sky-500/25 bg-sky-500/[0.07] px-5 py-4 md:mx-6 lg:mx-8">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          Your firm&apos;s setup hasn&apos;t been finished yet.
        </span>{" "}
        Firm details, branding and email are set up by a Partner, so parts of the app
        will look empty until that&apos;s done. Everything you add in the meantime is
        kept.
      </p>
    </div>
  )
}
