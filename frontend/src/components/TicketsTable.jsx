import React, { useEffect, useState } from "react";
import { getTickets } from "../api";

const TicketsTable = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTickets() {
      try {
        const data = await getTickets();
        setTickets(data);
      } catch (error) {
        console.error("Erro ao buscar tickets:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, []);

  if (loading) return <p className="text-center mt-4">Carregando tickets...</p>;

  return (
    <div className="overflow-x-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Tickets Recebidos</h1>
      <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow-md">
        <thead>
          <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
            <th className="py-3 px-6 text-left">Ticket Number</th>
            <th className="py-3 px-6 text-left">Status</th>
            <th className="py-3 px-6 text-left">Request Type</th>
            <th className="py-3 px-6 text-left">Date</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-sm font-light">
          {tickets.map((ticket, i) => (
            <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="py-3 px-6">{ticket.TicketNumber}</td>
              <td className="py-3 px-6">{ticket.Status}</td>
              <td className="py-3 px-6">{ticket.RequestType}</td>
              <td className="py-3 px-6">{ticket.Date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TicketsTable;
