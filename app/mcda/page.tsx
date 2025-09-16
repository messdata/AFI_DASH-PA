// app/mcda/page.tsx
"use client";

import React from "react";
import Papa from "papaparse";

/** 31 Local Authorities (labels used in the table) */
const LA_LIST = [
  "Carlow","Cavan","Clare","Cork City","Cork County","Donegal","Dublin City",
  "Dún Laoghaire–Rathdown","Fingal","South Dublin","Galway City","Galway County",
  "Kerry","Kildare","Kilkenny","Laois","Leitrim","Limerick City and County",
  "Longford","Louth","Mayo","Meath","Monaghan","Offaly","Roscommon",
  "Sligo","Tipperary","Waterford City and County","Westmeath","Wexford","Wicklow",
];

/** Canonical key helper */
const canon = (s: string) =>
  String(s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(county council|city and county|council)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Build a map from canonical key -> LA label */
const KEY_FOR_LA = (() => {
  const m = new Map<string, string>();
  for (const la of LA_LIST) m.set(canon(la), la);
  // Add common county-only keys mapping:
  m.set("cork", "Cork County");
  m.set("galway", "Galway County");
  m.set("waterford", "Waterford City and County");
  m.set("limerick", "Limerick City and County");
  m.set("dublin", "Dublin City"); // if source is county-level “Dublin”, park it on Dublin City to avoid dropping rows
  // Short forms / synonyms
  m.set("dlr", "Dún Laoghaire–Rathdown");
  m.set("dun laoghaire rathdown", "Dún Laoghaire–Rathdown");
  return m;
})();

/** Try best-effort resolution of a raw county/label to our 31 LA labels */
function resolveLA(raw: string): string | null {
  const k = canon(raw);
  if (KEY_FOR_LA.has(k)) return KEY_FOR_LA.get(k)!;
  // try single-word county names directly (capitalised)
  const guess = raw.replace(/\b(\w)(\w*)/g, (_, a, b) => a.toUpperCase() + b.toLowerCase());
  if (LA_LIST.includes(guess)) return guess;
  return null;
}

type HospRow = {
  hospitals_total: number;
  acute_hospitals_count: number;
  hospitals_per_100k_65: number | null;
};
type OutRow = { la: string; score: number; hospitals: number; accessPer100k65?: number|null; share: number; euros: number };

async function fetchBackendScores(payload: {
  budget: number; ruralUplift: number; maxShare: number; minEuro: number; laList: string[];
}): Promise<Record<string, number> | null> {
  try {
    const r = await fetch("/api/mcda/allocate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.scores ?? null;
  } catch { return null; }
}

function allocateBudget(
  scores: Record<string, number>, budget: number,
  opts: { maxShare: number; minEuro: number; ruralUplift: number; ruralSet?: Set<string> }
): Record<string, number> {
  const names = Object.keys(scores);
  const boosted: Record<string, number> = {};
  for (const n of names) {
    const b = Math.max(0, scores[n] ?? 0);
    boosted[n] = (opts.ruralSet?.has(n) ? b * (1 + opts.ruralUplift) : b);
  }
  let total = names.reduce((s,n)=> s + boosted[n], 0);
  const alloc: Record<string, number> = {};
  if (total <= 0) {
    const floors = Math.max(0, opts.minEuro) * names.length;
    const even = Math.max(0, (budget - floors) / names.length);
    for (const n of names) alloc[n] = Math.max(0, opts.minEuro) + Math.max(0, even);
  } else {
    for (const n of names) alloc[n] = (boosted[n] / total) * budget;
    // floor
    let deficit = 0;
    for (const n of names) if (alloc[n] < opts.minEuro) { deficit += (opts.minEuro - alloc[n]); alloc[n] = opts.minEuro; }
    if (deficit > 0) {
      const donors = names.filter(n => alloc[n] > opts.minEuro);
      const pool = donors.reduce((s,n)=> s + (alloc[n] - opts.minEuro), 0) || 1;
      for (const n of donors) alloc[n] -= (alloc[n]-opts.minEuro)/pool * deficit;
    }
    // cap
    const cap = budget * Math.max(0, Math.min(1, opts.maxShare || 1));
    let excess = 0;
    for (const n of names) if (alloc[n] > cap) { excess += (alloc[n]-cap); alloc[n] = cap; }
    if (excess > 0) {
      const receivers = names.filter(n => alloc[n] < cap);
      const wsum = receivers.reduce((s,n)=> s + boosted[n], 0) || receivers.length;
      for (const n of receivers) alloc[n] += (wsum ? boosted[n]/wsum : 1/receivers.length) * excess;
    }
  }
  const sum = Object.values(alloc).reduce((s,v)=> s+v, 0) || 1;
  const k = budget / sum;
  for (const n of names) alloc[n] *= k;
  return alloc;
}

export default function MCDA() {
  // Minimal inputs
  const [budget, setBudget] = React.useState(117_000_000);
  const [ruralUplift, setRuralUplift] = React.useState(0.15);
  const [maxShare, setMaxShare] = React.useState(0.12);
  const [minEuro, setMinEuro] = React.useState(250_000);

  const [hosp, setHosp] = React.useState<Record<string, HospRow>>({});
  const [rows, setRows] = React.useState<OutRow[]>([]);
  const [status, setStatus] = React.useState<{fac:number; matched:number; unmatched:number}|null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Load CSV robustly and map onto 31 LAs
  React.useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await fetch("/data/hospital_access_by_county.csv", { cache: "no-store" });
        if (!res.ok) throw new Error("Missing /data/hospital_access_by_county.csv");
        const text = await res.text();
        const { data, errors } = Papa.parse<Record<string, string | number>>(text, { header: true, skipEmptyLines: true });
        if (errors?.length) throw new Error(errors.map(e => e.message).join("; "));

        const acc: Record<string, HospRow> = {};
        let fac = 0, matched = 0, unmatched = 0;

        for (const r of data) {
          // Case/space-insensitive row access
          const low: Record<string, any> = {};
          for (const [k, v] of Object.entries(r)) low[String(k).toLowerCase().trim()] = v;

          const rawName =
            (low["county"] ?? low["label"] ?? low["local authority"] ?? low["la"] ?? low["area"] ?? "").toString().trim();
          if (!rawName) { unmatched++; continue; }

          const la = resolveLA(rawName);
          if (!la) { unmatched++; continue; }

          matched++;

          // Support multiple numeric header variants
          const hTot = Number(
            low["hospitals_total"] ?? low["total_hospitals"] ?? low["hospitals"] ?? low["sites"] ?? 0
          );
          const hAcute = Number(
            low["acute_hospitals_count"] ?? low["acute"] ?? 0
          );
          const per100k = Number(
            low["hospitals_per_100k_65"] ?? low["access_per_100k_65"] ?? low["access_per_100k"] ?? NaN
          );

          const prev = acc[la] ?? { hospitals_total: 0, acute_hospitals_count: 0, hospitals_per_100k_65: null };
          acc[la] = {
            hospitals_total: (prev.hospitals_total ?? 0) + (Number.isFinite(hTot) ? hTot : 0),
            acute_hospitals_count: (prev.acute_hospitals_count ?? 0) + (Number.isFinite(hAcute) ? hAcute : 0),
            hospitals_per_100k_65:
              Number.isFinite(per100k) && per100k > 0 ? per100k : (prev.hospitals_per_100k_65 ?? null),
          };

          fac++;
        }

        // Ensure all 31 LAs exist (fill zeros)
        for (const la of LA_LIST) acc[la] = acc[la] ?? { hospitals_total: 0, acute_hospitals_count: 0, hospitals_per_100k_65: null };

        setHosp(acc);
        setStatus({ fac, matched, unmatched });
      } catch (e:any) {
        setError(e.message || "Failed to load CSV");
      }
    })();
  }, []);

  // Compute allocations
  React.useEffect(() => {
    (async () => {
      const dubs = new Set(["Dublin City","Fingal","South Dublin","Dún Laoghaire–Rathdown"]);
      const ruralSet = new Set(LA_LIST.filter(la => !dubs.has(la)));

      const server = await fetchBackendScores({ budget, ruralUplift, maxShare, minEuro, laList: LA_LIST });

      // Fallback score: inverse of access/100k (or inverse of site counts)
      const fallback: Record<string, number> = {};
      for (const la of LA_LIST) {
        const r = hosp[la] ?? { hospitals_total: 0, hospitals_per_100k_65: null, acute_hospitals_count: 0 };
        const inv = r.hospitals_per_100k_65 && r.hospitals_per_100k_65 > 0
          ? 1 / r.hospitals_per_100k_65
          : (r.hospitals_total && r.hospitals_total > 0 ? 1 / r.hospitals_total : 0);
        fallback[la] = inv;
      }
      const scores = server ?? fallback;

      const euros = allocateBudget(scores, budget, { maxShare, minEuro, ruralUplift, ruralSet });
      const scoreSum = Object.values(scores).reduce((s,v)=> s + Math.max(0,v), 0) || 1;

      const out: OutRow[] = LA_LIST.map(la => ({
        la,
        score: Math.max(0, (scores[la] ?? 0)) / scoreSum,
        hospitals: Number(hosp[la]?.hospitals_total ?? 0),
        accessPer100k65: hosp[la]?.hospitals_per_100k_65 ?? null,
        share: (euros[la] ?? 0) / Math.max(1, budget),
        euros: euros[la] ?? 0,
      })).sort((a,b)=> b.euros - a.euros);

      setRows(out);
    })();
  }, [hosp, budget, ruralUplift, maxShare, minEuro]);

  const total = rows.reduce((s,r)=> s + r.euros, 0);

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 space-y-6 bg-[#0b1320] text-slate-100">
      <header className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">MCDA — Funding Allocation</h1>
        <div className="text-slate-400 text-sm">Budget: <span className="text-slate-200">€{budget.toLocaleString()}</span></div>
      </header>

      {/* Essential inputs only */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="text-xs text-slate-400">Budget (€)
            <input type="number" className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2"
                   value={budget} onChange={e=>setBudget(Number(e.target.value)||0)} />
          </label>
          <label className="text-xs text-slate-400">Rural uplift (0–25%)
            <input type="number" step={0.01} min={0} max={0.25}
                   className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2"
                   value={ruralUplift} onChange={e=>setRuralUplift(Math.max(0, Math.min(0.25, Number(e.target.value)||0)))} />
          </label>
          <label className="text-xs text-slate-400">Max share per LA (0–1)
            <input type="number" step={0.01} min={0} max={1}
                   className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2"
                   value={maxShare} onChange={e=>setMaxShare(Math.max(0, Math.min(1, Number(e.target.value)||0)))} />
          </label>
          <label className="text-xs text-slate-400">Min € per LA
            <input type="number" step={10000} min={0}
                   className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2"
                   value={minEuro} onChange={e=>setMinEuro(Math.max(0, Number(e.target.value)||0))} />
          </label>
        </div>
        <div className="text-[13px] text-slate-300 mt-3 flex flex-wrap gap-x-4">
          <span>Allocated total: <strong>€{Math.round(total).toLocaleString()}</strong></span>
          {status && (
            <span className="text-slate-400">
              • Hospitals parsed: <strong>{status.fac}</strong> • Matched LAs: <strong>{status.matched}</strong> • Unmatched rows: <strong>{status.unmatched}</strong>
            </span>
          )}
          {error && <span className="text-rose-300">• {error}</span>}
        </div>
      </section>

      {/* Results table */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-slate-300 text-sm mb-3">Allocations (31 LAs, backend score if available; fallback = inverse access)</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 pr-4">Local Authority</th>
                <th className="text-right py-2 pr-4">Score</th>
                <th className="text-right py-2 pr-4">Hospitals</th>
                <th className="text-right py-2 pr-4">Access /100k (65+)</th>
                <th className="text-right py-2 pr-4">% Share</th>
                <th className="text-right py-2">€ Allocation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.la} className="border-b border-slate-800/70 hover:bg-slate-800/40">
                  <td className="py-2 pr-4">{r.la}</td>
                  <td className="py-2 pr-4 text-right">{r.score.toFixed(3)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.hospitals.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{r.accessPer100k65 ? r.accessPer100k65.toFixed(2) : "—"}</td>
                  <td className="py-2 pr-4 text-right">{(r.share * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right font-medium">€{Math.round(r.euros).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
