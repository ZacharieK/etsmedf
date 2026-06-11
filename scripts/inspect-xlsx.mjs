import * as XLSX from "xlsx"
import { readFileSync } from "fs"

const workbook = XLSX.read(readFileSync("quin_articles_DGI.xlsx"))
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet)

console.log("Sheet name:", workbook.SheetNames[0])
console.log("Total rows:", rows.length)
console.log("\nColumns:", Object.keys(rows[0] ?? {}))
console.log("\nFirst 5 rows:")
rows.slice(0, 5).forEach((r, i) => console.log(`[${i}]`, r))
