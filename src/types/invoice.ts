export interface InvoiceItem {
  id: string
  productId?: number
  description: string
  quantity: number
  unitPrice: number
}

export interface Invoice {
  id?: string
  invoiceNumber: string
  clientName: string
  clientEmail?: string
  clientAddress?: string
  issueDate: string
  dueDate: string
  items: InvoiceItem[]
  notes?: string
  status: "draft" | "sent" | "paid"
  createdAt?: string
  dgiReference?: string
  dgiPdfUrl?: string
  dgiSubmittedAt?: string
}

export const TVA_RATE = 0.16 // Groupe B — 16%

export function calculateSubtotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function calculateTVA(items: InvoiceItem[]): number {
  return calculateSubtotal(items) * TVA_RATE
}

export function calculateTotal(items: InvoiceItem[]): number {
  return calculateSubtotal(items) + calculateTVA(items)
}
