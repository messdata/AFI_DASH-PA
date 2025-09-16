"use client";

/**
 * app/demand/page.tsx — Demand Page built per the provided method plan
 *
 * Data used (files expected in /public/data):
 *  - ESRI:    PopLAPro_2050.csv (or PopLAPro.csv)
 *  - CSO:     Projected Dependency Ratios from 2022.csv (or Projected Dependency Ratios.csv)
 *  - CSO:     Projected Annual Births and Deaths.csv
 *  - Census:  disabilty.csv (or disability.csv) — % with long-lasting condition, 65+
 *
 * This page:
 *  - Loads & normalizes data
 *  - Aggregates 65+/85+ headcounts per LA/Region×Year×Scenario
 *  - Reads OADR/TDR (M1–M3) as-is
 *  - Computes natural increase (births − deaths)
 *  - Wires Filters + KPI tiles + Trends + Heatmap + Scatter + Map
 *  - Plain background (no particles), glass cards for layout
 */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Papa from "papaparse";

import Filters from "@/components/Filters";
import KPI from "@/components/KPI";
import DemandTrends from "@/components/DemandTrends";
import HeatmapMatrix from "@/components/HeatmapMatrix";
import OADRScatter from "@/components/OADRScatter";
import MapLibreLA from "@/components/MapLibreLA";

import {
  ALL_REGIONS,
  RegionKey,
  toDisplayLabel,
  regionKeyFromLabel,
  countiesForRegion,
  countyToRegion,
} from "@/lib/regionAdapter";

// ------------------------------ Config ------------------------------
const GEOJSON_PATH = "/data/la_boundaries.geojson";
const GEO_NAME_FIELD = "ENG_NAME_VALUE";

const ESRI_POP_CSVS = ["/data/PopLAPro_2050.csv", "/data/PopLAPro.csv"]; // LA × age × scenario × years
const CSO_DEP_CSVS = [
  "/data/Projected Dependency Ratios from 2022.csv",
  "/data/Projected Dependency Ratios.csv",
];
const CSO_NAT_INC_CSVS = ["/data/Projected Annual Births and Deaths.csv"]; // births & deaths
const DISABILITY_CSVS = ["/data/disabilty.csv", "/data/disability.csv"]; // Census 2022 65+

// Toggleable map metric
type MapMetric = "headcount65" | "oadr" | "disability";

// ------------------------------ Utils ------------------------------
function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function canonCounty(s: string) {
  const x = stripDiacritics(String(s || "").toLowerCase())
    .replace(/\bcounty\s+council\b/g, "")
    .replace(/\bcity\s+and\s+county\b/g, "")
    .replace(/\bcouncil\b/g, "")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (x.endsWith(" city and county")) return x.slice(0, -" city and county".length);
  if (x.endsWith(" county")) return x.slice(0, -" county".length);
  return x;
}
function titleCaseCounty(raw: string) {
  return String(raw || "").replace(/\b(CITY|COUNTY)\s+COUNCIL\b/gi, "").replace(/\s{2,}/g, " ").trim().replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
}
async function fetchFirst(paths: string[]) {
  for (const p of paths) {
    try { const r = await fetch(p, { cache: "no-store" }); if (r.ok) return await r.text(); } catch {}
  }
  return null;
}
function parseCSV<T = Record<string, string>>(text: string | null): T[] {
  if (!text) return [] as T[];
  const { data } = Papa.parse<T>(text, { header: true, skipEmptyLines: true });
  return data as T[];
}

// ------------------------------ Types ------------------------------
// ESRI population long row after normalization
interface PopRow { countyKey: string; countyRaw: string; scenario: string; year: number; age: number | null; value: number }
// Aggregated headcounts per LA×Year×Scenario
interface PopAgg { countyKey: string; countyRaw: string; year: number; scenario: string; pop65: number; pop85: number }
// OADR/TDR by Region×Year×CSO Scenario (M1–M3)
interface DepRow { regionLabel: string; year: number; csoScenario: string; OADR?: number; TDR?: number }
// Natural increase by LA×Year
interface NatRow { countyKey: string; year: number; births: number; deaths: number; naturalIncrease: number }
// Disability % (65+) by LA
interface DisRow { countyKey: string; pct65: number }

