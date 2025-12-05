// server.js
import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
const port = process.env.PORT || 8080;

// -------------------------------------------------------
// 🔧 Config básica
// -------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Deixa as rotas sensíveis a maiúsculas/minúsculas:
// /receive/Ticket ≠ /receive/ticket
app.set("case sensitive routing", true);

// -------------------------------------------------------
// 🔥 Inicialização Firebase
// -------------------------------------------------------
let firebaseInitialized = false;
let db = null;

try {
  if (!process.env.FIREBASE_KEY) {
    console.error("❌ ERRO: FIREBASE_KEY não configurada!");
  } else {
    const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);

    admin.initializeApp({
      credential: admin.credential.cert(firebaseKey),
    });

    db = admin.firestore();
    firebaseInitialized = true;
    console.log("✅ Firebase conectado com sucesso!");
  }
} catch (error) {
  console.error("❌ Erro ao inicializar Firebase:", error);
}

// -------------------------------------------------------
// 🧩 Helper: salvar log no Firestore (sem derrubar a API)
// -------------------------------------------------------
async function saveLog(path, headers, body) {
  if (!firebaseInitialized || !db) {
    console.error("⚠️ Firestore não inicializado, não vou salvar:", path);
    return; // não lança erro -> não gera 500
  }

  // Sanitiza o body: garante que só JSON puro vai pro Firestore
  let safeBody = null;
  try {
    safeBody = JSON.parse(JSON.stringify(body));
  } catch (err) {
    console.error("⚠️ Erro ao serializar body, salvando como string:", err);
    safeBody = { raw: String(body) };
  }

  // Também dá pra fazer isso com headers se quiser, mas normalmente já é simples
  let safeHeaders = null;
  try {
    safeHeaders = JSON.parse(JSON.stringify(headers));
  } catch (err) {
    console.error("⚠️ Erro ao serializar headers, salvando como string:", err);
    safeHeaders = { raw: String(headers) };
  }

  try {
    await db.collection("sunshine_logs").add({
      timestamp: new Date().toISOString(),
      path,
      headers: safeHeaders,
      body: safeBody,
    });
    console.log("✅ Log salvo no Firestore (ou ignorado com segurança)");
  } catch (err) {
    console.error("⚠️ Falha ao salvar no Firestore:", err);
    // NÃO relança o erro -> 811 continua recebendo 200
  }
}

// -------------------------------------------------------
// 🧪 ROTA ROOT
// -------------------------------------------------------
app.get("/", (req, res) => {
  res.status(200).send({
    message: "API Online com Firebase",
    firebase: firebaseInitialized,
  });
});

// -------------------------------------------------------
// 🧪 Teste rápido do Firebase
// -------------------------------------------------------
app.get("/test-firebase", async (req, res) => {
  try {
    await saveLog("/test-firebase", {}, { test: true });
    res.status(200).send({ ok: true });
  } catch (error) {
    console.error("❌ Erro em /test-firebase:", error);
    res.status(500).send({ error: "Firestore não inicializado" });
  }
});

// -------------------------------------------------------
// 📥 Handler genérico (NUNCA devolve 500 para a 811)
// -------------------------------------------------------
async function genericHandler(path, req, res) {
  console.log(`📩 RECEBIDO ${path}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  // Tenta salvar, mas qualquer erro fica só no log
  await saveLog(path, req.headers, req.body);

  // Sempre responde 200 pra 811 (no content is expected)
  return res.sendStatus(200);
}

// -------------------------------------------------------
// 📌 ENDPOINTS OFICIAIS FL811 (Receive API)
// -------------------------------------------------------

// Base URL cadastrada no FL811: https://hdd-managmentticketsfl.onrender.com/receive

app.post("/receive/Ticket", async (req, res) => {
  await genericHandler("/receive/Ticket", req, res);
});

app.post("/receive/EODAudit", async (req, res) => {
  await genericHandler("/receive/EODAudit", req, res);
});

app.post("/receive/Message", async (req, res) => {
  await genericHandler("/receive/Message", req, res);
});

app.post("/receive/Response", async (req, res) => {
  await genericHandler("/receive/Response", req, res);
});

// -------------------------------------------------------
// 📌 Endpoint genérico /receive (caso usem sem sufixo)
// -------------------------------------------------------
app.post("/receive", async (req, res) => {
  await genericHandler("/receive", req, res);
});

// Ainda aceita /receive/QualquerCoisa:
app.post("/receive/:type", async (req, res) => {
  const type = req.params.type;
  await genericHandler(`/receive/${type}`, req, res);
});

// -------------------------------------------------------
// 🔍 Rotas GET para evitar "Cannot GET"
// -------------------------------------------------------
app.get("/receive", (req, res) => {
  res.status(200).send({
    message: "Use POST para enviar notificações.",
  });
});

app.get("/receive/:type", (req, res) => {
  res.status(200).send({
    message: "Use POST neste endpoint.",
  });
});

// -------------------------------------------------------
// 🚀 Start server
// -------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
