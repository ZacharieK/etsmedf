import { useState } from "react"
import { toast } from "sonner"
import { AppHeader } from "@/components/AppHeader"
import { InvoiceForm } from "@/components/InvoiceForm"
import { InvoicePreview } from "@/components/InvoicePreview"
import { useCreateInvoice } from "@/hooks/useInvoices"
import type { Invoice } from "@/types/invoice"

export function NewInvoicePage() {
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null)
  const createInvoice = useCreateInvoice()

  async function handleGenerate(invoice: Invoice) {
    setGeneratedInvoice(invoice)
    try {
      const id = await createInvoice.mutateAsync(invoice)
      setGeneratedInvoice((prev) => (prev ? { ...prev, id } : prev))
      toast.success("Facture enregistrée dans Firestore")
    } catch {
      toast.error("Échec de l'enregistrement — vérifiez votre configuration Firebase")
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
          <InvoiceForm onGenerate={handleGenerate} />
        )}
      </main>
    </div>
  )
}
