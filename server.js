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

// 🚨 Verifica Firebase Key
if (!process.env.FIREBASE_KEY) {
  console.error("❌ ERRO: FIREBASE_KEY não foi configurada no Render!");
  process.exit(1);
}

// Credencial Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

// Inicializa Firebase Admin
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
        message: "Formato inválido: Ticket ou TicketNumber ausente",
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

    console.log("📨 Ticket recebido:", id);
    return res.json({ message: "Ticket salvo com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar Ticket:", error);
    return res.status(500).json({ message: "Erro interno", error: error.message });
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
      return res.status(400).json({ message: "Formato inválido: faltando Message" });
    }

    await db.collection("messages").add({
      ...Message,
      OneCallCenterCode: payload.OneCallCenterCode || null,
      TransmissionDate: payload.TransmissionDate || null,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 Message recebido");
    return res.json({ message: "Message salvo com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar Message:", error);
    return res.status(500).json({ message: "Erro interno", error: error.message });
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
      return res.status(400).json({ message: "Formato inválido: faltando EODAudit" });
    }

    await db.collection("audits").add({
      ...EODAudit,
      OneCallCenterCode: payload.OneCallCenterCode || null,
      TransmissionDate: payload.TransmissionDate || null,
      receivedAt: new Date().toISOString(),
    });

    console.log("📨 EODAudit recebido");
    return res.json({ message: "EODAudit salvo com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar EODAudit:", error);
    return res.status(500).json({ message: "Erro interno", error: error.message });
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
        message: "Formato inválido: Response ou TicketNumber ausente",
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

    console.log("📨 Response recebido:", ticketNumber);

    // ----- Lógica para CLEAR -----
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

      console.log(`✅ Ticket ${ticketNumber} marcado como CLEAR`);
    }

    return res.json({ message: "Response salvo com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar Response:", error);
    return res.status(500).json({ message: "Erro interno", error: error.message });
  }
});

// ---------------------------------------------------------------------------
// 🔎 Endpoint de teste
// ---------------------------------------------------------------------------
app.get("/tickets", async (req, res) => {
  const snap = await db.collection("tickets").get();
  const data = snap.docs.map((d) => d.data());
  res.json(data);
});

// ---------------------------------------------------------------------------
// 🚀 Inicia servidor
// ---------------------------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
