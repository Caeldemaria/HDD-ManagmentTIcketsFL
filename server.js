// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// 🚨 Check Firebase Key
if (!process.env.FIREBASE_KEY) {
  console.error("❌ ERROR: FIREBASE_KEY was not configured on Render!");
  process.exit(1);
}

// Firebase Credential
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// ✅ ENDPOINT /receive/Ticket
// ---------------------------------------------------------------------------
app.post("/receive/Ticket", async (req, res) => {
  try {
    const payload = req.body;
    const Ticket = payload.Ticket;

    if (!Ticket || !Ticket.TicketNumber) {
      return res.status(400).json({
        message: "Invalid format: missing Ticket or TicketNumber",
      });
    }

    const id = Ticket.TicketNumber.toString().trim();

    await db.collection("tickets").doc(id).set(
      {
        ...Ticket,
        OneCallCenterCode: payload.OneCallCenterCode || null,
        TransmissionDate: payload.TransmissionDate || null,
        receivedAt: new Date().toISOString(),
        status: Ticket.Status || "Open",
      },
      { merge: true }
    );

    console.log("📨 Ticket received:", id);
    return res.json({ message: "Ticket saved successfully" });
  } catch (error) {
    console.error("❌ Error saving Ticket:", error);
    return res.status(500).json({ message: "Internal error", error: error.message });
  }
});

// ---------------------------------------------------------------------------
// ✅ ENDPOINT /receive/Message
// ---------------------------------------------------------------------------
app.post("/receive/Message", async (req, res) => {
  try {
    const payload = req.body;
    const Message = payload.Message;

    if (!Message) {
      return res.status(400).json({ message: "Invalid format: Message is missing" });
    }

    await db.collection("messages").add({
      ...Message,
      OneCallCenterCode: payload.OneCallCenterCode || null,
      TransmissionDate: payload.TransmissionDate || null,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 Message received");
    return res.json({ message: "Message saved successfully" });
  } catch (error) {
    console.error("❌ Error saving Message:", error);
    return res.status(500).json({ message: "Internal error", error: error.message });
  }
});

// ---------------------------------------------------------------------------
// ✅ ENDPOINT /receive/EODAudit
// ---------------------------------------------------------------------------
app.post("/receive/EODAudit", async (req, res) => {
  try {
    const payload = req.body;
    const EODAudit = payload.EODAudit;

    if (!EODAudit) {
      return res.status(400).json({ message: "Invalid format: EODAudit is missing" });
    }

    await db.collection("audits").add({
      ...EODAudit,
      OneCallCenterCode: payload.OneCallCenterCode || null,
      TransmissionDate: payload.TransmissionDate || null,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 EODAudit received");
    return res.json({ message: "EODAudit saved successfully" });
  } catch (error) {
    console.error("❌ Error saving EODAudit:", error);
    return res.status(500).json({ message: "Internal error", error: error.message });
  }
});

// ---------------------------------------------------------------------------
// ✅ ENDPOINT /receive/Response
// ---------------------------------------------------------------------------
app.post("/receive/Response", async (req, res) => {
  try {
    const payload = req.body;
    const ResponseObj = payload.Response;

    if (!ResponseObj || !ResponseObj.TicketNumber) {
      return res.status(400).json({
        message: "Invalid format: missing Response or TicketNumber",
      });
    }

    const ticketNumber = ResponseObj.TicketNumber.toString().trim();

    await db
      .collection("tickets")
      .doc(ticketNumber)
      .collection("responses")
      .add({
        ...ResponseObj,
        OneCallCenterCode: payload.OneCallCenterCode || null,
        TransmissionDate: payload.TransmissionDate || null,
        receivedAt: new Date().toISOString(),
      });

    console.log("📨 Response received:", ticketNumber);

    // ----- CLEAR Logic -----
    const clearCodes = ["1", "4", "5"];

    const responsesSnap = await db
      .collection("tickets")
      .doc(ticketNumber)
      .collection("responses")
      .get();

    const allResponses = responsesSnap.docs.map((d) => d.data());

    const allUtilitiesCleared = allResponses.every((r) =>
      clearCodes.includes(r.ResponseCode)
    );

    if (allResponses.length > 0 && allUtilitiesCleared) {
      await db.collection("tickets").doc(ticketNumber).set(
        { status: "Clear" },
        { merge: true }
      );

      console.log(`✅ Ticket ${ticketNumber} marked as CLEAR`);
    }

    return res.json({ message: "Response saved successfully" });
  } catch (error) {
    console.error("❌ Error saving Response:", error);
    return res.status(500).json({ message: "Internal error", error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 🔎 Test endpoint
// ---------------------------------------------------------------------------
app.get("/tickets", async (req, res) => {
  const snap = await db.collection("tickets").get();
  const data = snap.docs.map((d) => d.data());
  res.json(data);
});

// ---------------------------------------------------------------------------
// 🚀 Start server
// ---------------------------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
