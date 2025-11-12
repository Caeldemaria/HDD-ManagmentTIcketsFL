// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Inicializa Firebase usando variável de ambiente
if (!process.env.FIREBASE_KEY) {
  console.error("❌ ERRO: FIREBASE_KEY não configurada nas variáveis de ambiente!");
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ✅ Endpoint: /receive/Ticket
app.post("/receive/Ticket", async (req, res) => {
  const { Ticket } = req.body;

  if (!Ticket) {
    return res.status(400).json({ message: "Formato inválido: faltando Ticket" });
  }

  try {
    await db.collection("tickets").add(Ticket);
    console.log("📨 Ticket recebido e salvo:", Ticket.TicketNumber);
    res.status(200).json({ message: "Ticket recebido com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar Ticket:", error);
    res.status(500).json({ message: "Erro ao salvar Ticket" });
  }
});

// ✅ Endpoint: /receive/Message
app.post("/receive/Message", async (req, res) => {
  const { Message } = req.body;

  if (!Message) {
    return res.status(400).json({ message: "Formato inválido: faltando Message" });
  }

  try {
    await db.collection("messages").add(Message);
    console.log("📨 Mensagem recebida e salva:", Message.id);
    res.status(200).json({ message: "Message recebido com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar Message:", error);
    res.status(500).json({ message: "Erro ao salvar Message" });
  }
});

// ✅ Endpoint: /receive/EODAudit
app.post("/receive/EODAudit", async (req, res) => {
  const { EODAudit } = req.body;

  if (!EODAudit) {
    return res.status(400).json({ message: "Formato inválido: faltando EODAudit" });
  }

  try {
    await db.collection("audits").add(EODAudit);
    console.log("📨 EODAudit recebido e salvo:", EODAudit.id);
    res.status(200).json({ message: "EODAudit recebido com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar EODAudit:", error);
    res.status(500).json({ message: "Erro ao salvar EODAudit" });
  }
});

// ✅ Endpoint: /receive/Response
// ✅ Endpoint: /receive/Response
app.post("/receive/Response", async (req, res) => {
  try {
    const { Response } = req.body;

    if (!Response || !Response.TicketNumber) {
      return res.status(400).json({ message: "Formato inválido: faltando Response ou TicketNumber" });
    }

    // 🔹 Cria referência ao ticket
    const ticketRef = db.collection("tickets").doc(Response.TicketNumber);

    // 🔹 Adiciona o response como subdocumento
    const newResponseRef = await ticketRef.collection("responses").add(Response);

    console.log(`📨 Response recebido e salvo para ticket ${Response.TicketNumber}, ID do response: ${newResponseRef.id}`);

    // ✅ Atualiza status do ticket se todos responses forem "Clear" (1, 4, 5)
    const responsesSnap = await ticketRef.collection("responses").get();
    const allResponses = responsesSnap.docs.map(doc => doc.data());

    const clearCodes = ["1", "4", "5"];
    const allClear = allResponses.length > 0 && allResponses.every(r => clearCodes.includes(r.ResponseCode));

    if (allClear) {
      await ticketRef.set({ status: "Clear" }, { merge: true });
      console.log(`✅ Ticket ${Response.TicketNumber} marcado como "Clear"`);
    }

    return res.status(200).json({ message: "Response recebido com sucesso" });

  } catch (error) {
    console.error("❌ Erro ao salvar Response:", error);
    return res.status(500).json({ message: "Erro interno ao salvar Response" });
  }
});

app.get("/tickets", (req, res) => {
  res.json([
    { TicketNumber: "123", Status: "Open", RequestType: "Locate", Date: "2025-10-31" }
  ]);
});


app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});