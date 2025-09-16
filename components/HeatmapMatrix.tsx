// components/HeatmapMatrix.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS, CategoryScale, Tooltip, Legend } from "chart.js";
import { Chart } from "react-chartjs-2";

export default function HeatmapMatrix({
  years,
  regions,
  getValue,
}: {
  years: string[];
  regions: string[];
  getValue: (r: string, y: string) => number | undefined;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const m = await import("chartjs-chart-matrix");
      ChartJS.register(CategoryScale, Tooltip, Legend, m.MatrixController, m.MatrixElement);
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const flat = useMemo(() => {
    const cells = regions.flatMap((r) =>
      years.map((y) => ({ x: y, y: r, v: getValue(r, y) }))
    );
    const vals = cells
      .map((c) => (typeof c.v === "number" ? c.v : null))
      .filter((v) => v !== null) as number[];
    const min = vals.length ? Math.min(...vals) : 0;
    const max0 = vals.length ? Math.max(...vals) : 1;
    const max = max0 === min ? min + 1 : max0;
    return { cells, min, max };
  }, [regions, years, getValue]);

  if (!ready) return <div className="text-xs text-slate-400">Loading heatmap…</div>;

  const data = {
    datasets: [
      {
        label: "Intensity",
        data: flat.cells,
        width: ({ chart }: any) => {
          const x = chart?.scales?.x;
          const step =
            (x?.getPixelForTick?.(1) ?? NaN) -
            (x?.getPixelForTick?.(0) ?? NaN);
          const base = Number.isFinite(step)
            ? step
            : chart?.chartArea
            ? chart.chartArea.width / Math.max(1, years.length)
            : 320 / Math.max(1, years.length);
          return Math.max(8, base - 4);
        },
        height: ({ chart }: any) => {
          const y = chart?.scales?.y;
          const step =
            (y?.getPixelForTick?.(1) ?? NaN) -
            (y?.getPixelForTick?.(0) ?? NaN);
          const base = Number.isFinite(step)
            ? step
            : chart?.chartArea
            ? chart.chartArea.height / Math.max(1, regions.length)
            : 260 / Math.max(1, regions.length);
          return Math.max(10, base - 4);
        },
        backgroundColor: (ctx: any) => {
          const v = ctx.raw?.v;
          if (typeof v !== "number") return "rgba(148,163,184,0.15)"; // faint for missing
          const t = (v - flat.min) / (flat.max - flat.min); // 0..1
          const hue = 240 - 240 * Math.min(1, Math.max(0, t)); // blue→pink
          return `hsl(${hue}, 70%, 55%)`;
        },
        borderWidth: 0,
      },
    ],
  };

  const tickStyle = { color: "#94a3b8", font: { size: 11 } };
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: true }, // focus a single tile
    layout: { padding: 8 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: any[]) => {
            const r = items?.[0]?.raw;
            return r ? `${r.y} • ${r.x}` : "";
          },
          label: (i: any) =>
            typeof i.raw?.v === "number" ? `${i.raw.v.toFixed(1)}%` : "No data",
        },
      },
    },
    scales: {
      x: {
        type: "category",
        labels: years,
        offset: true,
        grid: { color: "rgba(148,163,184,0.10)" },
        ticks: tickStyle,
      },
      y: {
        type: "category",
        labels: regions,
        reverse: true, // top→bottom as given
        offset: true,
        grid: { color: "rgba(148,163,184,0.10)" },
        ticks: tickStyle,
      },
    },
  };

  return (
    <div className="h-[380px] w-full">
      <Chart type="matrix" data={data} options={options} />
    </div>
  );
}
