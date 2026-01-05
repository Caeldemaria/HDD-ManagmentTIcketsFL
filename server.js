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

// Mantém compatibilidade com FL811
app.set("case sensitive routing", true);

// -------------------------------------------------------
// 🔥 Firebase Init
// -------------------------------------------------------
let db = null;

try {
  if (!process.env.FIREBASE_KEY) {
    throw new Error("FIREBASE_KEY not set");
  }

  const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(firebaseKey),
  });

  db = admin.firestore();
  console.log("✅ Firebase conectado");
} catch (err) {
  console.error("❌ Firebase init error:", err.message);
}

// -------------------------------------------------------
// 🔐 AUTH API INTERNA (ROLE + CLIENT)
// -------------------------------------------------------
function authWithRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

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

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      req.user = {
        role: user.role,
        name: user.name || "unknown",
        clientId: user.clientId || null,
      };

      next();
    } catch (err) {
      console.error("❌ Auth error:", err);
      res.status(500).json({ error: "Auth failed" });
    }
  };
}

// -------------------------------------------------------
// 🧼 Helper: sanitize para Firestore
// -------------------------------------------------------
function sanitizeForFirestore(obj) {
  if (obj === undefined || obj === null) return null;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore).filter(v => v !== null);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitized = sanitizeForFirestore(value);
    if (
      sanitized !== null &&
      !(typeof sanitized === "object" && Object.keys(sanitized).length === 0)
    ) {
      clean[key] = sanitized;
    }
  }

  return clean;
}

// -------------------------------------------------------
// 🧩 LOGS (AUDITORIA / DEBUG)
// -------------------------------------------------------
async function saveLog({ path, headers, body, clientId = "system" }) {
  try {
    await db.collection("sunshine_logs").add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      path,
      clientId,
      headers: sanitizeForFirestore(headers),
      body: sanitizeForFirestore(body),
    });
  } catch (err) {
    console.error("❌ Log save error:", err.message);
  }
}

// -------------------------------------------------------
// 🎟️ TICKETS 811 (DADOS REAIS)
// -------------------------------------------------------
async function saveOrUpdateTicket(ticket, clientId) {
  if (!ticket.TicketNumber) return;

  await db
    .collection("tickets")
    .doc(ticket.TicketNumber)
    .set(
      {
        ...ticket,
        clientId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

// -------------------------------------------------------
// 📥 HANDLER GENÉRICO FL811
// ⚠️ NUNCA retorna erro para o FL811
// -------------------------------------------------------
async function receiveHandler(type, req, res) {
  await saveLog({
    path: `/receive/${type}`,
    headers: req.headers,
    body: req.body,
  });

  // Apenas Ticket vira dado estruturado
  if (type === "Ticket") {
    const ticket = {
      TicketNumber: req.body?.TicketNumber,
      Address: req.body?.Address,
      County: req.body?.County,
      Status: req.body?.Status,
      WorkType: req.body?.WorkType,
      ExpireDate: req.body?.ExpireDate,
      Date: req.body?.Date,
    };

    await saveOrUpdateTicket(ticket, "default_client");
  }

  return res.sendStatus(200);
}
x 
// -------------------------------------------------------
// 🧪 ROOT
// -------------------------------------------------------
app.get("/", (req, res) => {
  res.status(200).send({
    message: "API Online",
    firebase: Boolean(db),
  });
});

// -------------------------------------------------------
// 📌 ENDPOINTS OFICIAIS FL811 (SEM AUTH)
// -------------------------------------------------------
app.post("/receive/Ticket", (req, res) =>
  receiveHandler("Ticket", req, res)
);

app.post("/receive/Response", (req, res) =>
  receiveHandler("Response", req, res)
);

app.post("/receive/EODAudit", (req, res) =>
  receiveHandler("EODAudit", req, res)
);

app.post("/receive/Message", (req, res) =>
  receiveHandler("Message", req, res)
);

// Fallback (opcional, seguro)
app.post("/receive/:type", (req, res) =>
  receiveHandler(req.params.type, req, res)
);

// GETs defensivos
app.get("/receive", (req, res) => {
  res.status(200).send({ message: "Use POST" });
});

app.get("/receive/:type", (req, res) => {
  res.status(200).send({ message: "Use POST" });
});

// -------------------------------------------------------
// 📊 API INTERNA — TICKETS
// -------------------------------------------------------
app.get(
  "/api/tickets",
  authWithRole(["client", "viewer", "admin"]),
  async (req, res) => {
    try {
      const { role, clientId } = req.user;

      let query = db.collection("tickets");
      if (role === "client" && clientId) {
        query = query.where("clientId", "==", clientId);
      }

      const snap = await query
        .orderBy("updatedAt", "desc")
        .limit(100)
        .get();

      res.json(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    } catch (err) {
      console.error("❌ /api/tickets error:", err);
      res.status(500).json({ error: "Failed to load tickets" });
    }
  }
);

// -------------------------------------------------------
// 🔴 ADMIN DELETE
// -------------------------------------------------------
app.delete(
  "/api/tickets/:id",
  authWithRole(["admin"]),
  async (req, res) => {
    await db.collection("tickets").doc(req.params.id).delete();
    res.sendStatus(204);
  }
);

// -------------------------------------------------------
// 🚀 START SERVER
// -------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
