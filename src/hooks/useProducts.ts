import { useQuery } from "@tanstack/react-query"
import { getProducts } from "@/lib/productService"
import type { Product } from "@/lib/productService"

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    staleTime: 5 * 60 * 1000,
  })
}

export function useProductMap() {
  const { data } = useProducts()
  const map = new Map<number, Product>()
  data?.forEach((p) => map.set(p.id, p))
  return map
}
