// -------------------------------------------------------
// 🌐 SERVER SETUP
// -------------------------------------------------------
import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
const port = process.env.PORT || 8080;

// -------------------------------------------------------
// 🔧 BASIC CONFIG
// -------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Compatibilidade FL811
app.set("case sensitive routing", true);

// -------------------------------------------------------
// 🔥 FIREBASE INIT
// -------------------------------------------------------
let db;

try {
  if (!process.env.FIREBASE_KEY) {
    throw new Error("FIREBASE_KEY not set");
  }

  const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(firebaseKey),
  });

  db = admin.firestore();
  console.log("✅ Firebase connected");
} catch (err) {
  console.error("❌ Firebase init error:", err.message);
}

// -------------------------------------------------------
// 🔐 AUTH MIDDLEWARE (ROLE + CLIENT)
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
      res.status(500).json({ error: "Authentication failed" });
    }
  };
}

// -------------------------------------------------------
// 🧼 SANITIZE (Firestore Safe)
// -------------------------------------------------------
function sanitizeForFirestore(value) {
  if (value === undefined || value === null) return null;

  if (Array.isArray(value)) {
    return value
      .map(sanitizeForFirestore)
      .filter(v => v !== null);
  }

  if (typeof value === "object") {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      const sanitized = sanitizeForFirestore(v);
      if (
        sanitized !== null &&
        !(typeof sanitized === "object" && Object.keys(sanitized).length === 0)
      ) {
        clean[k] = sanitized;
      }
    }
    return clean;
  }

  return value;
}

// -------------------------------------------------------
// 🧩 LOGGING (AUDIT / DEBUG)
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
// 🎟️ TICKETS
// -------------------------------------------------------
async function saveOrUpdateTicket(ticket, clientId) {
  if (!ticket.TicketNumber) return;

  await db.collection("tickets").doc(ticket.TicketNumber).set(
    {
      ...ticket,
      clientId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

// -------------------------------------------------------
// 📥 FL811 GENERIC RECEIVER
// ⚠️ NEVER RETURN ERROR TO FL811
// -------------------------------------------------------
async function receiveHandler(type, req, res) {
  await saveLog({
    path: `/receive/${type}`,
    headers: req.headers,
    body: req.body,
  });

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

// -------------------------------------------------------
// 🧪 ROOT
// -------------------------------------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    message: "API Online",
    firebase: Boolean(db),
  });
});

// -------------------------------------------------------
// 📌 FL811 OFFICIAL ENDPOINTS (NO AUTH)
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

// Safe fallback
app.post("/receive/:type", (req, res) =>
  receiveHandler(req.params.type, req, res)
);

// Defensive GETs
app.get("/receive", (_, res) => res.json({ message: "Use POST" }));
app.get("/receive/:type", (_, res) => res.json({ message: "Use POST" }));

// -------------------------------------------------------
// 📊 INTERNAL API — TICKETS
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
// 🔴 ADMIN — DELETE TICKET
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
