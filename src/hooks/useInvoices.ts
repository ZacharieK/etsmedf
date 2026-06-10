import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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
