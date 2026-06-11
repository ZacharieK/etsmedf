import puppeteer, { Browser, Page, type Cookie, type CookieData } from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import * as logger from "firebase-functions/logger"
import type * as admin from "firebase-admin"

const DGI_URL = "https://edef.dgirdc.cd"
const SESSION_PATH = "dgi_sessions/session"
const CONFIG_PATH = "dgi_config/settings"
const TAX_GROUP = "B"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface DgiInvoiceItem {
  description: string
  quantity: number
  unitPrice: number
}

export interface DgiInvoiceInput {
  clientName?: string
  clientEmail?: string
  items: DgiInvoiceItem[]
}

export interface DgiInvoiceResult {
  dgiReference: string
  pdfBuffer?: Buffer
}

export interface DGIArticle {
  name: string
  price: number
  group: string
}

export interface DGIEUFEntry {
  id: string
  name: string
}

// ── Session ───────────────────────────────────────────────────────────────────

async function saveSession(db: admin.firestore.Firestore, cookies: Cookie[]) {
  // Firestore rejects undefined values; JSON round-trip strips them cleanly.
  // The login flow touches sygdef.dgirdc.cd then redirects back to edef.dgirdc.cd,
  // so page.browserContext().cookies() already captures all domains.
  const sanitized = JSON.parse(JSON.stringify(cookies))
  await db.doc(SESSION_PATH).set({ cookies: sanitized, savedAt: new Date().toISOString() })
  logger.info("DGI: session saved", { cookieCount: sanitized.length })
}

async function loadSession(db: admin.firestore.Firestore): Promise<CookieData[] | null> {
  const snap = await db.doc(SESSION_PATH).get()
  if (!snap.exists) return null
  return (snap.data() as { cookies: CookieData[] }).cookies ?? null
}

async function clearSession(db: admin.firestore.Firestore) {
  await db.doc(SESSION_PATH).delete().catch(() => {})
}

// ── Config helpers ────────────────────────────────────────────────────────────

async function getSelectedEUFId(db: admin.firestore.Firestore): Promise<string> {
  const snap = await db.doc(CONFIG_PATH).get()
  const id = (snap.data() as { selectedEUFId?: string } | undefined)?.selectedEUFId
  if (!id) {
    throw new Error(
      "Aucun point de vente sélectionné. Veuillez en choisir un dans l'application."
    )
  }
  return id
}

// ── Browser ───────────────────────────────────────────────────────────────────

export async function launchBrowser(): Promise<Browser> {
  const executablePath = await chromium.executablePath()
  logger.info("DGI: launching browser", { executablePath: executablePath ?? "undefined" })
  return puppeteer.launch({
    args: [
      ...chromium.args,
      "--disable-dev-shm-usage",
      "--ignore-certificate-errors",
      "--ignore-ssl-errors",
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: true,
    timeout: 30000,
  })
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

async function findByText(page: Page, text: string) {
  const handles = await page.$$("button, a, [role='button'], input[type='submit']")
  for (const h of handles) {
    const t = await h.evaluate((el) => el.textContent?.trim() ?? "")
    if (t.toUpperCase().includes(text.toUpperCase())) return h
  }
  return null
}

async function clickText(page: Page, text: string, timeoutMs = 15000) {
  await page.waitForFunction(
    (t) => {
      const els = document.querySelectorAll("button, a, [role='button'], input[type='submit']")
      return Array.from(els).some((el) => el.textContent?.toUpperCase().includes(t.toUpperCase()))
    },
    { timeout: timeoutMs },
    text
  )
  const el = await findByText(page, text)
  if (!el) throw new Error(`Button "${text}" not found`)
  await el.click()
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 }).catch(() => {})
}

async function typeIn(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { timeout: 10000 })
  await page.click(selector, { clickCount: 3 })
  await page.type(selector, value, { delay: 25 })
}

// ── Login / Logout ────────────────────────────────────────────────────────────

