import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Páginas
import TicketsTable from "./components/TicketsTable";
import DashboardResumo from "./components/Resumo";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TicketsTable />} />
        <Route path="/resumo" element={<DashboardResumo />} />
      </Routes>
    </Router>
  );
}

export default App;
