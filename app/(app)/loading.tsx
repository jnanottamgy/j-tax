import { RouteLoading } from "@/components/layout/route-loading"

/**
 * Fallback for every route under (app) that has no loading.tsx of its own.
 *
 * Fifteen of the forty-eight pages had one, so two-thirds of the app showed
 * nothing at all while it fetched. A loading file suspends its whole subtree,
 * so one boundary here covers the rest — and because it sits inside
 * (app)/layout.tsx, the sidebar and header stay put and only the content area
 * skeletons. A route with a more specific shape still overrides it by adding
 * its own file.
 */
export default function Loading() {
  return <RouteLoading />
}
