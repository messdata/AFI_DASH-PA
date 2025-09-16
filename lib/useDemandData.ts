// lib/useDemandData.ts
'use client';
import { useEffect, useState } from 'react';

export type Year = string;
export type Cohort = '65+' | '85+';
export type RegionKey =
  | 'Border' | 'Dublin' | 'Mid-East' | 'Mid-West'
  | 'Midland' | 'South-East' | 'South-West' | 'West';

export interface Region { key: RegionKey; label: string }
export interface GrowthPoint { x: Year; y: number }   // % vs 2022
export interface GrowthSeries { label: string; points: GrowthPoint[] }
export interface OADRRow { LA: RegionKey; label: string; value: number } // ratio

export interface DemandParams {
  years: Year[];
  regions: RegionKey[];
  cohort: Cohort;
  baselineYear?: Year;  // default 2022
}

export interface DemandState {
  loading: boolean; err: string | null;
  allYears: Year[]; allRegions: Region[];
  kpi: {
    growthPct65: number; growthPct85: number; oadr_ratio: number;
    proj2031_65: number; delta65_fromToday: number; latestYear: Year;
  };
  growthSeries: GrowthSeries[];
  oadrMapRows: OADRRow[];
  activeRegionKeys: RegionKey[];
}

const UI_KEY_TO_LABEL: Record<RegionKey, string> = {
  Border: 'Border', Dublin: 'Dublin', 'Mid-East': 'Mid-East', 'Mid-West': 'Mid-West',
  Midland: 'Midland', 'South-East': 'South-East', 'South-West': 'South-West', West: 'West',
};
const toDataKey = (k: RegionKey) => UI_KEY_TO_LABEL[k].toLowerCase().replace(/-/g, ' ');

async function fetchCsv(url: string): Promise<string[][]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return (await res.text()).trim().split(/\r?\n/).map(l => l.split(',').map(s => s.trim()));
}
const toNum = (x: any) => (Number.isFinite(+x) ? +x : null);

export function useDemandData({ years, regions, cohort, baselineYear = '2022' }: DemandParams): DemandState {
  const [st, setSt] = useState<DemandState>({
    loading: true, err: null,
    allYears: [], allRegions: (Object.keys(UI_KEY_TO_LABEL) as RegionKey[]).map(k => ({ key: k, label: k })),
    kpi: { growthPct65: 0, growthPct85: 0, oadr_ratio: 0, proj2031_65: 0, delta65_fromToday: 0, latestYear: '—' },
    growthSeries: [], oadrMapRows: [], activeRegionKeys: regions,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dfRows, oadrRows] = await Promise.all([
          fetchCsv('/data/demand_fact.csv'),
          fetchCsv('/data/oadr.csv'),
        ]);

        const dH = dfRows[0];
        const iY = dH.indexOf('year'), iL = dH.indexOf('nuts3'), iK = dH.indexOf('nuts3_key');
        const iC = dH.indexOf('cohort'), iV = dH.indexOf('value');

        const rows = dfRows.slice(1).map(r => ({
          year: String(r[iY]), label: r[iL], key: r[iK], cohort: r[iC], value: toNum(r[iV]),
        })).filter(r => r.value != null && r.label);

        const allYears = Array.from(new Set(rows.map(r => r.year))).sort();
        const latestYear = [...years].filter(y => allYears.includes(String(y))).sort().slice(-1)[0]
                           ?? allYears[allYears.length - 1];

        const selectedLabels = regions.map(k => UI_KEY_TO_LABEL[k]);

        // label -> (year -> value) for the cohort
        const byLabelYear = new Map<string, Map<string, number>>();
        for (const r of rows) {
          if (r.cohort !== cohort) continue;
          if (!selectedLabels.includes(r.label)) continue;
          const inner = byLabelYear.get(r.label) ?? new Map();
          inner.set(r.year, r.value!);
          byLabelYear.set(r.label, inner);
        }

        // growth series (% vs baseline)
        const growthSeries = selectedLabels.map(lab => {
          const inner = byLabelYear.get(lab) ?? new Map<string, number>();
          const base = inner.get(String(baselineYear));
          const pts = years.map(y => {
            const v = inner.get(String(y));
            if (!Number.isFinite(v as number) || !Number.isFinite(base as number)) return { x: String(y), y: NaN };
            return { x: String(y), y: ((v as number) / (base as number) - 1) * 100 };
          });
          return { label: lab, points: pts };
        });

        // KPIs aggregated over selected labels
        const sumFor = (yr: string, coh: '65+'|'85+') =>
          rows.filter(r => r.year === yr && r.cohort === coh && selectedLabels.includes(r.label))
              .reduce((s, r) => s + (r.value as number), 0);

        const base65 = sumFor('2022', '65+'), base85 = sumFor('2022', '85+');
        const latest65 = sumFor(latestYear, '65+'), latest85 = sumFor(latestYear, '85+');
        const proj2031_65 = sumFor('2031', '65+');

        const kpi = {
          growthPct65: base65 ? ((latest65 / base65) - 1) * 100 : 0,
          growthPct85: base85 ? ((latest85 / base85) - 1) * 100 : 0,
          oadr_ratio: 0,
          proj2031_65,
          delta65_fromToday: (proj2031_65 || 0) - (latest65 || 0),
          latestYear,
        };

        // OADR — take latest available year, convert pct -> ratio
        const oH = oadrRows[0]; const oy = oH.indexOf('year'), ol = oH.indexOf('nuts3'), ov = oH.indexOf('oadr_pct');
        const yearsO = oadrRows.slice(1).map(r => +r[oy]); const latestO = Math.max(...yearsO);
        const oadrByLabel = new Map<string, number>();
        for (const r of oadrRows.slice(1)) {
          const lab = r[ol] as string; if (!selectedLabels.includes(lab)) continue;
          if (+r[oy] !== latestO) continue;
          const pct = toNum(r[ov]); if (!Number.isFinite(pct as number)) continue;
          oadrByLabel.set(lab, (pct as number) / 100);
        }
        const oadrMapRows = Array.from(oadrByLabel.entries()).map(([lab, val]) => {
          const uiKey = (Object.keys(UI_KEY_TO_LABEL) as RegionKey[]).find(k => UI_KEY_TO_LABEL[k] === lab)!;
          return { LA: uiKey, label: lab, value: val };
        });

        if (oadrMapRows.length) {
          kpi.oadr_ratio = oadrMapRows.reduce((s, r) => s + r.value, 0) / oadrMapRows.length;
        }

        if (!cancelled) setSt({
          loading: false, err: null,
          allYears,
          allRegions: (Object.keys(UI_KEY_TO_LABEL) as RegionKey[]).map(k => ({ key: k, label: k })),
          kpi, growthSeries, oadrMapRows, activeRegionKeys: regions,
        });
      } catch (e: any) {
        if (!cancelled) setSt(s => ({ ...s, loading: false, err: String(e?.message ?? e) }));
      }
    })();

    return () => { cancelled = true; };
  }, [years.join(','), regions.join(','), cohort, baselineYear]);

  return st;
}
