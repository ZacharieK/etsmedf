# ETSMEDF — Claude Code Guide

## Project Overview

Invoice management application for **ETSMEDF**, integrated with the Congolese tax authority (DGI) platform at `https://edef.dgirdc.cd`. The app creates invoices, submits them to DGI via Puppeteer automation, and displays the returned DGI PDF with QR code.

The e-DEF NID in use is **CD02001575-1**.

All UI text is in **French**.

---

## Tech Stack

### Frontend (`/`)
- **Vite 8** + **React 19** + **TypeScript 6**
- **TanStack Router v1** (file-based routing via `src/router.tsx`)
- **TanStack Query v5** (server state, 5 min staleTime by default)
- **shadcn v3** + **Tailwind v4**
- **React Hook Form** + **Zod** for form validation
- **Sonner** for toasts
- **Firebase v12** (Firestore, Auth, Storage)

### Backend (`/functions`)
- **Firebase Cloud Functions Gen 2** (Node 20, `commonjs`)
- **Puppeteer-core v24** + **@sparticuz/chromium** for serverless browser automation
- **firebase-functions/logger** for all structured logging (never `console.*`)
- Build: `tsc` → `lib/`; type-check only: `npm run typecheck`

---

## Repository Structure

```
/
├── src/
│   ├── components/
│   │   ├── AppHeader.tsx        # Header with DGI status pill + Déconnexion
│   │   ├── InvoiceForm.tsx      # New invoice form with product ID lookup
│   │   ├── InvoicePreview.tsx   # Invoice viewer with DGI PDF tab
│   │   └── ProtectedRoute.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx      # Auto DGI login/logout on app sign-in/out
│   ├── hooks/
│   │   ├── useDGIStatus.ts      # Real-time Firestore onSnapshot for DGI session
│   │   ├── useInvoices.ts       # CRUD + useSubmitToDGI mutation
│   │   └── useProducts.ts       # useProducts() + useProductMap() (O(1) lookup)
│   ├── lib/
│   │   ├── firebase.ts          # Firebase app init (env vars)
│   │   ├── invoiceService.ts    # Firestore CRUD for invoices
│   │   └── productService.ts   # Firestore read for products
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── InvoicesListPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── NewInvoicePage.tsx
│   ├── types/
│   │   └── invoice.ts           # Invoice, InvoiceItem interfaces
│   └── router.tsx
├── functions/
│   ├── src/
│   │   ├── dgiAutomation.ts     # All Puppeteer logic (login, articles, invoice, PDF)
│   │   └── index.ts             # Cloud Function exports: dgiLogin, dgiLogout, submitToDGI
│   ├── babel.config.js
│   ├── eslint.config.js
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── import-products.mjs     # One-time script: imports 120 products from xlsx to Firestore
├── babel.config.js
├── eslint.config.js
├── firestore.rules              # allow read, write: if request.auth != null
└── firebase.json
```

---

## Firebase Configuration

### Environment Variables (frontend `.env`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

### Secrets (Cloud Functions — Secret Manager)
```
DGI_USERNAME   # NIF used to log in to edef.dgirdc.cd
DGI_PASSWORD   # DGI account password
```
Set with: `printf "value" | firebase functions:secrets:set SECRET_NAME`

### Firestore Collections
| Collection | Document | Purpose |
|---|---|---|
| `invoices` | auto-id | Invoice records |
| `products` | auto-id | 120 DGI articles (id, name, price, unit) |
| `dgi_sessions` | `session` | Saved Puppeteer cookies + `savedAt` timestamp |

### Firebase Storage
DGI PDFs are uploaded to `dgi-invoices/{invoiceId}.pdf` and made public.

---

## Key Patterns

### Product ID Lookup (InvoiceForm)
Type a numeric product ID → auto-fills description and unit price via `useProductMap()` (returns `Map<number, Product>`).

### DGI Session Persistence
Cookies are saved to Firestore after every login/operation. On next invocation, cookies are restored and `isLoggedIn()` is checked before re-logging in. Session doc: `dgi_sessions/session`.

### DGI Auto Login/Logout
`AuthContext` calls `dgiLogin` Cloud Function on app sign-in and `dgiLogout` on sign-out (fire-and-forget, never blocks UI).

### DGI Status Indicator
`useDGIStatus()` uses `onSnapshot` on `dgi_sessions/session`. If doc exists → connected; missing → disconnected. Displayed as a colored pill in `AppHeader`.

### PDF Capture
`capturePDF()` in `dgiAutomation.ts` intercepts HTTP responses via `page.on("response", ...)` before clicking "TÉLÉCHARGER LE PDF". Looks for `content-type: application/pdf` or `octet-stream`.

### Puppeteer API Notes (v24)
- **Cookies get**: `page.browserContext().cookies()` — `page.cookies()` is deprecated
- **Cookies set**: `page.browserContext().setCookie(c)` in a loop — `page.setCookie()` is deprecated
- **Sleep**: use `const sleep = (ms) => new Promise(r => setTimeout(r, ms))` — `page.waitForTimeout()` was removed in v22
- **PDF buffer**: `response.buffer()` — `response.bytes()` does not exist

---

## Development Commands

### Frontend
```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run lint       # ESLint (flat config)
```

### Functions
```bash
cd functions
npm run build      # tsc → lib/
npm run typecheck  # tsc --noEmit (type-check only)
npm run lint       # ESLint
npm run deploy     # firebase deploy --only functions
```

### Deploy
```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
```

---

## Logging

All Cloud Function logs use `firebase-functions/logger` (structured JSON → Google Cloud Logging):
```typescript
import * as logger from "firebase-functions/logger"
logger.info("message", { key: value })
logger.warn(...)
logger.error(...)
```
Never use `console.log/warn/error` in functions.

---

## DGI Automation Flow (`submitToDGI`)

1. Restore session cookies from Firestore or re-login
2. Open e-UF `CD02001575-1`
3. Navigate to "GESTION DES ARTICLES" — collect existing article names
4. Create any missing articles (Group B taxation, prix TTC)
5. Navigate back, click "EMETTRE UNE FACTURE"
6. Fill client info (section "1-Informations")
7. Add articles via "2-Articles" (click `+` per item, set quantity if > 1)
8. Click "APERÇU" → "NORMALISER" → extract DGI reference code
9. Intercept PDF response → `response.buffer()`
10. Upload PDF to Firebase Storage → `dgiPdfUrl`
11. Update Firestore invoice doc with `dgiReference`, `dgiPdfUrl`, `dgiSubmittedAt`
12. Save refreshed cookies back to Firestore

---

## Taxation

**Rate**: 16% TVA (Groupe B), applied on both frontend and DGI backend.

### Frontend (`src/types/invoice.ts`)
```ts
TVA_RATE = 0.16
calculateSubtotal(items)        // sum of quantity × unitPrice
calculateTVA(items)             // subtotal × 0.16
calculateTotal(items)           // subtotal + TVA
```
Both `InvoiceForm` and `InvoicePreview` display three lines: **Sous-total HT**, **TVA (16%)**, **Total TTC**.

### Backend (`dgiAutomation.ts`)
`TAX_GROUP = "B"` is set when creating articles in DGI. The prix TTC sent to DGI already includes TVA (it matches `unitPrice` from the invoice).

---

## Security Notes

- Firestore rules require authenticated user (`request.auth != null`) for all read/write
- DGI credentials are stored in Firebase Secret Manager only — never in code or `.env`
- If credentials are ever exposed, change password at `edef.dgirdc.cd` and update the secret:
  `printf "NewPassword" | firebase functions:secrets:set DGI_PASSWORD`
