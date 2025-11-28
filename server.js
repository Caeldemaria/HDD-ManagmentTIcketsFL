const express = require("express");
const app = express();
const bodyParser = require("body-parser");

// ----------- ACEITA JSON, XML, TEXTO -----------

app.use(bodyParser.text({ type: "*/*", limit: "50mb" }));
app.use(bodyParser.json({ type: "*/*", limit: "50mb", strict: false }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// ----------- LOG COMPLETO -----------

app.use((req, res, next) => {
  console.log("\n======= RECEBIDO =======");
  console.log("URL:", req.method, req.url);
  console.log("HEADERS:", req.headers);
  console.log("BODY:", req.body);
  console.log("========================\n");
  next();
});

// ----------- HANDLER SEM ERRO 500 -----------

function safeHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("❌ ERRO INTERNO:", err);
      // Sunshine 811 nunca pode receber erro 500
      return res.status(200).json({ message: "OK" });
    }
  };
}

// ----------- ENDPOINTS EXACTIX (OFICIAIS) -----------

app.post(
  "/receive/Ticket",
  safeHandler(async (req, res) => {
    console.log("📨 Ticket recebido.");
    return res.status(200).json({ message: "OK" });
  })
);

app.post(
  "/receive/EODAudit",
  safeHandler(async (req, res) => {
    console.log("📨 EODAudit recebido.");
    return res.status(200).json({ message: "OK" });
  })
);

app.post(
  "/receive/Message",
  safeHandler(async (req, res) => {
    console.log("📨 Message recebido.");
    return res.status(200).json({ message: "OK" });
  })
);

app.post(
  "/receive/Response",
  safeHandler(async (req, res) => {
    console.log("📨 Response recebido.");
    return res.status(200).json({ message: "OK" });
  })
);

// ----------- ROTAS DE TESTE -----------

app.get("/", (req, res) => res.json({ message: "Receiver online" }));
app.get("/health", (req, res) => res.json({ status: "UP" }));
app.get("/receive", (req, res) => res.json({ message: "Receiver running" }));

// ----------- INICIAR SERVIDOR -----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Exactix Receiver ON - Porta ${PORT}`);
});
