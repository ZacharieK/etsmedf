import { Link, useNavigate } from "@tanstack/react-router"
import { FileText, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"

interface Props {
  breadcrumb?: string
  breadcrumbHref?: string
  current?: string
}

export function AppHeader({ breadcrumb, breadcrumbHref, current }: Props) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    toast.success("Signed out")
    navigate({ to: "/login" })
  }

  return (
    <header className="border-b border-border print:hidden">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">ETSMEDF</span>
          </Link>
          {breadcrumb && (
            <>
              <span className="text-muted-foreground">/</span>
              {breadcrumbHref ? (
                <Link to={breadcrumbHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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

        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-40">
              {user.email}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4 mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
