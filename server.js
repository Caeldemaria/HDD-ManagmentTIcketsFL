import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { db } from "./firebase.js";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Rota para receber tickets e salvar no Firebase
app.post("/api/tickets", async (req, res) => {
  try {
    const ticket = req.body;

    if (!ticket.TicketNumber) {
      return res.status(400).json({ error: "TicketNumber is required" });
    }

    await db.collection("tickets").doc(ticket.TicketNumber).set(ticket);
    res.status(201).json({ message: "Ticket saved successfully" });
  } catch (error) {
    console.error("Error saving ticket:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Rota para listar todos os tickets
app.get("/api/tickets", async (req, res) => {
  try {
    const snapshot = await db.collection("tickets").get();
    const tickets = snapshot.docs.map((doc) => doc.data());
    res.json(tickets);
  } catch (error) {
    console.error("Error listing tickets:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Rota para buscar um ticket pelo ID
app.get("/api/tickets/:id", async (req, res) => {
  try {
    const doc = await db.collection("tickets").doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.json(doc.data());
  } catch (error) {
    console.error("Error getting ticket:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
