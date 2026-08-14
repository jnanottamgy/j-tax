import { RouteLoading } from "@/components/layout/route-loading"

/**
 * Fallback for the client portal. None of its pages had one, so a client on a
 * slow connection saw a blank panel — the surface where an unexplained blank
 * screen costs the most, because they cannot ask the app what went wrong.
 */
export default function Loading() {
  return <RouteLoading kpis={4} />
}
