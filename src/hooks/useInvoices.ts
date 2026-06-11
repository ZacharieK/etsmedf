import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFunctions, httpsCallable } from "firebase/functions"
import {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoiceStatus,
  deleteInvoice,
} from "@/lib/invoiceService"
import type { Invoice } from "@/types/invoice"

const KEYS = {
  all: ["invoices"] as const,
  detail: (id: string) => ["invoices", id] as const,
}

export function useInvoices() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: getInvoices,
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => getInvoice(id),
    enabled: !!id,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoice: Omit<Invoice, "id">) => createInvoice(invoice),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Invoice["status"] }) =>
      updateInvoiceStatus(id, status),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.all })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useSubmitToDGI() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ invoiceId, invoice }: { invoiceId: string; invoice: Invoice }) => {
      const functions = getFunctions()
      const fn = httpsCallable<
        { invoiceId: string; invoice: { clientName?: string; clientEmail?: string; clientAddress?: string; items: { description: string; quantity: number; unitPrice: number }[] } },
        { dgiReference: string; dgiPdfUrl?: string }
      >(functions, "submitToDGI")

      const result = await fn({
        invoiceId,
        invoice: {
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          clientAddress: invoice.clientAddress,
          items: invoice.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      })
      return result.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all })
    },
  })
}
