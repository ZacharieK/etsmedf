import { useState } from "react"
import { toast } from "sonner"
import { AppHeader } from "@/components/AppHeader"
import { InvoiceForm } from "@/components/InvoiceForm"
import { InvoicePreview } from "@/components/InvoicePreview"
import { useCreateInvoice, useSubmitToDGI } from "@/hooks/useInvoices"
import type { Invoice } from "@/types/invoice"

export function NewInvoicePage() {
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createInvoice = useCreateInvoice()
  const submitToDGI = useSubmitToDGI()

  async function handleGenerate(invoice: Invoice) {
    setGeneratedInvoice(invoice)
    setIsSubmitting(true)
    try {
      // Step 1: Save to Firestore
      const id = await createInvoice.mutateAsync(invoice)
      const savedInvoice = { ...invoice, id }
      setGeneratedInvoice(savedInvoice)
      toast.success("Facture enregistrée")

      // Step 2: Automatically submit to DGI
      toast.info("Envoi à la DGI en cours…", { duration: 30000, id: "dgi-submit" })
      const data = await submitToDGI.mutateAsync({ invoiceId: id, invoice: savedInvoice })
      toast.dismiss("dgi-submit")
      setGeneratedInvoice((prev) => prev ? { ...prev, dgiReference: data.dgiReference, dgiPdfUrl: data.dgiPdfUrl, status: "sent" as const } : prev)
      toast.success(`Facture soumise à la DGI — Référence : ${data.dgiReference}`)
    } catch (err: unknown) {
      toast.dismiss("dgi-submit")
      const msg = err instanceof Error ? err.message : "Erreur inconnue"
      toast.error(`Échec : ${msg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        breadcrumb="Invoices"
        breadcrumbHref="/invoices"
        current={generatedInvoice ? "Aperçu" : "Nouvelle facture"}
      />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {generatedInvoice ? (
          <InvoicePreview
            invoice={generatedInvoice}
            onBack={() => setGeneratedInvoice(null)}
          />
        ) : (
          <InvoiceForm onGenerate={handleGenerate} isSubmitting={isSubmitting} />
        )}
      </main>
    </div>
  )
}
