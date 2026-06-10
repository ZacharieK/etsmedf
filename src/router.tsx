import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
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

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
})

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invoices",
  component: InvoicesListPage,
})

const newInvoiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/invoices/new",
  component: NewInvoicePage,
})

const routeTree = rootRoute.addChildren([homeRoute, invoicesRoute, newInvoiceRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