// ------------------------------ Component ------------------------------
export default function DemandPage() {
  // UI state
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedRegionLabels, setSelectedRegionLabels] = useState<string[]>(ALL_REGIONS.map(toDisplayLabel));
  const [esriScenario, setEsriScenario] = useState<string>("Business as Usual");
  const [csoScenario, setCsoScenario] = useState<string>("M2");
  const [mapMetric, setMapMetric] = useState<MapMetric>("headcount65");

  // Loading state
  const [status, setStatus] = useState<string>("Loading datasets…");
  const [error, setError] = useState<string | null>(null);

  // Raw CSVs → normalized
  const [popAgg, setPopAgg] = useState<PopAgg[]>([]);
  const [depRows, setDepRows] = useState<DepRow[]>([]);
  const [natRows, setNatRows] = useState<NatRow[]>([]);
  const [disRows, setDisRows] = useState<DisRow[]>([]);

  // ---- Load & transform all datasets once ----
  useEffect(() => {
    (async () => {
      try {
        setError(null); setStatus("Loading datasets…");

        // ESRI population
        const esriText = await fetchFirst(ESRI_POP_CSVS);
        const esriRaw = parseCSV<Record<string, string | number>>(esriText);

        // CSO dependency ratios
        const depText = await fetchFirst(CSO_DEP_CSVS);
        const depRaw = parseCSV<Record<string, string | number>>(depText);

        // CSO births & deaths
        const natText = await fetchFirst(CSO_NAT_INC_CSVS);
        const natRaw = parseCSV<Record<string, string | number>>(natText);

        // Disability snapshot
        const disText = await fetchFirst(DISABILITY_CSVS);
        const disRaw = parseCSV<Record<string, string | number>>(disText);

        // --- Transform ESRI population ---
        const popLong: PopRow[] = [];
        if (esriRaw.length) {
          const sample = esriRaw.find(Boolean) || {};
          const yearCols = Object.keys(sample).filter((k) => /^(year_)?\d{4}$/i.test(k));
          for (const r of esriRaw) {
            const bag: Record<string, any> = {};
            for (const [k, v] of Object.entries(r)) bag[k.toLowerCase()] = v;
            const laRaw = (bag["local authority"] ?? bag["local_authority"] ?? bag["la"] ?? bag["county"] ?? "").toString().trim();
            const scenario = (bag["scenario"] ?? bag["esri_scenario"] ?? "").toString().trim();
            let age: number | null = null;
            const ageRaw = bag["age"] ?? bag["age_band"];
            if (ageRaw !== undefined && ageRaw !== null && String(ageRaw).trim() !== "") {
              const m = String(ageRaw).trim().match(/^(\d+)/); age = m ? Number(m[1]) : Number(ageRaw); if (!Number.isFinite(age)) age = null;
            }
            for (const yc of yearCols) {
              const y = Number(String(yc).replace(/^year_/i, ""));
              const val = Number((r as any)[yc]);
              if (!laRaw || !scenario || !Number.isFinite(y) || !Number.isFinite(val)) continue;
              popLong.push({ countyKey: canonCounty(laRaw), countyRaw: laRaw, scenario, year: y, age, value: val });
            }
          }
        }
        // Aggregate 65+ / 85+
        const aggMap = new Map<string, PopAgg>();
        for (const p of popLong) {
          const key = `${p.countyKey}|${p.year}|${p.scenario}`;
          const row = aggMap.get(key) ?? { countyKey: p.countyKey, countyRaw: p.countyRaw, year: p.year, scenario: p.scenario, pop65: 0, pop85: 0 };
          const in65 = (p.age ?? -1) >= 65;
          const in85 = (p.age ?? -1) >= 85;
          if (in65) row.pop65 += p.value;
          if (in85) row.pop85 += p.value;
          aggMap.set(key, row);
        }
        const agg = Array.from(aggMap.values());

        // Years & default scenario bootstrapping
        const distinctYears = Array.from(new Set(agg.map((r) => r.year))).sort((a, b) => a - b);
        if (!selectedYears.length && distinctYears.length) {
          setSelectedYears([distinctYears[0], distinctYears[distinctYears.length - 1]]); // base + latest
        }
        if (!agg.length) throw new Error("No population data parsed from ESRI file(s).");

        // --- Transform CSO dependency ---
        const dep: DepRow[] = [];
        for (const r of depRaw) {
          const bag: Record<string, any> = {}; for (const [k, v] of Object.entries(r)) bag[k.toLowerCase()] = v;
          const region = (bag["region"] ?? bag["nuts3"] ?? bag["label"] ?? "").toString().trim();
          const year = Number(bag["year"] ?? bag["yr"]);
          const scen = (bag["scenario"] ?? bag["cso_scenario"] ?? bag["assumption"] ?? "").toString().trim() || "M2";
          const oadr = Number(bag["oadr"] ?? bag["old_age_dependency_ratio"]);
          const tdr = Number(bag["tdr"] ?? bag["total_dependency_ratio"]);
          if (!region || !Number.isFinite(year)) continue;
          dep.push({ regionLabel: region, year, csoScenario: scen, OADR: Number.isFinite(oadr) ? oadr : undefined, TDR: Number.isFinite(tdr) ? tdr : undefined });
        }

        // --- Transform natural increase ---
        const nat: NatRow[] = [];
        for (const r of natRaw) {
          const bag: Record<string, any> = {}; for (const [k, v] of Object.entries(r)) bag[k.toLowerCase()] = v;
          const laRaw = (bag["local authority"] ?? bag["county"] ?? bag["la"] ?? "").toString().trim();
          const year = Number(bag["year"] ?? bag["yr"]);
          const births = Number(bag["births"] ?? bag["projected_births"]);
          const deaths = Number(bag["deaths"] ?? bag["projected_deaths"]);
          if (!laRaw || !Number.isFinite(year)) continue;
          nat.push({ countyKey: canonCounty(laRaw), year, births: Number.isFinite(births) ? births : 0, deaths: Number.isFinite(deaths) ? deaths : 0, naturalIncrease: (Number.isFinite(births) ? births : 0) - (Number.isFinite(deaths) ? deaths : 0) });
        }

        // --- Transform disability (Census 2022) ---
        const dis: DisRow[] = [];
        for (const r of disRaw) {
          const bag: Record<string, any> = {}; for (const [k, v] of Object.entries(r)) bag[k.toLowerCase()] = v;
          const laRaw = (bag["local authority"] ?? bag["county"] ?? bag["la"] ?? "").toString().trim();
          const pct65 = Number(bag["pct_65plus"] ?? bag["65+_%"] ?? bag["percent_65plus"]);
          if (!laRaw || !Number.isFinite(pct65)) continue;
          dis.push({ countyKey: canonCounty(laRaw), pct65 });
        }

        setPopAgg(agg);
        setDepRows(dep);
        setNatRows(nat);
        setDisRows(dis);
        setStatus("Loaded");
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Distinct lists
  const allYears = useMemo(() => Array.from(new Set(popAgg.map((r) => r.year))).sort((a, b) => a - b), [popAgg]);
  const esriScenarios = useMemo(() => Array.from(new Set(popAgg.map((r) => r.scenario))).sort(), [popAgg]);
  const csoScenarios = useMemo(() => Array.from(new Set(depRows.map((r) => r.csoScenario))).sort(), [depRows]);

  // Base/latest years from current selection
  const baseYear = useMemo(() => (selectedYears.length ? Math.min(...selectedYears) : allYears[0]), [selectedYears, allYears]);
  const latestYear = useMemo(() => (selectedYears.length ? Math.max(...selectedYears) : allYears[allYears.length - 1]), [selectedYears, allYears]);

  // County selections derived from selected regions
  const selectedCountyKeys = useMemo(() => {
    const set = new Set<string>();
    (selectedRegionLabels ?? []).forEach((r) => (countiesForRegion(r as any) ?? []).forEach((ck) => set.add(ck)));
    return Array.from(set);
  }, [selectedRegionLabels]);

  // -------------- Aggregates for charts & KPIs --------------
  // County→Region mapping for ESRI agg rows
  const regionYearTotals = useMemo(() => {
    const out = new Map<string, number>(); // key: regionLabel|year → pop65 (selected scenario)
    for (const r of popAgg) {
      if (r.scenario !== esriScenario) continue;
      const reg = countyToRegion(r.countyKey as any);
      if (!reg) continue;
      const lbl = toDisplayLabel(reg);
      const k = `${lbl}|${r.year}`;
      out.set(k, (out.get(k) ?? 0) + r.pop65);
    }
    return out;
  }, [popAgg, esriScenario]);

  // Trend series: 65+ headcount over time for selected regions
  const trendSeries = useMemo(() => {
    return (selectedRegionLabels.length ? selectedRegionLabels : ALL_REGIONS.map(toDisplayLabel)).map((lbl) => ({
      label: lbl,
      points: allYears.map((y) => ({ x: y, y: regionYearTotals.get(`${lbl}|${y}`) ?? 0 }))
    }));
  }, [selectedRegionLabels, ALL_REGIONS, allYears, regionYearTotals]);

  // Heatmap values: growth % vs baseYear
  const heatmapGet = useCallback((label: string, yr: number) => {
    const base = regionYearTotals.get(`${label}|${baseYear}`) ?? 0;
    const val = regionYearTotals.get(`${label}|${yr}`) ?? 0;
    if (!base) return 0;
    return Math.round(((val - base) / base) * 100);
  }, [regionYearTotals, baseYear]);

  // Scatter: 65+ growth % (ESRI) vs OADR (CSO) at latestYear
  const oadrByRegionAtLatest = useMemo(() => {
    const idx = depRows.filter((d) => d.csoScenario === csoScenario && d.year === latestYear);
    const m = new Map<string, number>();
    for (const d of idx) if (Number.isFinite(d.OADR)) m.set(d.regionLabel, d.OADR as number);
    return m; // key: region label in CSV
  }, [depRows, csoScenario, latestYear]);

  const scatterPoints = useMemo(() => {
    const regs = selectedRegionLabels.length ? selectedRegionLabels : ALL_REGIONS.map(toDisplayLabel);
    return regs.map((lbl) => {
      const base = regionYearTotals.get(`${lbl}|${baseYear}`) ?? 0;
      const val = regionYearTotals.get(`${lbl}|${latestYear}`) ?? 0;
      const g = base ? ((val - base) / base) * 100 : 0;
      // resolve OADR label mismatches by trying CSV label and display label
      const oadr = oadrByRegionAtLatest.get(lbl) ?? oadrByRegionAtLatest.get(lbl.toUpperCase()) ?? oadrByRegionAtLatest.get(lbl.toLowerCase());
      return { label: lbl, x: Number.isFinite(oadr) ? (oadr as number) : 0, y: Math.round(g) };
    });
  }, [selectedRegionLabels, ALL_REGIONS, baseYear, latestYear, regionYearTotals, oadrByRegionAtLatest]);

  // KPIs over the current region selection
  const kpi = useMemo(() => {
    const regs = selectedRegionLabels.length ? selectedRegionLabels : ALL_REGIONS.map(toDisplayLabel);
    let baseSum65 = 0, lastSum65 = 0, baseSum85 = 0, lastSum85 = 0;
    for (const lbl of regs) {
      baseSum65 += regionYearTotals.get(`${lbl}|${baseYear}`) ?? 0;
      lastSum65 += regionYearTotals.get(`${lbl}|${latestYear}`) ?? 0;
    }
    // 85+ (from county rows)
    const regionYearTotals85 = new Map<string, number>();
    for (const r of popAgg) {
      if (r.scenario !== esriScenario) continue; const reg = countyToRegion(r.countyKey as any); if (!reg) continue;
      const lbl = toDisplayLabel(reg); const k = `${lbl}|${r.year}`; regionYearTotals85.set(k, (regionYearTotals85.get(k) ?? 0) + r.pop85);
    }
    for (const lbl of regs) {
      baseSum85 += regionYearTotals85.get(`${lbl}|${baseYear}`) ?? 0;
      lastSum85 += regionYearTotals85.get(`${lbl}|${latestYear}`) ?? 0;
    }
    const growthPct65 = baseSum65 ? Math.round(((lastSum65 - baseSum65) / baseSum65) * 100) : 0;
    const growthPct85 = baseSum85 ? Math.round(((lastSum85 - baseSum85) / baseSum85) * 100) : 0;

    // OADR: average across selected regions (latestYear, selected CSO scenario)
    let oadrSum = 0, oadrN = 0;
    for (const lbl of regs) { const v = oadrByRegionAtLatest.get(lbl); if (Number.isFinite(v)) { oadrSum += v as number; oadrN++; } }
    const oadr_ratio = oadrN ? Number((oadrSum / oadrN).toFixed(2)) : 0;

    const proj65_latest = lastSum65;
    const delta65_fromBase = lastSum65 - baseSum65;

    return { growthPct65, growthPct85, oadr_ratio, proj65_latest, delta65_fromBase, latestYear };
  }, [selectedRegionLabels, ALL_REGIONS, regionYearTotals, baseYear, latestYear, popAgg, esriScenario, oadrByRegionAtLatest]);

  // -------------- Map data --------------
  type MapRow = { LA: string; value: number };
  const selectionColors = useMemo(() => { const out: Record<string, string> = {}; selectedCountyKeys.forEach((ck) => (out[ck] = "#22c55e")); return out; }, [selectedCountyKeys]);

  const mapRows: MapRow[] = useMemo(() => {
    if (mapMetric === "disability") {
      return disRows.map((d) => ({ LA: d.countyKey, value: d.pct65 }));
    }
    if (mapMetric === "oadr") {
      // Assign region OADR to member counties
      const idx = depRows.filter((d) => d.csoScenario === csoScenario && d.year === latestYear);
      const perRegion = new Map<string, number>(); idx.forEach((d) => { if (Number.isFinite(d.OADR)) perRegion.set(d.regionLabel, d.OADR as number); });
      const out: MapRow[] = [];
      for (const reg of ALL_REGIONS) {
        const lbl = toDisplayLabel(reg);
        const v = perRegion.get(lbl);
        if (!Number.isFinite(v)) continue;
        for (const ck of countiesForRegion(lbl as any) ?? []) out.push({ LA: ck, value: v as number });
      }
      return out;
    }
    // headcount65
    const countyYearTotals = new Map<string, number>(); // countyKey|year → pop65 (selected scenario)
    for (const r of popAgg) {
      if (r.scenario !== esriScenario) continue;
      const k = `${r.countyKey}|${latestYear}`;
      if (r.year === latestYear) countyYearTotals.set(k, (countyYearTotals.get(k) ?? 0) + r.pop65);
    }
    const out: MapRow[] = [];
    for (const [k, v] of countyYearTotals.entries()) {
      const [ck] = k.split("|");
      out.push({ LA: ck, value: v });
    }
    return out;
  }, [mapMetric, disRows, depRows, csoScenario, latestYear, ALL_REGIONS, popAgg, esriScenario]);

  // Map click → toggle parent region in filters
  const handleCountyClick = useCallback((featureName: string) => {
    const ck = canonCounty(featureName);
    const reg = countyToRegion(ck as any);
    if (!reg) return;
    const lbl = toDisplayLabel(reg);
    setSelectedRegionLabels((prev) => (prev.includes(lbl) ? prev.filter((x) => x !== lbl) : [...prev, lbl]));
  }, []);

  // ------------------------------ Render ------------------------------
  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="rounded-3xl border border-slate-700/50 bg-slate-800/30 p-5 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <header className="mb-6 sm:mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Demand — Data & Indicators</h1>
              <p className="text-slate-300 text-sm">OADR/TDR from CSO (M1–M3), headcount 65+/85+ from ESRI scenarios, disability (Census).</p>
            </div>
            <div className="flex gap-2">
              {/* ESRI Scenario toggle */}
              <label className="sr-only" htmlFor="esri-scen">ESRI Scenario</label>
              <select id="esri-scen" value={esriScenario} onChange={(e)=>setEsriScenario(e.target.value)} className="rounded-lg border border-slate-600/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/60">
                {esriScenarios.map((s)=> (<option key={s} value={s}>{s}</option>))}
              </select>
              {/* CSO Scenario toggle */}
              <label className="sr-only" htmlFor="cso-scen">CSO Scenario</label>
              <select id="cso-scen" value={csoScenario} onChange={(e)=>setCsoScenario(e.target.value)} className="rounded-lg border border-slate-600/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/60">
                {csoScenarios.map((s)=> (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
          </header>

          {/* Filters */}
          <section className="mb-5 rounded-2xl border border-white/5 bg-slate-900/40 p-3 sm:p-4 backdrop-blur">
            {allYears.length ? (
              <Filters
                years={allYears}
                regions={ALL_REGIONS.map(toDisplayLabel)}
                selectedYears={selectedYears}
                selectedRegions={selectedRegionLabels}
                onYearsChange={setSelectedYears}
                onRegionsChange={setSelectedRegionLabels}
              />
            ) : (
              <div className="text-sm text-slate-300">{error ? `Error: ${error}` : status}</div>
            )}
          </section>

          {/* KPI row (interactive; updates with filters + map clicks) */}
          <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <KPI title="65+ Growth %" value={`${kpi.growthPct65}%`} />
            <KPI title="85+ Growth %" value={`${kpi.growthPct85}%`} />
            <KPI title="OADR" value={kpi.oadr_ratio.toFixed(2)} />
            <KPI title={`65+ in ${kpi.latestYear}`} value={kpi.proj65_latest.toLocaleString()} />
            <KPI title={`Δ65+ from Base`} value={kpi.delta65_fromBase.toLocaleString()} />
          </section>

          {/* Charts & Map */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            <div className="rounded-2xl border border-slate-700/50 p-4 bg-slate-800/30 shadow-inner backdrop-blur">
              <h3 className="text-sm font-semibold mb-3 text-white">65+ Trend — {esriScenario}</h3>
              <DemandTrends series={trendSeries} years={allYears} selectedLabels={selectedRegionLabels} />
            </div>

            <div className="rounded-2xl border border-slate-700/50 p-4 bg-slate-800/30 shadow-inner backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Map — {mapMetric === "headcount65" ? "65+ headcount" : mapMetric === "oadr" ? "OADR (CSO)" : "Disability % (65+)"}</h3>
                <div className="inline-flex rounded-xl border border-slate-600/60 bg-slate-900/40 p-1">
                  {(["headcount65","oadr","disability"] as MapMetric[]).map((m)=> (
                    <button key={m} onClick={()=>setMapMetric(m)} className={`px-3 py-1.5 text-xs rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${mapMetric===m?"bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-200 border border-cyan-400/40":"text-slate-200 hover:bg-slate-800/60 border border-transparent"}`}>{m==="headcount65"?"65+":m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ height: 420 }}>
                <MapLibreLA
                  rows={mapRows}
                  geojsonPath={GEOJSON_PATH}
                  nameField={GEO_NAME_FIELD}
                  selectedCounties={selectedCountyKeys}
                  selectionColors={selectionColors}
                  onFeatureClick={handleCountyClick}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 p-4 bg-slate-800/30 shadow-inner backdrop-blur">
              <h3 className="text-sm font-semibold mb-3 text-white">Region × Year Heatmap — Growth % (base {baseYear})</h3>
              <HeatmapMatrix years={selectedYears.length? selectedYears : allYears} regions={selectedRegionLabels.length? selectedRegionLabels : ALL_REGIONS.map(toDisplayLabel)} getValue={(label, yr) => heatmapGet(label, yr)} />
            </div>

            <div className="rounded-2xl border border-slate-700/50 p-4 bg-slate-800/30 shadow-inner backdrop-blur">
              <h3 className="text-sm font-semibold mb-3 text-white">65+ Growth % vs OADR (latest {latestYear}, {csoScenario})</h3>
              <OADRScatter points={scatterPoints} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
