import * as admin from "firebase-admin"
import { onCall, HttpsError } from "firebase-functions/v2/https"
import { defineSecret } from "firebase-functions/params"
import * as logger from "firebase-functions/logger"
import {
  submitInvoiceToDGI,
  performDGILogin,
  performDGILogout,
  listDGIEUFs,
  listDGIArticles,
  addDGIArticle,
  deleteDGIArticle,
  updateDGIArticle,
  type DgiInvoiceInput,
} from "./dgiAutomation"

admin.initializeApp()

const DGI_USERNAME = defineSecret("DGI_USERNAME")
const DGI_PASSWORD = defineSecret("DGI_PASSWORD")

const BASE_CONFIG = {
  memory: "2GiB" as const,
  secrets: [DGI_USERNAME, DGI_PASSWORD],
  region: "us-central1",
}

const INVOICE_CONFIG = { ...BASE_CONFIG, timeoutSeconds: 120 }
const ARTICLE_CONFIG = { ...BASE_CONFIG, timeoutSeconds: 180 }

function getCredentials() {
  const username = DGI_USERNAME.value()
  const password = DGI_PASSWORD.value()
  if (!username || !password) {
    throw new HttpsError("failed-precondition", "DGI credentials not configured")
  }
  return { username, password }
}

// ── DGI Login / Logout ────────────────────────────────────────────────────────

export const dgiLogin = onCall(INVOICE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")
  logger.info("dgiLogin called", { uid: request.auth.uid })
  const { username, password } = getCredentials()

  try {
    await performDGILogin(username, password, admin.firestore())
    logger.info("dgiLogin: success", { uid: request.auth.uid })
    return { status: "logged_in" }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("dgiLogin: failed", { uid: request.auth.uid, error: msg })
    throw new HttpsError("internal", `DGI login failed: ${msg}`)
  }
})

export const dgiLogout = onCall(INVOICE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")
  logger.info("dgiLogout called", { uid: request.auth.uid })

  try {
    await performDGILogout(admin.firestore())
    logger.info("dgiLogout: success", { uid: request.auth.uid })
    return { status: "logged_out" }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("dgiLogout: failed", { uid: request.auth.uid, error: msg })
    return { status: "error", message: msg }
  }
})

// ── DGI e-UF list ─────────────────────────────────────────────────────────────

export const dgiListEUFs = onCall(ARTICLE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")
  logger.info("dgiListEUFs called", { uid: request.auth.uid })
  const { username, password } = getCredentials()

  try {
    const eufs = await listDGIEUFs(username, password, admin.firestore())
    logger.info("dgiListEUFs: success", { count: eufs.length })
    return { eufs }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("dgiListEUFs: failed", { error: msg })
    throw new HttpsError("internal", `Échec du chargement des points de vente : ${msg}`)
  }
})

// ── DGI Article Management ────────────────────────────────────────────────────

export const dgiListArticles = onCall(ARTICLE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")
  logger.info("dgiListArticles called", { uid: request.auth.uid })
  const { username, password } = getCredentials()

  try {
    const articles = await listDGIArticles(username, password, admin.firestore())
    logger.info("dgiListArticles: success", { count: articles.length })
    return { articles }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("dgiListArticles: failed", { error: msg })
    throw new HttpsError("internal", `Échec du chargement des articles : ${msg}`)
  }
})

export const dgiAddArticle = onCall(ARTICLE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { name, price } = request.data as { name: string; price: number }
  if (!name || price == null || price < 0) {
    throw new HttpsError("invalid-argument", "name and price are required")
  }

  logger.info("dgiAddArticle called", { uid: request.auth.uid, name, price })
  const { username, password } = getCredentials()

  try {
    await addDGIArticle(username, password, admin.firestore(), name, price)
    logger.info("dgiAddArticle: success", { name })
    return { status: "added" }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("dgiAddArticle: failed", { name, error: msg })
    throw new HttpsError("internal", `Échec de l'ajout de l'article : ${msg}`)
  }
})

export const dgiDeleteArticle = onCall(ARTICLE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { name } = request.data as { name: string }
  if (!name) throw new HttpsError("invalid-argument", "name is required")

  logger.info("dgiDeleteArticle called", { uid: request.auth.uid, name })
  const { username, password } = getCredentials()

  try {
    await deleteDGIArticle(username, password, admin.firestore(), name)
    logger.info("dgiDeleteArticle: success", { name })
    return { status: "deleted" }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("dgiDeleteArticle: failed", { name, error: msg })
    throw new HttpsError("internal", `Échec de la suppression de l'article : ${msg}`)
  }
})

export const dgiUpdateArticle = onCall(ARTICLE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { name, newName, newPrice } = request.data as {
    name: string
    newName?: string
    newPrice?: number
  }
  if (!name) throw new HttpsError("invalid-argument", "name is required")
  if (!newName && newPrice == null) {
    throw new HttpsError("invalid-argument", "newName or newPrice must be provided")
  }

  logger.info("dgiUpdateArticle called", { uid: request.auth.uid, name, newName, newPrice })
  const { username, password } = getCredentials()

  try {
    await updateDGIArticle(username, password, admin.firestore(), name, newName, newPrice)
    logger.info("dgiUpdateArticle: success", { name })
    return { status: "updated" }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("dgiUpdateArticle: failed", { name, error: msg })
    throw new HttpsError("internal", `Échec de la modification de l'article : ${msg}`)
  }
})

// ── Submit Invoice ────────────────────────────────────────────────────────────

export const submitToDGI = onCall(INVOICE_CONFIG, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { invoiceId, invoice } = request.data as {
    invoiceId: string
    invoice: DgiInvoiceInput
  }

  logger.info("submitToDGI called", {
    uid: request.auth.uid,
    invoiceId,
    itemCount: invoice?.items?.length,
  })

  if (!invoiceId || !invoice?.items?.length) {
    throw new HttpsError("invalid-argument", "invoiceId and items are required")
  }

  const { username, password } = getCredentials()

  let result
  try {
    result = await submitInvoiceToDGI(username, password, admin.firestore(), invoice)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error("submitToDGI: failed", { invoiceId, error: msg })
    // Pass the message as-is so the frontend can display "Articles manquants : ..."
    throw new HttpsError("internal", msg)
  }

  // Upload PDF to Firebase Storage if captured
  let dgiPdfUrl: string | undefined
  if (result.pdfBuffer) {
    try {
      const bucket = admin.storage().bucket()
      const filePath = `dgi-invoices/${invoiceId}.pdf`
      const file = bucket.file(filePath)
      await file.save(result.pdfBuffer, { metadata: { contentType: "application/pdf" } })
      await file.makePublic()
      dgiPdfUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`
      logger.info("submitToDGI: PDF uploaded", { dgiPdfUrl })
    } catch (err) {
      logger.error("submitToDGI: PDF upload failed (non-blocking)", { invoiceId, error: String(err) })
    }
  } else {
    logger.warn("submitToDGI: no PDF captured", { invoiceId })
  }

  await admin.firestore().collection("invoices").doc(invoiceId).update({
    dgiReference: result.dgiReference,
    ...(dgiPdfUrl ? { dgiPdfUrl } : {}),
    dgiSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "sent",
  })

  logger.info("submitToDGI: complete", {
    invoiceId,
    dgiReference: result.dgiReference,
    hasPdf: !!dgiPdfUrl,
  })

  return { dgiReference: result.dgiReference, dgiPdfUrl }
})
