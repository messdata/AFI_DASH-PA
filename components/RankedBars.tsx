"use client";
import { useMemo } from "react";
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

function normalizeCountyKey(s: string) {
  // same function body as in applyFilters (or import it)
  // keep in sync!
  // ... (omitted here for brevity)
  return s;
}

type Row = { county?: string; LA?: string; value: number };

type Props = {
  rows: Row[]; // already filtered
  filters?: { year?: string; quarter?: string; counties?: string[] };
  onFilterChange?: (f: any) => void; // optional
  onBarClick?: (county: string) => void;
};

export default function RankedBars({ rows, onBarClick }: Props) {
  const dataAgg = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = normalizeCountyKey(String(r.county ?? r.LA ?? ""));
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + Number(r.value ?? 0));
    }
    const arr = [...m.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 26); // top 26 (all counties)
    return arr;
  }, [rows]);

  const labels = dataAgg.map((d) => d.name);
  const values = dataAgg.map((d) => d.total);
  const max = values.length ? Math.max(...values) : 0;

  const data = {
    labels,
    datasets: [
      {
        label: "Completions",
        data: values,
        borderWidth: 0,
        backgroundColor: "rgba(59,130,246,0.9)", // tweak as you like
      },
    ],
  };

  const options: any = {
    indexAxis: "y",
    maintainAspectRatio: false,
    scales: {
      x: {
        beginAtZero: true,
        suggestedMax: max * 1.1,
        ticks: {
          callback: (v: any) => Number(v).toLocaleString(),
        },
        grid: { color: "rgba(255,255,255,0.06)" },
      },
      y: {
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `Completions: ${Number(ctx.raw ?? 0).toLocaleString()}`,
        },
      },
    },
    onClick: (evt: any, elements: any[]) => {
      if (!elements.length) return;
      const idx = elements[0].index;
      const county = labels[idx];
      if (county && onBarClick) onBarClick(county);
    },
  };

  if (!dataAgg.length) {
    return <div className="p-4 text-sm text-gray-400 italic">No data available.</div>;
  }

  return (
    <div style={{ height: 420 }}>
      <Bar data={data} options={options} />
    </div>
  );
}
