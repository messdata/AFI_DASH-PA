// lib/pxstat.ts
// Minimal client for CSO PxStat (JSON-stat 2.0), no API key needed.
export type PxQuery = {
  query?: Array<{ code: string; selection: { filter: string; values: string[] } }>;
  response?: { format?: "json-stat2"; pivot?: null | string; codes?: boolean };
};

const BASE = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset";
const LANG = "en";

export async function readPxStat(table: string, q?: PxQuery) {
  const qp = q
    ? `?query=${encodeURIComponent(
        JSON.stringify({
          response: { format: "json-stat2", codes: false, ...(q.response ?? {}) },
          query: q.query ?? [],
        })
      )}`
    : "";
  const url = `${BASE}/${table}/JSON-stat/2.0/${LANG}${qp}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // cache 24h
  if (!res.ok) throw new Error(`CSO ${table} ${res.status}`);
  return res.json();
}

export function jsonstatToRows(j: any) {
  // Lazy import keeps edge/runtime small
  const { default: JSONstat } = require("jsonstat-toolkit");
  const ds = JSONstat(j).Dataset(0);
  const rows: any[] = [];
  ds.forEach(function (c: any) {
    const r: any = {};
    ds.id.forEach((id: string, i: number) => {
      const dim = ds.Dimension(id);
      r[id] = dim.Category(c[i]).label;
    });
    r.value = typeof c.value === "number" ? c.value : null;
    rows.push(r);
  });
  return rows; // tidy objects with .value and human labels for each dimension
}