async function openLoginForm(page: Page): Promise<boolean> {
  // Strategy 1: check if login form already present (e.g. direct /login URL)
  if (await page.$('input[type="password"]') !== null) {
    logger.info("DGI: login form already visible")
    return true
  }

  // Strategy 2: click "Se connecter" via JS evaluate (more reliable than Puppeteer synthetic click)
  logger.info("DGI: clicking Se connecter via JS evaluate")
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("a, button, [role='button']"))
    const btn = all.find((el) => (el.textContent ?? "").trim().toLowerCase().includes("se connecter"))
    if (btn) (btn as HTMLElement).click()
    else {
      // try href-based link
      const link = document.querySelector<HTMLAnchorElement>("a[href*='login'], a[href*='connexion'], a[href*='auth']")
      if (link) link.click()
    }
  })

  // Wait up to 10 s for the password field to appear in DOM
  try {
    await page.waitForFunction(
      () => document.querySelector('input[type="password"]') !== null,
      { timeout: 10000 }
    )
    logger.info("DGI: login form appeared after Se connecter click", { url: page.url() })
    return true
  } catch {
    logger.warn("DGI: password field not in DOM 10s after click")
  }

  // Strategy 3: navigate directly to /login
  const loginUrl = `${DGI_URL}/login`
  logger.info("DGI: trying direct navigation to /login", { loginUrl })
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 20000 })
  await sleep(2000)
  if (await page.$('input[type="password"]') !== null) {
    logger.info("DGI: login form found at /login")
    return true
  }

  const bodyText: string = await page.evaluate(
    () => (document.body?.innerText ?? "").replace(/\s+/g, " ").substring(0, 600)
  )
  logger.error("DGI: login form not found anywhere", { url: page.url(), bodyText })
  return false
}

async function rawLogin(page: Page, username: string, password: string) {
  logger.info("DGI: navigating to DGI", { url: DGI_URL })
  await page.goto(DGI_URL, { waitUntil: "load", timeout: 30000 })
  await sleep(3000)
  logger.info("DGI: page loaded", { url: page.url(), title: await page.title() })

  const formReady = await openLoginForm(page)
  if (!formReady) {
    throw new Error("DGI: formulaire de connexion introuvable — vérifiez que le site est accessible")
  }

  // Dump all visible inputs to help debug field names
  const inputs: string[] = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map(
      (el) => `${el.type}|name=${el.name}|id=${el.id}|placeholder=${el.placeholder}`
    )
  )
  logger.info("DGI: inputs on login form", { inputs })

  // Fill username — try by name/id first, then fall back to first visible text input
  const userSelectors = [
    'input[name="username"]',
    'input[id="username"]',
    'input[name="nif"]',
    'input[id="nif"]',
    'input[placeholder*="NIF"]',
    'input[placeholder*="tilisateur"]',
    'input[placeholder*="dentifiant"]',
    'input[placeholder*="Login"]',
    'input[type="text"]',
    'input[type="email"]',
  ]
  let found = false
  for (const sel of userSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 2000 })
      await typeIn(page, sel, username)
      found = true
      logger.info("DGI: username filled", { selector: sel })
      break
    } catch { /* try next */ }
  }
  if (!found) throw new Error("DGI: champ identifiant introuvable dans le formulaire de connexion")

  await typeIn(page, 'input[type="password"]', password)
  logger.info("DGI: password filled")

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {}),
    (async () => {
      const btn =
        (await page.$('button[type="submit"], input[type="submit"]')) ??
        (await findByText(page, "Connexion")) ??
        (await findByText(page, "Valider")) ??
        (await findByText(page, "S'identifier")) ??
        (await findByText(page, "Login"))
      if (btn) await btn.click()
      else await page.keyboard.press("Enter")
    })(),
  ])

  await sleep(3000)
  const postUrl = page.url()
  const postText: string = await page.evaluate(
    () => (document.body?.innerText ?? "").replace(/\s+/g, " ").substring(0, 500)
  )
  logger.info("DGI: post-login state", { url: postUrl, text: postText })

  const ok = await page.evaluate(() =>
    !!(
      document.body.textContent?.includes("e-UF") ||
      document.body.textContent?.includes("Ouvrir") ||
      document.body.textContent?.includes("Déconnexion") ||
      document.body.textContent?.includes("e-DEF") ||
      document.body.textContent?.includes("FACTURE") ||
      document.body.textContent?.includes("Tableau de bord") ||
      document.body.textContent?.includes("Dashboard") ||
      document.body.textContent?.includes("NIF")
    )
  )
  if (!ok) {
    logger.error("DGI: login check failed", { url: postUrl, text: postText })
    throw new Error("DGI login failed — vérifiez le NIF et le mot de passe")
  }
  logger.info("DGI: login successful")
}

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto(DGI_URL, { waitUntil: "load", timeout: 20000 })
    await sleep(2000)

    // If the site redirects or shows dashboard content without prompting for login → logged in
    const hasDashboard = await page.evaluate(() =>
      !!(
        document.body.textContent?.includes("Ouvrir") ||
        document.body.textContent?.includes("Déconnexion") ||
        document.body.textContent?.includes("e-UF") ||
        document.body.textContent?.includes("FACTURE") ||
        document.body.textContent?.includes("Tableau de bord")
      )
    )

    // Landing page always shows "Se connecter" — if there's also a password field,
    // we navigated somewhere else. Either way: no password field + dashboard = logged in.
    const hasPasswordField = (await page.$('input[type="password"]')) !== null

    const result = hasDashboard && !hasPasswordField
    logger.info("DGI: isLoggedIn check", { result, hasDashboard, hasPasswordField, url: page.url() })
    return result
  } catch (e) {
    logger.warn("DGI: isLoggedIn threw", { error: String(e) })
    return false
  }
}

