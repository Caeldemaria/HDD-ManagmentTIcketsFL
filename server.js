// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

// ---------------------------------------------
// FIREBASE
// ---------------------------------------------
if (!process.env.FIREBASE_KEY) {
  console.error("❌ ERROR: FIREBASE_KEY missing!");
  process.exit(1);
}

let serviceAccount = null;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
} catch (e) {
  console.error("❌ Invalid FIREBASE_KEY JSON");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

const ok = (msg, data = {}) => ({ success: true, message: msg, ...data });
const err = (msg, data = {}) => ({ success: false, message: msg, ...data });

// ---------------------------------------------
// POST /receive/Ticket  ✓ CORRIGIDO
// ---------------------------------------------
app.post("/receive/Ticket", async (req, res) => {
  try {
    const { Ticket, OneCallCenterCode, TransmissionDate } = req.body;

    if (!Ticket || !Ticket.TicketNumber)
      return res.status(400).json(err("Ticket or TicketNumber missing"));

    const id = Ticket.TicketNumber.toString().trim();

    const ticketData = {
      ...Ticket,
      OneCallCenterCode,
      TransmissionDate,
      receivedAt: new Date().toISOString(),
    };

    await db.collection("tickets").doc(id).set(ticketData, { merge: true });

    console.log("📨 Ticket saved:", id);
    res.status(200).json(ok("Ticket saved", { id }));
  } catch (e) {
    console.error("❌ Ticket Error:", e);
    res.status(500).json(err("Internal error", { error: e.message }));
  }
});

// ---------------------------------------------
// POST /receive/Message  ✓ CORRIGIDO
// ---------------------------------------------
app.post("/receive/Message", async (req, res) => {
  try {
    const { MessageContent, OneCallCenterCode, TransmissionDate } = req.body;

    if (!MessageContent)
      return res.status(400).json(err("MessageContent missing"));

    await db.collection("messages").add({
      MessageContent,
      OneCallCenterCode,
      TransmissionDate,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 Message saved");
    res.status(200).json(ok("Message saved"));
  } catch (e) {
    console.error("❌ Message Error:", e);
    res.status(500).json(err("Internal error", { error: e.message }));
  }
});

// ---------------------------------------------
// POST /receive/EODAudit  ✓ CORRIGIDO
// ---------------------------------------------
app.post("/receive/EODAudit", async (req, res) => {
  try {
    const auditData = { ...req.body };

    if (!auditData.MessageContent)
      return res.status(400).json(err("MessageContent missing"));

    await db.collection("audits").add({
      ...auditData,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 EODAudit saved");
    res.status(200).json(ok("EODAudit saved"));
  } catch (e) {
    console.error("❌ EOD Error:", e);
    res.status(500).json(err("Internal error", { error: e.message }));
  }
});

// ---------------------------------------------
// POST /receive/Response  ✓ VALIDADO
// ---------------------------------------------
app.post("/receive/Response", async (req, res) => {
  try {
    const { Response: R, OneCallCenterCode, TransmissionDate } = req.body;

    if (!R || !R.TicketNumber)
      return res.status(400).json(err("Response or TicketNumber missing"));

    const id = R.TicketNumber.toString().trim();

    const data = {
      ...R,
      OneCallCenterCode,
      TransmissionDate,
      receivedAt: new Date().toISOString(),
    };

    await db.collection("tickets").doc(id).collection("responses").add(data);

    console.log("📨 Response saved:", id);

    // CLEAR detection
    const clearCodes = ["1", "4", "5"];

    const snap = await db
      .collection("tickets")
      .doc(id)
      .collection("responses")
      .get();

    const all = snap.docs.map((d) => d.data());
    const allClear =
      all.length > 0 &&
      all.every((r) => clearCodes.includes(r.ResponseCode));

    if (allClear) {
      await db.collection("tickets").doc(id).set({ Status: "Clear" }, { merge: true });
      console.log(`✅ Ticket ${id} marked CLEAR`);
    }

    res.status(200).json(ok("Response saved", { clear: allClear }));
  } catch (e) {
    console.error("❌ Response Error:", e);
    res.status(500).json(err("Internal error", { error: e.message }));
  }
});

// ---------------------------------------------
// GET ROUTES FOR FL811 TESTER  ✓ KEEP
// ---------------------------------------------
app.get("/receive/Ticket", (req, res) => res.status(200).json({ message: "OK" }));
app.get("/receive/Message", (req, res) => res.status(200).json({ message: "OK" }));
app.get("/receive/EODAudit", (req, res) => res.status(200).json({ message: "OK" }));
app.get("/receive/Response", (req, res) => res.status(200).json({ message: "OK" }));

// ---------------------------------------------
app.listen(port, () => console.log(`🚀 Server running on ${port}`));
