// -------------------------------------------------------
// 🌐 SERVER SETUP
// -------------------------------------------------------
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import crypto from "crypto";


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
      rawBody: JSON.stringify(body), // 👈 SALVA TUDO
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
  // 🔹 LOG SEMPRE
  await saveLog({
    path: `/receive/${type}`,
    headers: req.headers,
    body: req.body,
  });

  // 🔹 SALVA PAYLOAD COMPLETO (NUNCA QUEBRA)
  try {
    await db
      .collection("tickets_raw")
      .doc(req.body?.TicketNumber || crypto.randomUUID())
      .set({
        type,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        payload: JSON.stringify(req.body),
      });
  } catch (err) {
    console.error("❌ Error saving raw payload:", err.message);
  }

  // 🔹 DADOS ESTRUTURADOS (APENAS O QUE VOCÊ USA)
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

  // ⚠️ FL811 SEMPRE PRECISA 200
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


app.get("/api/tickets", async (req, res) => {
  try {
    const snap = await db
      .collection("sunshine_logs")
      .orderBy("timestamp", "desc")
      .limit(2000)
      .get();

    const rows = snap.docs.map((d) => {
      const data = d.data();

      let payload = {};
      try {
        payload = JSON.parse(data.rawBody || "{}");
      } catch (e) {}

      return {
        id: payload.TicketNumber,
        type: data.path?.toLowerCase().includes("ticket") ? "Ticket" : "Other",
        TicketNumber: payload.TicketNumber,
        Address: payload.Address || payload.Location?.Address,
        County: payload.County,
        Status: payload.Status,
        ExpireDate: payload.ExpireDate,
        Date: payload.Date,
        raw: payload,
      };
    });

    const map = new Map();

    rows.forEach((r) => {
      if (!r.TicketNumber) return;
      if (r.type !== "Ticket") return;

      if (!map.has(r.TicketNumber)) {
        map.set(r.TicketNumber, r);
      }
    });

    const tickets = Array.from(map.values());

    console.log("TOTAL LOGS:", rows.length);
    console.log("TOTAL TICKETS:", tickets.length);

    res.json({ tickets });
  } catch (err) {
    console.error("❌ /api/tickets error:", err);
    res.status(500).json({ error: "Failed to load tickets" });
  }
});





// -------------------------------------------------------
// 🔴 ADMIN — DELETE TICKET
app.delete("/api/tickets/:id", async (req, res) => {
  try {
    await db.collection("tickets").doc(req.params.id).delete();
    res.sendStatus(204);
  } catch (err) {
    console.error("❌ delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});


// -------------------------------------------------------
// 🚀 START SERVER
// -------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