// ── Exported: login / logout ──────────────────────────────────────────────────

export async function performDGILogin(
  username: string,
  password: string,
  db: admin.firestore.Firestore
): Promise<void> {
  logger.info("DGI: starting login", { username })
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    page.setDefaultTimeout(20000)
    await rawLogin(page, username, password)
    await saveSession(db, await page.browserContext().cookies())
    logger.info("DGI: login successful, session saved")
  } finally {
    await browser.close()
  }
}

export async function performDGILogout(db: admin.firestore.Firestore): Promise<void> {
  logger.info("DGI: starting logout")
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(15000)
    const cookies = await loadSession(db)
    if (cookies?.length) {
      for (const c of cookies) await page.browserContext().setCookie(c)
    }
    if (await isLoggedIn(page)) {
      const btn =
        (await findByText(page, "Déconnexion")) ??
        (await findByText(page, "Logout")) ??
        (await findByText(page, "Se déconnecter"))
      if (btn) {
        await btn.click()
        await sleep(2000)
      }
    }
    await clearSession(db)
    logger.info("DGI: logged out, session cleared")
  } finally {
    await browser.close()
  }
}

// ── Authenticated page ────────────────────────────────────────────────────────

async function getAuthenticatedPage(
  browser: Browser,
  db: admin.firestore.Firestore,
  username: string,
  password: string
): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  page.setDefaultTimeout(30000)
  page.setDefaultNavigationTimeout(30000)

  // Mimic a real browser to reduce bot-detection
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
  )

  const cookies = await loadSession(db)
  if (cookies?.length) {
    logger.info("DGI: restoring session from Firestore", { cookieCount: cookies.length })
    for (const c of cookies) await page.browserContext().setCookie(c)
    if (await isLoggedIn(page)) {
      logger.info("DGI: session reused from Firestore")
      return page
    }
    logger.info("DGI: session expired, re-logging in")
  } else {
    logger.info("DGI: no saved session, logging in fresh")
  }

  await rawLogin(page, username, password)
  await saveSession(db, await page.browserContext().cookies())
  logger.info("DGI: fresh login complete")
  return page
}

// ── e-UF list scraping ────────────────────────────────────────────────────────

async function scrapeEUFList(page: Page): Promise<DGIEUFEntry[]> {
  const NID_RE = /^[A-Z]{1,3}\d{4,12}-\d{1,3}$/

  // Primary strategy: parse the table on /Manage
  // Headers are: NID | Type | Etat | Nom du point de vente | Factures
  const tableEntries: DGIEUFEntry[] = await page.evaluate((nidPattern: string) => {
    const re = new RegExp(nidPattern)
    const result: { id: string; name: string }[] = []

    const rows = Array.from(document.querySelectorAll("table tr, tbody tr"))

    // Locate column indices from the header row
    let nidCol = 0
    let nameCol = 3 // default: 4th column = "Nom du point de vente"
    for (const row of rows) {
      const headers = Array.from(row.querySelectorAll("th"))
      if (headers.length >= 2) {
        headers.forEach((th, i) => {
          const t = th.textContent?.toLowerCase().trim() ?? ""
          if (t === "nid") nidCol = i
          if (t.includes("nom") || t.includes("point de vente")) nameCol = i
        })
        break
      }
    }

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"))
      if (cells.length < 2) continue
      const nidText = cells[nidCol]?.textContent?.trim() ?? ""
      if (!re.test(nidText)) continue
      const rawName = cells[nameCol]?.textContent ?? ""
      const name =
        rawName
          .split("\n")
          .map((s: string) => s.trim())
          .find((s: string) => s.length > 0) ?? ""
      result.push({ id: nidText, name: name || nidText })
    }

    return result
  }, NID_RE.source)

  if (tableEntries.length > 0) {
    logger.info("DGI: scraped e-UFs from table", {
      count: tableEntries.length,
      entries: tableEntries.map((e) => `${e.id} → ${e.name}`),
    })
    return tableEntries
  }

  // Fallback: full-text NID scan (handles non-table layouts)
  logger.info("DGI: table scrape found nothing, falling back to text scan")
  const bodyText: string = await page.evaluate(
    () => (document.body as HTMLElement).innerText ?? ""
  )
  const LOOSE_NID_RE = /\b[A-Z]{1,3}\d{4,12}-\d{1,3}\b/g
  const rawNIDs = [...new Set(bodyText.match(LOOSE_NID_RE) ?? [])]
  logger.info("DGI: NIDs found in text scan", { nids: rawNIDs })

  if (rawNIDs.length === 0) {
    logger.warn("DGI: no NIDs found in text scan", {
      preview: bodyText.replace(/\s+/g, " ").substring(0, 600),
    })
    return []
  }

  // For each NID extract the name from its table row text,
  // skipping known non-name tokens
  const SKIP = /^(e-UF|e-DEF|Ouvrir|Actif|Inactif|Fermé|Type|Etat|Factures|\d+)$/i
  const textEntries: DGIEUFEntry[] = await page.evaluate(
    (nids: string[], skipPattern: string) => {
      const skip = new RegExp(skipPattern)
      const result: { id: string; name: string }[] = []

      for (const nid of nids) {
        const row = Array.from(document.querySelectorAll("tr")).find((r) =>
          r.textContent?.includes(nid)
        )
        if (!row) { result.push({ id: nid, name: nid }); continue }

        const cells = Array.from(row.querySelectorAll("td"))
        // Pick the cell whose text is longest and doesn't look like a status/type token
        const nameCandidates = cells
          .map((c) => c.textContent?.trim() ?? "")
          .filter((t) => t.length > 3 && t !== nid && !skip.test(t))
        const name = nameCandidates.sort((a, b) => b.length - a.length)[0] ?? nid
        result.push({ id: nid, name: name.substring(0, 100) })
      }

      return result
    },
    rawNIDs,
    SKIP.source
  )

  logger.info("DGI: text-scan entries", {
    entries: textEntries.map((e) => `${e.id} → ${e.name}`),
  })
  return textEntries
}

