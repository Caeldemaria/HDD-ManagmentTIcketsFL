// index.js

const express = require("express");
const admin = require("firebase-admin");

const app = express();

// =======================
//  FIREBASE INIT
// =======================
//
// Opção 1 (recomendada em produção):
// - Defina a variável de ambiente GOOGLE_APPLICATION_CREDENTIALS
//   apontando para o JSON de service account.
//   Ex: GOOGLE_APPLICATION_CREDENTIALS=/caminho/serviceAccountKey.json
//
// admin.initializeApp(); // se já tiver GOOGLE_APPLICATION_CREDENTIALS no ambiente
//
// Opção 2: carregar o JSON direto (apenas para testes locais):
// const serviceAccount = require("./serviceAccountKey.json");
//
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

if (!admin.apps.length) {
  admin.initializeApp(); // usa a config padrão do ambiente
}

const db = admin.firestore();

// =======================
//  BODY PARSER
// =======================

// Receber JSON (é o que o Exactix/FL811 envia)
app.use(express.json({ limit: "50mb" }));

// Se quiser aceitar form-urlencoded, pode manter também:
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// =======================
//  LOG DE REQUISIÇÕES
// =======================

app.use((req, res, next) => {
  console.log("\n======= RECEBIDO =======");
  console.log("URL:", req.method, req.url);
  console.log("HEADERS:", req.headers);
  console.log("BODY:", req.body);
  console.log("========================\n");
  next();
});

// =======================
//  SAFE HANDLER
// =======================
//
// Se der erro interno (Firebase, etc.), devolve 500 para
// o Exactix reenviar mais tarde.

function safeHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("❌ ERRO INTERNO:", err);
      return res.sendStatus(500);
    }
  };
}

// =======================
//  ROTA DE TESTE DO FIREBASE
// =======================
//
// Use /test-firebase no navegador para validar se está salvando no Firestore.

app.get(
  "/test-firebase",
  safeHandler(async (req, res) => {
    const ref = await db.collection("test_receiver").add({
      msg: "Olá Firebase",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Documento de teste criado:", ref.id);
    return res.json({ ok: true, docId: ref.id });
  })
);

// =======================
//  ENDPOINT /receive/Ticket
// =======================

app.post(
  "/receive/Ticket",
  safeHandler(async (req, res) => {
    console.log("📨 Ticket recebido.");

    let payload = req.body;

    // Se por algum motivo vier como string, tenta converter:
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.error("❌ Body Ticket não é JSON válido:", e);
        return res.sendStatus(400);
      }
    }

    console.log("🧾 Payload Ticket:", JSON.stringify(payload, null, 2));

    // Validação mínima (se atrapalhar, pode comentar):
    if (!payload || payload.OneCallCenterCode !== "FL811") {
      console.warn(
        "⚠️ Ticket com OneCallCenterCode inválido:",
        payload && payload.OneCallCenterCode
      );
      return res.sendStatus(400);
    }

    const ticket = payload.Ticket || {};
    const ticketNumber = ticket.TicketNumber || "unknown";
    const version = ticket.Version || 1;

    // Id estável: ex: 12345678_v1
    const docId = `${ticketNumber}_v${version}`;

    await db
      .collection("tickets")
      .doc(docId)
      .set({
        ...payload,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log("✅ Ticket salvo no Firestore com ID:", docId);

    // Doc permite 200, 201, 202, 204. 200 está ok.
    return res.sendStatus(200);
  })
);

// =======================
//  ENDPOINT /receive/EODAudit
// =======================

app.post(
  "/receive/EODAudit",
  safeHandler(async (req, res) => {
    console.log("📨 EODAudit recebido.");

    let payload = req.body;

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.error("❌ Body EODAudit não é JSON válido:", e);
        return res.sendStatus(400);
      }
    }

    console.log("🧾 Payload EODAudit:", JSON.stringify(payload, null, 2));

    const ref = await db.collection("eod_audits").add({
      ...payload,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ EODAudit salvo no Firestore com ID:", ref.id);

    return res.sendStatus(200);
  })
);

// =======================
//  ENDPOINT /receive/Message
// =======================

app.post(
  "/receive/Message",
  safeHandler(async (req, res) => {
    console.log("📨 Message recebido.");

    let payload = req.body;

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.error("❌ Body Message não é JSON válido:", e);
        return res.sendStatus(400);
      }
    }

    console.log("🧾 Payload Message:", JSON.stringify(payload, null, 2));

    const ref = await db.collection("messages").add({
      ...payload,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Message salva no Firestore com ID:", ref.id);

    return res.sendStatus(200);
  })
);

// =======================
//  ENDPOINT /receive/Response
// =======================

app.post(
  "/receive/Response",
  safeHandler(async (req, res) => {
    console.log("📨 Response recebido.");

    let payload = req.body;

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        console.error("❌ Body Response não é JSON válido:", e);
        return res.sendStatus(400);
      }
    }

    console.log("🧾 Payload Response:", JSON.stringify(payload, null, 2));

    const response = payload.Response || {};
    const ticketNumber = response.TicketNumber || "unknown";

    const ref = await db.collection("responses").add({
      ...payload,
      ticketNumber,
      receivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Response salva no Firestore com ID:", ref.id);

    return res.sendStatus(200);
  })
);

// =======================
//  ROTAS DE STATUS / HEALTHCHECK
// =======================

app.get("/", (req, res) => res.json({ message: "Receiver online" }));

app.get("/health", (req, res) => res.json({ status: "UP" }));

// =======================
//  START SERVER
// =======================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Exactix Receiver ON - Porta ${PORT}`);
});
