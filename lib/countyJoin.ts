// /lib/countyJoin.ts
export type Row = { LA: string; value: number };

export const clean = (s: string) =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[–-]/g, " ")                            // dashes
    .replace(/\b(city and county|city|county|council)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Collapse the 31 LAs to the 26 counties used in ie.json
export function laToCounty(la: string) {
  const n = clean(la);
  if (["dublin city", "dun laoghaire rathdown", "fingal", "south dublin"].includes(n)) return "dublin";
  if (["cork city"].includes(n)) return "cork";
  if (["galway city"].includes(n)) return "galway";
  if (["limerick", "limerick city and county"].includes(n)) return "limerick";
  if (["waterford", "waterford city and county"].includes(n)) return "waterford";
  return n; // most LAs already equal county names (e.g., tipperary, meath)
}

export function totalsByCounty(rows: Row[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const county = laToCounty(r.LA);
    m.set(county, (m.get(county) || 0) + r.value);
  }
  return m; // keys are lower-case county names
}

// Build a MapLibre expression: match(countyName -> value), default 0
export function makeMatchExpression(totalMap: Map<string, number>, nameField: string) {
  const match: any[] = ["match", ["downcase", ["get", nameField]]];
  for (const [county, v] of totalMap) match.push(county, v);
  match.push(0);
  return match;
}

// Turn numeric values into a step-based color ramp
export function fillPaintFrom(matchExpr: any) {
  return {
    "fill-color": [
      "step", matchExpr,
      "#0b1020",   1,
      "#0e1f3a",  25,
      "#12315c",  50,
      "#184a8a", 100,
      "#2563eb", 250,
      "#60a5fa", 500,
      "#93c5fd", 1000,
      "#bfdbfe",
    ],
    "fill-opacity": 0.85,
  } as const;
}