// ── Exported: list e-UFs ──────────────────────────────────────────────────────

export async function listDGIEUFs(
  username: string,
  password: string,
  db: admin.firestore.Firestore
): Promise<DGIEUFEntry[]> {
  logger.info("DGI: listing e-UFs")
  const browser = await launchBrowser()
  try {
    const page = await getAuthenticatedPage(browser, db, username, password)

    logger.info("DGI: authenticated, current URL", { url: page.url() })

    // Wait for the SPA to fully render the e-UF list
    await sleep(4000)
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {})

    logger.info("DGI: starting first scrape attempt", { url: page.url() })
    let eufs = await scrapeEUFList(page)
    logger.info("DGI: first scrape result", { count: eufs.length })

    // If nothing found, wait longer and try once more (lazy-loaded content)
    if (eufs.length === 0) {
      logger.info("DGI: no e-UFs on first pass, waiting 5s and retrying")
      await sleep(5000)
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 }).catch(() => {})
      eufs = await scrapeEUFList(page)
      logger.info("DGI: second scrape result", { count: eufs.length })
    }

    if (eufs.length > 0) {
      // Merge with existing Firestore list — add only entries not already present by ID
      const snap = await db.doc(CONFIG_PATH).get()
      const existing: DGIEUFEntry[] = (snap.data()?.availableEUFs as DGIEUFEntry[] | undefined) ?? []
      const existingIds = new Set(existing.map((e) => e.id))
      const newEntries = eufs.filter((e) => !existingIds.has(e.id))
      // Also update names for existing entries if DGI returned a better name
      const updated = existing.map((e) => {
        const fresh = eufs.find((f) => f.id === e.id)
        return fresh && fresh.name && fresh.name !== e.id ? { ...e, name: fresh.name } : e
      })
      const merged = [...updated, ...newEntries].map(({ id, name }) => ({ id, name }))
      await db
        .doc(CONFIG_PATH)
        .set({ availableEUFs: merged, eufsUpdatedAt: new Date().toISOString() }, { merge: true })
      logger.info("DGI: e-UF list merged into Firestore", {
        existing: existing.length,
        added: newEntries.length,
        total: merged.length,
      })
    } else {
      logger.warn("DGI: no e-UFs found after two attempts")
    }

    await saveSession(db, await page.browserContext().cookies())
    return eufs
  } finally {
    await browser.close()
  }
}

// ── Open e-UF (by dynamic ID) ─────────────────────────────────────────────────

async function openEUF(page: Page, eufId: string) {
  logger.info("DGI: opening e-UF", { eufId })

  const clicked = await page.evaluate((id) => {
    const all = Array.from(document.querySelectorAll("*"))
    for (const el of all) {
      if (el.textContent?.includes(id) && el.children.length < 10) {
        const container = el.closest("tr, li, div[class], article") ?? el.parentElement
        if (!container) continue
        const btn = Array.from(container.querySelectorAll("button, a")).find(
          (b) => b.textContent?.toLowerCase().includes("ouvrir")
        )
        if (btn) {
          ;(btn as HTMLElement).click()
          return true
        }
      }
    }
    return false
  }, eufId)

  if (!clicked) {
    logger.warn("DGI: e-UF not found by ID, clicking first available", { eufId })
    await clickText(page, "Ouvrir e-UF")
  }

  await page.waitForFunction(
    () =>
      document.body.textContent?.toUpperCase().includes("EMETTRE") ||
      document.body.textContent?.toUpperCase().includes("GESTION DES ARTICLES"),
    { timeout: 15000 }
  )
  await sleep(800)
  logger.info("DGI: e-UF opened", { eufId })
}

