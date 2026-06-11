import { useState } from "react"
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
import { calculateSubtotal, calculateTVA, calculateTotal, TVA_RATE } from "@/types/invoice"
import { ArrowLeft, Printer, Download, Send, CheckCircle2, Loader2, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useUpdateInvoiceStatus, useSubmitToDGI } from "@/hooks/useInvoices"

interface Props {
  invoice: Invoice
  onBack: () => void
  onStatusChange?: (status: Invoice["status"]) => void
  onDgiSubmit?: (dgiReference: string) => void
}

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

export function InvoicePreview({ invoice, onBack, onStatusChange, onDgiSubmit }: Props) {
  const subtotal = calculateSubtotal(invoice.items)
  const tva = calculateTVA(invoice.items)
  const total = calculateTotal(invoice.items)
  const updateStatus = useUpdateInvoiceStatus()
  const submitToDGI = useSubmitToDGI()
  const [dgiRef, setDgiRef] = useState(invoice.dgiReference ?? "")
  const [dgiPdfUrl, setDgiPdfUrl] = useState(invoice.dgiPdfUrl ?? "")
  const [showPdf, setShowPdf] = useState(!!invoice.dgiPdfUrl)

  async function handleStatusChange(status: Invoice["status"]) {
    if (!invoice.id) return
    try {
      await updateStatus.mutateAsync({ id: invoice.id, status })
      onStatusChange?.(status)
      toast.success(`Statut mis à jour : ${statusLabel[status]}`)
    } catch {
      toast.error("Échec de la mise à jour du statut")
    }
  }

  async function handleSendToDGI() {
    if (!invoice.id) {
      toast.error("Enregistrez la facture avant de l'envoyer à la DGI")
      return
    }
    try {
      const data = await submitToDGI.mutateAsync({ invoiceId: invoice.id, invoice })
      setDgiRef(data.dgiReference)
      if (data.dgiPdfUrl) {
        setDgiPdfUrl(data.dgiPdfUrl)
        setShowPdf(true)
      }
      onDgiSubmit?.(data.dgiReference)
      toast.success(`Facture soumise à la DGI — Référence : ${data.dgiReference}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue"
      toast.error(`Échec de la soumission DGI : ${msg}`)
    }
  }

  const alreadySubmitted = !!dgiRef

  return (
    <div className="space-y-6">

      {/* ── Barre supérieure ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour au formulaire
        </Button>

        {/* Sélecteur de vue — visible une fois la référence DGI obtenue */}
        {dgiRef && (
          <div className="flex rounded-lg border border-border overflow-hidden self-start">
            <button
              onClick={() => setShowPdf(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                !showPdf
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Facture app
            </button>
            <button
              onClick={() => setShowPdf(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                showPdf
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Facture DGI
            </button>
          </div>
        )}
      </div>

      {/* ── Visionneuse PDF DGI ───────────────────────────────────────────────── */}
      {showPdf && dgiRef && (
        <div className="space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Référence DGI :</span>
              <span className="font-mono text-sm text-green-700 font-semibold">{dgiRef}</span>
            </div>
            {dgiPdfUrl && (
              <a
                href={dgiPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir dans un nouvel onglet
              </a>
            )}
          </div>

          {dgiPdfUrl ? (
            <iframe
              src={dgiPdfUrl}
              title="Facture DGI"
              className="w-full rounded-xl border border-border shadow-sm"
              style={{ height: "780px" }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-border text-muted-foreground gap-3">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Le PDF DGI n'a pas été capturé automatiquement.</p>
              <p className="text-xs">
                Connectez-vous à{" "}
                <span className="font-mono">edef.dgirdc.cd</span> et téléchargez le PDF
                manuellement en utilisant la référence{" "}
                <span className="font-mono font-semibold">{dgiRef}</span>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Facture app (masquée quand l'onglet DGI est actif) ───────────────── */}
      <div className={showPdf && dgiRef ? "hidden print:block" : undefined}>

        {/* Barre d'actions */}
        <div className="flex items-center justify-between print:hidden mb-4">
          <div />
          <div className="flex items-center gap-2">
            {invoice.id && (
              <Select
                value={invoice.status}
                onValueChange={(v) => handleStatusChange(v as Invoice["status"])}
                disabled={updateStatus.isPending}
              >
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="sent">Envoyée</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
                </SelectContent>
              </Select>
            )}

            {invoice.id && (
              alreadySubmitted ? (
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium px-3 py-1.5 rounded-md border border-green-200 bg-green-50">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  DGI : {dgiRef}
                </div>
              ) : (
                <Button size="sm" onClick={handleSendToDGI} disabled={submitToDGI.isPending}>
                  {submitToDGI.isPending
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Send className="h-4 w-4 mr-2" />}
                  {submitToDGI.isPending ? "Envoi à la DGI…" : "Envoyer à la DGI"}
                </Button>
              )
            )}

            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4 mr-2" />
              Enregistrer en PDF
            </Button>
          </div>
        </div>

        {/* Document de facture */}
        <div
          id="invoice-document"
          className="bg-white text-foreground rounded-xl border border-border p-8 md:p-12 shadow-sm space-y-8 print:shadow-none print:border-none print:rounded-none"
        >
          {/* En-tête */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground">FACTURE</h1>
              <p className="text-muted-foreground font-mono mt-1">{invoice.invoiceNumber}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="font-semibold text-lg">ETSMEDF</p>
              <Badge variant={statusBadge[invoice.status]}>
                {statusLabel[invoice.status]}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Facturer à / Dates */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Facturer à</p>
              <p className="font-semibold text-base">{invoice.clientName}</p>
              {invoice.clientEmail && (
                <p className="text-muted-foreground">{invoice.clientEmail}</p>
              )}
              {invoice.clientAddress && (
                <p className="text-muted-foreground whitespace-pre-line">{invoice.clientAddress}</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Date d'émission</p>
              <p className="font-medium">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Date d'échéance</p>
              <p className="font-medium">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>

          {/* Tableau des articles */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="text-right font-semibold w-20">Qté</TableHead>
                  <TableHead className="text-right font-semibold w-32">Prix unitaire</TableHead>
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
                <span>Sous-total HT</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>TVA ({(TVA_RATE * 100).toFixed(0)}%)</span>
                <span>${tva.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total TTC</span>
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

          {/* Cachet de référence DGI */}
          {dgiRef && (
            <>
              <Separator />
              <div className="flex items-center justify-center gap-2 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Référence DGI :{" "}
                  <span className="font-mono font-semibold">{dgiRef}</span>
                </span>
              </div>
            </>
          )}

          <Separator />
          <p className="text-center text-xs text-muted-foreground">
            Merci pour votre confiance — ETSMEDF
          </p>
        </div>

      </div>{/* fin wrapper facture app */}

    </div>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
