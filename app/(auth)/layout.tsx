export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard-gradient relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.45 0.14 265 / 18%), transparent 70%)",
        }}
      />
      <div className="page-enter relative z-[1] w-full max-w-md">{children}</div>
    </div>
  )
}
