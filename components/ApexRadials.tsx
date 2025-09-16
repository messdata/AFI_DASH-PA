"use client";
import React from "react";


type Item = { label: string; value: number; target: number };


export default function ApexRadials({ items }: { items: Item[] }) {
return (
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
{items.map((it) => (
<Radial key={it.label} {...it} />
))}
</div>
);
}


function Radial({ label, value, target }: Item) {
const pct = Math.max(0, Math.min(1, target ? value / target : 0));
const size = 160;
const stroke = 12;
const r = (size - stroke) / 2;
const c = Math.PI * 2 * r;
const dash = c * pct;


return (
<div className="flex items-center gap-5 rounded-xl border border-white/5 bg-slate-900/40 p-3 backdrop-blur">
<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={label} role="img">
<circle cx={size / 2} cy={size / 2} r={r} stroke="var(--chart-track, #1f2937)" strokeWidth={stroke} fill="none" />
<circle
cx={size / 2}
cy={size / 2}
r={r}
stroke="var(--chart-pos, #22c55e)"
strokeWidth={stroke}
fill="none"
strokeDasharray={`${dash} ${c - dash}`}
strokeLinecap="round"
transform={`rotate(-90 ${size / 2} ${size / 2})`}
/>
<text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize={18} fill="var(--chart-line, #e5e7eb)">
{value.toFixed(1)}
</text>
</svg>
<div>
<div className="text-sm text-slate-300">{label}</div>
<div className="text-xs text-slate-400">Target: {target}</div>
</div>
</div>
);
}