const express=  require('express');
const body_parser= require('body-parser');
const dotenv= require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para aceitar JSON
app.use(body_parser.json());


// Endpoints
app.post('/receive/Ticket', (req, res) => {
  console.log('📨 Recebido Ticket:', req.body);
  res.status(200).json({ message: 'Ticket recebido com sucesso' });
});

app.post('/receive/Message', (req, res) => {
  console.log('📨 Recebido Message:', req.body);
  res.status(200).json({ message: 'Message recebido com sucesso' });
});

app.post('/receive/EODAudit', (req, res) => {
  console.log('📨 Recebido EODAudit:', req.body);
  res.status(200).json({ message: 'EODAudit recebido com sucesso' });
});

app.post('/receive/Response', (req, res) => {
  console.log('📨 Recebido Response:', req.body);
  res.status(200).json({ message: 'Response recebido com sucesso' });
});

// Rota de teste GET
app.get('/', (req, res) => {
  res.send('Servidor funcionando 🚀');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
