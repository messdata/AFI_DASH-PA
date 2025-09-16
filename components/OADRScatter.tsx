"use client";
import { Scatter } from "react-chartjs-2";
import { Chart as ChartJS, LinearScale, PointElement, Tooltip, Legend } from "chart.js";
ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

export type ScatterPoint = { x: number; y: number; label: string };

export default function OADRScatter({ points }: { points: ScatterPoint[] }) {
  const data = {
    datasets: [{
      label: "Regions",
      data: points,
      parsing: false,
      pointRadius: 5,
    }],
  };
  const options: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { tooltip: { callbacks: { label: (ctx: any) =>
      `${ctx.raw.label}: OADR ${ctx.raw.x.toFixed(3)}, Growth ${ctx.raw.y.toFixed(1)}%` } } },
    scales: { x: { title: { display: true, text: "OADR (ratio, latest)" } },
              y: { title: { display: true, text: "65+ growth vs 2022 (%)" } } },
  };
  return <div className="h-[400px]"><Scatter data={data} options={options} /></div>;
}
