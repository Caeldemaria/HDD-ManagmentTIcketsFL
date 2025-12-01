// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

// -------------------------------------------------------
// 🔥 Inicialização Firebase (SEM ERROS)
// -------------------------------------------------------
let firebaseInitialized = false;

try {
  if (!process.env.FIREBASE_KEY) {
    console.error("❌ ERRO: FIREBASE_KEY não configurada!");
  } else {
    const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);

    admin.initializeApp({
      credential: admin.credential.cert(firebaseKey),
    });

    firebaseInitialized = true;
    console.log("✅ Firebase conectado com sucesso!");
  }
} catch (error) {
  console.error("❌ Erro ao inicializar Firebase:", error);
}

// Firestore (se Firebase carregou)
const db = firebaseInitialized ? admin.firestore() : null;

// -------------------------------------------------------
// 🔥 ROTA ROOT
// -------------------------------------------------------
app.get("/", (req, res) => {
  res.status(200).send({
    message: "API Online com Firebase",
    firebase: firebaseInitialized,
  });
});

// -------------------------------------------------------
// 🔥 Sunshine 811 envia POST para /receive
// -------------------------------------------------------
app.post("/receive", async (req, res) => {
  console.log("📩 RECEIVED /receive:");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  try {
    if (firebaseInitialized) {
      await db.collection("sunshine_logs").add({
        timestamp: new Date(),
        path: "/receive",
        headers: req.headers,
        body: req.body,
      });

      console.log("✅ Dados salvos no Firestore");
    }

    res.status(200).send({ message: "OK" });
  } catch (error) {
    console.error("❌ Erro ao processar /receive:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// -------------------------------------------------------
// 🔥 Sunshine 811 às vezes envia para /receive/Ticket
// -------------------------------------------------------
app.post("/receive/:type", async (req, res) => {
  const type = req.params.type;

  console.log(`📩 RECEIVED /receive/${type}`);
  console.log("Body:", req.body);

  try {
    if (firebaseInitialized) {
      await db.collection("sunshine_logs").add({
        timestamp: new Date(),
        path: `/receive/${type}`,
        headers: req.headers,
        body: req.body,
      });

      console.log("✅ Dados salvos no Firestore");
    }

    res.status(200).send({ message: "OK" });
  } catch (error) {
    console.error(`❌ Erro em /receive/${type}:`, error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// -------------------------------------------------------
// 🔥 Para evitar erro "Cannot GET /receive"
// -------------------------------------------------------
app.get("/receive", (req, res) => {
  res.status(200).send({
    message: "Use POST para enviar notificações.",
  });
});

app.get("/receive/:type", (req, res) => {
  res.status(200).send({
    message: "Use POST neste endpoint.",
  });
});

// -------------------------------------------------------
// 🚀 Start server
// -------------------------------------------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
