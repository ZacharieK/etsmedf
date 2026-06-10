import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Invoice } from "@/types/invoice"
import { calculateTotal } from "@/types/invoice"
import { ArrowLeft, Printer, Download } from "lucide-react"
import { toast } from "sonner"
import { useUpdateInvoiceStatus } from "@/hooks/useInvoices"

interface Props {
  invoice: Invoice
  onBack: () => void
  onStatusChange?: (status: Invoice["status"]) => void
}

const statusBadge: Record<Invoice["status"], "default" | "secondary" | "outline"> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
}

export function InvoicePreview({ invoice, onBack, onStatusChange }: Props) {
  const total = calculateTotal(invoice.items)
  const updateStatus = useUpdateInvoiceStatus()

  async function handleStatusChange(status: Invoice["status"]) {
    if (!invoice.id) return
    try {
      await updateStatus.mutateAsync({ id: invoice.id, status })
      onStatusChange?.(status)
      toast.success(`Status updated to ${status}`)
    } catch {
      toast.error("Failed to update status")
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Form
        </Button>
        <div className="flex items-center gap-2">
          {invoice.id && (
            <Select
              value={invoice.status}
              onValueChange={(v) => handleStatusChange(v as Invoice["status"])}
              disabled={updateStatus.isPending}
            >
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Invoice document */}
      <div
        id="invoice-document"
        className="bg-white text-foreground rounded-xl border border-border p-8 md:p-12 shadow-sm space-y-8 print:shadow-none print:border-none print:rounded-none"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">INVOICE</h1>
            <p className="text-muted-foreground font-mono mt-1">{invoice.invoiceNumber}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="font-semibold text-lg">ETSMEDF</p>
            <Badge variant={statusBadge[invoice.status]} className="capitalize">
              {invoice.status}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Bill to / Dates */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Bill To</p>
            <p className="font-semibold text-base">{invoice.clientName}</p>
            {invoice.clientEmail && (
              <p className="text-muted-foreground">{invoice.clientEmail}</p>
            )}
            {invoice.clientAddress && (
              <p className="text-muted-foreground whitespace-pre-line">{invoice.clientAddress}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Issue Date</p>
            <p className="font-medium">{formatDate(invoice.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Due Date</p>
            <p className="font-medium">{formatDate(invoice.dueDate)}</p>
          </div>
        </div>

        {/* Items table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="text-right font-semibold w-20">Qty</TableHead>
                <TableHead className="text-right font-semibold w-32">Unit Price</TableHead>
                <TableHead className="text-right font-semibold w-32">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">
                    ${(item.quantity * item.unitPrice).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Total */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <>
            <Separator />
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
            </div>
          </>
        )}

        <Separator />
        <p className="text-center text-xs text-muted-foreground">
          Thank you for your business — ETSMEDF
        </p>
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
