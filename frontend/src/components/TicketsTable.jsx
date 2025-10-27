import React, { useEffect, useState } from "react";

const TicketsTable = () => {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/tickets")
      .then((res) => res.json())
      .then((data) => setTickets(data))
      .catch((err) => console.error("Erro ao buscar tickets:", err));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-700">Tickets Recebidos</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 uppercase">
            <tr>
              <th className="px-4 py-3">Ticket Number</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ticket Type</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Excavator Company</th>
              <th className="px-4 py-3">Date Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length > 0 ? (
              tickets.map((t, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{t.TicketNumber || "—"}</td>
                  <td className="px-4 py-2">{t.Status || "—"}</td>
                  <td className="px-4 py-2">{t.TicketType || "—"}</td>
                  <td className="px-4 py-2">{t.Category || "—"}</td>
                  <td className="px-4 py-2">{t.SendingToExcavatorCompany?.Name || "—"}</td>
                  <td className="px-4 py-2">
                    {t.CreatedAt ? new Date(t.CreatedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-3 text-center text-gray-500">
                  Nenhum ticket encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketsTable;
