import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PlusCircle, Trash2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useStoredDGIArticles } from "@/hooks/useDGIArticles"
import type { Invoice, InvoiceItem } from "@/types/invoice"
import { calculateSubtotal, calculateTVA, calculateTotal, TVA_RATE } from "@/types/invoice"

const itemSchema = z.object({
  id: z.string(),
  productId: z.number().optional(),
  description: z.string().min(1, "La description est requise"),
  quantity: z.number({ message: "Entrez un nombre" }).min(1, "Minimum 1"),
  unitPrice: z.number({ message: "Entrez un nombre" }).min(0, "Doit être positif"),
})

const invoiceSchema = z.object({
  clientName: z.string().min(1, "Le nom du client est requis"),
  clientEmail: z.string().email("Adresse e-mail invalide").optional().or(z.literal("")),
  clientAddress: z.string().optional(),
  issueDate: z.string().min(1, "La date d'émission est requise"),
  dueDate: z.string().min(1, "La date d'échéance est requise"),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Ajoutez au moins un article"),
})

type InvoiceFormData = z.infer<typeof invoiceSchema>

interface Props {
  onGenerate: (invoice: Invoice) => void
  isSubmitting?: boolean
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

export function InvoiceForm({ onGenerate, isSubmitting }: Props) {
  const [invoiceNumber] = useState(generateInvoiceNumber)
  const { articles: dgiArticles } = useStoredDGIArticles()
  const [articleIdInputs, setArticleIdInputs] = useState<Record<number, string>>({})

  const today = new Date().toISOString().split("T")[0]
  const dueDefault = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
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

  const normalizedItems = watchedItems.map((i) => ({
    ...i,
    quantity: Number(i.quantity) || 0,
    unitPrice: Number(i.unitPrice) || 0,
  }))
  const subtotal = calculateSubtotal(normalizedItems)
  const tva = calculateTVA(normalizedItems)
  const total = calculateTotal(normalizedItems)

  function handleArticleIdChange(index: number, raw: string) {
    setArticleIdInputs((prev) => ({ ...prev, [index]: raw }))
    const numId = parseInt(raw, 10)
    if (!isNaN(numId) && numId >= 1 && numId <= dgiArticles.length) {
      const article = dgiArticles[numId - 1]
      setValue(`items.${index}.productId`, numId, { shouldValidate: true })
      setValue(`items.${index}.description`, article.name, { shouldValidate: true })
      setValue(`items.${index}.unitPrice`, article.price, { shouldValidate: true })
    }
  }

  function getArticleStatus(index: number): "found" | "not-found" | "empty" {
    const raw = articleIdInputs[index] ?? ""
    if (!raw) return "empty"
    const numId = parseInt(raw, 10)
    return (!isNaN(numId) && numId >= 1 && numId <= dgiArticles.length) ? "found" : "not-found"
  }

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
      {/* Numéro de facture */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Nouvelle facture</h2>
        <span className="text-sm font-mono text-muted-foreground bg-muted px-3 py-1 rounded-md">
          {invoiceNumber}
        </span>
      </div>

      <Separator />

      {/* Informations client */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations client</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="clientName">Nom du client *</Label>
            <Input id="clientName" placeholder="Acme Corp" {...register("clientName")} />
            {errors.clientName && (
              <p className="text-xs text-destructive">{errors.clientName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clientEmail">E-mail</Label>
            <Input
              id="clientEmail"
              type="email"
              placeholder="client@exemple.com"
              {...register("clientEmail")}
            />
            {errors.clientEmail && (
              <p className="text-xs text-destructive">{errors.clientEmail.message}</p>
            )}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="clientAddress">Adresse</Label>
            <Input
              id="clientAddress"
              placeholder="123 Avenue de la Paix, Kinshasa"
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
            <Label htmlFor="issueDate">Date d'émission *</Label>
            <Input id="issueDate" type="date" {...register("issueDate")} />
            {errors.issueDate && (
              <p className="text-xs text-destructive">{errors.issueDate.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Date d'échéance *</Label>
            <Input id="dueDate" type="date" {...register("dueDate")} />
            {errors.dueDate && (
              <p className="text-xs text-destructive">{errors.dueDate.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Articles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Articles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden md:grid md:grid-cols-[72px_1fr_80px_130px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>ID article</span>
            <span>Description</span>
            <span className="text-center">Qté</span>
            <span className="text-right">Prix unitaire</span>
            <span />
          </div>
        
          {fields.map((field, index) => {
            const qty = Number(watchedItems[index]?.quantity) || 0
            const price = Number(watchedItems[index]?.unitPrice) || 0
            const lineTotal = qty * price
            const status = getArticleStatus(index)
        
            return (
              <div
                key={field.id}
                className="grid grid-cols-1 md:grid-cols-[72px_1fr_80px_130px_40px] gap-2 items-start"
              >
                {/* ID article */}
                <div className="space-y-1">
                  <Label className="md:hidden text-xs">ID article</Label>
                  <div className="relative">
                    <Input
                      placeholder="ID"
                      className="pr-7"
                      value={articleIdInputs[index] ?? ""}
                      onChange={(e) => handleArticleIdChange(index, e.target.value)}
                    />
                    {status === "found" && (
                      <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-500" />
                    )}
                    {status === "not-found" && (
                      <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                  {status === "not-found" && (
                    <p className="text-xs text-destructive">Introuvable</p>
                  )}
                </div>
        
                {/* Description */}
                <div className="space-y-1">
                  <Label className="md:hidden text-xs">Description</Label>
                  <Input
                    placeholder="Description de l'article"
                    {...register(`items.${index}.description`)}
                  />
                  {errors.items?.[index]?.description && (
                    <p className="text-xs text-destructive">
                      {errors.items[index]?.description?.message}
                    </p>
                  )}
                </div>

                {/* Qté */}
                <div className="space-y-1">
                  <Label className="md:hidden text-xs">Qté</Label>
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

                {/* Prix unitaire */}
                <div className="space-y-1">
                  <Label className="md:hidden text-xs">Prix unitaire</Label>
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

                {/* Supprimer */}
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
            Ajouter un article
          </Button>

          <Separator />

          <div className="flex justify-end">
            <div className="text-right space-y-1 min-w-48">
              <div className="flex justify-between gap-16 text-sm text-muted-foreground">
                <span>Sous-total HT</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-16 text-sm text-muted-foreground">
                <span>TVA ({(TVA_RATE * 100).toFixed(0)}%)</span>
                <span>${tva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-16 text-lg font-bold pt-1 border-t border-border">
                <span>Total TTC</span>
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
            placeholder="Conditions de paiement, message de remerciement…"
            {...register("notes")}
          />
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Envoi à la DGI en cours…" : "Générer la facture"}
      </Button>
    </form>
  )
}
