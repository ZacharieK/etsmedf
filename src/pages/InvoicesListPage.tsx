import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { FileText, PlusCircle, Trash2, Eye, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { InvoicePreview } from "@/components/InvoicePreview"
import { useInvoices, useDeleteInvoice } from "@/hooks/useInvoices"
import { calculateTotal } from "@/types/invoice"
import type { Invoice } from "@/types/invoice"

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
    if (!confirm(`Delete invoice ${invoiceNumber}?`)) return
    try {
      await deleteInvoice.mutateAsync(id)
      toast.success("Invoice deleted")
      if (preview?.id === id) setPreview(null)
    } catch {
      toast.error("Failed to delete invoice")
    }
  }

  if (preview) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border print:hidden">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <FileText className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl tracking-tight">ETSMEDF</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <button
              onClick={() => setPreview(null)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Invoices
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{preview.invoiceNumber}</span>
          </div>
        </header>
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
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">ETSMEDF</span>
          </Link>
          <Button asChild>
            <Link to="/invoices/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Invoice
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <span className="text-sm text-muted-foreground">
            {invoices?.length ?? 0} invoice{invoices?.length !== 1 ? "s" : ""}
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading invoices…
          </div>
        )}

        {isError && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="font-medium">Could not load invoices.</p>
              <p className="text-sm mt-1">Check your Firebase config in <code>.env</code></p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && invoices?.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <p className="text-muted-foreground">No invoices yet.</p>
              <Button asChild>
                <Link to="/invoices/new">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create your first invoice
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {invoices && invoices.length > 0 && (
          <div className="space-y-2">
            {/* Table header */}
            <div className="hidden md:grid md:grid-cols-[1fr_160px_120px_100px_80px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Client</span>
              <span>Invoice #</span>
              <span>Due Date</span>
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
                  <Badge variant={statusBadge[invoice.status]} className="capitalize shrink-0">
                    {invoice.status}
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
                    title="View invoice"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(invoice.id!, invoice.invoiceNumber)}
                    disabled={deleteInvoice.isPending}
                    title="Delete invoice"
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
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
