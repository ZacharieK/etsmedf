import { useState } from "react"
import { AppHeader } from "@/components/AppHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Loader2, RefreshCw, Store, CheckCircle2, AlertCircle, PlusCircle } from "lucide-react"
import { toast } from "sonner"
import {
  useDGIConfig,
  useSetPointDeVente,
  useRefreshEUFs,
  useAddEUFManually,
  type DGIEUFEntry,
} from "@/hooks/useDGIConfig"

export function PointDeVentePage() {
  const dgiConfig = useDGIConfig()
  const setPointDeVente = useSetPointDeVente()
  const refreshEUFs = useRefreshEUFs()
  const addManually = useAddEUFManually()

  const [showManual, setShowManual] = useState(false)
  const [manualId, setManualId] = useState("")
  const [manualName, setManualName] = useState("")

  function handleLoad() {
    const promise = refreshEUFs.mutateAsync()
    toast.promise(promise, {
      loading: "Connexion à la plateforme DGI — récupération des e-DEF…",
      success: (eufs) =>
        eufs.length > 0
          ? `${eufs.length} point${eufs.length !== 1 ? "s" : ""} de vente trouvé${eufs.length !== 1 ? "s" : ""}`
          : "Aucun e-DEF trouvé automatiquement. Utilisez l'ajout manuel.",
      error: (e) => `Erreur : ${e instanceof Error ? e.message : "inconnue"}`,
    })
  }

  function handleSelect(euf: DGIEUFEntry) {
    setPointDeVente.mutate(
      { id: euf.id, name: euf.name },
      {
        onSuccess: () => toast.success(`Point de vente actif : ${euf.name || euf.id}`),
        onError: () => toast.error("Erreur lors de la sélection"),
      }
    )
  }

  function handleAddManually() {
    const id = manualId.trim().toUpperCase()
    if (!id) { toast.error("Saisissez un identifiant e-DEF (ex : CD02001575-1)"); return }
    addManually.mutate(
      { id, name: manualName.trim() || id },
      {
        onSuccess: () => {
          toast.success(`e-DEF ${id} ajouté`)
          setManualId("")
          setManualName("")
          setShowManual(false)
        },
        onError: () => toast.error("Erreur lors de l'ajout"),
      }
    )
  }

  const isSelected = (euf: DGIEUFEntry) => euf.id === dgiConfig.selectedEUFId
  const hasEUFs = dgiConfig.availableEUFs.length > 0
  const isLoading = refreshEUFs.isPending

  return (
    <div className="min-h-screen bg-background">
      <AppHeader breadcrumb="Accueil" breadcrumbHref="/" current="Points de vente" />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Points de vente DGI</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sélectionnez l'e-DEF à utiliser pour la facturation et la gestion des articles.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowManual((v) => !v)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Ajouter manuellement
            </Button>
            <Button onClick={handleLoad} disabled={isLoading} variant={hasEUFs ? "outline" : "default"} size="sm">
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {hasEUFs ? "Rafraîchir depuis DGI" : "Charger depuis DGI"}
            </Button>
          </div>
        </div>

        {/* Manual entry form */}
        {showManual && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ajouter un e-DEF manuellement</CardTitle>
              <CardDescription className="text-xs">
                Utilisez l'identifiant NIF tel qu'affiché sur la plateforme DGI (ex :{" "}
                <span className="font-mono">CD02001575-1</span>).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="space-y-1 flex-1 min-w-40">
                  <Label className="text-xs">Identifiant e-DEF *</Label>
                  <Input
                    placeholder="CD02001575-1"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    className="font-mono"
                    disabled={addManually.isPending}
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-40">
                  <Label className="text-xs">Nom (facultatif)</Label>
                  <Input
                    placeholder="Nom du point de vente"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    disabled={addManually.isPending}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleAddManually} disabled={addManually.isPending || !manualId.trim()} size="sm">
                    {addManually.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowManual(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active selection banner */}
        {dgiConfig.selectedEUFId && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <div className="text-sm">
              <span className="font-medium">Point de vente actif : </span>
              <span className="font-mono">
                {dgiConfig.selectedEUFName
                  ? `${dgiConfig.selectedEUFName} — ${dgiConfig.selectedEUFId}`
                  : dgiConfig.selectedEUFId}
              </span>
            </div>
          </div>
        )}

        {/* No selection warning */}
        {!dgiConfig.selectedEUFId && !dgiConfig.loading && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600 mt-0.5" />
            <p className="text-sm">
              Aucun point de vente sélectionné. La soumission de factures et la gestion des articles
              resteront bloquées tant qu'aucun e-DEF n'est actif.
            </p>
          </div>
        )}

        <Separator />

        {/* Loading spinner */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-medium">Connexion à la plateforme DGI…</p>
              <p className="text-sm">Chargement des e-DEF enregistrés sur votre compte.</p>
              <p className="text-xs opacity-70">Durée estimée : 30 à 60 secondes</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasEUFs && !dgiConfig.loading && (
          <Card className="border-dashed">
            <CardContent className="py-14 flex flex-col items-center gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Store className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <p className="font-medium">Aucun e-DEF chargé</p>
                <p className="text-sm text-muted-foreground">
                  Cliquez sur <strong>Charger depuis DGI</strong> pour récupérer automatiquement la
                  liste des e-DEF de votre compte. Si la détection automatique échoue, utilisez{" "}
                  <strong>Ajouter manuellement</strong> pour saisir votre NIF directement.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button onClick={handleLoad} disabled={isLoading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Charger depuis DGI
                </Button>
                <Button variant="outline" onClick={() => setShowManual(true)}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Ajouter manuellement
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* e-UF cards */}
        {!isLoading && hasEUFs && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dgiConfig.availableEUFs.map((euf) => {
              const active = isSelected(euf)
              const selecting =
                setPointDeVente.isPending && setPointDeVente.variables?.id === euf.id

              return (
                <Card
                  key={euf.id}
                  className={
                    active
                      ? "border-green-400 bg-green-50/40 shadow-sm"
                      : "hover:border-primary/40 transition-colors"
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Store className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {active && (
                        <Badge className="bg-green-600 text-white text-xs shrink-0">
                          Actif
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-0.5">
                      <CardTitle className="text-sm font-semibold leading-snug">
                        {euf.name && euf.name !== euf.id ? euf.name : <span className="text-muted-foreground italic text-xs">Nom inconnu</span>}
                      </CardTitle>
                      <CardDescription className="font-mono text-xs tracking-wide">
                        {euf.id}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {active ? (
                      <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Point de vente actif
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => handleSelect(euf)}
                        disabled={setPointDeVente.isPending}
                      >
                        {selecting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        Sélectionner
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

      </main>
    </div>
  )
}
