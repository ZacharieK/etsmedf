import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFunctions, httpsCallable } from "firebase/functions"

export interface DGIArticle {
  name: string
  price: number
  group: string
}

const KEY = ["dgi-articles"] as const

function fn<Req, Res>(name: string) {
  return httpsCallable<Req, Res>(getFunctions(), name)
}

export function useDGIArticles() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const result = await fn<Record<string, never>, { articles: DGIArticle[] }>(
        "dgiListArticles"
      )({})
      return result.data.articles
    },
    enabled: false,
    staleTime: Infinity,
    retry: false,
  })
}

export function useDGIAddArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, price }: { name: string; price: number }) => {
      await fn<{ name: string; price: number }, { status: string }>("dgiAddArticle")({
        name,
        price,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDGIDeleteArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      await fn<{ name: string }, { status: string }>("dgiDeleteArticle")({ name })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDGIUpdateArticle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      newName,
      newPrice,
    }: {
      name: string
      newName?: string
      newPrice?: number
    }) => {
      await fn<{ name: string; newName?: string; newPrice?: number }, { status: string }>(
        "dgiUpdateArticle"
      )({ name, newName, newPrice })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
