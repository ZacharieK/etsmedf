import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { FileText } from "lucide-react"
import { toast } from "sonner"
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
      toast.success("Invoice saved to Firestore")
    } catch {
      toast.error("Failed to save invoice — check your Firebase config")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">ETSMEDF</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground">
            {generatedInvoice ? "Preview" : "New Invoice"}
          </span>
        </div>
      </header>

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
