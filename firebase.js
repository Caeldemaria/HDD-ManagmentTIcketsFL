const admin = require("firebase-admin");
const fs = require("fs");

// Lê o arquivo JSON da chave do Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync("./tickets-a13e5-firebase-adminsdk-fbsvc-e6514a452c.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tickets-a13e5.firebaseio.com"
});

const db = admin.firestore();

module.exports = { db };
  