// ── Session helper (opens e-UF automatically) ─────────────────────────────────

async function withEUFSession<T>(
  db: admin.firestore.Firestore,
  username: string,
  password: string,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const browser = await launchBrowser()
  try {
    const page = await getAuthenticatedPage(browser, db, username, password)
    const eufId = await getSelectedEUFId(db)
    await openEUF(page, eufId)
    const result = await fn(page)
    await saveSession(db, await page.browserContext().cookies())
    return result
  } finally {
    await browser.close()
  }
}

async function withArticleManagement<T>(
  db: admin.firestore.Firestore,
  username: string,
  password: string,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  return withEUFSession(db, username, password, async (page) => {
    await clickText(page, "GESTION DES ARTICLES")
    await sleep(1200)
    return fn(page)
  })
}

// ── Article scraping ──────────────────────────────────────────────────────────

async function scrapeArticleList(page: Page): Promise<DGIArticle[]> {
  return page.evaluate(() => {
    const articles: { name: string; price: number; group: string }[] = []
    const rows = document.querySelectorAll("tr")

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td"))
      if (cells.length < 2) return
      const name = cells[0]?.textContent?.trim() ?? ""
      if (!name || /^(Code|Désignation|N°|#|Libellé)/i.test(name)) return
      const rawPrice = cells[1]?.textContent?.replace(/[^0-9.,]/g, "").replace(",", ".") ?? "0"
      const price = parseFloat(rawPrice) || 0
      const group = cells[2]?.textContent?.trim() || "B"
      articles.push({ name, price, group })
    })

    if (articles.length === 0) {
      document
        .querySelectorAll("[class*='article'], [class*='designation'], [class*='libelle']")
        .forEach((el) => {
          const name = el.textContent?.trim()
          if (name && name.length > 0) articles.push({ name, price: 0, group: "B" })
        })
    }

    return articles
  })
}

async function getExistingArticleNames(page: Page): Promise<string[]> {
  await clickText(page, "GESTION DES ARTICLES")
  await sleep(1200)
  const articles = await scrapeArticleList(page)
  return articles.map((a) => a.name)
}

async function navigateBackToEUF(page: Page) {
  const backBtn =
    (await findByText(page, "Retour")) ??
    (await findByText(page, "Accueil")) ??
    (await findByText(page, "Menu"))
  if (backBtn) {
    await backBtn.click()
    await sleep(1000)
  } else {
    // Re-open e-UF from DGI home — eufId is not available here, so just navigate back
    await page.goBack().catch(() => {})
    await sleep(500)
  }
}

// ── Check articles exist (throws if any missing) ───────────────────────────────

async function checkArticlesExist(page: Page, items: DgiInvoiceItem[]): Promise<void> {
  const existingNames = await getExistingArticleNames(page)
  logger.info("DGI: checking articles", {
    existing: existingNames.length,
    required: items.map((i) => i.description),
  })

  const existing = existingNames.map((n) => n.toLowerCase().trim())
  const missing = items.filter(
    (item) =>
      !existing.some(
        (n) =>
          n === item.description.toLowerCase().trim() ||
          n.includes(item.description.toLowerCase().trim())
      )
  )

  if (missing.length > 0) {
    const names = missing.map((i) => `"${i.description}"`).join(", ")
    logger.warn("DGI: missing articles, aborting submission", { missing: names })
    throw new Error(
      `Articles manquants dans DGI : ${names}. Ajoutez-les via la gestion des articles avant de soumettre.`
    )
  }

  logger.info("DGI: all articles present")
  await navigateBackToEUF(page)
}

// ── Article CRUD (page-level) ─────────────────────────────────────────────────

async function addArticleOnPage(page: Page, name: string, price: number): Promise<void> {
  logger.info("DGI: adding article", { name, price })
  await clickText(page, "PROGRAMMER UN ARTICLE")
  await sleep(800)

  const nameInput =
    (await page.$('input[placeholder*="Désignation"]')) ??
    (await page.$('input[placeholder*="Libellé"]')) ??
    (await page.$('input[placeholder*="Nom"]')) ??
    (await page.$('input[placeholder*="nom"]')) ??
    (await page.$$('input[type="text"]'))[0] ?? null

  if (nameInput) {
    await nameInput.click({ clickCount: 3 })
    await nameInput.type(name, { delay: 20 })
  }

  for (const sel of ["select[name*='group']", "select[name*='tva']", "select[id*='group']"]) {
    const select = await page.$(sel)
    if (select) {
      await page.evaluate(
        (el, group) => {
          const opt = Array.from((el as HTMLSelectElement).options).find(
            (o) => o.text.toUpperCase().includes(group) || o.value.toUpperCase() === group
          )
          if (opt) (el as HTMLSelectElement).value = opt.value
        },
        select,
        TAX_GROUP
      )
      break
    }
  }

  const priceInputs = await page.$$('input[type="number"], input[placeholder*="rix"]')
  if (priceInputs.length > 0) {
    await priceInputs[0].click({ clickCount: 3 })
    await priceInputs[0].type(String(price), { delay: 20 })
  }

  await clickText(page, "AJOUTER")
  await sleep(1000)
  logger.info("DGI: article added", { name, price })
}

