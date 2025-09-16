import { ALL_REGIONS, toDisplayLabel, RegionKey } from "@/lib/regionAdapter";

type Domain = "health" | "residence";

export type GapRow = {
  region: string;
  regionKey: RegionKey;
  domain: Domain;
  year: string;
  supply: number;
  need: number;
  gap: number;
};

export function useGapData({ year, regionLabels, domain }: { year: string; regionLabels: string[]; domain: Domain }) {
  const allYears = ["2022","2026","2031","2040"];
  const rows: GapRow[] = [];
  const labels = new Set(regionLabels);
  const target = domain === "health" ? 10 : 30;

  ALL_REGIONS.forEach((rk, idx) => {
    const label = toDisplayLabel(rk);
    if (!labels.has(label)) return;
    const yN = allYears.indexOf(year);
    const base = domain === "health" ? 7.0 : 24.0;
    const amp  = domain === "health" ? 4.0 : 10.0;
    const phase = (idx * 1.7 + yN * 0.9) % Math.PI;
    const supply = +(base + amp * Math.sin(phase)).toFixed(1);
    const need = target;
    const gap = +(supply - need).toFixed(1);
    rows.push({ region: label, regionKey: rk, domain, year, supply, need, gap });
  });

  const mapByRegion: Record<RegionKey, number> = Object.fromEntries(
    rows.map(r => [r.regionKey, r.gap])
  ) as any;

  return {
    loading: false,
    err: null as string | null,
    allYears,
    allRegions: ALL_REGIONS.map(k => ({ key: k, label: toDisplayLabel(k) })),
    matrix: rows,
    mapByRegion,
  };
}

export async function computeAvgGapForYears(years: string[], regionLabels: string[], domain: Domain) {
  const out: { x: string; y: number }[] = [];
  for (const y of years) {
    const { matrix } = useGapData({ year: y, regionLabels, domain });
    const gaps = matrix.map(m => m.gap).filter(v => Number.isFinite(v));
    const avg = gaps.length ? gaps.reduce((s, v) => s + v, 0) / gaps.length : 0;
    out.push({ x: y, y: +avg.toFixed(2) });
  }
  return out;
}
