import { Suspense } from "react"

import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { SearchResultsClient } from "./search-results-client"

export default function SearchPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Search" }]} />
      {/* useSearchParams needs a Suspense boundary to keep the rest of the
          route from opting out of static rendering. */}
      <Suspense fallback={null}>
        <SearchResultsClient />
      </Suspense>
    </PageContainer>
  )
}
