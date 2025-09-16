// lib/useDemandData.factcsv.ts
"use client";

import { useEffect, useMemo, useState } from "react";

export type RegionKey =
  | "Border" | "Dublin" | "Mid-East" | "Midland" | "Mid-West"
  | "South East" | "South-West" | "West";

// Normalize common label drift
export function normalizeRegionKey(s: string): RegionKey | null {
  const t = String(s || "").trim()
    .replace(/^South[-\s]?East$/i, "South East")
    .replace(/^South[-\s]?West$/i, "South-West")
    .replace(/^Mid[-\s]?East$/i, "Mid-East")
    .replace(/^Mid[-\s]?West$/i, "Mid-West");
  const ok: RegionKey[] = ["Border","Dublin","Mid-East","Midland","Mid-West","South East","South-West","West"];
  return (ok.includes(t as RegionKey) ? (t as RegionKey) : null);
}

type Point = { x: string; y: number };
export type Series = { label: string; points: Point[] };

// light CSV parser that respects quotes
function parseCSV(text: string) {
  const rows: string[][] = [];
  let cell = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { row.push(cell.trim()); cell = ""; continue; }
    if ((c === "\n" || c === "\r") && !inQ) {
      if (row.length || cell) { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
      continue;
    }
    cell += c;
  }
  if (row.length || cell) { row.push(cell.trim()); rows.push(row); }
  return rows.filter(r => r.length && r.join("").length);
}

async function loadFact(): Promise<{ year: string; nuts3: RegionKey; cohort: string; value: number }[]> {
  // Expect the file at /public/data/demand_fact.csv
  const res = await fetch("/data/demand_fact.csv", { cache: "no-store" });
  if (!res.ok) throw new Error(`demand_fact.csv HTTP ${res.status}`);
  const txt = await res.text();
  const rows = parseCSV(txt);
  const header = rows[0].map(h => h.replace(/^\uFEFF/, "").toLowerCase());

  const iYear = header.indexOf("year");
  const iNuts3 = header.indexOf("nuts3");
  const iCoh  = header.indexOf("cohort");
  const iVal  = header.indexOf("value");
  if ([iYear,iNuts3,iCoh,iVal].some(i => i < 0))
    throw new Error("demand_fact.csv must have: year, nuts3, cohort, value");

  const out: { year: string; nuts3: RegionKey; cohort: string; value: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rk = normalizeRegionKey(r[iNuts3]);
    if (!rk) continue;
    out.push({
      year: String(r[iYear]),
      nuts3: rk,
      cohort: String(r[iCoh]),
      value: Number(r[iVal]),
    });
  }
  return out;
}

