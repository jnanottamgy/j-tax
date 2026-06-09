import { Sparkles } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

type PagePlaceholderProps = {
  label?: string
  title: string
  description: string
}

export function PagePlaceholder({
  label,
  title,
  description,
}: PagePlaceholderProps) {
  return (
    <PageContainer>
      <PageHeader label={label} title={title} description={description} />
      <GlassCard
        hover={false}
        className="flex min-h-[360px] flex-col items-center justify-center p-12 text-center"
      >
        <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/20">
          <Sparkles className="size-6 text-primary" />
        </div>
        <p className="text-[15px] font-medium text-foreground/90">
          This module is ready for implementation
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Connect your data sources and workflows to populate this view.
        </p>
      </GlassCard>
    </PageContainer>
  )
}
