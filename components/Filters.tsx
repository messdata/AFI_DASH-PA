"use client";
import React from "react";


type Props = {
years: number[];
regions: string[];
selectedYears: number[];
selectedRegions: string[];
onYearsChange: (vals: number[]) => void;
onRegionsChange: (vals: string[]) => void;
};


export default function Filters({ years, regions, selectedYears, selectedRegions, onYearsChange, onRegionsChange }: Props) {
const toggleYear = (y: number) => {
const set = new Set(selectedYears);
set.has(y) ? set.delete(y) : set.add(y);
onYearsChange([...set].sort());
};
const toggleRegion = (r: string) => {
const set = new Set(selectedRegions);
set.has(r) ? set.delete(r) : set.add(r);
onRegionsChange([...set]);
};


const chip = (active: boolean) =>
`rounded-full px-3 py-1.5 text-sm transition border focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ` +
(active
? `bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200 border-cyan-400/40 shadow-sm`
: `text-slate-200/90 border-slate-600/60 hover:bg-slate-800/60`);


return (
<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
<div className="rounded-2xl border border-white/5 bg-slate-900/40 p-3 sm:p-4 backdrop-blur">
<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Years</div>
<div className="flex flex-wrap gap-2">
{years.map((y) => (
<button
key={y}
onClick={() => toggleYear(y)}
className={chip(selectedYears.includes(y))}
aria-pressed={selectedYears.includes(y)}
>
{y}
</button>
))}
</div>
</div>


<div className="rounded-2xl border border-white/5 bg-slate-900/40 p-3 sm:p-4 backdrop-blur">
<div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">NUTS3 Regions</div>
<div className="flex max-h-60 flex-wrap gap-2 overflow-auto pr-1">
{regions.map((r) => (
<button
key={r}
onClick={() => toggleRegion(r)}
className={chip(selectedRegions.includes(r))}
aria-pressed={selectedRegions.includes(r)}
title={r}
>
{r}
</button>
))}
</div>
</div>
</div>
);
}