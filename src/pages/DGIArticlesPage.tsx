import { useState } from "react"
import { Loader2, RefreshCw, PlusCircle, Pencil, Trash2, Check, X } from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/AppHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  useDGIArticles,
  useStoredDGIArticles,
  useDGIAddArticle,
  useDGIDeleteArticle,
  useDGIUpdateArticle,
  type DGIArticle,
} from "@/hooks/useDGIArticles"
import { useDGIConfig } from "@/hooks/useDGIConfig"

export function DGIArticlesPage() {
  const { selectedEUFId } = useDGIConfig()
  const { articles: storedArticles, loading: storedLoading } = useStoredDGIArticles()
  const fetchFromDGI = useDGIArticles()
  const addArticle = useDGIAddArticle()
  const deleteArticle = useDGIDeleteArticle()
  const updateArticle = useDGIUpdateArticle()

  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState("")
  const [addPrice, setAddPrice] = useState("")

  // Edit state — which row is being edited
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editPrice, setEditPrice] = useState("")

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Busy state per article (for individual row loaders)
  const [busyArticle, setBusyArticle] = useState<string | null>(null)

  // Display comes from Firestore (live); Cloud Function only used for fetch/CRUD
  const articles = storedArticles
  const isLoading = storedLoading || fetchFromDGI.isFetching
  const isMutating =
    addArticle.isPending || deleteArticle.isPending || updateArticle.isPending

  async function handleLoad() {
    const promise = fetchFromDGI.refetch()
    toast.promise(promise, {
      loading: "Connexion à la plateforme DGI…",
      success: (res) => `${res.data?.length ?? 0} articles sauvegardés dans Firestore`,
      error: (e) => `Erreur : ${extractMessage(e)}`,
    })
  }

  async function handleAdd() {
    if (!addName.trim()) return
    const price = parseFloat(addPrice)
    if (isNaN(price) || price < 0) {
      toast.error("Prix invalide")
      return
    }

    const promise = addArticle.mutateAsync({ name: addName.trim(), price })
    toast.promise(promise, {
      loading: `Ajout de "${addName}" dans DGI…`,
      success: () => {
        setAddName("")
        setAddPrice("")
        setShowAdd(false)
        fetchFromDGI.refetch()
        return `Article "${addName}" ajouté`
      },
      error: (e) => `Échec : ${extractMessage(e)}`,
    })
  }

  function startEdit(article: DGIArticle) {
    setEditingName(article.name)
    setEditName(article.name)
    setEditPrice(String(article.price))
    setConfirmDelete(null)
  }

  function cancelEdit() {
    setEditingName(null)
  }

  async function handleUpdate(originalName: string) {
    const newName = editName.trim() || undefined
    const newPrice = editPrice !== "" ? parseFloat(editPrice) : undefined

    if (newPrice !== undefined && isNaN(newPrice)) {
      toast.error("Prix invalide")
      return
    }

    setBusyArticle(originalName)
    const promise = updateArticle
      .mutateAsync({ name: originalName, newName, newPrice })
      .finally(() => setBusyArticle(null))

    toast.promise(promise, {
      loading: `Modification de "${originalName}"…`,
      success: () => {
        setEditingName(null)
        fetchFromDGI.refetch()
        return `Article modifié`
      },
      error: (e) => `Échec : ${extractMessage(e)}`,
    })
  }

  async function handleDelete(name: string) {
    if (confirmDelete !== name) {
      setConfirmDelete(name)
      return
    }

    setBusyArticle(name)
    const promise = deleteArticle
      .mutateAsync(name)
      .finally(() => setBusyArticle(null))

    toast.promise(promise, {
      loading: `Suppression de "${name}"…`,
      success: () => {
        setConfirmDelete(null)
        fetchFromDGI.refetch()
        return `Article "${name}" supprimé`
      },
      error: (e) => `Échec : ${extractMessage(e)}`,
    })
  }

  const anyBusy = isLoading || isMutating

  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumb="Accueil" breadcrumbHref="/" current="Articles DGI" />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Page title + actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Articles DGI</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestion des articles enregistrés sur la plateforme e-DEF
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoad}
              disabled={anyBusy}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {fetchFromDGI.isFetched || articles.length > 0 ? "Rafraîchir depuis DGI" : "Charger les articles"}
            </Button>
            <Button
              size="sm"
              onClick={() => { setShowAdd((v) => !v); setConfirmDelete(null) }}
              disabled={anyBusy}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium mb-3">Nouvel article DGI</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Désignation *</label>
                  <Input
                    placeholder="Nom de l'article"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    disabled={addArticle.isPending}
                  />
                </div>
                <div className="w-36 space-y-1">
                  <label className="text-xs text-muted-foreground">Prix TTC *</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-6"
                      value={addPrice}
                      onChange={(e) => setAddPrice(e.target.value)}
                      disabled={addArticle.isPending}
                    />
                  </div>
                </div>
                <div className="w-20 space-y-1">
                  <label className="text-xs text-muted-foreground">Groupe</label>
                  <Input value="B" disabled className="text-center" />
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={addArticle.isPending || !addName.trim() || !addPrice}
                  className="mb-0"
                >
                  {addArticle.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowAdd(false); setAddName(""); setAddPrice("") }}
                  disabled={addArticle.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                L'ajout lance une session navigateur et prend ~30–60 secondes.
              </p>
            </CardContent>
          </Card>
        )}

        {/* No EUF selected */}
        {!selectedEUFId && !isLoading && (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground space-y-2">
              <p className="font-medium">Aucun point de vente sélectionné.</p>
              <p className="text-sm">Sélectionnez un e-DEF dans la barre de navigation.</p>
            </CardContent>
          </Card>
        )}

        {/* Empty + no DGI fetch yet */}
        {selectedEUFId && articles.length === 0 && !isLoading && (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground space-y-3">
              <p className="font-medium">Aucun article enregistré pour ce point de vente.</p>
              <p className="text-sm">
                Cliquez sur <strong>Charger les articles</strong> pour récupérer la liste
                depuis la plateforme DGI et la sauvegarder.
              </p>
              <p className="text-xs">Durée estimée : 30–60 secondes.</p>
            </CardContent>
          </Card>
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {fetchFromDGI.isFetching ? "Connexion à la plateforme DGI…" : "Chargement…"}
          </div>
        )}

        {/* Error from Cloud Function */}
        {fetchFromDGI.isError && !isLoading && (
          <Card>
            <CardContent className="py-10 text-center text-destructive">
              <p className="font-medium">Erreur lors du chargement depuis DGI</p>
              <p className="text-sm mt-1 text-muted-foreground">
                {extractMessage(fetchFromDGI.error)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Articles table */}
        {selectedEUFId && articles.length > 0 && !isLoading && (
          <div className="space-y-2">
            {/* Header */}
            <div className="hidden md:grid md:grid-cols-[1fr_130px_80px_100px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Désignation</span>
              <span className="text-right">Prix TTC</span>
              <span className="text-center">Groupe</span>
              <span />
            </div>
            <Separator />

            {articles.length === 0 && (
              <p className="text-sm text-muted-foreground px-4 py-6 text-center">
                Aucun article trouvé dans DGI.
              </p>
            )}

            {articles.map((article) => {
              const isEditing = editingName === article.name
              const isDeleting = confirmDelete === article.name
              const isBusy = busyArticle === article.name

              if (isEditing) {
                return (
                  <div
                    key={article.name}
                    className="grid grid-cols-1 md:grid-cols-[1fr_130px_80px_100px] gap-2 md:gap-4 items-center px-4 py-2 rounded-lg bg-muted/40 border border-border"
                  >
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={updateArticle.isPending}
                      className="h-8 text-sm"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        disabled={updateArticle.isPending}
                        className="h-8 text-sm pl-6 text-right"
                      />
                    </div>
                    <div className="flex justify-center">
                      <Badge variant="secondary">B</Badge>
                    </div>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUpdate(article.name)}
                        disabled={updateArticle.isPending}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={cancelEdit}
                        disabled={updateArticle.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={article.name}
                  className="group grid grid-cols-1 md:grid-cols-[1fr_130px_80px_100px] gap-2 md:gap-4 items-center px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="font-medium truncate">{article.name}</span>
                  <span className="text-sm text-right font-mono">
                    ${article.price.toFixed(2)}
                  </span>
                  <div className="flex justify-center">
                    <Badge variant="secondary">{article.group || "B"}</Badge>
                  </div>

                  <div className="flex gap-1 justify-end md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {isDeleting ? (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleDelete(article.name)}
                          disabled={isBusy}
                        >
                          {isBusy ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          Confirmer
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setConfirmDelete(null)}
                          disabled={isBusy}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEdit(article)}
                          disabled={anyBusy}
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(article.name)}
                          disabled={anyBusy}
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {articles.length > 0 && (
              <p className="text-xs text-muted-foreground px-4 pt-2">
                {articles.length} article{articles.length !== 1 ? "s" : ""} — Groupe B · TVA 16%
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message)
  return "Erreur inconnue"
}
