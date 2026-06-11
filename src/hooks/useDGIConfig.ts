import { useEffect, useState } from "react"
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore"
import { useMutation } from "@tanstack/react-query"
import { getFunctions, httpsCallable } from "firebase/functions"
import { db } from "@/lib/firebase"

export interface DGIEUFEntry {
  id: string
  name: string
}

export interface DGIConfig {
  selectedEUFId: string | null
  selectedEUFName: string | null
  availableEUFs: DGIEUFEntry[]
  loading: boolean
}

const CONFIG_DOC = doc(db, "dgi_config", "settings")

export function useDGIConfig(): DGIConfig {
  const [config, setConfig] = useState<DGIConfig>({
    selectedEUFId: null,
    selectedEUFName: null,
    availableEUFs: [],
    loading: true,
  })

  useEffect(() => {
    const unsub = onSnapshot(
      CONFIG_DOC,
      (snap) => {
        if (!snap.exists()) {
          setConfig({ selectedEUFId: null, selectedEUFName: null, availableEUFs: [], loading: false })
          return
        }
        const data = snap.data()
        setConfig({
          selectedEUFId: data?.selectedEUFId ?? null,
          selectedEUFName: data?.selectedEUFName ?? null,
          availableEUFs: (data?.availableEUFs as DGIEUFEntry[]) ?? [],
          loading: false,
        })
      },
      () => setConfig((prev) => ({ ...prev, loading: false }))
    )
    return unsub
  }, [])

  return config
}

export function useSetPointDeVente() {
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await setDoc(CONFIG_DOC, { selectedEUFId: id, selectedEUFName: name }, { merge: true })
    },
  })
}

export function useAddEUFManually() {
  return useMutation({
    mutationFn: async (euf: DGIEUFEntry) => {
      const snap = await getDoc(CONFIG_DOC)
      const existing = ((snap.data()?.availableEUFs) as DGIEUFEntry[] | undefined) ?? []
      if (existing.some((e) => e.id === euf.id)) return
      await setDoc(CONFIG_DOC, { availableEUFs: [...existing, euf] }, { merge: true })
    },
  })
}

export function useRefreshEUFs() {
  return useMutation({
    mutationFn: async () => {
      const fn = httpsCallable<Record<string, never>, { eufs: DGIEUFEntry[] }>(
        getFunctions(),
        "dgiListEUFs"
      )
      const result = await fn({})
      return result.data.eufs
    },
  })
}
