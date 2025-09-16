// lib/supplyCsv.ts
"use client";

import {
  REGION_KEY_TO_COUNTIES,
  normalizeRegionKey,
  // If you DO have normalizeCounty exported, keep this import and delete the local fallback below.
  // normalizeCounty,
  type RegionKey,
} from "@/lib/geoMappings";

// --- Local normalizeCounty fallback (remove if your geoMappings already exports one)
function normalizeCounty(name: string): string {
  let s = (name || "").trim();
  s = s.replace(/^Co\.\s*/i, "").replace(/^County\s+/i, "");
  if (/^Dublin\b/i.test(s)) s = "Dublin";
  return s.replace(/\s+/g, " ");
}

// Build reverse: county -> NUTS3 label (once)
const COUNTY_TO_NUTS3: Record<string, RegionKey> = (() => {
  const out: Record<string, RegionKey> = {} as any;
  for (const [rk, arr] of Object.entries(REGION_KEY_TO_COUNTIES)) {
    for (const c of arr) out[c] = rk as RegionKey;
  }
  return out;
})();

// Heuristics to pick the county column from your cleaned file
function pickCounty(row: Record<string, string>): string | null {
  if (row.County) return row.County;
  if (row["Address 3"]) return row["Address 3"];
  if (row.Address3) return row.Address3;
  if (row["Address 2"]) return row["Address 2"];
  if (row.Address2) return row.Address2;
  return null;
}

function cleanCounty(raw: string | null): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.includes(",")) s = s.split(",")[0];           // drop Eircode if present
  s = s.replace(/^Co\.\s*/i, "").replace(/^County\s+/i, "").trim();
  if (/^Dublin\b/i.test(s)) s = "Dublin";
  return s.replace(/\s+/g, " ");
}

/** Reads /data/gpsCleanedData.csv (or /data/gps.csv) and returns GP site counts per NUTS-3 region. */
export async function fetchGpCountsByRegion(): Promise<Record<RegionKey, number>> {
  const tryUrls = ["/data/gpsCleanedData.csv", "/data/gps.csv"];
  let text = "";
  for (const u of tryUrls) {
    try { const r = await fetch(u, { cache: "no-store" }); if (r.ok) { text = await r.text(); break; } } catch {}
  }
  if (!text) return {};

  // light CSV parser that respects quotes
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) return {};
  const parseLine = (ln: string) => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < ln.length; i++) {
      const c = ln[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { out.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  const header = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, "")); // strip BOM if any
  const rows = lines.slice(1).map(ln => {
    const parts = parseLine(ln);
    const obj: Record<string,string> = {};
    header.forEach((h, i) => obj[h] = (parts[i] ?? "").trim());
    return obj;
  });

  const counts: Record<RegionKey, number> = {} as any;

  for (const row of rows) {
    const candidate = cleanCounty(pickCounty(row));
    if (!candidate) continue;

    const countyNorm = normalizeCounty(candidate);
    const nuts3Label = COUNTY_TO_NUTS3[countyNorm];
    const key = nuts3Label ? normalizeRegionKey(nuts3Label) as RegionKey | null : null;
    if (!key) continue;

    counts[key] = (counts[key] ?? 0) + 1;
  }
  if (process.env.NODE_ENV !== "production") {
    const total = Object.values(counts).reduce((a,b)=>a+b,0);
    console.debug("[GP loader] regions:", Object.keys(counts).length, "total GP sites:", total);
  }
  return counts;
}
