// components/DemandTrends.tsx
"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,           // ← needed for area fill
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

export type Series = { label: string; points: { x: string | number; y: number }[] };

type Props = {
  years: (string | number)[];
  series: Series[];
  valueSuffix?: string; // default "%"
};

export default function DemandTrends({ years, series, valueSuffix = "%" }: Props) {
  // --- helpers: stable vivid color per series label ---
  const hueFor = (label: string) => {
    let h = 0;
    for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) % 360;
    return h;
  };
  const lineColor = (label: string) => `hsl(${hueFor(label)}, 85%, 60%)`;
  const fillColor = (label: string) => `hsla(${hueFor(label)}, 85%, 60%, 0.12)`;

  // --- coerce inputs to safe arrays ---
  const labels = Array.isArray(years) ? years.map(String) : [];
  const safeSeries = Array.isArray(series) ? series : [];

  // --- build datasets ---
  const datasets = useMemo(() => {
    return safeSeries.map(s => {
      const byYear = new Map<string, number>();
      (s.points ?? []).forEach(p => byYear.set(String(p.x), Number(p.y)));
      const border = lineColor(s.label);
      const bg = fillColor(s.label);
      return {
        label: s.label,
        data: labels.map(y => {
          const v = byYear.get(String(y));
          return Number.isFinite(v as number) ? (v as number) : null;
        }),
        borderColor: border,
        backgroundColor: bg,
        pointBackgroundColor: border,
        pointBorderColor: border,
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.35,
        cubicInterpolationMode: "monotone" as const,
        spanGaps: true,
        fill: true, // soft area fill to make lines look “color-full”
      };
    });
  }, [safeSeries, labels]);

  const data = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    normalized: true,
    interaction: { mode: "nearest" as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: { color: "#e2e8f0", boxWidth: 12, usePointStyle: true, pointStyle: "circle" },
      },
      tooltip: {
        callbacks: {
          title: (items: any[]) => `Year ${items?.[0]?.label ?? ""}`,
          label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1)}${valueSuffix}`,
        },
      },
    },
    scales: {
      x: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.08)" } },
      y: {
        ticks: {
          color: "#94A3B8",
          callback: (v: any) => `${v}${valueSuffix}`,
        },
        grid: { color: "rgba(148,163,184,0.08)" },
      },
    },
  };

  return (
    <div className="h-[400px]">
      <Line data={data} options={options as any} />
    </div>
  );
}

// ----------- helpers used by heatmap/scatter -----------
const asArray = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

// ----------- Lightweight Heatmap (SVG) -----------
export function HeatmapMatrix({ years, regions, getValue }: { years: (number | string)[]; regions: string[]; getValue: (label: string, yr: number | string) => number | undefined; }) {
  const yLabels = asArray(regions);
  const xLabels = asArray(years).map(String);
  const values = yLabels.map((r) => xLabels.map((y) => getValue(r, y)));
  const flat = values.flat().filter((v) => typeof v === "number") as number[];
  const min = Math.min(...(flat.length ? flat : [0]));
  const max = Math.max(...(flat.length ? flat : [1]));
  const W = 640, H = 280, gx = xLabels.length || 1, gy = yLabels.length || 1;
  const cw = W / gx, ch = H / gy;
  const colour = (v: number) => {
    if (!Number.isFinite(v)) return "#e5e7eb"; // neutral
    const t = (v - min) / (max - min || 1);
    const g = Math.round(200 * t);
    return `rgb(${255 - g}, ${g}, 120)`; // simple green→red scale
  };
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {yLabels.map((r, i) => (
        <g key={r}>
          {xLabels.map((y, j) => {
            const v = values[i]?.[j] as number | undefined;
            return (
              <g key={`${r}-${y}`}>
                <rect x={j * cw} y={i * ch} width={cw - 2} height={ch - 2} fill={colour(Number(v))} rx={4} />
                <text x={j * cw + cw / 2} y={i * ch + ch / 2} dominantBaseline="middle" textAnchor="middle" fontSize={10} fill="#111">{Number.isFinite(Number(v)) ? String(v) : "—"}</text>
              </g>
            );
          })}
          <text x={4} y={i * ch + 12} fontSize={10} fill="#333">{r}</text>
        </g>
      ))}
      {xLabels.map((y, j) => (
        <text key={y} x={j * cw + cw / 2} y={H - 4} fontSize={10} textAnchor="middle" fill="#333">{y}</text>
      ))}
    </svg>
  );
}

// ----------- Lightweight Scatter (SVG) -----------
export function OADRScatter({ points }: { points: { label: string; x: number; y: number }[] }) {
  const ps = asArray(points).filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
  const minX = Math.min(...(xs.length ? xs : [0])), maxX = Math.max(...(xs.length ? xs : [1]));
  const minY = Math.min(...(ys.length ? ys : [0])), maxY = Math.max(...(ys.length ? ys : [1]));
  const W = 640, H = 280, PAD = 28;
  const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - PAD * 2);
  const sy = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - PAD * 2);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* axes */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#999" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#999" />
      {/* ticks */}
      {[0, 0.5, 1].map((t) => (
        <text key={`xt${t}`} x={PAD + t * (W - PAD * 2)} y={H - 8} fontSize={10} textAnchor="middle" fill="#333">{(minX + t * (maxX - minX || 1)).toFixed(2)}</text>
      ))}
      {[0, 0.5, 1].map((t) => (
        <text key={`yt${t}`} x={8} y={H - PAD - t * (H - PAD * 2)} fontSize={10} textAnchor="start" fill="#333">{(minY + t * (maxY - minY || 1)).toFixed(0)}</text>
      ))}
      {ps.map((p) => (
        <g key={p.label}>
          <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill="#3b82f6" />
          <text x={sx(p.x) + 6} y={sy(p.y) - 6} fontSize={10} fill="#111">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
