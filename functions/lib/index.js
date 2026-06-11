"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitToDGI = exports.dgiUpdateArticle = exports.dgiDeleteArticle = exports.dgiAddArticle = exports.dgiListArticles = exports.dgiListEUFs = exports.dgiLogout = exports.dgiLogin = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const logger = __importStar(require("firebase-functions/logger"));
const dgiAutomation_1 = require("./dgiAutomation");
admin.initializeApp();
const DGI_USERNAME = (0, params_1.defineSecret)("DGI_USERNAME");
const DGI_PASSWORD = (0, params_1.defineSecret)("DGI_PASSWORD");
const BASE_CONFIG = {
    memory: "2GiB",
    secrets: [DGI_USERNAME, DGI_PASSWORD],
    region: "us-central1",
};
const INVOICE_CONFIG = { ...BASE_CONFIG, timeoutSeconds: 120 };
const ARTICLE_CONFIG = { ...BASE_CONFIG, timeoutSeconds: 180 };
function getCredentials() {
    const username = DGI_USERNAME.value();
    const password = DGI_PASSWORD.value();
    if (!username || !password) {
        throw new https_1.HttpsError("failed-precondition", "DGI credentials not configured");
    }
    return { username, password };
}
// ── DGI Login / Logout ────────────────────────────────────────────────────────
exports.dgiLogin = (0, https_1.onCall)(INVOICE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    logger.info("dgiLogin called", { uid: request.auth.uid });
    const { username, password } = getCredentials();
    try {
        await (0, dgiAutomation_1.performDGILogin)(username, password, admin.firestore());
        logger.info("dgiLogin: success", { uid: request.auth.uid });
        return { status: "logged_in" };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("dgiLogin: failed", { uid: request.auth.uid, error: msg });
        throw new https_1.HttpsError("internal", `DGI login failed: ${msg}`);
    }
});
exports.dgiLogout = (0, https_1.onCall)(INVOICE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    logger.info("dgiLogout called", { uid: request.auth.uid });
    try {
        await (0, dgiAutomation_1.performDGILogout)(admin.firestore());
        logger.info("dgiLogout: success", { uid: request.auth.uid });
        return { status: "logged_out" };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("dgiLogout: failed", { uid: request.auth.uid, error: msg });
        return { status: "error", message: msg };
    }
});
// ── DGI e-UF list ─────────────────────────────────────────────────────────────
exports.dgiListEUFs = (0, https_1.onCall)(ARTICLE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    logger.info("dgiListEUFs called", { uid: request.auth.uid });
    const { username, password } = getCredentials();
    try {
        const eufs = await (0, dgiAutomation_1.listDGIEUFs)(username, password, admin.firestore());
        logger.info("dgiListEUFs: success", { count: eufs.length });
        return { eufs };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("dgiListEUFs: failed", { error: msg });
        throw new https_1.HttpsError("internal", `Échec du chargement des points de vente : ${msg}`);
    }
});
// ── DGI Article Management ────────────────────────────────────────────────────
exports.dgiListArticles = (0, https_1.onCall)(ARTICLE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    logger.info("dgiListArticles called", { uid: request.auth.uid });
    const { username, password } = getCredentials();
    try {
        const articles = await (0, dgiAutomation_1.listDGIArticles)(username, password, admin.firestore());
        logger.info("dgiListArticles: success", { count: articles.length });
        return { articles };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("dgiListArticles: failed", { error: msg });
        throw new https_1.HttpsError("internal", `Échec du chargement des articles : ${msg}`);
    }
});
exports.dgiAddArticle = (0, https_1.onCall)(ARTICLE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    const { name, price } = request.data;
    if (!name || price == null || price < 0) {
        throw new https_1.HttpsError("invalid-argument", "name and price are required");
    }
    logger.info("dgiAddArticle called", { uid: request.auth.uid, name, price });
    const { username, password } = getCredentials();
    try {
        await (0, dgiAutomation_1.addDGIArticle)(username, password, admin.firestore(), name, price);
        logger.info("dgiAddArticle: success", { name });
        return { status: "added" };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("dgiAddArticle: failed", { name, error: msg });
        throw new https_1.HttpsError("internal", `Échec de l'ajout de l'article : ${msg}`);
    }
});
exports.dgiDeleteArticle = (0, https_1.onCall)(ARTICLE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    const { name } = request.data;
    if (!name)
        throw new https_1.HttpsError("invalid-argument", "name is required");
    logger.info("dgiDeleteArticle called", { uid: request.auth.uid, name });
    const { username, password } = getCredentials();
    try {
        await (0, dgiAutomation_1.deleteDGIArticle)(username, password, admin.firestore(), name);
        logger.info("dgiDeleteArticle: success", { name });
        return { status: "deleted" };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("dgiDeleteArticle: failed", { name, error: msg });
        throw new https_1.HttpsError("internal", `Échec de la suppression de l'article : ${msg}`);
    }
});
exports.dgiUpdateArticle = (0, https_1.onCall)(ARTICLE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    const { name, newName, newPrice } = request.data;
    if (!name)
        throw new https_1.HttpsError("invalid-argument", "name is required");
    if (!newName && newPrice == null) {
        throw new https_1.HttpsError("invalid-argument", "newName or newPrice must be provided");
    }
    logger.info("dgiUpdateArticle called", { uid: request.auth.uid, name, newName, newPrice });
    const { username, password } = getCredentials();
    try {
        await (0, dgiAutomation_1.updateDGIArticle)(username, password, admin.firestore(), name, newName, newPrice);
        logger.info("dgiUpdateArticle: success", { name });
        return { status: "updated" };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("dgiUpdateArticle: failed", { name, error: msg });
        throw new https_1.HttpsError("internal", `Échec de la modification de l'article : ${msg}`);
    }
});
// ── Submit Invoice ────────────────────────────────────────────────────────────
exports.submitToDGI = (0, https_1.onCall)(INVOICE_CONFIG, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    const { invoiceId, invoice } = request.data;
    logger.info("submitToDGI called", {
        uid: request.auth.uid,
        invoiceId,
        itemCount: invoice?.items?.length,
    });
    if (!invoiceId || !invoice?.items?.length) {
        throw new https_1.HttpsError("invalid-argument", "invoiceId and items are required");
    }
    const { username, password } = getCredentials();
    let result;
    try {
        result = await (0, dgiAutomation_1.submitInvoiceToDGI)(username, password, admin.firestore(), invoice);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("submitToDGI: failed", { invoiceId, error: msg });
        // Pass the message as-is so the frontend can display "Articles manquants : ..."
        throw new https_1.HttpsError("internal", msg);
    }
    // Upload PDF to Firebase Storage if captured
    let dgiPdfUrl;
    if (result.pdfBuffer) {
        try {
            const bucket = admin.storage().bucket();
            const filePath = `dgi-invoices/${invoiceId}.pdf`;
            const file = bucket.file(filePath);
            await file.save(result.pdfBuffer, { metadata: { contentType: "application/pdf" } });
            await file.makePublic();
            dgiPdfUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
            logger.info("submitToDGI: PDF uploaded", { dgiPdfUrl });
        }
        catch (err) {
            logger.error("submitToDGI: PDF upload failed (non-blocking)", { invoiceId, error: String(err) });
        }
    }
    else {
        logger.warn("submitToDGI: no PDF captured", { invoiceId });
    }
    await admin.firestore().collection("invoices").doc(invoiceId).update({
        dgiReference: result.dgiReference,
        ...(dgiPdfUrl ? { dgiPdfUrl } : {}),
        dgiSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "sent",
    });
    logger.info("submitToDGI: complete", {
        invoiceId,
        dgiReference: result.dgiReference,
        hasPdf: !!dgiPdfUrl,
    });
    return { dgiReference: result.dgiReference, dgiPdfUrl };
});
//# sourceMappingURL=index.js.map