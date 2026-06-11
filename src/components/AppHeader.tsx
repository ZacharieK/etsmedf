import { Link, useNavigate } from "@tanstack/react-router"
import { FileText, LogOut, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { useDGIStatus } from "@/hooks/useDGIStatus"
import { useDGIConfig, useSetPointDeVente } from "@/hooks/useDGIConfig"
import { toast } from "sonner"

interface Props {
  breadcrumb?: string
  breadcrumbHref?: string
  current?: string
}

export function AppHeader({ breadcrumb, breadcrumbHref, current }: Props) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const dgi = useDGIStatus()
  const dgiConfig = useDGIConfig()
  const setPointDeVente = useSetPointDeVente()

  async function handleSignOut() {
    await signOut()
    toast.success("Déconnecté")
    navigate({ to: "/login" })
  }

  function handleSelectEUF(id: string) {
    const euf = dgiConfig.availableEUFs.find((e) => e.id === id)
    if (!euf) return
    setPointDeVente.mutate(
      { id: euf.id, name: euf.name },
      { onSuccess: () => toast.success(`Point de vente : ${euf.name || euf.id}`) }
    )
  }

const dgiLabel =
    dgi.status === "connected"
      ? `DGI connecté${dgi.savedAt ? ` · ${formatRelative(dgi.savedAt)}` : ""}`
      : dgi.status === "loading"
      ? "Vérification DGI…"
      : "DGI déconnecté"

  return (
    <header className="border-b border-border print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

        {/* Left: logo + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">ETSMEDF</span>
          </Link>
          {breadcrumb && (
            <>
              <span className="text-muted-foreground">/</span>
              {breadcrumbHref ? (
                <Link
                  to={breadcrumbHref}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {breadcrumb}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">{breadcrumb}</span>
              )}
            </>
          )}
          {current && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground truncate">{current}</span>
            </>
          )}
        </div>

        {/* Right: DGI status + point de vente + user + sign out */}
        <div className="flex items-center gap-2 shrink-0">

          {/* DGI connection pill */}
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border"
            title={dgiLabel}
          >
            <span
              className={
                dgi.status === "connected"
                  ? "h-2 w-2 rounded-full bg-green-500"
                  : dgi.status === "loading"
                  ? "h-2 w-2 rounded-full bg-yellow-400 animate-pulse"
                  : "h-2 w-2 rounded-full bg-red-500"
              }
            />
            <span className="text-muted-foreground font-medium">DGI</span>
          </div>

          {/* Point de vente selector — reads from Firestore via useDGIConfig */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {dgiConfig.availableEUFs.length > 0 ? (
              <Select
                value={dgiConfig.selectedEUFId ?? ""}
                onValueChange={handleSelectEUF}
                disabled={setPointDeVente.isPending}
              >
                <SelectTrigger className="h-7 text-xs w-48 border-dashed">
                  <SelectValue placeholder="Point de vente…" />
                </SelectTrigger>
                <SelectContent>
                  {dgiConfig.availableEUFs.map((euf) => (
                    <SelectItem key={euf.id} value={euf.id} className="text-xs">
                      {euf.name && euf.name !== euf.id ? euf.name : euf.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              !dgiConfig.loading && (
                <Link
                  to="/dgi/points-de-vente"
                  className="text-xs text-muted-foreground italic hover:text-foreground transition-colors"
                >
                  Configurer PDV…
                </Link>
              )
            )}
          </div>

          {/* Separator */}
          <span className="hidden sm:block text-border select-none">|</span>

          {user?.email && (
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-36">
              {user.email}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Déconnexion
          </Button>
        </div>

      </div>
    </header>
  )
}

function formatRelative(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `il y a ${diffHr} h`
  return `il y a ${Math.floor(diffHr / 24)} j`
}