export function useDemandDataFactCSV(selectedYears: string[], selectedRegions: RegionKey[]) {
  const [state, setState] = useState<{
    loading: boolean; err: string | null;
    allYears: string[]; allRegions: { key: RegionKey; label: string }[];
    growthSeries: Series[];            // 65+ growth % vs 2022
    oadrByRegion: Record<RegionKey, number>; // latest selected year
    latestYear: string;
    kpi: {
      growthPct65: number;
      growthPct85: number;
      oadr_ratio: number;
      proj2031_65: number;
      delta65_fromToday: number;
      latestYear: string;
    };
    oadrMapRows: { LA: RegionKey; label: string; value: number }[];
    activeRegionKeys: RegionKey[];
  }>({
    loading: true, err: null, allYears: [], allRegions: [],
    growthSeries: [], oadrByRegion: {}, latestYear: "",
    kpi: { growthPct65: 0, growthPct85: 0, oadr_ratio: 0, proj2031_65: 0, delta65_fromToday: 0, latestYear: "—" },
    oadrMapRows: [],
    activeRegionKeys: [],
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setState(s => ({ ...s, loading: true, err: null }));

        const fact = await loadFact();

        const allYears = Array.from(new Set(fact.map(f => f.year))).sort();
        const baseYear = allYears.includes("2022") ? "2022" : allYears[0];
        const latestYear = (selectedYears && selectedYears.length)
          ? selectedYears[selectedYears.length - 1]
          : allYears[allYears.length - 1];

        const allRegions = Array.from(new Set(fact.map(f => f.nuts3))) as RegionKey[];
        const regionObjs = allRegions.map(k => ({ key: k, label: k }));

        const useRegions = (selectedRegions && selectedRegions.length) ? selectedRegions : allRegions;

        // Build lookups: pop65 and pop1564
        const key = (rk: RegionKey, y: string, c: string) => `${rk}__${y}__${c}`;
        const pop: Record<string, number> = {};
        fact.forEach(f => pop[key(f.nuts3, f.year, f.cohort)] = f.value);

        // Growth % (65+) vs baseYear for chosen/available years
        const yearsForChart = allYears.filter(y => !selectedYears.length || selectedYears.includes(y));
        const growthSeries: Series[] = useRegions.map((rk) => {
          const pts: Point[] = yearsForChart.map(y => {
            const b = pop[key(rk, baseYear, "65+")] ?? NaN;
            const v = pop[key(rk, y, "65+")] ?? NaN;
            const g = (Number.isFinite(b) && b > 0 && Number.isFinite(v)) ? ((v - b) / b) * 100 : NaN;
            return { x: y, y: Number.isFinite(g) ? g : 0 };
          });
          return { label: rk, points: pts };
        });

        // OADR (latest selected year)
        const oadrByRegion: Record<RegionKey, number> = {} as any;
        useRegions.forEach(rk => {
          const p65 = pop[key(rk, latestYear, "65+")] ?? 0;
          const p15 = pop[key(rk, latestYear, "15–64")] ?? 0; // en-dash cohort in your CSV
          oadrByRegion[rk] = p15 > 0 ? p65 / p15 : 0;
        });

        // --- KPI computations
        const cohortExists = (name: string) => fact.some(f => String(f.cohort).toLowerCase() === name.toLowerCase());
        const useRegionsArr = useRegions;

        const sumPop = (year: string, cohort: string) =>
          useRegionsArr.reduce((acc, rk) => acc + (pop[`${rk}__${year}__${cohort}`] ?? 0), 0);

        const avgGrowthForCohort = (cohort: string) => {
          const vals: number[] = [];
          useRegionsArr.forEach(rk => {
            const b = pop[`${rk}__${baseYear}__${cohort}`] ?? NaN;
            const v = pop[`${rk}__${latestYear}__${cohort}`] ?? NaN;
            const g = (Number.isFinite(b) && b > 0 && Number.isFinite(v)) ? ((v - b) / b) * 100 : NaN;
            if (Number.isFinite(g)) vals.push(g);
          });
          return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : NaN;
        };

        const growthPct65 = avgGrowthForCohort("65+");
        const growthPct85 = cohortExists("85+") ? avgGrowthForCohort("85+") : NaN;
        const oadr_ratio = (() => {
          const vals = useRegionsArr.map(rk => oadrByRegion[rk]).filter(v => Number.isFinite(v));
          return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : NaN;
        })();
        const proj2031_65 = allYears.includes("2031") ? sumPop("2031", "65+") : NaN;
        const delta65_fromToday = (() => {
          const now = sumPop(latestYear, "65+");
          const base = sumPop(baseYear, "65+");
          return Number.isFinite(now) && Number.isFinite(base) ? (now - base) : NaN;
        })();

        const oadrMapRows = Object.entries(oadrByRegion).map(([key, value]) => ({
          LA: key as RegionKey,
          label: key,
          value: value as number,
        }));

        if (!alive) return;
        setState({
          loading: false,
          err: null,

          kpi: {
            growthPct65: Number.isFinite(growthPct65) ? growthPct65 : 0,
            growthPct85: Number.isFinite(growthPct85) ? growthPct85 : 0,
            oadr_ratio: Number.isFinite(oadr_ratio) ? oadr_ratio : 0,
            proj2031_65: Number.isFinite(proj2031_65) ? proj2031_65 : 0,
            delta65_fromToday: Number.isFinite(delta65_fromToday) ? delta65_fromToday : 0,
            latestYear: typeof latestYear === "string" ? latestYear : "—",
          },

          allYears,
          allRegions: regionObjs,
          growthSeries: Array.isArray(growthSeries) ? growthSeries : [],
          oadrMapRows: Array.isArray(oadrMapRows) ? oadrMapRows : [],
          activeRegionKeys: [...useRegionsArr],
          oadrByRegion,
          latestYear,
        });
      } catch (e: any) {
        if (!alive) return;
        setState(s => ({ ...s, loading: false, err: e?.message || "Failed to load demand_fact.csv" }));
      }
    })();
    // stringify deps to avoid shallow equality traps
  }, [JSON.stringify(selectedYears), JSON.stringify(selectedRegions)]);

  return state;
}
