import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function Resumo() {
  const [project, setProject] = useState("");
  const [projectsList, setProjectsList] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, clear: 0, performed: 0 });

  // Load tickets in realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tickets"), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTickets(data);

      // Auto collect list of projects
      const unique = new Set();
      data.forEach((t) => {
        const p = t.Project ?? t.project;
        if (p) unique.add(p);
      });
      setProjectsList([...unique]);
    });

    return () => unsub();
  }, []);

  // Calculate stats per project
  const calculateStats = () => {
    if (!project) return;

    const filtered = tickets.filter(
      (t) => (t.Project ?? t.project ?? "").toLowerCase() === project.toLowerCase()
    );

    let openFt = 0,
      clearFt = 0,
      performedFt = 0;

    filtered.forEach((t) => {
      const ft = Number(t.Footage ?? t.footage ?? 0);

      if (t.Status === "Open" || t.Status === "Release") openFt += ft;
      if (t.Status === "Clear") clearFt += ft;
      if (t.Status === "Performed") performedFt += ft;
    });

    setStats({ open: openFt, clear: clearFt, performed: performedFt });
  };

  // Export PDF
  const exportPDF = () => {
    const div = document.getElementById("pdf-area");

    html2canvas(div).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save(`Resumo_${project}.pdf`);
    });
  };

  const chartData = {
    labels: ["Open", "Clear", "Performed"],
    datasets: [
      {
        label: `Total footage`,
        data: [stats.open, stats.clear, stats.performed],
        backgroundColor: ["#ef4444", "#22c55e", "#3b82f6"],
      },
    ],
  };

  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.parsed.y} ft`,
        },
      },
    },
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Resumo por Projeto</h1>

      {/* PROJECT SELECT */}
      <div className="mb-4">
        <label className="font-semibold">Selecione o Projeto:</label>
        <select
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="border rounded p-2 w-full mt-1"
        >
          <option value="">-- escolher projeto --</option>
          {projectsList.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          onClick={calculateStats}
          className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Gerar Resumo
        </button>
      </div>

      {/* PDF EXPORT BUTTON */}
      <button
        onClick={exportPDF}
        className="mb-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
      >
        Exportar PDF
      </button>

      {/* AREA TO EXPORT */}
      <div id="pdf-area" className="bg-white p-4 rounded shadow-md">
        <h2 className="text-lg font-semibold text-center mb-2">
          {project ? `Resumo do Projeto: ${project}` : "Selecione um projeto"}
        </h2>

        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
