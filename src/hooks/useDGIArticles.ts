import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getFunctions, httpsCallable } from "firebase/functions"
import { db } from "@/lib/firebase"
import { useDGIConfig } from "./useDGIConfig"

export interface DGIArticle {
  name: string
  price: number
  group?: string
}

// ── Firestore live articles (reads dgi_articles/{selectedEUFId}) ──────────────

export function useStoredDGIArticles(): { articles: DGIArticle[]; loading: boolean } {
  const { selectedEUFId } = useDGIConfig()
  const [articles, setArticles] = useState<DGIArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!selectedEUFId) {
      setArticles([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = onSnapshot(
      doc(db, "dgi_articles", selectedEUFId),
      (snap) => {
        setArticles(snap.exists() ? ((snap.data().items as DGIArticle[]) ?? []) : [])
        setLoading(false)
      },
      () => { setArticles([]); setLoading(false) }
    )
    return unsub
  }, [selectedEUFId])

  return { articles, loading }
}

// ── Cloud Function hooks (CRUD on DGI platform) ───────────────────────────────

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
