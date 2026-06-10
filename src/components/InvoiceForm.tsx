import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PlusCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Invoice, InvoiceItem } from "@/types/invoice"
import { calculateTotal } from "@/types/invoice"

const itemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "Description is required"),
  quantity: z.number({ message: "Enter a number" }).min(1, "Minimum 1"),
  unitPrice: z.number({ message: "Enter a number" }).min(0, "Must be positive"),
})

const invoiceSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  clientAddress: z.string().optional(),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

interface Props {
  onGenerate: (invoice: Invoice) => void
}

function generateInvoiceNumber(): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `INV-${y}${m}-${rand}`
}

function newItem(): InvoiceItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }
}

export function InvoiceForm({ onGenerate }: Props) {
  const [invoiceNumber] = useState(generateInvoiceNumber)

  const today = new Date().toISOString().split("T")[0]
  const dueDefault = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientAddress: "",
      issueDate: today,
      dueDate: dueDefault,
      notes: "",
      items: [newItem()],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")

  const total = calculateTotal(
    watchedItems.map((i) => ({
      ...i,
      quantity: Number(i.quantity) || 0,
      unitPrice: Number(i.unitPrice) || 0,
    }))
  )

  function onSubmit(data: InvoiceFormData) {
    const invoice: Invoice = {
      ...data,
      invoiceNumber,
      status: "draft",
      createdAt: new Date().toISOString(),
    }
    onGenerate(invoice)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Invoice number */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">New Invoice</h2>
        <span className="text-sm font-mono text-muted-foreground bg-muted px-3 py-1 rounded-md">
          {invoiceNumber}
        </span>
      </div>

      <Separator />

      {/* Client info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Client Name *</Label>
            <Input id="clientName" placeholder="Acme Corp" {...register("clientName")} />
            {errors.clientName && (
              <p className="text-xs text-destructive">{errors.clientName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clientEmail">Email</Label>
            <Input
              id="clientEmail"
              type="email"
              placeholder="client@example.com"
              {...register("clientEmail")}
            />
            {errors.clientEmail && (
              <p className="text-xs text-destructive">{errors.clientEmail.message}</p>
            )}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="clientAddress">Address</Label>
            <Input
              id="clientAddress"
              placeholder="123 Main St, City, Country"
              {...register("clientAddress")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dates</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="issueDate">Issue Date *</Label>
            <Input id="issueDate" type="date" {...register("issueDate")} />
            {errors.issueDate && (
              <p className="text-xs text-destructive">{errors.issueDate.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due Date *</Label>
            <Input id="dueDate" type="date" {...register("dueDate")} />
            {errors.dueDate && (
              <p className="text-xs text-destructive">{errors.dueDate.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden md:grid md:grid-cols-[1fr_80px_120px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>Description</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Unit Price</span>
            <span />
          </div>

          {fields.map((field, index) => {
            const qty = Number(watchedItems[index]?.quantity) || 0
            const price = Number(watchedItems[index]?.unitPrice) || 0
            const lineTotal = qty * price

            return (
              <div
                key={field.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_80px_120px_40px] gap-2 items-start"
              >
                <div className="space-y-1">
                  <Label className="md:hidden text-xs">Description</Label>
                  <Input
                    placeholder="Item description"
                    {...register(`items.${index}.description`)}
                  />
                  {errors.items?.[index]?.description && (
                    <p className="text-xs text-destructive">
                      {errors.items[index]?.description?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="md:hidden text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    className="text-center"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                  {errors.items?.[index]?.quantity && (
                    <p className="text-xs text-destructive">
                      {errors.items[index]?.quantity?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="md:hidden text-xs">Unit Price</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-6 text-right"
                      {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                    />
                  </div>
                  <p className="text-xs text-right text-muted-foreground pr-1">
                    = ${lineTotal.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-start pt-1 md:pt-0 md:items-center justify-end md:justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}

          {errors.items?.root && (
            <p className="text-xs text-destructive">{errors.items.root.message}</p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={() => append(newItem())}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Item
          </Button>

          <Separator />

          <div className="flex justify-end">
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-16 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-16 text-lg font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            placeholder="Payment terms, thank you note..."
            {...register("notes")}
          />
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full">
        Generate Invoice
      </Button>
    </form>
  )
}
