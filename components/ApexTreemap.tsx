"use client";
import React, { useMemo } from "react";


export default function ApexTreemap({ items, title }: { items: { label: string; value: number }[]; title?: string }) {
const data = useMemo(() => {
const vals = items.map((i) => Math.abs(i.value));
const total = vals.reduce((s, v) => s + v, 0) || 1;
return items.map((i) => ({ ...i, w: Math.max(0.05, Math.abs(i.value) / total) }));
}, [items]);


const W = 640, H = 320, PAD = 4;
let x = PAD;
const boxes = data.map((d) => {
const w = (W - PAD * 2) * d.w;
const h = H - PAD * 2;
const rect = { x, y: PAD, w, h };
x += w;
return { d, rect };
});


const color = (v: number) => (v >= 0 ? "var(--chart-pos, #22c55e)" : "var(--chart-neg, #ef4444)");


return (
<div>
{title ? <div className="mb-3 text-sm text-slate-300">{title}</div> : null}
<svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={title || "Treemap"}>
{boxes.map(({ d, rect }) => (
<g key={d.label}>
<rect x={rect.x} y={rect.y} width={rect.w - 2} height={rect.h - 2} fill={color(d.value)} opacity={0.75} rx={14} />
<text x={rect.x + 10} y={rect.y + 22} fontSize={12} fill="var(--chart-ink, #0b1020)">{d.label}</text>
<text x={rect.x + 10} y={rect.y + 40} fontSize={12} fill="var(--chart-ink, #0b1020)">{d.value.toFixed(1)}</text>
</g>
))}
</svg>
</div>
);
}