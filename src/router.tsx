import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { LoginPage } from "@/pages/LoginPage"
import { HomePage } from "@/pages/HomePage"
import { NewInvoicePage } from "@/pages/NewInvoicePage"
import { InvoicesListPage } from "@/pages/InvoicesListPage"

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

const routeTree = rootRoute.addChildren([loginRoute, homeRoute, invoicesRoute, newInvoiceRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
