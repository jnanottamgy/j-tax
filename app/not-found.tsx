import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FileSearch, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <FileSearch className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold">Page not found</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/clients">
              View clients
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
