// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";

// ----------------------------------------------------------------------------
// 🔧 Express Setup
// ----------------------------------------------------------------------------
const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json({ limit: "20mb" }));

// ----------------------------------------------------------------------------
// 🔥 Firebase Setup
// ----------------------------------------------------------------------------
if (!process.env.FIREBASE_KEY) {
  console.error("❌ ERROR: FIREBASE_KEY is missing!");
  process.exit(1);
}

let serviceAccount = null;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
} catch (err) {
  console.error("❌ FIREBASE_KEY JSON is invalid!");
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

// ----------------------------------------------------------------------------
// 📥 POST /receive/Ticket
// ----------------------------------------------------------------------------
app.post("/receive/Ticket", async (req, res) => {
  try {
    const { Ticket, OneCallCenterCode, TransmissionDate } = req.body;

    if (!Ticket || !Ticket.TicketNumber) {
      return res.status(400).json(err("Ticket or TicketNumber missing"));
    }

    const id = Ticket.TicketNumber.toString().trim();

    const ticketData = {
      ...Ticket,
      OneCallCenterCode: OneCallCenterCode || null,
      TransmissionDate: TransmissionDate || null,
      receivedAt: new Date().toISOString(),
      status: Ticket.Status || "Open",
    };

    await db.collection("tickets").doc(id).set(ticketData, { merge: true });

    console.log("📨 Ticket saved:", id);
    return res.json(ok("Ticket saved", { id }));
  } catch (error) {
    console.error("❌ Ticket Error:", error);
    return res.status(500).json(err("Internal error", { error: error.message }));
  }
});

// ----------------------------------------------------------------------------
// 📥 POST /receive/Message
// ----------------------------------------------------------------------------
app.post("/receive/Message", async (req, res) => {
  try {
    const { Message, OneCallCenterCode, TransmissionDate } = req.body;

    if (!Message) return res.status(400).json(err("Message missing"));

    await db.collection("messages").add({
      ...Message,
      OneCallCenterCode: OneCallCenterCode || null,
      TransmissionDate: TransmissionDate || null,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 Message saved");
    return res.json(ok("Message saved"));
  } catch (error) {
    console.error("❌ Message Error:", error);
    return res.status(500).json(err("Internal error", { error: error.message }));
  }
});

// ----------------------------------------------------------------------------
// 📥 POST /receive/EODAudit
// ----------------------------------------------------------------------------
app.post("/receive/EODAudit", async (req, res) => {
  try {
    const { EODAudit, OneCallCenterCode, TransmissionDate } = req.body;

    if (!EODAudit) return res.status(400).json(err("EODAudit missing"));

    await db.collection("audits").add({
      ...EODAudit,
      OneCallCenterCode: OneCallCenterCode || null,
      TransmissionDate: TransmissionDate || null,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 EODAudit saved");
    return res.json(ok("EODAudit saved"));
  } catch (error) {
    console.error("❌ EODAudit Error:", error);
    return res.status(500).json(err("Internal error", { error: error.message }));
  }
});

// ----------------------------------------------------------------------------
// 📥 POST /receive/Response
// ----------------------------------------------------------------------------
app.post("/receive/Response", async (req, res) => {
  try {
    const { Response: ResponseObj, OneCallCenterCode, TransmissionDate } = req.body;

    if (!ResponseObj || !ResponseObj.TicketNumber) {
      return res.status(400).json(err("Response or TicketNumber missing"));
    }

    const id = ResponseObj.TicketNumber.toString().trim();

    const responseData = {
      ...ResponseObj,
      OneCallCenterCode: OneCallCenterCode || null,
      TransmissionDate: TransmissionDate || null,
      receivedAt: new Date().toISOString(),
    };

    // 🔹 Save response
    await db.collection("tickets").doc(id).collection("responses").add(responseData);

    console.log("📨 Response saved:", id);

    // ----------------------------------------------------------------------
    // CHECK CLEAR
    // ----------------------------------------------------------------------
    const clearCodes = ["1", "4", "5"]; // Cliente confirmou estes códigos

    const responsesSnap = await db
      .collection("tickets")
      .doc(id)
      .collection("responses")
      .get();

    const all = responsesSnap.docs.map((d) => d.data());
    const allClear = all.length > 0 && all.every((r) => clearCodes.includes(r.ResponseCode));

    if (allClear) {
      await db.collection("tickets").doc(id).set({ status: "Clear" }, { merge: true });
      console.log(`✅ Ticket ${id} marked as CLEAR`);
    }

    return res.json(ok("Response saved", { clear: allClear }));
  } catch (error) {
    console.error("❌ Response Error:", error);
    return res.status(500).json(err("Internal error", { error: error.message }));
  }
});

// ----------------------------------------------------------------------------
// 🔎 GET /tickets — Test endpoint
// ----------------------------------------------------------------------------
app.get("/tickets", async (req, res) => {
  try {
    const snap = await db.collection("tickets").get();
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(ok("Tickets loaded", { total: list.length, data: list }));
  } catch (error) {
    res.status(500).json(err("Error loading tickets", { error: error.message }));
  }
});

// ---------------------------------------------------------------------------
// GET endpoints required by FL811 tester (return simple 200 OK)
// ---------------------------------------------------------------------------
app.get("/receive/Ticket", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.get("/receive/Message", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.get("/receive/EODAudit", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.get("/receive/Response", (req, res) => {
  res.status(200).json({ message: "OK" });
});


// ----------------------------------------------------------------------------
// 🚀 Start server
// ----------------------------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
