import { LogoLoading } from "@/components/ui/logo"

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
      <LogoLoading size={64} />
    </div>
  )
}
