"use client"

import { useRouter } from "next/navigation"
import { Download } from "lucide-react"

import { AddClientDialog } from "@/components/clients/add-client-dialog"
import { ClientsTable } from "@/components/clients/clients-table"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import type { ClientListItem, EmployeeOption } from "@/lib/clients/types"

type ClientsPageClientProps = {
  initialClients: ClientListItem[]
  employees: EmployeeOption[]
  canManage: boolean
}

export function ClientsPageClient({
  initialClients,
  employees,
  canManage,
}: ClientsPageClientProps) {
  const router = useRouter()

  const handleExportClients = () => {
    const headers = ["Name", "GSTIN", "PAN", "Email", "Phone", "Priority", "Status"]
    const rows = initialClients.map(client => [
      client.name,
      client.gstin || "",
      client.pan || "",
      client.email || "",
      client.phone || "",
      client.priority || "",
      client.status || ""
    ])
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `clients-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <>
      <PageHeader
        label="Client management"
        title="Clients"
        description="Master client records powering tasks, payments, documents, and compliance across J-TAX."
        action={
          <>
            <Button
              variant="outline"
              size="sm"
              className="input-premium h-9 gap-1.5 rounded-xl border-white/[0.07] bg-transparent"
              onClick={handleExportClients}
            >
              <Download className="size-3.5" />
              Export
            </Button>
            {canManage && (
              <AddClientDialog
                employees={employees}
                onSuccess={() => router.refresh()}
              />
            )}
          </>
        }
      />

      <p className="-mt-2 text-[13px] text-muted-foreground/80">
        <span className="font-medium tabular-nums text-foreground/90">
          {initialClients.length}
        </span>{" "}
        master {initialClients.length === 1 ? "entity" : "entities"} in portfolio
      </p>

      <ClientsTable
        clients={initialClients}
        employees={employees}
        canManage={canManage}
      />
    </>
  )
}
