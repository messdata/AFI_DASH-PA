"use client";

import { useEffect, useMemo, useState } from "react";
import { readPxStat, jsonstatToRows } from "./pxstat";

export type Year = string;
export type Cohort = "65+" | "85+";
export type RegionKey =
  | "Border" | "Dublin" | "Mid-East" | "Mid-West" | "Midland" | "South-East" | "South-West" | "West";

export interface Region { key: RegionKey; label: string }
export interface GrowthPoint { x: Year; y: number }           // % vs 2022
export interface GrowthSeries { label: string; points: GrowthPoint[] }
export interface OADRRow { LA: RegionKey; label: string; value: number } // ratio

export interface DemandParams {
  years: Year[]; regions: RegionKey[]; cohort: Cohort; baselineYear?: Year; scenario?: string; // default M2
}
export interface DemandState {
  loading: boolean; err: string | null;
  allYears: Year[]; allRegions: Region[];
  kpi: { growthPct65: number; growthPct85: number; oadr_ratio: number; proj2031_65: number; delta65_fromToday: number; latestYear: Year; };
  growthSeries: GrowthSeries[]; oadrMapRows: OADRRow[]; activeRegionKeys: RegionKey[];
}

const UI_LABEL: Record<RegionKey, string> = {
  Border:"Border", Dublin:"Dublin", "Mid-East":"Mid-East", "Mid-West":"Mid-West",
  Midland:"Midland", "South-East":"South-East", "South-West":"South-West", West:"West"
};

const AGE_LABELS = {
  y1564: "15 - 64 years",
  y65p: "65 years and over",
  y85p: "85 years and over", // if missing we’ll derive later
};

export function useDemandDataPxStat({ years, regions, cohort, baselineYear="2022", scenario="M2" }: DemandParams): DemandState {
  const [state, setState] = useState<DemandState>({
    loading: true, err: null,
    allYears: [], allRegions: (Object.keys(UI_LABEL) as RegionKey[]).map(k => ({key: k, label: UI_LABEL[k]})),
    kpi: { growthPct65: 0, growthPct85: 0, oadr_ratio: 0, proj2031_65: 0, delta65_fromToday: 0, latestYear: "—" },
    growthSeries: [], oadrMapRows: [], activeRegionKeys: regions,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Simpler + robust: fetch full PEC26 once, filter client-side (still small for NUTS3)
        const j = await readPxStat("PEC26");
        const rows = jsonstatToRows(j) as Array<{
          Region: string; "Age Group": string; Year: string; Scenario?: string; value: number | null;
        }>;

        // Filter to NUTS3 + scenario
        const wantedRegions = new Set(regions.map(r => UI_LABEL[r]));
        const r2 = rows.filter(r =>
          wantedRegions.has(r.Region) &&
          (!r.Scenario || r.Scenario === scenario) &&
          r.value != null
        );

        // Index: label->year->ageband value
        const map = new Map<string, Map<string, Record<string, number>>>();
        for (const r of r2) {
          const lab = r.Region;
          const y = String(r.Year);
          const age = r["Age Group"];
          const v = r.value as number;
          const yr = map.get(lab) ?? new Map<string, Record<string, number>>();
          const bag = yr.get(y) ?? {};
          bag[age] = v;
          yr.set(y, bag);
          map.set(lab, yr);
        }

        // Derive 65+, 85+ (prefer direct labels; fall back to summing if necessary)
        const get65 = (bag: Record<string, number>) =>
          Number.isFinite(bag[AGE_LABELS.y65p]) ? bag[AGE_LABELS.y65p] : (bag["65 - 69 years"] ?? 0) + (bag["70 - 74 years"] ?? 0) + (bag["75 - 79 years"] ?? 0) + (bag["80 - 84 years"] ?? 0) + (bag["85 years and over"] ?? 0);
        const get85 = (bag: Record<string, number>) =>
          Number.isFinite(bag[AGE_LABELS.y85p]) ? bag[AGE_LABELS.y85p] : (bag["85 years and over"] ?? 0);
        const get1564 = (bag: Record<string, number>) =>
          Number.isFinite(bag[AGE_LABELS.y1564]) ? bag[AGE_LABELS.y1564] :
          (bag["15 - 19 years"] ?? 0)+(bag["20 - 24 years"] ?? 0)+(bag["25 - 29 years"] ?? 0)+(bag["30 - 34 years"] ?? 0)+
          (bag["35 - 39 years"] ?? 0)+(bag["40 - 44 years"] ?? 0)+(bag["45 - 49 years"] ?? 0)+(bag["50 - 54 years"] ?? 0)+(bag["55 - 59 years"] ?? 0)+(bag["60 - 64 years"] ?? 0);

        const allYears = Array.from(new Set(r2.map(r => String(r.Year)))).sort();
        const latestYear = [...years].filter(y => allYears.includes(String(y))).sort().slice(-1)[0] ?? allYears[allYears.length - 1];

        // Series (% vs baseline)
        const growthSeries: GrowthSeries[] = regions.map((rk) => {
          const lab = UI_LABEL[rk];
          const yr = map.get(lab) ?? new Map();
          const baseBag = yr.get(String(baselineYear)) ?? {};
          const base = cohort === "65+" ? get65(baseBag) : get85(baseBag);
          const points = years.map(y => {
            const bag = yr.get(String(y)) ?? {};
            const v = cohort === "65+" ? get65(bag) : get85(bag);
            const g = base ? ((v / base) - 1) * 100 : NaN;
            return { x: String(y), y: Number.isFinite(g) ? g : NaN };
          });
          return { label: lab, points };
        });

        // KPIs (aggregate selected regions)
        const sumFor = (yr: string, kind: "65+" | "85+" | "15-64") => {
          let s = 0;
          for (const rk of regions) {
            const lab = UI_LABEL[rk];
            const bag = map.get(lab)?.get(yr) ?? {};
            s += kind === "65+" ? get65(bag) : kind === "85+" ? get85(bag) : get1564(bag);
          }
          return s;
        };
        const base65 = sumFor("2022", "65+"), base85 = sumFor("2022", "85+");
        const latest65 = sumFor(latestYear, "65+"), latest85 = sumFor(latestYear, "85+");
        const latest1564 = sumFor(latestYear, "15-64");
        const proj2031_65 = sumFor("2031", "65+");

        const kpi = {
          growthPct65: base65 ? ((latest65 / base65) - 1) * 100 : 0,
          growthPct85: base85 ? ((latest85 / base85) - 1) * 100 : 0,
          oadr_ratio: latest1564 ? (latest65 / latest1564) : 0,
          proj2031_65,
          delta65_fromToday: (proj2031_65 || 0) - (latest65 || 0),
          latestYear,
        };

        // OADR rows per region (ratio)
        const oadrMapRows = regions.map((rk) => {
          const lab = UI_LABEL[rk];
          const bag = map.get(lab)?.get(latestYear) ?? {};
          return { LA: rk, label: lab, value: (get65(bag) || 0) / (get1564(bag) || 1) };
        });

        if (!cancelled) setState(s => ({
          ...s, loading: false, err: null, allYears, kpi, growthSeries, oadrMapRows, activeRegionKeys: regions
        }));
      } catch (e: any) {
        if (!cancelled) setState(s => ({ ...s, loading: false, err: String(e?.message ?? e) }));
      }
    })();
    return () => { cancelled = true; };
  }, [years.join(","), regions.join(","), cohort, baselineYear, scenario]);

  return state;
}
