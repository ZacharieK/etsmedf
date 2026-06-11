import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { PlusCircle, Trash2, Eye, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AppHeader } from "@/components/AppHeader"
import { InvoicePreview } from "@/components/InvoicePreview"
import { useInvoices, useDeleteInvoice } from "@/hooks/useInvoices"
import { calculateTotal } from "@/types/invoice"
import type { Invoice } from "@/types/invoice"

const statusLabel: Record<Invoice["status"], string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
}

const statusBadge: Record<Invoice["status"], "default" | "secondary" | "outline"> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
}

export function InvoicesListPage() {
  const { data: invoices, isLoading, isError } = useInvoices()
  const deleteInvoice = useDeleteInvoice()
  const [preview, setPreview] = useState<Invoice | null>(null)

  async function handleDelete(id: string, invoiceNumber: string) {
    if (!confirm(`Supprimer la facture ${invoiceNumber} ?`)) return
    try {
      await deleteInvoice.mutateAsync(id)
      toast.success("Facture supprimée")
      if (preview?.id === id) setPreview(null)
    } catch {
      toast.error("Échec de la suppression")
    }
  }

  if (preview) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader
          breadcrumb="Factures"
          breadcrumbHref="/invoices"
          current={preview.invoiceNumber}
        />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <InvoicePreview
            invoice={preview}
            onBack={() => setPreview(null)}
            onStatusChange={(status) => setPreview((p) => p ? { ...p, status } : p)}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Factures</h1>
          <span className="text-sm text-muted-foreground">
            {invoices?.length ?? 0} facture{(invoices?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des factures…
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="font-medium">Impossible de charger les factures.</p>
              <p className="text-sm mt-1">Vérifiez votre configuration Firebase dans <code>.env</code></p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && invoices?.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <p className="text-muted-foreground">Aucune facture pour le moment.</p>
              <Button asChild>
                <Link to="/invoices/new">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Créer votre première facture
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {invoices && invoices.length > 0 && (
          <div className="space-y-2">
            {/* En-tête du tableau */}
            <div className="hidden md:grid md:grid-cols-[1fr_160px_120px_100px_80px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Client</span>
              <span>N° facture</span>
              <span>Échéance</span>
              <span className="text-right">Total</span>
              <span />
            </div>

            <Separator />

            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="group flex flex-col md:grid md:grid-cols-[1fr_160px_120px_100px_80px] gap-2 md:gap-4 items-start md:items-center px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-medium truncate">{invoice.clientName}</span>
                  <Badge variant={statusBadge[invoice.status]} className="shrink-0">
                    {statusLabel[invoice.status]}
                  </Badge>
                </div>
                <span className="text-sm font-mono text-muted-foreground">
                  {invoice.invoiceNumber}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatShortDate(invoice.dueDate)}
                </span>
                <span className="text-sm font-medium text-right">
                  ${calculateTotal(invoice.items).toFixed(2)}
                </span>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreview(invoice)}
                    title="Voir la facture"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(invoice.id!, invoice.invoiceNumber)}
                    disabled={deleteInvoice.isPending}
                    title="Supprimer la facture"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
