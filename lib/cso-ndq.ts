// lib/cso-ndq.ts
const NDQ05_URL = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/NDQ05/JSON-stat/2.0/en";

type NdqRow = { year: string; quarter: string; la: string; value: number | null };

export async function fetchNdq05({ lastNQuarters = 8 }: { lastNQuarters?: number } = {}) {
  const url =
    lastNQuarters
      ? `${NDQ05_URL}?query=${encodeURIComponent(JSON.stringify({
          query: [
            { code: "Local Authority", selection: { filter: "all", values: ["*"] } },
            { code: "Quarter", selection: { filter: "top", values: [String(lastNQuarters)] } }
          ],
          response: { format: "json-stat2", codes: false }
        }))}`
      : NDQ05_URL;

  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // 24h cache
  if (!res.ok) throw new Error(`NDQ05 ${res.status}`);
  const j = await res.json();

  // Lazy import JSON-stat toolkit
  const { default: JSONstat } = await import("jsonstat-toolkit");
  const ds = JSONstat(j).Dataset(0);

  // Discover dimension ids/labels (robust to renaming)
  const timeId = ds.id.find((id: string) => /quarter/i.test(ds.Dimension(id).label))!;
  const geoId  = ds.id.find((id: string) => /local.*authority/i.test(ds.Dimension(id).label))!;
  const valId  = ds.id.find((id: string) => /stat|value|number/i.test(ds.Dimension(id).label)) ?? null;

  const rows: NdqRow[] = [];
  ds.forEach((cell: any) => {
    const rec: any = { value: typeof cell.value === "number" ? cell.value : null };
    ds.id.forEach((id: string, i: number) => {
      const dim = ds.Dimension(id);
      const label = dim.Category(cell[i]).label;
      if (id === timeId) rec.quarter = label;       // e.g. "2025Q2"
      else if (id === geoId) rec.la = label;        // e.g. "Dublin City"
      else if (id !== valId) rec[id] = label;       // keep anything else
    });
    const m = /^(\d{4})Q([1-4])$/.exec(rec.quarter || "");
    rows.push({
      year: m ? m[1] : "",
      quarter: rec.quarter,
      la: rec.la,
      value: rec.value
    });
  });

  return rows;
}
