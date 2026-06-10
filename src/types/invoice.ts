export interface InvoiceItem {
  id: string
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
}

export function calculateSubtotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function calculateTotal(items: InvoiceItem[]): number {
  return calculateSubtotal(items)
}
