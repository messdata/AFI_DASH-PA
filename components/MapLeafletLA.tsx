"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import L, { GeoJSON as LGeoJSON } from "leaflet";
import { normalizeCountyKey } from "@/lib/useNDQData";

type Row = { LA: string; value: number };
type Filters = { years: string[]; quarters: string[]; counties: string[] };

type Props = {
  rows: Row[];
  filters: Filters;
  geojsonPath: string;      // e.g. "/data/la_boundaries_simplified.geojson"
  nameField: string;        // e.g. "ENG_NAME_VALUE"
  onSelectCounty?: (name: string) => void;
};

// simple 5-class color ramp (low → high)
function ramp(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return "#374151"; // gray for missing
  if (max <= min) return "#10b981"; // all same → teal
  const t = (v - min) / (max - min);
  if (t < 0.2) return "#93c5fd";
  if (t < 0.4) return "#60a5fa";
  if (t < 0.6) return "#3b82f6";
  if (t < 0.8) return "#2563eb";
  return "#1d4ed8";
}

export default function MapLeafletLA({
  rows,
  filters,
  geojsonPath,
  nameField,
  onSelectCounty,
}: Props) {
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  const gjRef = useRef<LGeoJSON | null>(null);

  // fetch local GeoJSON file
  useEffect(() => {
    let alive = true;
    fetch(geojsonPath)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setFc(j as FeatureCollection);
      })
      .catch(() => alive && setFc(null));
    return () => {
      alive = false;
    };
  }, [geojsonPath]);

  // value lookup by normalized name
  const valueByKey = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => {
      const k = normalizeCountyKey(r.LA);
      if (k) m.set(k, Number(r.value));
    });
    return m;
  }, [rows]);

  const [min, max] = useMemo(() => {
    const vals = [...valueByKey.values()].filter((v) => Number.isFinite(v));
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0];
  }, [valueByKey]);

  // style fn uses current data + selection
  const styleFor = (feature: Feature<Geometry, any>) => {
    const raw = String(feature?.properties?.[nameField] ?? "");
    const k = normalizeCountyKey(raw);
    const v = valueByKey.get(k);
    const isSelected = filters.counties.includes(k);
    return {
      weight: isSelected ? 2.5 : 1,
      color: isSelected ? "#fbbf24" : "#101010",
      fillOpacity: 0.85,
      fillColor: ramp(v ?? NaN, min, max),
    };
  };

  // update styles whenever rows/filters change
  useEffect(() => {
    if (!gjRef.current) return;
    gjRef.current.eachLayer((layer: any) => {
      const f = layer.feature as Feature;
      layer.setStyle(styleFor(f));
      const nm = String(f?.properties?.[nameField] ?? "Unknown LA");
      const k = normalizeCountyKey(nm);
      const v = valueByKey.get(k);
      const text = Number.isFinite(v) ? `${nm}: ${v}` : nm;
      layer.bindTooltip(text, { sticky: true });
    });
  }, [valueByKey, min, max, filters, nameField]);

  // events per feature
  const onEach = (feature: Feature, layer: any) => {
    const nm = String(feature?.properties?.[nameField] ?? "Unknown LA");
    layer.setStyle(styleFor(feature));
    layer.on({
      mouseover: () => layer.setStyle({ weight: 2, color: "#f8fafc" }),
      mouseout: () => layer.setStyle(styleFor(feature)),
      click: () => {
        onSelectCounty?.(nm);
        // smooth zoom to county but cap zoom to avoid “zoom jumps too much”
        const b = layer.getBounds?.();
        const map = layer._map as L.Map | undefined;
        if (b && map) map.fitBounds(b, { padding: [12, 12], maxZoom: 9 });
      },
    });
  };

  const center = useMemo(() => ({ lat: 53.4, lng: -8.0 }), []);

  return (
    <MapContainer center={center} zoom={6} style={{ height: 560, width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {fc && (
        <GeoJSON
          data={fc as any}
          onEachFeature={onEach}
          ref={(ref) => {
            // react-leaflet types: the ref is a layer container with .leafletElement in v3 prior,
            // but in current it’s the L.GeoJSON instance itself
            gjRef.current = (ref as any) || null;
          }}
        />
      )}
    </MapContainer>
  );
}
