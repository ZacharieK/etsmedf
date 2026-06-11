import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { LoginPage } from "@/pages/LoginPage"
import { HomePage } from "@/pages/HomePage"
import { NewInvoicePage } from "@/pages/NewInvoicePage"
import { InvoicesListPage } from "@/pages/InvoicesListPage"
import { DGIArticlesPage } from "@/pages/DGIArticlesPage"
import { PointDeVentePage } from "@/pages/PointDeVentePage"

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  ),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <ProtectedRoute>
      <HomePage />
    </ProtectedRoute>
  ),
})

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invoices",
  component: () => (
    <ProtectedRoute>
      <InvoicesListPage />
    </ProtectedRoute>
  ),
})

const newInvoiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invoices/new",
  component: () => (
    <ProtectedRoute>
      <NewInvoicePage />
    </ProtectedRoute>
  ),
})

const dgiArticlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dgi/articles",
  component: () => (
    <ProtectedRoute>
      <DGIArticlesPage />
    </ProtectedRoute>
  ),
})

const pointDeVenteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dgi/points-de-vente",
  component: () => (
    <ProtectedRoute>
      <PointDeVentePage />
    </ProtectedRoute>
  ),
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  homeRoute,
  invoicesRoute,
  newInvoiceRoute,
  dgiArticlesRoute,
  pointDeVenteRoute,
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
