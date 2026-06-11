import * as XLSX from "xlsx"
import { readFileSync } from "fs"
import { initializeApp } from "firebase/app"
import { getFirestore, collection, doc, writeBatch } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCp_ZBNGh4JzBeRLVSdkBCm5hyQbmXJBy0",
  authDomain: "emedf-e14a0.firebaseapp.com",
  projectId: "emedf-e14a0",
  storageBucket: "emedf-e14a0.firebasestorage.app",
  messagingSenderId: "693995784508",
  appId: "1:693995784508:web:7c0d1d0bca3fad2c063639",
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const workbook = XLSX.read(readFileSync("quin_articles_DGI.xlsx"))
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet)

const products = rows.map((r) => ({
  id: r.plu_id,
  name: r.plu_name,
  price: r.plu_price,
  unit: r.plu_unit ?? "UN",
  barcode: r.plu_barcodeX ?? "",
  groupId: r.plu_group_id ?? 0,
}))

console.log(`Importing ${products.length} products to Firestore collection "products"…`)

// Firestore batch limit is 500 operations
const BATCH_SIZE = 499
for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = writeBatch(db)
  const chunk = products.slice(i, i + BATCH_SIZE)

  for (const product of chunk) {
    const ref = doc(collection(db, "products"), String(product.id))
    batch.set(ref, product)
  }

  await batch.commit()
  console.log(`  ✓ Committed ${i + chunk.length}/${products.length}`)
}

console.log("Done. All products imported.")
process.exit(0)
