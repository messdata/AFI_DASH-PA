import { NUTS3_TO_COUNTIES } from "./geoMappings";

export type RegionKey = keyof typeof NUTS3_TO_COUNTIES;
export const ALL_REGIONS = Object.keys(NUTS3_TO_COUNTIES) as RegionKey[];

// Simple canonicaliser to perform tolerant key/label comparisons
function canon(s: string): string {
  return s.trim().toLowerCase();
}

export function toDisplayLabel(key: RegionKey): string { return key; }
export function fromDisplayLabel(lbl: string): RegionKey | undefined {
  const hit = ALL_REGIONS.find((k) => canon(k) === canon(lbl));
  return hit as RegionKey | undefined;
}
export const regionKeyFromLabel = fromDisplayLabel;

// Legacy name retained for compatibility
export function regionToCounties(key: RegionKey): string[] {
  return NUTS3_TO_COUNTIES[key] ?? [];
}

// === New helpers expected by consumers ===
// Tolerates either a RegionKey or a display label string
export function countiesForRegion(keyOrLabel: RegionKey | string): string[] {
  const rk = (typeof keyOrLabel === "string"
    ? (fromDisplayLabel(keyOrLabel) as RegionKey | undefined)
    : keyOrLabel);
  return rk ? (NUTS3_TO_COUNTIES[rk] ?? []) : [];
}

// Reverse lookup: county name -> parent RegionKey
export function countyToRegion(countyLabel: string): RegionKey | undefined {
  const target = canon(countyLabel);
  for (const rk of ALL_REGIONS) {
    const counties = NUTS3_TO_COUNTIES[rk] || [];
    if (counties.some(c => canon(c) === target)) return rk;
  }
  return undefined;
}
