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

// -------------------------------------------------------
// 🔐 AUTH API INTERNA (ROLE BASED)
// -------------------------------------------------------
async function authWithRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      const apiKey = req.headers["x-api-key"];

      if (!apiKey) {
        return res.status(401).json({ error: "API key required" });
      }

      const snap = await db.collection("api_keys").doc(apiKey).get();

      if (!snap.exists) {
        return res.status(403).json({ error: "Invalid API key" });
      }

      const user = snap.data();

      if (!user.active) {
        return res.status(403).json({ error: "API key disabled" });
      }

      if (
        allowedRoles.length &&
        !allowedRoles.includes(user.role)
      ) {
        return res.status(403).json({ error: "Forbidden" });
      }

      req.user = {
        role: user.role,
        name: user.name || "unknown",
      };

      next();
    } catch (err) {
      console.error("❌ Auth error:", err);
      res.status(500).json({ error: "Auth failed" });
    }
  };
}


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
function sanitizeForFirestore(obj) {
  if (obj === undefined) return null;
  if (obj === null) return null;

  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj
      .map(sanitizeForFirestore)
      .filter(v => v !== undefined);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;

    const sanitized = sanitizeForFirestore(value);

    // Firestore não gosta de objetos vazios
    if (
      sanitized !== undefined &&
      !(typeof sanitized === "object" && Object.keys(sanitized).length === 0)
    ) {
      clean[key] = sanitized;
    }
  }

  return clean;
}

async function saveLog(path, headers, body) {
  if (!firebaseInitialized || !db) {
    console.error("⚠️ Firestore não inicializado, não vou salvar:", path);
    return;
  }

  try {
    const cleanBody = sanitizeForFirestore(body);
    const cleanHeaders = sanitizeForFirestore(headers);

    await db.collection("sunshine_logs").add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      path,
      headers: cleanHeaders,
      body: cleanBody,
    });

    console.log("✅ Log salvo no Firestore");
  } catch (err) {
    console.error("❌ Falha ao salvar no Firestore:", err.message);
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
// 📊 API INTERNA (DASHBOARD / FRONTEND)
// -------------------------------------------------------

// 🔹 Listar logs/tickets (viewer + admin)
app.get(
  "/api/tickets",
  authWithRole(["viewer", "admin"]),
  async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);

      const snap = await db
        .collection("sunshine_logs")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({
        user: req.user,
        count: data.length,
        data,
      });
    } catch (err) {
      console.error("❌ /api/tickets error:", err);
      res.status(500).json({ error: "Failed to load tickets" });
    }
  }
);

// 🔹 Buscar um log específico por ID
app.get(
  "/api/tickets/:id",
  authWithRole(["viewer", "admin"]),
  async (req, res) => {
    try {
      const doc = await db
        .collection("sunshine_logs")
        .doc(req.params.id)
        .get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Not found" });
      }

      res.json({
        id: doc.id,
        ...doc.data(),
      });
    } catch (err) {
      console.error("❌ /api/tickets/:id error:", err);
      res.status(500).json({ error: "Failed to load ticket" });
    }
  }
);

// 🔴 Deletar log (ADMIN only)
app.delete(
  "/api/tickets/:id",
  authWithRole(["admin"]),
  async (req, res) => {
    try {
      await db
        .collection("sunshine_logs")
        .doc(req.params.id)
        .delete();

      res.sendStatus(204);
    } catch (err) {
      console.error("❌ DELETE /api/tickets error:", err);
      res.status(500).json({ error: "Delete failed" });
    }
  }
);



// -------------------------------------------------------
// 🚀 Start server
// -------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

