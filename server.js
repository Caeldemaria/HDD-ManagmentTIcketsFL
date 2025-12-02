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
// 🧩 Helper: salvar log no Firestore
// -------------------------------------------------------
async function saveLog(path, headers, body) {
  if (!firebaseInitialized || !db) {
    throw new Error("Firestore não inicializado");
  }

  await db.collection("sunshine_logs").add({
    timestamp: new Date().toISOString(),
    path,
    headers,
    body,
  });
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
// 📥 Handler genérico com tratamento de erro
// -------------------------------------------------------
async function genericHandler(path, req, res) {
  console.log(`📩 RECEBIDO ${path}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  try {
    await saveLog(path, req.headers, req.body);
    console.log("✅ Dados salvos no Firestore");
    // Sucesso: 200 sem body (conforme doc: no content is expected)
    return res.sendStatus(200);
  } catch (error) {
    console.error(`❌ Erro ao processar ${path}:`, error);
    // 500 -> faz o FL811 reenviar depois
    return res.status(500).send({ error: "Internal server error" });
  }
}

// -------------------------------------------------------
// 📌 ENDPOINTS OFICIAIS FL811 (Receive API)
// -------------------------------------------------------

// Base URL cadastrada no FL811: https://seu-servidor.com/receive
// Eles vão chamar: /Ticket, /EODAudit, /Message, /Response

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

// Se quiser ainda aceitar algo como /receive/QualquerCoisa:
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
