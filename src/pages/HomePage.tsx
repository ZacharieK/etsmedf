import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, FileText, List } from "lucide-react"

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">ETSMEDF</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/invoices">
                <List className="h-4 w-4 mr-2" />
                My Invoices
              </Link>
            </Button>
            <Button asChild>
              <Link to="/invoices/new">
                <PlusCircle className="h-4 w-4 mr-2" />
                New Invoice
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Invoice Manager</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Create professional invoices in seconds. Fill in the client details, add your items, and generate a clean PDF.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button asChild size="lg">
              <Link to="/invoices/new">
                <PlusCircle className="h-5 w-5 mr-2" />
                New Invoice
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/invoices">
                <List className="h-5 w-5 mr-2" />
                View All
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Creation</CardTitle>
              <CardDescription>
                Fill in client info, add line items, and generate an invoice in under a minute.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Print & PDF</CardTitle>
              <CardDescription>
                Print directly or save as PDF with the browser's native print dialog.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cloud Storage</CardTitle>
              <CardDescription>
                All invoices are saved to Firestore and accessible from any device.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </div>
  )
}
