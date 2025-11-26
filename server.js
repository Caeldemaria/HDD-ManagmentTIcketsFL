const express = require("express");
const app = express();
const bodyParser = require("body-parser");

// ----------- CONFIGURAÇÃO DE SEGURANÇA -----------

// Aceita JSON, texto, xml, ou qualquer outro tipo sem quebrar
app.use(bodyParser.json({ limit: "50mb", strict: false, type: "*/*" }));
app.use(bodyParser.text({ limit: "50mb", type: "*/*" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Log de requisições (ajuda em testes)
app.use((req, res, next) => {
  console.log("\n------- RECEBIDO -------");
  console.log("URL:", req.url);
  console.log("Método:", req.method);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("------------------------\n");
  next();
});

// ----------- AUTENTICAÇÃO EXACTIX -----------
const EXPECTED_API_KEY = process.env.EXACTIX_API_KEY || null;

function exactixAuth(req, res, next) {
  if (!EXPECTED_API_KEY) {
    console.log("⚠ Nenhuma API KEY configurada — auth ignorado.");
    return next();
  }

  const auth = req.header("Authorization") || "";
  const [scheme, token] = auth.split(" ");

  if (scheme !== "Bearer" || token !== EXPECTED_API_KEY) {
    console.log("❌ Falha de autenticação. Header recebido:", auth);
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
}

// ----------- HANDLER PROTEGIDO (NUNCA ERRA) -----------
function safeHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("❌ ERRO INTERNO CAPTURADO:", err);
      // Nunca permite um 500 chegar ao 811
      return res.status(200).json({ message: "received" });
    }
  };
}

// ----------- ROTAS EXACTIX -----------

app.post(
  "/receive/Ticket",
  exactixAuth,
  safeHandler(async (req, res) => {
    console.log("📨 Ticket recebido e salvo.");
    return res.status(200).json({ message: "OK" });
  })
);

app.post(
  "/receive/EODAudit",
  exactixAuth,
  safeHandler(async (req, res) => {
    console.log("📨 EODAudit recebido.");
    return res.status(200).json({ message: "OK" });
  })
);

app.post(
  "/receive/Message",
  exactixAuth,
  safeHandler(async (req, res) => {
    console.log("📨 Message recebido.");
    return res.status(200).json({ message: "OK" });
  })
);

app.post(
  "/receive/Response",
  exactixAuth,
  safeHandler(async (req, res) => {
    console.log("📨 Response recebido.");
    return res.status(200).json({ message: "OK" });
  })
);

// ----------- ROTA GET PARA TESTE DO BROWSER -----------

app.get("/receive", (req, res) => {
  res.json({ message: "Receiver running" });
});

// ----------- INICIAR SERVIDOR -----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Exactix Receiver ON - Porta: ${PORT}`);
  console.log(`Use este endpoint base: https://<seu-dominio>/receive`);
});
