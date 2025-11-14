// ✅ /receive/Ticket
app.post("/receive/Ticket", async (req, res) => {
  try {
    const payload = req.body;
    const Ticket = payload.Ticket;

    if (!Ticket || !Ticket.TicketNumber) {
      console.error("❌ Payload inválido (Ticket):", payload);
      return res.status(400).json({ message: "Formato inválido: faltando Ticket ou TicketNumber" });
    }

    const ticketNumber = Ticket.TicketNumber.toString().trim();

    await db.collection("tickets").doc(ticketNumber).set(
      {
        ...Ticket,
        receivedAt: new Date().toISOString(),
        OneCallCenterCode: payload.OneCallCenterCode || null,
        TransmissionDate: payload.TransmissionDate || null,
      },
      { merge: true }
    );

    console.log(`📨 Ticket salvo com sucesso: ${ticketNumber}`);
    return res.status(200).json({ message: "Ticket recebido e salvo com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar Ticket:", error);
    return res.status(500).json({ message: "Erro interno ao salvar Ticket", error: error.message });
  }
});


// ✅ /receive/Message
app.post("/receive/Message", async (req, res) => {
  try {
    const payload = req.body;
    const Message = payload.Message;

    if (!Message) {
      console.error("❌ Payload inválido (Message):", payload);
      return res.status(400).json({ message: "Formato inválido: faltando Message" });
    }

    await db.collection("messages").add({
      ...Message,
      receivedAt: new Date().toISOString(),
      OneCallCenterCode: payload.OneCallCenterCode || null,
      TransmissionDate: payload.TransmissionDate || null,
    });

    console.log(`📨 Mensagem recebida e salva com sucesso.`);
    return res.status(200).json({ message: "Message recebido com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar Message:", error);
    return res.status(500).json({ message: "Erro interno ao salvar Message", error: error.message });
  }
});


// ✅ /receive/EODAudit
app.post("/receive/EODAudit", async (req, res) => {
  try {
    const payload = req.body;
    const EODAudit = payload.EODAudit;

    if (!EODAudit) {
      console.error("❌ Payload inválido (EODAudit):", payload);
      return res.status(400).json({ message: "Formato inválido: faltando EODAudit" });
    }

    await db.collection("audits").add({
      ...EODAudit,
      receivedAt: new Date().toISOString(),
      OneCallCenterCode: payload.OneCallCenterCode || null,
      TransmissionDate: payload.TransmissionDate || null,
    });

    console.log(`📨 EODAudit recebido e salvo com sucesso.`);
    return res.status(200).json({ message: "EODAudit recebido com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao salvar EODAudit:", error);
    return res.status(500).json({ message: "Erro interno ao salvar EODAudit", error: error.message });
  }
});
