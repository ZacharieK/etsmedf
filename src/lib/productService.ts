import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface Product {
  id: number
  name: string
  price: number
  unit: string
  barcode: string
  groupId: number
}

export async function getProducts(): Promise<Product[]> {
  const snap = await getDocs(collection(db, "products"))
  return snap.docs.map((d) => d.data() as Product)
}
