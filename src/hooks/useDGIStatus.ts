import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type DGIStatus = "connected" | "disconnected" | "loading"

export interface DGISessionInfo {
  status: DGIStatus
  savedAt: Date | null
}

export function useDGIStatus(): DGISessionInfo {
  const [info, setInfo] = useState<DGISessionInfo>({ status: "loading", savedAt: null })

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "dgi_sessions", "session"),
      (snap) => {
        if (!snap.exists()) {
          setInfo({ status: "disconnected", savedAt: null })
          return
        }
        const data = snap.data()
        const savedAt = data?.savedAt ? new Date(data.savedAt as string) : null
        setInfo({ status: "connected", savedAt })
      },
      () => setInfo({ status: "disconnected", savedAt: null })
    )
    return unsub
  }, [])

  return info
}
