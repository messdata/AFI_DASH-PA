// components/RankedBarsChartJS.tsx
"use client";
import React, { useMemo } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartOptions, ChartData } from "chart.js";
import { Bar } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function RankedBarsChartJS({ rows, colors, onBarClick, selected = [] }: {
  rows: { county: string; value: number }[];
  colors?: string[]; // same order as rows
  onBarClick?: (county: string, value: number) => void;
  selected?: string[];
}) {
  const data = useMemo(() => [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), [rows]);
  const labels = useMemo(() => data.map((d) => d.county), [data]);
  const bg = useMemo(() => (colors && colors.length === data.length ? colors : data.map((_, i) => `hsl(${(i * 43) % 360} 70% 55%)`)), [colors, data]);

  const chartData: ChartData<"bar"> = useMemo(() => ({ labels, datasets: [{ label: "New dwellings (sum)", data: data.map((d) => d.value), backgroundColor: bg, borderWidth: 0 }] }), [labels, data, bg]);

  const chartOpts: ChartOptions<"bar"> = useMemo(() => ({ indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: false }, tooltip: { mode: "nearest", intersect: false } }, scales: { x: { grid: { display: true } }, y: { grid: { display: false } } }, onClick: (_evt, elements, chart) => { const el = elements?.[0]; if (!el) return; const label = chart.data.labels?.[el.index]; if (!label || typeof label !== "string") return; onBarClick?.(label, data[el.index]?.value ?? 0); } }), [onBarClick, data]);

  return <div className="h-[520px]"><Bar data={chartData} options={chartOpts} /></div>;
}
