# Webhook Exactix

Servidor Node.js para receber webhooks da Exactix.

## Rotas disponíveis:

- POST /receive/Ticket
- POST /receive/Message
- POST /receive/EODAudit
- POST /receive/Response

Todas as requisições devem ter o header:

```bash
x-api-key: sua_chave_secreta
