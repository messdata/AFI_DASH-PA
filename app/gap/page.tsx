"use client";

// app/gap/page.tsx — GAP view + Labour‑force KPIs (M1–M3)
// Style/layout matches your current glass theme. Data & charts remain intact.
// Added: CSO labour‑force loader, ESRI 65+/85+ aggregator, and Support Capacity KPI strip.

import React, { useMemo, useState, useEffect, useCallback } from "react";
import Filters from "@/components/Filters";
import MapLibreLA from "@/components/MapLibreLA";
import GapRadials from "@/components/ApexRadials";
import GapTreemap from "@/components/ApexTreemap";
import GapAreaNegative from "@/components/ApexAreaNegative";
import { useGapData, computeAvgGapForYears } from "@/lib/useGapData";
import { ALL_REGIONS, RegionKey, toDisplayLabel, countiesForRegion, countyToRegion } from "@/lib/regionAdapter";
import Papa from "papaparse";

// ---- Config
const GEOJSON_PATH = "/data/la_boundaries.geojson";
const GEO_NAME_FIELD = "ENG_NAME_VALUE";
const ESRI_POP_CSVS = ["/data/PopLAPro_2050.csv", "/data/PopLAPro.csv"]; // LA × age × scenario × years
const CSO_LF_CSVS = [
  "/data/Actual and Projected Labour Force from 2022.csv",
  "/data/Projected Labour Force from 2022.csv",
  "/data/Labour Force Projections 2023-2057.csv",
];

type Domain = "health" | "residence";

type PopAgg = { countyKey: string; countyRaw: string; year: number; scenario: string; pop65: number; pop85: number };
interface LfRow { regionLabel: string; year: number; scenario: string; labour: number; share60?: number }

