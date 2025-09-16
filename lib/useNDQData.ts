import { useEffect, useMemo, useState } from "react";
import { fetchPxStat } from "@/lib/pxstat";
import { loadLocalCSV } from "@/lib/csv";
import { canonicalLA } from "@/lib/normalize";

export type Row = { LA: string; year: string; quarter: string; value: number };

function pickLA(r: any) {
  return r["Local Authority"] || r["County"] || r["LA"] || r["Region"] || "";
}
function pickQuarter(r: any) {
  return { year: r["Year"] ?? r["YEAR"], quarter: r["Quarter"] ?? r["QUARTER"] };
}
function pickValue(r: any) {
  return Number(r["VALUE"] ?? r["Value"] ?? r["value"]);
}

export function useNDQData(dataset = "NDQ01") {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const table = await fetchPxStat(dataset);
        setRows(
          table
            .map((r: any) => {
              const la = pickLA(r);
              const { year, quarter } = pickQuarter(r);
              const value = pickValue(r);
              const ok = la && year && quarter && Number.isFinite(value);
              return ok ? { LA: la, year, quarter, value } : null;
            })
            .filter(Boolean) as Row[]
        );
      } catch {
        try {
          const csv = await loadLocalCSV("/data/new dwellings quarterly.csv");
          setRows(
            (csv as any[])
              .map((r: any) => {
                const la = pickLA(r);
                const { year, quarter } = pickQuarter(r);
                const value = pickValue(r);
                const ok = la && year && quarter && Number.isFinite(value);
                return ok ? { LA: la, year, quarter, value } : null;
              })
              .filter(Boolean) as Row[]
          );
        } catch {
          setErr("Failed to load NDQ01 data.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [dataset]);

  return { rows, loading, err };
}

export const DUBLIN_LAS = new Set([
  "Dublin City",
  "Fingal",
  "South Dublin",
  "Dún Laoghaire-Rathdown",
]);

export function normalizeCountyKey(county: string) {
  if (DUBLIN_LAS.has(county)) {
    return "Dublin";
  }
  return county;
}

export type Filters = { year: string; quarter: string; counties: string[] };

export function applyFilters(rows: Row[], f: Filters) {
  return rows
    .filter((r) => (f.year ? r.year === f.year : true))
    .filter((r) => (f.quarter ? r.quarter === f.quarter : true))
    .filter((r) =>
      f.counties.length > 0
        ? f.counties.some((c) => normalizeCountyKey(c) === normalizeCountyKey(r.LA))
        : true
    );
}

export function totalsByLA(rows: Row[]) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.LA, (m.get(r.LA) || 0) + r.value));
  return m;
}
