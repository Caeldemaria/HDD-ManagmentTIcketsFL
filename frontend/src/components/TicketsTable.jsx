import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const TicketsTable = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previousStatuses, setPreviousStatuses] = useState({});
  const [selectedResponses, setSelectedResponses] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "tickets"));
        const ticketsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTickets(ticketsData);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "Open":
      case "Release":
        return "bg-red-500 text-white px-2 py-1 rounded";
      case "Clear":
        return "bg-green-500 text-white px-2 py-1 rounded";
      case "Performed":
        return "bg-blue-500 text-white px-2 py-1 rounded";
      default:
        return "bg-gray-300 text-black px-2 py-1 rounded";
    }
  };

  const togglePerformed = async (ticket) => {
    const ticketRef = doc(db, "tickets", ticket.id);
    let newStatus;
    let newPrevious = { ...previousStatuses };

    if (ticket.Status === "Performed") {
      newStatus = newPrevious[ticket.id] || "Open";
      delete newPrevious[ticket.id];
    } else {
      newPrevious[ticket.id] = ticket.Status;
      newStatus = "Performed";
    }

    try {
      await updateDoc(ticketRef, { Status: newStatus });
      setPreviousStatuses(newPrevious);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id ? { ...t, Status: newStatus } : t
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleViewResponses = (ticket) => {
    setSelectedResponses(ticket.Responses || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedResponses(null);
  };

  if (loading) return <p className="text-center mt-4">Loading tickets...</p>;

  return (
    <div className="relative overflow-x-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Received Tickets</h1>

      {/* Modal for responses */}
      {showModal && (
        <div className="absolute top-0 left-0 w-full bg-white border border-gray-300 shadow-xl rounded-lg p-6 z-10">
          <h2 className="text-lg font-semibold mb-3">Utility Responses</h2>

          {selectedResponses.length > 0 ? (
            <ul className="list-disc pl-6 text-gray-700">
              {selectedResponses.map((resp, i) => (
                <li key={i} className="mb-1">{resp}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">
              No responses registered yet.
            </p>
          )}

          <button
            onClick={closeModal}
            className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Close
          </button>
        </div>
      )}

      <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow-md mt-4">
        <thead>
          <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
            <th className="py-3 px-6 text-left">Ticket Number</th>
            <th className="py-3 px-6 text-left">Status</th>
            <th className="py-3 px-6 text-left">Expire Date</th>
            <th className="py-3 px-6 text-left">Responses</th>
            <th className="py-3 px-6 text-left">Created Date</th>
            <th className="py-3 px-6 text-left">Address</th>
            <th className="py-3 px-6 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-sm font-light">
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="py-3 px-6">{ticket.TicketNumber}</td>
              <td className="py-3 px-6">
                <span className={getStatusColor(ticket.Status)}>
                  {ticket.Status === "Release" ? "Open" : ticket.Status}
                </span>
              </td>
              <td className="py-3 px-6">{ticket.ExpireDate || "-"}</td>
              <td className="py-3 px-6">
                <button
                  onClick={() => handleViewResponses(ticket)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded"
                >
                  View responses
                </button>
              </td>
              <td className="py-3 px-6">{ticket.Date || "-"}</td>
              <td className="py-3 px-6">{ticket.Address || "-"}</td>
              <td className="py-3 px-6 text-center">
                <button
                  onClick={() => togglePerformed(ticket)}
                  className={`${
                    ticket.Status === "Performed"
                      ? "bg-yellow-500 hover:bg-yellow-600"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white px-4 py-1 rounded`}
                >
                  {ticket.Status === "Performed" ? "Undo" : "Performed"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TicketsTable;
