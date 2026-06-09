import { DocumentVaultClient } from "./document-vault-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"

export default function DocumentsPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Documents" }]} />
      <PageHeader
        label="Document management"
        title="Document Vault"
        description="Secure document storage with version control and access management."
      />
      <DocumentVaultClient />
    </PageContainer>
  )
}
