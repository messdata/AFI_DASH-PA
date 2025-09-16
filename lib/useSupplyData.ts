"use client";

import { useEffect, useMemo, useState } from "react";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

export type RegionKey =
  | "Border" | "Dublin" | "Mid-East" | "Mid-West" | "Midland" | "South-East" | "South-West" | "West";

const UI_LABEL: Record<RegionKey, string> = {
  Border:"Border", Dublin:"Dublin", "Mid-East":"Mid-East", "Mid-West":"Mid-West",
  Midland:"Midland", "South-East":"South-East", "South-West":"South-West", West:"West"
};

type Pt = { lon: number; lat: number; type: "GP"|"Pharmacy"|"NursingHome"|"Stop"|"Other" };

async function csv(url: string) {
  const t = await fetch(url, { next: { revalidate: 86400 } }).then(r => r.text());
  const [hdr, ...lines] = t.trim().split(/\r?\n/);
  const H = hdr.split(",").map(s=>s.trim());
  return lines.map(L => {
    const cells = L.split(",").map(s=>s.trim());
    const row: any = {};
    H.forEach((h,i)=>row[h]=cells[i]);
    return row;
  });
}

function toNumber(x: any) { const n = +x; return Number.isFinite(n) ? n : null; }

export function useSupplyData({
  year="2024",
  nutsUrl="/data/nuts3.geojson",
  gpUrl="/data/gp.csv",
  pharmUrl="/data/pharmacies.csv",
  nhUrl="/data/nursing_homes.csv",
  stopsUrl="/data/stops.csv",
  bedsUrl="/data/ltc_beds.csv",
  pop65ByRegion,           // { RegionLabel -> number } from Demand (same year)
}: {
  year?: string;
  nutsUrl?: string;
  gpUrl?: string; pharmUrl?: string; nhUrl?: string; stopsUrl?: string; bedsUrl?: string;
  pop65ByRegion: Record<string, number>;
}) {
  const [state, setState] = useState<any>({ loading: true, err: null, rollups:{}, kpi:{} });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [nuts, gp, ph, nh, st, beds] = await Promise.all([
          fetch(nutsUrl, { next: { revalidate: 86400 } }).then(r=>r.json()),
          csv(gpUrl), csv(pharmUrl), csv(nhUrl), csv(stopsUrl), csv(bedsUrl)
        ]);

        const nutsRegions = nuts.features.map((f: any) => ({
          key: (f.properties?.NUTS_NAME ?? f.properties?.name) as string,
          label: (f.properties?.NUTS_NAME ?? f.properties?.name) as string,
          feature: f
        }));

        function assign(points: Pt[]) {
          const totals: Record<string, number> = {};
          for (const p of points) {
            const pt = { type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: {} } as any;
            const hit = nutsRegions.find((r: any) => booleanPointInPolygon(pt, r.feature));
            const lab = hit?.label;
            if (lab) totals[lab] = (totals[lab] ?? 0) + 1;
          }
          return totals;
        }

        const gpPts: Pt[] = gp.map((r:any)=>({lon:+r.lon||+r.longitude, lat:+r.lat||+r.latitude, type:"GP"})).filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat));
        const phPts: Pt[] = ph.map((r:any)=>({lon:+r.lon||+r.longitude, lat:+r.lat||+r.latitude, type:"Pharmacy"})).filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat));
        const nhPts: Pt[] = nh.map((r:any)=>({lon:+r.lon||+r.longitude, lat:+r.lat||+r.latitude, type:"NursingHome"})).filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat));
        const stPts: Pt[] = st.map((r:any)=>({lon:+r.stop_lon||+r.lon||+r.longitude, lat:+r.stop_lat||+r.lat||+r.latitude, type:"Stop"})).filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat));

        const gpByR = assign(gpPts);
        const phByR = assign(phPts);
        const nhByR = assign(nhPts);
        const stByR = assign(stPts);

        // Beds CSV expected: region,label,year,beds
        const bedsByR: Record<string, number> = {};
        for (const r of beds) {
          if (String(r.year) !== String(year)) continue;
          const lab = r.region || r.Region || r.nuts3 || r.NUTS3 || r.area;
          const v = toNumber(r.beds ?? r.Beds ?? r.value);
          if (lab && v != null) bedsByR[lab] = (bedsByR[lab] ?? 0) + v;
        }

        // KPIs (per-65+ where relevant)
        const kpi = { gp_per_10k_65: 0, beds_per_1k_65: 0, stops: 0 };
        let kRegions = 0;
        for (const r of nutsRegions) {
          const lab = r.label;
          const pop65 = pop65ByRegion[lab] ?? 0;
          const gpv = gpByR[lab] ?? 0;
          const bedv = bedsByR[lab] ?? 0;
          const stopv = stByR[lab] ?? 0;
          if (pop65 > 0) {
            kpi.gp_per_10k_65 += (gpv / pop65) * 10000;
            kpi.beds_per_1k_65 += (bedv / pop65) * 1000;
            kRegions++;
          }
          kpi.stops += stopv;
        }
        if (kRegions) {
          kpi.gp_per_10k_65 /= kRegions;
          kpi.beds_per_1k_65 /= kRegions;
        }

        if (!cancelled) setState({ loading:false, err:null, rollups:{ gpByR, phByR, nhByR, stByR, bedsByR }, kpi, nutsRegions });
      } catch (e:any) {
        if (!cancelled) setState({ loading:false, err:String(e?.message ?? e), rollups:{}, kpi:{}, nutsRegions:[] });
      }
    })();
    return () => { cancelled = true; };
  }, [year, nutsUrl, gpUrl, pharmUrl, nhUrl, stopsUrl, bedsUrl, JSON.stringify(pop65ByRegion)]);

  const toMatrix = (byR: Record<string, number>) => byR; // simple snapshot matrix per region

  return { ...state, toMatrix };
}