async function deleteArticleOnPage(page: Page, name: string): Promise<void> {
  logger.info("DGI: deleting article", { name })

  const deleted = await page.evaluate((desc) => {
    const rows = document.querySelectorAll("tr")
    for (const row of rows) {
      if (row.textContent?.toLowerCase().includes(desc.toLowerCase())) {
        const btn = Array.from(row.querySelectorAll("button")).find((b) => {
          const t = b.textContent?.toLowerCase() ?? ""
          const c = b.className?.toLowerCase() ?? ""
          return (
            t.includes("supprimer") || t.includes("delete") || t.includes("effacer") ||
            c.includes("delete") || c.includes("danger") || c.includes("remove")
          )
        }) as HTMLElement | undefined
        if (btn) { btn.click(); return true }
        const buttons = Array.from(row.querySelectorAll("button"))
        if (buttons.length > 0) {
          ;(buttons[buttons.length - 1] as HTMLElement).click()
          return true
        }
      }
    }
    return false
  }, name)

  if (!deleted) throw new Error(`Article "${name}" introuvable dans la liste`)

  await sleep(800)
  const confirmBtn =
    (await findByText(page, "OUI")) ?? (await findByText(page, "CONFIRMER")) ??
    (await findByText(page, "SUPPRIMER")) ?? (await findByText(page, "OK"))
  if (confirmBtn) {
    await confirmBtn.click()
    await sleep(800)
  }
  logger.info("DGI: article deleted", { name })
}

async function updateArticleOnPage(
  page: Page,
  name: string,
  newName?: string,
  newPrice?: number
): Promise<void> {
  logger.info("DGI: updating article", { name, newName, newPrice })

  const clicked = await page.evaluate((desc) => {
    const rows = document.querySelectorAll("tr")
    for (const row of rows) {
      if (row.textContent?.toLowerCase().includes(desc.toLowerCase())) {
        const btn = Array.from(row.querySelectorAll("button")).find((b) => {
          const t = b.textContent?.toLowerCase() ?? ""
          const c = b.className?.toLowerCase() ?? ""
          return t.includes("modifier") || t.includes("edit") || c.includes("edit")
        }) as HTMLElement | undefined
        if (btn) { btn.click(); return true }
        const first = row.querySelector("button") as HTMLElement | null
        if (first) { first.click(); return true }
      }
    }
    return false
  }, name)

  if (!clicked) throw new Error(`Article "${name}" introuvable ou pas de bouton modifier`)
  await sleep(800)

  if (newName) {
    const nameInput =
      (await page.$('input[placeholder*="Désignation"]')) ??
      (await page.$('input[placeholder*="Libellé"]')) ??
      (await page.$('input[placeholder*="Nom"]')) ??
      (await page.$$('input[type="text"]'))[0] ?? null
    if (nameInput) {
      await nameInput.click({ clickCount: 3 })
      await nameInput.type(newName, { delay: 20 })
    }
  }

  if (newPrice !== undefined) {
    const priceInputs = await page.$$('input[type="number"], input[placeholder*="rix"]')
    if (priceInputs.length > 0) {
      await priceInputs[0].click({ clickCount: 3 })
      await priceInputs[0].type(String(newPrice), { delay: 20 })
    }
  }

  const saveBtn =
    (await findByText(page, "MODIFIER")) ?? (await findByText(page, "ENREGISTRER")) ??
    (await findByText(page, "OK"))
  if (saveBtn) await saveBtn.click()
  await sleep(800)
  logger.info("DGI: article updated", { name, newName, newPrice })
}

// ── Exported article CRUD ─────────────────────────────────────────────────────

export async function listDGIArticles(
  username: string,
  password: string,
  db: admin.firestore.Firestore
): Promise<DGIArticle[]> {
  return withArticleManagement(db, username, password, async (page) => {
    const articles = await scrapeArticleList(page)
    logger.info("DGI: article list fetched", { count: articles.length })
    return articles
  })
}

