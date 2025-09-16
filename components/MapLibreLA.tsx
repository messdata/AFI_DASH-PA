"use client";

// components/MapLibreLA.tsx — selection highlight + choropleth (normalized) + id mapping
// - Accepts canonical county keys from the parent (e.g., "cork").
// - Maps them to GeoJSON feature names (e.g., "Cork County Council") via nameField.
// - Keeps choropleth + selection layers in sync and auto-zooms to selection.

import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type ChoroplethRow = { LA: string; value: number };

export type MapLibreLAProps = {
  rows: ChoroplethRow[];
  geojsonPath: string;
  nameField: string;                 // e.g. "ENG_NAME_VALUE"
  selectedRegions?: string[];        // kept for API parity (unused)
  selectedCounties?: string[];       // canonical keys from parent filters, e.g. "cork"
  selectionColors?: Record<string, string>; // key: canonical or feature name
  onFeatureClick?: (la: string) => void;    // emits feature name (exact from GeoJSON)
  onSelectCounty?: (la: string) => void;    // backward-compat alias
};

// --- helpers ---------------------------------------------------------------
function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function canonCounty(s: string) {
  const x = stripDiacritics(String(s || "").toLowerCase())
    .replace(/\bcounty\s+council\b/g, "")
    .replace(/\bcity\s+and\s+county\b/g, "")
    .replace(/\bcouncil\b/g, "")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (x.endsWith(" city and county")) return x.slice(0, -" city and county".length);
  if (x.endsWith(" county")) return x.slice(0, -" county".length);
  return x;
}

export default function MapLibreLA({
  rows,
  geojsonPath,
  nameField,
  selectedRegions, // unused but preserved
  selectedCounties = [],
  selectionColors = {},
  onFeatureClick,
  onSelectCounty,
}: MapLibreLAProps) {
  const mapRef = useRef<MLMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // canonical key -> feature name (as in `nameField`)
  const [idMap, setIdMap] = useState<Record<string, string>>({});

  // Build value lookup & min/max
  const { valueByLA, min, max } = useMemo(() => {
    const m = new globalThis.Map<string, number>();
    let mn = Infinity, mx = -Infinity;
    for (const r of rows ?? []) {
      const key = canonCounty(r.LA);
      const v = Number(r.value);
      if (!Number.isFinite(v)) continue;
      m.set(key, v);
      mn = Math.min(mn, v); mx = Math.max(mx, v);
    }
    if (mn === Infinity) { mn = 0; mx = 1; }
    return { valueByLA: m, min: mn, max: mx };
  }, [rows]);

  // Style with feature-state driven choropleth (expects 0..1 normalized state)
  const style = useMemo<any>(() => ({
    version: 8,
    sources: {
      osm: { type: "raster", tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" },
      counties: { type: "geojson", data: geojsonPath, promoteId: nameField },
    },
    layers: [
      { id: "osm", type: "raster", source: "osm" },
      {
        id: "counties-fill",
        type: "fill",
        source: "counties",
        paint: {
          // 0..1 -> light..dark blue
          "fill-color": [
            "interpolate", ["linear"], ["to-number", ["feature-state", "value"], 0],
            0, "#eef4ff",
            0.25, "#c9dafd",
            0.5, "#98bbff",
            0.75, "#5d98ff",
            1, "#3b82f6"
          ],
          "fill-opacity": 0.65,
        },
      },
      {
        id: "counties-selected",
        type: "fill",
        source: "counties",
        filter: ["in", ["get", nameField], ["literal", []]],
        paint: { "fill-color": "#f59e0b", "fill-opacity": 0.7 },
      },
      { id: "counties-line", type: "line", source: "counties", paint: { "line-color": "#1e3a8a", "line-width": 1 } },
    ],
  }), [geojsonPath, nameField]);

  // mount
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [-7.8, 53.3],
      zoom: 5.6,
      attributionControl: false,
    });

    // click → emit feature name (parent can canonicalize/handle)
    map.on("click", "counties-fill", (e) => {
      const f = e.features?.[0];
      const la = f?.properties?.[nameField] as string | undefined;
      const emit = onFeatureClick ?? onSelectCounty;
      if (la && emit) emit(la);
    });

    mapRef.current = map;
  }, [style, nameField, onFeatureClick, onSelectCounty]);

  // build idMap from rendered features (maps canonical → feature name)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const build = () => {
      const feats = map.queryRenderedFeatures({ layers: ["counties-fill"] });
      const next: Record<string, string> = {};
      for (const f of feats) {
        const n = String(f.properties?.[nameField] ?? "");
        if (!n) continue;
        next[canonCounty(n)] = n;
      }
      setIdMap(next);
    };
    if (map.isStyleLoaded()) build(); else map.once("idle", build);
  }, [nameField]);

  // update choropleth feature-states (normalized to 0..1) + selection color overrides
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const apply = () => {
      const denom = max > min ? (max - min) : 1;
      // value feature-state (normalized)
      for (const [key, v] of valueByLA.entries()) {
        const id = idMap[key] ?? key; // fall back gracefully
        const norm = Math.max(0, Math.min(1, (v - min) / denom));
        map.setFeatureState({ source: "counties", id }, { value: norm });
      }
      // selected color override (match by feature name)
      const pairs: (string | any)[] = [];
      for (const [k, hex] of Object.entries(selectionColors)) {
        const id = idMap[canonCounty(k)] ?? idMap[k] ?? k;
        if ((selectedCounties ?? []).some((sc) => canonCounty(sc) === canonCounty(k))) {
          pairs.push(id, hex);
        }
      }
      const matchExpr = ["match", ["get", nameField], ...pairs, "#f59e0b"];
      map.setPaintProperty("counties-selected", "fill-color", matchExpr as any);
    };
    if (map.isStyleLoaded()) apply(); else map.once("idle", apply);
  }, [valueByLA, min, max, idMap, nameField, selectionColors, selectedCounties]);

  // apply selection filter + fitBounds
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const run = () => {
      const list = Array.from(
        new Set((selectedCounties ?? []).map((k) => idMap[canonCounty(k)] ?? idMap[k] ?? k))
      ).filter(Boolean);
      const filter = ["in", ["get", nameField], ["literal", list]] as any;
      map.setFilter("counties-selected", filter);

      if (list.length) {
        const feats = map.queryRenderedFeatures({ layers: ["counties-fill"] })
          .filter((f) => list.includes(String(f.properties?.[nameField])));
        if (feats.length) {
          let b = [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number];
          for (const f of feats) {
            const geom: any = f.geometry;
            const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
            for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
              b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
            }
          }
          if (Number.isFinite(b[0])) {
            map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 400 });
          }
        }
      }
    };
    if (map.isStyleLoaded()) run(); else map.once("idle", run);
  }, [selectedCounties, idMap, nameField]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", borderRadius: 16, overflow: "hidden" }}
    />
  );
}
