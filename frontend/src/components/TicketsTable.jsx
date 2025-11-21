// src/components/TicketsTable.jsx
import { useNavigate } from "react-router-dom";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const DropdownIcon = ({ open }) => (
  <svg
    className={`w-4 h-4 inline-block ml-2 transition-transform ${open ? "transform rotate-180" : ""}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
  </svg>
);

const TicketsTable = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
const navigate = useNavigate();

  // modal responses
  const [selectedResponses, setSelectedResponses] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // coluna filtros: estado para cada coluna (search text + valores checados + dropdown open)
  const initialFilterState = {
    TicketNumber: { open: false, q: "", checked: [] },
    Status: { open: false, q: "", checked: [] },
    ExpireDate: { open: false, q: "", checked: [] },
    Project: { open: false, q: "", checked: [] },
    Footage: { open: false, q: "", checked: [] },
    Date: { open: false, q: "", checked: [] },
    Address: { open: false, q: "", checked: [] },
  };
  const [filters, setFilters] = useState(initialFilterState);

  // Real-time: tickets + subcollection responses per ticket
  useEffect(() => {
    const ticketsRef = collection(db, "tickets");

    let unsubResponsesList = [];
    const unsubTickets = onSnapshot(
      ticketsRef,
      (snapshot) => {
        const baseTickets = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          Responses: [],
        }));

        // cleanup previous response listeners
        unsubResponsesList.forEach((u) => u());
        unsubResponsesList = [];

        // for each ticket, listen responses subcollection in realtime
        setTickets(baseTickets); // primeira carga sem responses

baseTickets.forEach((ticket) => {
  const responsesRef = collection(db, "tickets", ticket.id, "response");

  const unsubResponses = onSnapshot(responsesRef, (resSnap) => {
    const responsesData = resSnap.docs.map((r) => ({ id: r.id, ...r.data() }));

    setTickets(prev =>
      prev.map(t =>
        t.id === ticket.id ? { ...t, Responses: responsesData } : t
      )
    );
  });

  unsubResponsesList.push(unsubResponses);
});

        setLoading(false);
      },
      (err) => {
        console.error("Error listening tickets:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubTickets();
      unsubResponsesList.forEach((u) => u());
    };
  }, []);

  // -------------------------
  // Helpers: status color
  // -------------------------
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

  // -------------------------
  // Edit fields Project/Footage (compatibilidade Project/Project lowercase)
  // -------------------------
  const pickFieldKey = (ticket, lowerKey, upperKey) => {
    if (ticket && Object.prototype.hasOwnProperty.call(ticket, upperKey)) return upperKey;
    if (ticket && Object.prototype.hasOwnProperty.call(ticket, lowerKey)) return lowerKey;
    return upperKey; // fallback
  };

  const handleLocalChange = (ticketId, field, value) => {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, [field]: value } : t)));
  };

  const handleSaveField = async (ticket, fieldCandidate, value) => {
    const fieldKey =
      fieldCandidate === "Project"
        ? pickFieldKey(ticket, "project", "Project")
        : pickFieldKey(ticket, "footage", "Footage");

    try {
      await updateDoc(doc(db, "tickets", ticket.id), {
        [fieldKey]: value === "" ? null : value,
      });
      // console.log("Saved", fieldKey, "=", value);
    } catch (err) {
      console.error("Error saving field:", fieldKey, ticket.id, err);
    }
  };

  // Toggle performed
  const togglePerformed = async (ticket) => {
    const ticketRef = doc(db, "tickets", ticket.id);
    const newStatus = ticket.Status === "Performed" ? "Open" : "Performed";
    try {
      await updateDoc(ticketRef, { Status: newStatus });
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, Status: newStatus } : t)));
    } catch (err) {
      console.error("Error toggling Performed:", err);
    }
  };

  // responses modal
  const handleViewResponses = (ticket) => {
    setSelectedResponses(ticket.Responses || []);
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setSelectedResponses([]);
  };

  // -------------------------
  // FILTERS: build unique values for each column from tickets
  // -------------------------
  const columnValues = useMemo(() => {
    const cols = {
      TicketNumber: new Set(),
      Status: new Set(),
      ExpireDate: new Set(),
      Project: new Set(),
      Footage: new Set(),
      Date: new Set(),
      Address: new Set(),
    };

    tickets.forEach((t) => {
      cols.TicketNumber.add(t.TicketNumber ?? "");
      cols.Status.add(t.Status ?? "");
      cols.ExpireDate.add(t.ExpireDate ?? "");
      const projectVal = t.Project ?? t.project ?? "";
      cols.Project.add(projectVal);
      const footageVal = t.Footage !== undefined ? t.Footage : (t.footage !== undefined ? t.footage : "");
      cols.Date.add(t.Date ?? "");
      cols.Footage.add(String(footageVal));
      cols.Address.add(t.Address ?? "");
    });

    // convert to arrays and sort
    const result = {};
    Object.keys(cols).forEach((k) => {
      result[k] = Array.from(cols[k]).filter(v => v !== null && v !== undefined).sort((a, b) => {
        if (a === b) return 0;
        // try numeric compare for Footage
        if (k === "Footage") {
          const na = Number(a), nb = Number(b);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
        }
        return String(a).localeCompare(String(b));
      });
    });
    return result;
  }, [tickets]);

  // -------------------------
  // Apply filters to tickets
  // -------------------------
  const filteredTickets = useMemo(() => {
    // if no filters active -> return tickets
    return tickets.filter((t) => {
      // helper to test a column
      const testCol = (colKey, valueExtractor) => {
        const f = filters[colKey];
        if (!f) return true;
        // if any checked values -> only show those
        if (f.checked && f.checked.length > 0) {
          return f.checked.includes(String(valueExtractor(t)));
        }
        // else if search query exists -> includes
        if (f.q && f.q.trim() !== "") {
          return String(valueExtractor(t)).toLowerCase().includes(f.q.toLowerCase());
        }
        return true;
      };

      const projectVal = t.Project ?? t.project ?? "";
      const footageVal = t.Footage !== undefined ? t.Footage : (t.footage !== undefined ? t.footage : "");

      return (
        testCol("TicketNumber", (x) => x.TicketNumber ?? "") &&
        testCol("Status", (x) => x.Status ?? "") &&
        testCol("ExpireDate", (x) => x.ExpireDate ?? "") &&
        testCol("Project", () => projectVal) &&
        testCol("Footage", () => String(footageVal)) &&
        testCol("Date", (x) => x.Date ?? "") &&
        testCol("Address", (x) => x.Address ?? "")
      );
    });
  }, [tickets, filters]);

  // -------------------------
  // Filter UI handlers
  // -------------------------
  const toggleFilterOpen = (col) => {
    setFilters((prev) => ({ ...prev, [col]: { ...prev[col], open: !prev[col].open } }));
  };

  const setFilterQuery = (col, q) => {
    setFilters((prev) => ({ ...prev, [col]: { ...prev[col], q } }));
  };

  const toggleFilterValue = (col, value) => {
    setFilters((prev) => {
      const checked = prev[col].checked || [];
      const exists = checked.includes(value);
      const next = exists ? checked.filter((c) => c !== value) : [...checked, value];
      return { ...prev, [col]: { ...prev[col], checked: next } };
    });
  };

  const clearFilter = (col) => {
    setFilters((prev) => ({ ...prev, [col]: { ...prev[col], q: "", checked: [], open: false } }));
  };

  const clearAll = () => {
    setFilters(initialFilterState);
  };

  if (loading) return <p className="text-center mt-4">Loading tickets...</p>;

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="relative overflow-x-auto p-6">
      <div className="flex items-center justify-between mb-4">
  <h1 className="text-2xl font-bold text-gray-800">Received Tickets</h1>
  <div className="flex gap-2 items-center">

    <button
      onClick={clearAll}
      className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
    >
      Clear filters
    </button>

    {/* BOTÃO PARA O DASHBOARD - RESUMO */}
    <button  
      onClick={() => navigate("/resumo")} 
      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
    >
      Resumo
    </button>

    <span className="text-sm text-gray-500">{filteredTickets.length} / {tickets.length} shown</span>
  </div>
</div>


      {/* Table */}
      <div className="overflow-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow-md">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
              {/* TicketNumber */}
              <th className="py-3 px-4 text-left relative">
                <div className="flex items-center">
                  <span>Ticket Number</span>
                  <button
                    onClick={() => toggleFilterOpen("TicketNumber")}
                    className="ml-2 p-1 rounded hover:bg-gray-200"
                    aria-label="filter TicketNumber"
                  >
                    <DropdownIcon open={filters.TicketNumber.open} />
                  </button>
                </div>

                {/* Dropdown */}
                {filters.TicketNumber.open && (
                  <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow-lg w-64">
                    <div className="flex items-center mb-2">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={filters.TicketNumber.q}
                        onChange={(e) => setFilterQuery("TicketNumber", e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </div>

                    <div className="max-h-40 overflow-auto">
                      {columnValues.TicketNumber.map((v) => (
                        <label key={v} className="flex items-center text-sm py-1">
                          <input
                            type="checkbox"
                            checked={filters.TicketNumber.checked.includes(String(v))}
                            onChange={() => toggleFilterValue("TicketNumber", String(v))}
                            className="mr-2"
                          />
                          <span>{v || "(empty)"}</span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-2 flex justify-between">
                      <button onClick={() => clearFilter("TicketNumber")} className="text-sm text-red-500">Clear</button>
                      <button onClick={() => toggleFilterOpen("TicketNumber")} className="text-sm text-gray-700">Close</button>
                    </div>
                  </div>
                )}
              </th>

              {/* Status */}
              <th className="py-3 px-4 text-left relative">
                <div className="flex items-center">
                  <span>Status</span>
                  <button onClick={() => toggleFilterOpen("Status")} className="ml-2 p-1 rounded hover:bg-gray-200" aria-label="filter Status">
                    <DropdownIcon open={filters.Status.open} />
                  </button>
                </div>

                {filters.Status.open && (
                  <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow-lg w-48">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters.Status.q}
                      onChange={(e) => setFilterQuery("Status", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm mb-2"
                    />
                    <div className="max-h-40 overflow-auto">
                      {columnValues.Status.map((v) => (
                        <label key={v} className="flex items-center text-sm py-1">
                          <input
                            type="checkbox"
                            checked={filters.Status.checked.includes(String(v))}
                            onChange={() => toggleFilterValue("Status", String(v))}
                            className="mr-2"
                          />
                          <span>{v || "(empty)"}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => clearFilter("Status")} className="text-sm text-red-500">Clear</button>
                      <button onClick={() => toggleFilterOpen("Status")} className="text-sm text-gray-700">Close</button>
                    </div>
                  </div>
                )}
              </th>

              {/* Expire Date */}
              <th className="py-3 px-4 text-left relative">
                <div className="flex items-center">
                  <span>Expire Date</span>
                  <button onClick={() => toggleFilterOpen("ExpireDate")} className="ml-2 p-1 rounded hover:bg-gray-200" aria-label="filter ExpireDate">
                    <DropdownIcon open={filters.ExpireDate.open} />
                  </button>
                </div>

                {filters.ExpireDate.open && (
                  <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow-lg w-56">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters.ExpireDate.q}
                      onChange={(e) => setFilterQuery("ExpireDate", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm mb-2"
                    />
                    <div className="max-h-40 overflow-auto">
                      {columnValues.ExpireDate.map((v) => (
                        <label key={v} className="flex items-center text-sm py-1">
                          <input
                            type="checkbox"
                            checked={filters.ExpireDate.checked.includes(String(v))}
                            onChange={() => toggleFilterValue("ExpireDate", String(v))}
                            className="mr-2"
                          />
                          <span>{v || "(empty)"}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => clearFilter("ExpireDate")} className="text-sm text-red-500">Clear</button>
                      <button onClick={() => toggleFilterOpen("ExpireDate")} className="text-sm text-gray-700">Close</button>
                    </div>
                  </div>
                )}
              </th>

              {/* Project */}
              <th className="py-3 px-4 text-left relative">
                <div className="flex items-center">
                  <span>Project</span>
                  <button onClick={() => toggleFilterOpen("Project")} className="ml-2 p-1 rounded hover:bg-gray-200" aria-label="filter Project">
                    <DropdownIcon open={filters.Project.open} />
                  </button>
                </div>

                {filters.Project.open && (
                  <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow-lg w-56">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters.Project.q}
                      onChange={(e) => setFilterQuery("Project", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm mb-2"
                    />
                    <div className="max-h-40 overflow-auto">
                      {columnValues.Project.map((v) => (
                        <label key={v} className="flex items-center text-sm py-1">
                          <input
                            type="checkbox"
                            checked={filters.Project.checked.includes(String(v))}
                            onChange={() => toggleFilterValue("Project", String(v))}
                            className="mr-2"
                          />
                          <span>{v || "(empty)"}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => clearFilter("Project")} className="text-sm text-red-500">Clear</button>
                      <button onClick={() => toggleFilterOpen("Project")} className="text-sm text-gray-700">Close</button>
                    </div>
                  </div>
                )}
              </th>

              {/* Footage */}
              <th className="py-3 px-4 text-left relative">
                <div className="flex items-center">
                  <span>Footage</span>
                  <button onClick={() => toggleFilterOpen("Footage")} className="ml-2 p-1 rounded hover:bg-gray-200" aria-label="filter Footage">
                    <DropdownIcon open={filters.Footage.open} />
                  </button>
                </div>

                {filters.Footage.open && (
                  <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow-lg w-44">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters.Footage.q}
                      onChange={(e) => setFilterQuery("Footage", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm mb-2"
                    />
                    <div className="max-h-40 overflow-auto">
                      {columnValues.Footage.map((v) => (
                        <label key={v} className="flex items-center text-sm py-1">
                          <input
                            type="checkbox"
                            checked={filters.Footage.checked.includes(String(v))}
                            onChange={() => toggleFilterValue("Footage", String(v))}
                            className="mr-2"
                          />
                          <span>{v === "" ? "(empty)" : v}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => clearFilter("Footage")} className="text-sm text-red-500">Clear</button>
                      <button onClick={() => toggleFilterOpen("Footage")} className="text-sm text-gray-700">Close</button>
                    </div>
                  </div>
                )}
              </th>

              {/* Responses column header (no filter) */}
              <th className="py-3 px-4 text-left">Responses</th>

              {/* Date */}
              <th className="py-3 px-4 text-left relative">
                <div className="flex items-center">
                  <span>Created Date</span>
                  <button onClick={() => toggleFilterOpen("Date")} className="ml-2 p-1 rounded hover:bg-gray-200" aria-label="filter Date">
                    <DropdownIcon open={filters.Date.open} />
                  </button>
                </div>

                {filters.Date.open && (
                  <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow-lg w-56">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters.Date.q}
                      onChange={(e) => setFilterQuery("Date", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm mb-2"
                    />
                    <div className="max-h-40 overflow-auto">
                      {columnValues.Date.map((v) => (
                        <label key={v} className="flex items-center text-sm py-1">
                          <input
                            type="checkbox"
                            checked={filters.Date.checked.includes(String(v))}
                            onChange={() => toggleFilterValue("Date", String(v))}
                            className="mr-2"
                          />
                          <span>{v || "(empty)"}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => clearFilter("Date")} className="text-sm text-red-500">Clear</button>
                      <button onClick={() => toggleFilterOpen("Date")} className="text-sm text-gray-700">Close</button>
                    </div>
                  </div>
                )}
              </th>

              {/* Address */}
              <th className="py-3 px-4 text-left relative">
                <div className="flex items-center">
                  <span>Address</span>
                  <button onClick={() => toggleFilterOpen("Address")} className="ml-2 p-1 rounded hover:bg-gray-200" aria-label="filter Address">
                    <DropdownIcon open={filters.Address.open} />
                  </button>
                </div>

                {filters.Address.open && (
                  <div className="absolute z-50 mt-2 p-3 bg-white border rounded shadow-lg w-72">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filters.Address.q}
                      onChange={(e) => setFilterQuery("Address", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm mb-2"
                    />
                    <div className="max-h-40 overflow-auto">
                      {columnValues.Address.map((v) => (
                        <label key={v} className="flex items-center text-sm py-1">
                          <input
                            type="checkbox"
                            checked={filters.Address.checked.includes(String(v))}
                            onChange={() => toggleFilterValue("Address", String(v))}
                            className="mr-2"
                          />
                          <span>{v || "(empty)"}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between">
                      <button onClick={() => clearFilter("Address")} className="text-sm text-red-500">Clear</button>
                      <button onClick={() => toggleFilterOpen("Address")} className="text-sm text-gray-700">Close</button>
                    </div>
                  </div>
                )}
              </th>

              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>

          <tbody className="text-gray-700 text-sm font-light">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket) => {
                const projectValue = ticket.Project ?? ticket.project ?? "";
                const footageValue = ticket.Footage !== undefined ? ticket.Footage : (ticket.footage !== undefined ? ticket.footage : "");

                return (
                  <tr key={ticket.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4">{ticket.TicketNumber}</td>

                    <td className="py-3 px-4">
                      <span className={getStatusColor(ticket.Status)}>
                        {ticket.Status === "Release" ? "Open" : ticket.Status}
                      </span>
                    </td>

                    <td className="py-3 px-4">{ticket.ExpireDate || "-"}</td>

                    {/* Project */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        className="border rounded p-1 w-full"
                        value={projectValue}
                        onChange={(e) => handleLocalChange(ticket.id, "Project", e.target.value)}
                        onBlur={(e) => handleSaveField(ticket, "Project", e.target.value.trim())}
                      />
                    </td>

                    {/* Footage */}
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        className="border rounded p-1 w-full"
                        value={footageValue === null ? "" : footageValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          handleLocalChange(ticket.id, "Footage", v === "" ? "" : Number(v));
                        }}
                        onBlur={(e) => {
                          const v = e.target.value;
                          handleSaveField(ticket, "Footage", v === "" ? null : Number(v));
                        }}
                      />
                    </td>

                    <td className="py-3 px-4">
                      <button onClick={() => handleViewResponses(ticket)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded">
                        View responses
                      </button>
                    </td>

                    <td className="py-3 px-4">{ticket.Date || "-"}</td>
                    <td className="py-3 px-4">{ticket.Address || "-"}</td>

                    <td className="py-3 px-4 text-center">
                      <button onClick={() => togglePerformed(ticket)} className={`${ticket.Status === "Performed" ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-500 hover:bg-blue-600"} text-white px-4 py-1 rounded`}>
                        {ticket.Status === "Performed" ? "Undo" : "Performed"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="11" className="text-center py-6 text-gray-500 italic">No tickets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Responses Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-start justify-center p-6 bg-black bg-opacity-40 z-50">
          <div className="w-full max-w-2xl bg-white border border-gray-300 shadow-xl rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-3">Utility Responses</h2>
            {selectedResponses && selectedResponses.length > 0 ? (
              <ul>
                {selectedResponses.map((resp, i) => (
                  <li key={i} className="mb-3 p-3 border rounded shadow-sm bg-gray-50">
                    <p><strong>Utility:</strong> {resp.UtilityName}</p>
                    <p><strong>Utility Type:</strong> {resp.UtilityType}</p>
                    <p><strong>Response Code:</strong> {resp.ResponseCode}</p>
                    <p><strong>Message:</strong> {resp.Message}</p>
                    <p><strong>Date:</strong> {resp.ResponseDate}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No responses found.</p>
            )}
            <div className="mt-4 text-right">
              <button onClick={closeModal} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketsTable;
