import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AppHeader } from "@/components/AppHeader"
import { PlusCircle, List, Package, Store } from "lucide-react"

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Gestionnaire de factures</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Créez des factures professionnelles en quelques secondes. Renseignez les informations
            client, ajoutez vos articles et générez un PDF propre.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <Button asChild size="lg">
              <Link to="/invoices/new">
                <PlusCircle className="h-5 w-5 mr-2" />
                Nouvelle facture
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/invoices">
                <List className="h-5 w-5 mr-2" />
                Voir toutes
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dgi/points-de-vente">
                <Store className="h-5 w-5 mr-2" />
                Points de vente
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dgi/articles">
                <Package className="h-5 w-5 mr-2" />
                Articles DGI
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Création rapide</CardTitle>
              <CardDescription>
                Renseignez les informations client, ajoutez des articles et générez une facture
                en moins d'une minute.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Impression et PDF</CardTitle>
              <CardDescription>
                Imprimez directement ou enregistrez en PDF via la boîte de dialogue d'impression
                du navigateur.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stockage cloud</CardTitle>
              <CardDescription>
                Toutes les factures sont sauvegardées dans Firestore et accessibles depuis
                n'importe quel appareil.
              </CardDescription>
            </CardHeader>
          </Card>
          <Link to="/dgi/points-de-vente" className="block">
            <Card className="h-full cursor-pointer hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-base">Points de vente</CardTitle>
                <CardDescription>
                  Connectez-vous à la DGI pour afficher et sélectionner l'e-DEF à utiliser
                  pour la facturation.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  )
}
