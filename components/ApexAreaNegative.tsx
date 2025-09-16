"use client";
import React from "react";


type Pt = { x: string; y: number };
export default function ApexAreaNegative({ series, title }: { series: { name: string; data: Pt[] }[]; title?: string }) {
const s = series?.[0]?.data ?? [];
const xs = s.map((p) => p.x);
const ys = s.map((p) => p.y);
const minY = Math.min(0, ...(ys.length ? ys : [0]));
const maxY = Math.max(0, ...(ys.length ? ys : [1]));
const W = 640, H = 300, PAD = 32;
const scaleX = (i: number) => PAD + (i / Math.max(1, xs.length - 1)) * (W - PAD * 2);
const scaleY = (y: number) => H - PAD - ((y - minY) / ((maxY - minY) || 1)) * (H - PAD * 2);


const posPts = s.map((p, i) => ({ x: scaleX(i), y: scaleY(Math.max(0, p.y)) }));
const negPts = s.map((p, i) => ({ x: scaleX(i), y: scaleY(Math.min(0, p.y)) }));
const baselineY = scaleY(0);


const path = (pts: { x: number; y: number }[], toY: number) => {
if (!pts.length) return "";
let d = `M ${pts[0].x} ${toY}`;
for (const pt of pts) d += ` L ${pt.x} ${pt.y}`;
d += ` L ${pts[pts.length - 1].x} ${toY} Z`;
return d;
};


return (
<div>
{title ? <div className="mb-3 text-sm text-slate-300">{title}</div> : null}
<svg
role="img"
aria-label={title || "Area chart"}
width="100%"
height={H}
viewBox={`0 0 ${W} ${H}`}
preserveAspectRatio="xMidYMid meet"
>
<line x1={PAD} y1={baselineY} x2={W - PAD} y2={baselineY} stroke="var(--chart-grid, #475569)" />
<line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--chart-grid, #475569)" />


<path d={path(posPts, baselineY)} fill="var(--chart-pos, #22c55e)" opacity="0.35" />
<path d={path(negPts, baselineY)} fill="var(--chart-neg, #ef4444)" opacity="0.35" />


<polyline
fill="none"
stroke="var(--chart-line, #e5e7eb)"
strokeWidth={2}
points={s.map((p, i) => `${scaleX(i)},${scaleY(p.y)}`).join(" ")}
/>


{xs.map((x, i) => (
<text key={x} x={scaleX(i)} y={H - 8} fontSize={10} textAnchor="middle" fill="var(--chart-label, #94A3B8)">
{x}
</text>
))}
{[minY, 0, maxY].map((y, idx) => (
<text key={idx} x={8} y={scaleY(y)} fontSize={10} fill="var(--chart-label, #94A3B8)">
{y.toFixed(1)}
</text>
))}
</svg>
</div>
);
}