export default function GapPage() {
  const allYears = [2022, 2026, 2031, 2040];
  const [selectedYears, setSelectedYears] = useState<number[]>([2031]);
  const [selectedRegionLabels, setSelectedRegionLabels] = useState<string[]>(ALL_REGIONS.map(toDisplayLabel));
  const [domain, setDomain] = useState<Domain>("health");

  // New: scenario for CSO labour‑force + ESRI scenario for pop bands
  const [csoScenario, setCsoScenario] = useState<string>("M2");
  const [esriScenario, setEsriScenario] = useState<string>("Business as Usual");

  const year = String(selectedYears?.[0] ?? 2031);

  const { loading, err, matrix } = useGapData({ year, regionLabels: selectedRegionLabels, domain });

  // ---------- ESRI population: aggregate 65+/85+ by LA → Region ----------
  const [popAgg, setPopAgg] = useState<PopAgg[]>([]);
  const [esriScenarios, setEsriScenarios] = useState<string[]>([]);

  // ---------- CSO Labour force (M1–M3) ----------
  const [lfRows, setLfRows] = useState<LfRow[]>([]);
  const [csoScenarios, setCsoScenarios] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      // helpers
      const strip = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const canonCounty = (s: string) => {
        const x = strip(String(s || "").toLowerCase())
          .replace(/\bcounty\s+council\b/g, "")
          .replace(/\bcity\s+and\s+county\b/g, "")
          .replace(/\bcouncil\b/g, "")
          .replace(/\band\b/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (x.endsWith(" city and county")) return x.slice(0, -" city and county".length);
        if (x.endsWith(" county")) return x.slice(0, -" county".length);
        return x;
      };
      const fetchFirst = async (paths: string[]) => {
        for (const p of paths) {
          try { const r = await fetch(p, { cache: "no-store" }); if (r.ok) return await r.text(); } catch {}
        }
        return null;
      };
      const parse = <T,>(t: string | null): T[] => (t ? Papa.parse<T>(t, { header: true, skipEmptyLines: true }).data as T[] : []);

      // ESRI population
      const esriText = await fetchFirst(ESRI_POP_CSVS);
      const esriRaw = parse<Record<string, string | number>>(esriText);
      const popLong: { countyKey: string; countyRaw: string; year: number; scenario: string; age: number | null; value: number }[] = [];
      if (esriRaw.length) {
        const sample = esriRaw.find(Boolean) || {};
        const yearCols = Object.keys(sample).filter((k) => /^(year_)?\d{4}$/i.test(k));
        for (const r of esriRaw) {
          const bag: Record<string, any> = {}; for (const [k, v] of Object.entries(r)) bag[k.toLowerCase()] = v;
          const laRaw = (bag["local authority"] ?? bag["local_authority"] ?? bag["la"] ?? bag["county"] ?? "").toString().trim();
          const scen = (bag["scenario"] ?? bag["esri_scenario"] ?? "").toString().trim();
          let age: number | null = null; const ageRaw = bag["age"]; if (ageRaw !== undefined && ageRaw !== null && String(ageRaw).trim() !== "") { const m = String(ageRaw).trim().match(/^(\d+)/); age = m ? Number(m[1]) : Number(ageRaw); if (!Number.isFinite(age)) age = null; }
          for (const yc of yearCols) {
            const y = Number(String(yc).replace(/^year_/i, "")); const val = Number((r as any)[yc]);
            if (!laRaw || !scen || !Number.isFinite(y) || !Number.isFinite(val)) continue;
            popLong.push({ countyKey: canonCounty(laRaw), countyRaw: laRaw, year: y, scenario: scen, age, value: val });
          }
        }
        const aggMap = new Map<string, PopAgg>();
        for (const p of popLong) {
          const key = `${p.countyKey}|${p.year}|${p.scenario}`;
          const row = aggMap.get(key) ?? { countyKey: p.countyKey, countyRaw: p.countyRaw, year: p.year, scenario: p.scenario, pop65: 0, pop85: 0 };
          const in65 = (p.age ?? -1) >= 65; const in85 = (p.age ?? -1) >= 85;
          if (in65) row.pop65 += p.value; if (in85) row.pop85 += p.value; aggMap.set(key, row);
        }
        const agg = Array.from(aggMap.values());
        setPopAgg(agg);
        setEsriScenarios(Array.from(new Set(agg.map((a) => a.scenario))).sort());
      }

      // CSO Labour force
      const lfText = await fetchFirst(CSO_LF_CSVS);
      const lfRaw = parse<Record<string, string | number>>(lfText);
      const lf: LfRow[] = [];
      for (const r of lfRaw) {
        const bag: Record<string, any> = {}; for (const [k, v] of Object.entries(r)) bag[k.toLowerCase()] = v;
        const region = (bag["region"] ?? bag["nuts3"] ?? bag["label"] ?? bag["nuts3 region"] ?? "").toString().trim();
        const year = Number(bag["year"] ?? bag["yr"]);
        const scen = (bag["scenario"] ?? bag["cso_scenario"] ?? bag["assumption"] ?? "").toString().trim() || "M2";
        const labour = Number(bag["labourforce"] ?? bag["labour_force"] ?? bag["labour"] ?? bag["lf"]);
        const share60 = Number(bag["share60plus"] ?? bag["lf_60plus_share"] ?? bag["share_60plus"]);
        if (!region || !Number.isFinite(year) || !Number.isFinite(labour)) continue;
        lf.push({ regionLabel: region, year, scenario: scen, labour, share60: Number.isFinite(share60) ? share60 : undefined });
      }
      setLfRows(lf);
      setCsoScenarios(Array.from(new Set(lf.map((a) => a.scenario))).sort());
    })();
  }, []);

  // ---------- Support capacity KPIs ----------
  const baseYear = useMemo(() => selectedYears.length ? Math.min(...selectedYears) : Number(year), [selectedYears, year]);
  const latestYear = useMemo(() => selectedYears.length ? Math.max(...selectedYears) : Number(year), [selectedYears, year]);

  const kpi = useMemo(() => {
    const regs = selectedRegionLabels.length ? selectedRegionLabels : ALL_REGIONS.map(toDisplayLabel);

    // Labour force — sum across selected regions (selected CSO scenario)
    let lfBase = 0, lfLast = 0, share60Sum = 0, share60N = 0;
    for (const lbl of regs) {
      const base = lfRows.find((d) => d.regionLabel === lbl && d.scenario === csoScenario && d.year === baseYear)?.labour;
      const last = lfRows.find((d) => d.regionLabel === lbl && d.scenario === csoScenario && d.year === latestYear)?.labour;
      if (Number.isFinite(base)) lfBase += base as number; if (Number.isFinite(last)) lfLast += last as number;
      const s60 = lfRows.find((d) => d.regionLabel === lbl && d.scenario === csoScenario && d.year === latestYear)?.share60;
      if (Number.isFinite(s60)) { share60Sum += s60 as number; share60N++; }
    }

    // 65+ / 85+ — sum across selected regions (selected ESRI scenario)
    const regOf = (ck: string) => toDisplayLabel(countyToRegion(ck as any) as RegionKey);
    const regYearPop = (year: number, band: 65 | 85) => {
      const m = new Map<string, number>();
      for (const r of popAgg) {
        if (r.scenario !== esriScenario || r.year !== year) continue;
        const lbl = regOf(r.countyKey);
        const v = band === 65 ? r.pop65 : r.pop85;
        m.set(lbl, (m.get(lbl) ?? 0) + v);
      }
      let sum = 0; for (const lbl of regs) sum += m.get(lbl) ?? 0; return sum;
    };
    const pop65Base = regYearPop(baseYear, 65); const pop65Last = regYearPop(latestYear, 65);
    const pop85Base = regYearPop(baseYear, 85); const pop85Last = regYearPop(latestYear, 85);

    const workersPer65 = pop65Last ? (lfLast / pop65Last) : 0;
    const workersPer85 = pop85Last ? (lfLast / pop85Last) : 0;
    const lfDeltaPct = lfBase ? ((lfLast - lfBase) / lfBase) * 100 : 0;
    const share60 = share60N ? (share60Sum / share60N) : undefined;

    return {
      workersPer65: Number.isFinite(workersPer65) ? workersPer65 : 0,
      workersPer85: Number.isFinite(workersPer85) ? workersPer85 : 0,
      labourK: lfLast / 1000,
      lfDeltaPct: Number.isFinite(lfDeltaPct) ? Math.round(lfDeltaPct) : 0,
      share60
    };
  }, [selectedRegionLabels, ALL_REGIONS, lfRows, csoScenario, baseYear, latestYear, popAgg, esriScenario]);

  // ---------- Existing visuals ----------
  const radials = useMemo(() => {
    const make = (d: Domain) => {
      const rows = matrix.filter(r => r.domain === d);
      const avgSupply = rows.length ? rows.reduce((s,r)=> s + r.supply, 0) / rows.length : 0;
      const target = d === "health" ? 10 : 30;
      const label = d === "health" ? "GP /10k (65+)" : "Beds /1k (65+)";
      return { label, value: avgSupply, target };
    };
    return [make("health"), make("residence")];
  }, [matrix]);

  const treemapPts = useMemo(() => matrix.filter(r => r.domain === domain && Number.isFinite(r.gap)).map(r => ({ label: r.region, value: r.gap })), [matrix, domain]);

  const [areaSeries, setAreaSeries] = useState<{ name: string; data: { x: string; y: number }[] }[]>([]);
  useEffect(() => { const years = selectedYears.map(String); const regions = selectedRegionLabels; const run = async () => { const data = await computeAvgGapForYears(years, regions, domain); setAreaSeries([{ name: domain === "health" ? "GP gap" : "Beds gap", data }]); }; run(); }, [selectedYears, selectedRegionLabels, domain]);

  // ---------- Map rows (unchanged logic for highlighting selected regions) ----------
  const selectedRegionKeys: RegionKey[] = useMemo(() => ALL_REGIONS.filter(k => selectedRegionLabels.includes(toDisplayLabel(k))), [selectedRegionLabels]);
  const selectedCountyKeys = useMemo(() => { const set = new Set<string>(); selectedRegionLabels.forEach((r) => (countiesForRegion(r as any) ?? []).forEach((ck) => set.add(ck))); return Array.from(set); }, [selectedRegionLabels]);
  const selectionColors = useMemo(() => { const out: Record<string,string> = {}; selectedCountyKeys.forEach((ck) => out[ck] = "#f59e0b"); return out; }, [selectedCountyKeys]);
  const mapRows = useMemo(() => selectedCountyKeys.map((ck) => ({ LA: ck, value: 0 })), [selectedCountyKeys]);

  const onCountyClick = useCallback((featureName: string) => {
    const ck = featureName; // Map component canonicalizes internally
    const reg = countyToRegion(ck as any); if (!reg) return; const lbl = toDisplayLabel(reg);
    setSelectedRegionLabels((prev) => prev.includes(lbl) ? prev.filter((x) => x !== lbl) : [...prev, lbl]);
  }, []);

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-3xl border border-slate-700/50 bg-slate-800/30 p-5 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-xl">

          {/* Header */}
          <header className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">GAP (Need vs Supply)</h1>
              <p className="text-slate-300 text-sm mt-1">
                {domain === "health" ? "Health providers — GP sites per 10k (65+)" : "Residences — LTC beds per 1k (65+)"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-xl border border-slate-600/60 bg-slate-900/40 p-1">
                {(["health","residence"] as Domain[]).map(d => (
                  <button key={d} onClick={()=>setDomain(d)} className={`px-3 py-2 text-sm rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${domain===d?"bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200 border border-cyan-400/40":"text-slate-200 hover:bg-slate-800/60 border border-transparent"}`} aria-pressed={domain===d}>{d==="health" ? "Health (GP)" : "Residence (Beds)"}</button>
                ))}
              </div>
              <div className="inline-flex rounded-xl border border-slate-600/60 bg-slate-900/40 p-1">
                <label className="sr-only" htmlFor="cso-scen">CSO scenario</label>
                {(["M1","M2","M3"] as string[]).map(s => (
                  <button key={s} onClick={()=>setCsoScenario(s)} className={`px-3 py-2 text-sm rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${csoScenario===s?"bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200 border border-cyan-400/40":"text-slate-200 hover:bg-slate-800/60 border border-transparent"}`} aria-pressed={csoScenario===s}>{s}</button>
                ))}
              </div>
              {esriScenarios.length ? (
                <div className="inline-flex rounded-xl border border-slate-600/60 bg-slate-900/40 p-1">
                  {esriScenarios.map(s => (
                    <button key={s} onClick={()=>setEsriScenario(s)} className={`px-3 py-2 text-sm rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${esriScenario===s?"bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200 border border-cyan-400/40":"text-slate-200 hover:bg-slate-800/60 border border-transparent"}`} aria-pressed={esriScenario===s}>{s}</button>
                  ))}
                </div>
              ) : null}
            </div>
          </header>

          {/* Filters */}
          <section className="mb-5 rounded-2xl border border-white/5 bg-slate-900/40 p-3 sm:p-4 backdrop-blur">
            <Filters years={allYears} regions={ALL_REGIONS.map(toDisplayLabel)} selectedYears={selectedYears} selectedRegions={selectedRegionLabels} onYearsChange={setSelectedYears} onRegionsChange={setSelectedRegionLabels} />
          </section>

          {/* Support Capacity KPIs (new) */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <KCard title="Workers per 65+" value={kpi.workersPer65 ? kpi.workersPer65.toFixed(2) : "—"} suffix="" />
            <KCard title="Workers per 85+" value={kpi.workersPer85 ? kpi.workersPer85.toFixed(2) : "—"} suffix="" />
            <KCard title="Labour force (k)" value={Number.isFinite(kpi.labourK) ? Math.round(kpi.labourK).toString() : "—"} />
            <KCard title="LF Δ vs base" value={`${Number.isFinite(kpi.lfDeltaPct) ? kpi.lfDeltaPct : 0}%`} />
            <KCard title="% LF aged 60+" value={kpi.share60 !== undefined ? `${(kpi.share60 * 100).toFixed(1)}%` : "—"} />
          </section>

          {/* Existing content */}
          {loading && <div className="text-slate-300 text-sm">Computing gaps…</div>}
          {err && <div className="text-red-400 text-sm">Error: {err}</div>}

          {!loading && !err && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 shadow-inner backdrop-blur">
                <GapRadials items={radials} />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 shadow-inner backdrop-blur">
                  <GapTreemap items={treemapPts} title={`Region spread — ${domain === "health" ? "GP per 10k (65+)" : "Beds per 1k (65+)"} | gap vs target`} />
                </div>

                <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 shadow-inner backdrop-blur">
                  <GapAreaNegative series={areaSeries} title={`Trend — ${domain === "health" ? "GP gap" : "Beds gap"} (selected years)`} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 shadow-inner backdrop-blur">
                <div className="text-slate-200 text-sm mb-2">Map — selected regions</div>
                <div className="rounded-xl overflow-hidden h-[420px] bg-slate-950/70">
                  <MapLibreLA rows={mapRows} geojsonPath={GEOJSON_PATH} nameField={GEO_NAME_FIELD} selectedCounties={selectedCountyKeys} selectionColors={selectionColors} onFeatureClick={onCountyClick} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function KCard({ title, value, suffix }: { title: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 sm:p-4 backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}{suffix ?? ""}</div>
    </div>
  );
}
