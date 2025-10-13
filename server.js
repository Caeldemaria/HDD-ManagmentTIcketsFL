import express from "express";
import { pool, initDB } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

// Inicializa tabelas
initDB();

// ✅ Receber Ticket
app.post("/receive/Ticket", async (req, res) => {
  try {
    const { Ticket, SendingToExcavatorCompany } = req.body;

    if (!Ticket || !SendingToExcavatorCompany) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }

    const { CompanyID, Name } = SendingToExcavatorCompany;
    const {
      TicketNumber,
      OneCallCenterCode,
      Version,
      Status,
      TicketFunction,
      TicketType,
    } = Ticket;

    await pool.query(
      `INSERT INTO tickets 
      (company_id, company_name, ticket_number, one_call_center_code, version, status, ticket_function, ticket_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        CompanyID,
        Name,
        TicketNumber,
        OneCallCenterCode,
        Version,
        Status,
        TicketFunction,
        TicketType,
      ]
    );

    console.log(`📨 Ticket ${TicketNumber} salvo com sucesso.`);
    res.status(200).json({ message: "Ticket recebido e salvo com sucesso" });
  } catch (err) {
    console.error("❌ Erro ao salvar ticket:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ✅ Receber Message
app.post("/receive/Message", async (req, res) => {
  try {
    const data = req.body;
    await pool.query(`INSERT INTO messages (content) VALUES ($1)`, [data]);
    console.log("💬 Mensagem recebida:", data);
    res.status(200).json({ message: "Message recebida e salva" });
  } catch (err) {
    console.error("❌ Erro ao salvar mensagem:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ✅ Receber EODAudit
app.post("/receive/EODAudit", async (req, res) => {
  try {
    const data = req.body;
    await pool.query(`INSERT INTO eod_audits (content) VALUES ($1)`, [data]);
    console.log("📋 EODAudit recebida:", data);
    res.status(200).json({ message: "EODAudit recebida e salva" });
  } catch (err) {
    console.error("❌ Erro ao salvar EODAudit:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ✅ Receber Response
app.post("/receive/Response", async (req, res) => {
  try {
    const data = req.body;
    const ticketNumber = data?.Ticket?.TicketNumber || "desconhecido";
    await pool.query(
      `INSERT INTO responses (ticket_number, content) VALUES ($1, $2)`,
      [ticketNumber, data]
    );
    console.log("🧾 Response recebida:", ticketNumber);
    res.status(200).json({ message: "Response recebida e salva" });
  } catch (err) {
    console.error("❌ Erro ao salvar Response:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ✅ Endpoint para consultar tickets
app.get("/tickets", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tickets ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar tickets:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

app.get("/", (req, res) => res.send("🚀 API Exactix 811 pronta!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor rodando na porta ${PORT}`));
