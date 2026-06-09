import { notFound } from "next/navigation"
import { Client360Client } from "./client-360-client"
import { getClient360Data } from "@/app/actions/client-360"
import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"

type Client360PageProps = {
  params: Promise<{ id: string }>
}

export default async function Client360Page({ params }: Client360PageProps) {
  const { id } = await params
  const data = await getClient360Data(id)

  if (!data.client) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <PageContainer className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Clients", href: "/clients" },
            { label: data.client.name },
          ]}
        />
        <Client360Client initialData={data} clientId={id} />
      </PageContainer>
    </div>
  )
}
