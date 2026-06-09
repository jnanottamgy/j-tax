import { InvoicesPageClient } from "@/components/payments/invoices-page-client"
import { getInvoicesData } from "@/app/actions/invoices"

export default async function InvoicesPage() {
  const data = await getInvoicesData()
  
  return <InvoicesPageClient initialInvoices={data.invoices} clients={data.clients} />
}
