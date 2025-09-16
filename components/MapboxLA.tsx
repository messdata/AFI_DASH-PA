"use client";
import MapGL, { Source, Layer, type MapMouseEvent } from 'react-map-gl/mapbox';
import "mapbox-gl/dist/mapbox-gl.css";
import type { FeatureCollection } from 'geojson';
import { useEffect, useMemo, useState } from "react";
import type { Row } from "@/lib/useNDQData";
import { canonicalLA } from "@/lib/normalize";

type Props = {
  rows: Row[];                 // filtered rows (applyFilters already done)
  geojsonPath?: string;        // default local
  nameField?: string;          // property holding LA name in GeoJSON
  onSelectCounty?: (name: string) => void;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const DEFAULT_GEOJSON = "/data/la_boundaries.geojson";
const DEFAULT_NAME_FIELD = "LA_NAME";

export default function MapboxLA({
  rows,
  geojsonPath = DEFAULT_GEOJSON,
  nameField = DEFAULT_NAME_FIELD,
  onSelectCounty,
}: Props) {
  const [bounds, setBounds] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(geojsonPath);
      setBounds(await res.json());
    })();
  }, [geojsonPath]);

  // Sum completions by LA (use canonical name to join)
  const totals = useMemo(() => {
    const m: globalThis.Map<string, number> = new globalThis.Map();
    rows.forEach((r) => {
      const key = canonicalLA(r.LA);
      m.set(key, (m.get(key) || 0) + r.value);
    });
    return m;
  }, [rows]);

  // Inject "value" onto features for styling
  const styled = useMemo(() => {
    if (!bounds) return null;
    const copy: any = structuredClone(bounds);
    copy.features.forEach((f: any) => {
      const raw = f.properties?.[nameField] ?? "";
      f.properties.value = totals.get(canonicalLA(raw)) || 0;
    });
    return copy;
  }, [bounds, totals, nameField]);

  // Choropleth colors (step)
  const fillPaint: any = {
    "fill-color": [
      "step", ["get", "value"],
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
  };
  const linePaint: any = { "line-color": "#1f2937", "line-width": 0.6 };

  // Optional text labels (name + value)
  const labelLayout: any = {
    "text-field": ["format",
      ["get", nameField], { "font-scale": 1.0 },
      "\n", {},
      ["to-string", ["get", "value"]], { "font-scale": 0.8 }
    ],
    "text-size": 12,
    "text-justify": "center",
    "text-anchor": "center",
    "text-allow-overlap": false
  };
  const labelPaint: any = {
    "text-color": "#e5e7eb",
    "text-halo-color": "#111827",
    "text-halo-width": 1.2
  };

  const handleClick = (e: MapMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const name = String(f.properties?.[nameField] ?? "");
    onSelectCounty?.(name);
  };

  return (
    <div className="map-wrap">
      <MapGL
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        initialViewState={{ longitude: -7.7, latitude: 53.35, zoom: 6.5 }}
        interactiveLayerIds={["la-fill"]}
        onClick={handleClick}
      >
        {styled && (
          <Source id="la" type="geojson" data={styled}>
            <Layer id="la-fill" type="fill" paint={fillPaint} />
            <Layer id="la-line" type="line" paint={linePaint} />
            <Layer id="la-labels" type="symbol" layout={labelLayout} paint={labelPaint} />
          </Source>
        )}
      </MapGL>
    </div>
  );
}
