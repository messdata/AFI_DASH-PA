// lib/supply.ts
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

export type SupplyPoint = { lon: number; lat: number; type: "GP"|"Pharmacy"|"NursingHome"|"Stop"; name?: string };
export type NutsRegion = { key: string; label: string; feature: GeoJSON.Feature<GeoJSON.Polygon|GeoJSON.MultiPolygon> };

export function rollupByRegion(points: SupplyPoint[], nuts3: NutsRegion[]) {
  const totals: Record<string, number> = Object.create(null);
  for (const pt of points) {
    const p = { type: "Feature", geometry: { type: "Point", coordinates: [pt.lon, pt.lat] }, properties: {} } as any;
    const hit = nuts3.find(r => booleanPointInPolygon(p, r.feature as any));
    if (hit) totals[hit.key] = (totals[hit.key] ?? 0) + 1;
  }
  return totals; // { regionKey: count, ... }
}