export async function addDGIArticle(
  username: string,
  password: string,
  db: admin.firestore.Firestore,
  name: string,
  price: number
): Promise<void> {
  return withArticleManagement(db, username, password, (page) =>
    addArticleOnPage(page, name, price)
  )
}

export async function deleteDGIArticle(
  username: string,
  password: string,
  db: admin.firestore.Firestore,
  name: string
): Promise<void> {
  return withArticleManagement(db, username, password, (page) =>
    deleteArticleOnPage(page, name)
  )
}

export async function updateDGIArticle(
  username: string,
  password: string,
  db: admin.firestore.Firestore,
  name: string,
  newName?: string,
  newPrice?: number
): Promise<void> {
  return withArticleManagement(db, username, password, (page) =>
    updateArticleOnPage(page, name, newName, newPrice)
  )
}

// ── Invoice creation ──────────────────────────────────────────────────────────

async function buildInvoice(page: Page, invoice: DgiInvoiceInput) {
  logger.info("DGI: building invoice", { clientName: invoice.clientName, itemCount: invoice.items.length })
  await clickText(page, "EMETTRE UNE FACTURE")
  await sleep(1000)

  const needsOperator = await page.evaluate(() =>
    document.body.textContent?.toUpperCase().includes("AJOUTER UN OPERATEUR")
  )
  if (needsOperator) {
    logger.info("DGI: adding operator (first time setup)")
    await clickText(page, "AJOUTER UN OPERATEUR")
    await sleep(800)
    const input = await page.$('input[type="text"]')
    if (input) {
      await input.type("Opérateur")
      const btn = (await findByText(page, "AJOUTER")) ?? (await findByText(page, "OK"))
      if (btn) await btn.click()
      await sleep(800)
    }
  }

  if (invoice.clientName) await fillClientInfo(page, invoice.clientName)
  await addArticlesToInvoice(page, invoice.items)
}

async function fillClientInfo(page: Page, clientName: string) {
  const sectionBtn =
    (await findByText(page, "1-Informations")) ??
    (await findByText(page, "Informations générales"))
  if (!sectionBtn) return
  await sectionBtn.click()
  await sleep(600)
  const modifierBtn = await findByText(page, "MODIFIER")
  if (!modifierBtn) return
  await modifierBtn.click()
  await sleep(600)
  const nameInput =
    (await page.$('input[placeholder*="nom"]')) ??
    (await page.$('input[placeholder*="client"]')) ??
    (await page.$('input[placeholder*="acheteur"]'))
  if (nameInput) {
    await nameInput.click({ clickCount: 3 })
    await nameInput.type(clientName)
  }
  const confirmBtn = await findByText(page, "MODIFIER")
  if (confirmBtn) await confirmBtn.click()
  await sleep(600)
}

async function addArticlesToInvoice(page: Page, items: DgiInvoiceItem[]) {
  await clickText(page, "2-Articles")
  await sleep(1000)
  for (const item of items) await addOneArticle(page, item)
}

async function addOneArticle(page: Page, item: DgiInvoiceItem) {
  logger.info("DGI: adding article to invoice", { description: item.description, quantity: item.quantity })

  const added = await page.evaluate((desc) => {
    const rows = document.querySelectorAll("tr, li, [class*='article-row'], [class*='plu']")
    for (const row of rows) {
      if (row.textContent?.toLowerCase().includes(desc.toLowerCase())) {
        const plusBtn =
          (row.querySelector("button[class*='plus'], button[title*='plus'], button[title*='ajouter']") as HTMLElement) ??
          (Array.from(row.querySelectorAll("button")).find((b) => b.textContent?.trim() === "+") as HTMLElement | undefined)
        if (plusBtn) { plusBtn.click(); return true }
      }
    }
    return false
  }, item.description)

  if (!added) {
    const found = await page.evaluate((desc) => {
      const textNode = Array.from(document.querySelectorAll("*")).find(
        (el) => el.childElementCount === 0 && el.textContent?.toLowerCase().includes(desc.toLowerCase())
      )
      if (!textNode) return false
      for (let d = 0; d < 5; d++) {
        const ancestor = textNode.closest(d === 0 ? "tr" : d === 1 ? "li" : "div")
        if (!ancestor) continue
        const btn = Array.from(ancestor.querySelectorAll("button")).find(
          (b) => b.textContent?.trim() === "+"
        ) as HTMLElement | undefined
        if (btn) { btn.click(); return true }
      }
      return false
    }, item.description)
    if (!found) {
      logger.warn("DGI: article not found in invoice article list", { description: item.description })
      return
    }
  }

  await sleep(500)
  if (item.quantity > 1) await setQuantity(page, item.description, item.quantity)
}

