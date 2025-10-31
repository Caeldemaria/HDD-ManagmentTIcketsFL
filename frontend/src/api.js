const API_URL = "https://hdd-managmentticketsfl.onrender.com";

export async function getTickets() {
  const response = await fetch(`${API_URL}/tickets`);
  if (!response.ok) throw new Error("Erro ao buscar tickets");
  return response.json();
}

export async function sendTicket(ticketData) {
  const response = await fetch(`${API_URL}/Ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticketData),
  });
  if (!response.ok) throw new Error("Erro ao enviar ticket");
  return response.json();
}
