import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Invoice } from "@/types/invoice"

const COLLECTION = "invoices"

export async function createInvoice(invoice: Omit<Invoice, "id">): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...invoice,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getInvoices(): Promise<Invoice[]> {
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({
    ...(d.data() as Omit<Invoice, "id" | "createdAt">),
    id: d.id,
    createdAt: d.data().createdAt instanceof Timestamp
      ? d.data().createdAt.toDate().toISOString()
      : d.data().createdAt,
  }))
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, COLLECTION, id))
  if (!snap.exists()) return null
  return {
    ...(snap.data() as Omit<Invoice, "id" | "createdAt">),
    id: snap.id,
    createdAt: snap.data().createdAt instanceof Timestamp
      ? snap.data().createdAt.toDate().toISOString()
      : snap.data().createdAt,
  }
}

export async function updateInvoiceStatus(id: string, status: Invoice["status"]): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { status })
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id))
}