async function setQuantity(page: Page, description: string, quantity: number) {
  const clicked = await page.evaluate((desc) => {
    const rows = document.querySelectorAll(
      "[class*='panier'] tr, [class*='cart'] tr, [class*='basket'] tr, table tr"
    )
    for (const row of rows) {
      if (row.textContent?.toLowerCase().includes(desc.toLowerCase())) {
        const menuBtn = Array.from(row.querySelectorAll("button")).find(
          (b) =>
            b.textContent?.includes("≡") || b.textContent?.includes("☰") ||
            (b.className ?? "").includes("menu") || (b.className ?? "").includes("edit")
        ) as HTMLElement | undefined
        if (menuBtn) { menuBtn.click(); return true }
      }
    }
    return false
  }, description)

  if (!clicked) return
  await sleep(600)

  const qtyInput =
    (await page.$('input[type="number"]')) ??
    (await page.$('input[id*="qty"]')) ??
    (await page.$('input[id*="quantite"]'))
  if (qtyInput) {
    await qtyInput.click({ clickCount: 3 })
    await qtyInput.type(String(quantity))
  }
  const saveBtn = await findByText(page, "MODIFIER")
  if (saveBtn) await saveBtn.click()
  await sleep(600)
}

// ── Normalize and capture ─────────────────────────────────────────────────────

async function normalizeInvoice(page: Page): Promise<DgiInvoiceResult> {
  logger.info("DGI: normalizing invoice")
  await clickText(page, "APERÇU")
  await sleep(1500)
  await clickText(page, "NORMALISER")
  await sleep(3000)

  const dgiReference = await page.evaluate(() => {
    const allEls = Array.from(document.querySelectorAll("*"))
    const labelEl = allEls.find(
      (el) =>
        el.childElementCount === 0 &&
        (el.textContent?.includes("Code DEF") || el.textContent?.includes("DEF/DGI") ||
          el.textContent?.includes("Référence") || el.textContent?.includes("Numéro de facture"))
    )
    if (labelEl?.parentElement) {
      for (const child of Array.from(labelEl.parentElement.children)) {
        const text = child.textContent?.trim() ?? ""
        if (text && text !== labelEl.textContent?.trim() && /[A-Z0-9\-/]{4,}/.test(text)) return text
      }
    }
    const bodyText = document.body.innerText ?? ""
    return (
      bodyText.match(/[A-Z]{2,4}[-/][0-9]{4}[-/][0-9]+/)?.[0] ??
      bodyText.match(/CD[0-9A-Z\-]+/)?.[0] ??
      "NORMALIZED"
    )
  })

  logger.info("DGI: invoice normalized", { dgiReference })

  const pdfBuffer = await capturePDF(page)
  if (pdfBuffer) logger.info("DGI: PDF captured", { bytes: pdfBuffer.length })
  else logger.warn("DGI: PDF not captured")

  const closeBtn =
    (await findByText(page, "FERMER LA FACTURE")) ?? (await findByText(page, "Fermer"))
  if (closeBtn) { await closeBtn.click(); await sleep(800) }

  return { dgiReference, pdfBuffer }
}

async function capturePDF(page: Page): Promise<Buffer | undefined> {
  return new Promise((resolve) => {
    let captured = false
    const onResponse = async (response: import("puppeteer-core").HTTPResponse) => {
      if (captured) return
      const ct = response.headers()["content-type"] ?? ""
      if (ct.includes("pdf") || ct.includes("octet-stream")) {
        try {
          const buf = await response.buffer()
          if (buf.length > 500) {
            captured = true
            page.off("response", onResponse)
            resolve(buf)
          }
        } catch { /* body already consumed */ }
      }
    }
    page.on("response", onResponse)
    findByText(page, "TÉLÉCHARGER LE PDF").then((btn) => btn?.click()).catch(() => {})
    setTimeout(() => {
      page.off("response", onResponse)
      if (!captured) { logger.warn("DGI: PDF not captured within 15s"); resolve(undefined) }
    }, 15000)
  })
}

// ── Main: submit invoice ──────────────────────────────────────────────────────

export async function submitInvoiceToDGI(
  username: string,
  password: string,
  db: admin.firestore.Firestore,
  invoice: DgiInvoiceInput
): Promise<DgiInvoiceResult> {
  logger.info("DGI: starting invoice submission", {
    clientName: invoice.clientName,
    itemCount: invoice.items.length,
  })

  const browser = await launchBrowser()
  try {
    const page = await getAuthenticatedPage(browser, db, username, password)
    const eufId = await getSelectedEUFId(db)
    await openEUF(page, eufId)
    await checkArticlesExist(page, invoice.items)
    await buildInvoice(page, invoice)
    const result = await normalizeInvoice(page)
    await saveSession(db, await page.browserContext().cookies())
    logger.info("DGI: submission complete", { dgiReference: result.dgiReference })
    return result
  } finally {
    await browser.close()
  }
}
