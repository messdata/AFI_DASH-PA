// app/supply/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Select from "react-select";
import Papa from "papaparse";
import RankedBarsChartJS from "../../components/RankedBarsChartJS";

// Map is client-only
const MapLibreLA = dynamic(() => import("../../components/MapLibreLA"), { ssr: false });

// --- Types -----------------------------------------------------------------
type ProjLongRow = {
  year: string;           // e.g., "2024"
  scenario: string;       // Baseline | 50:50 City | High Migration | Low Migration
  age: number | null;     // single year of age (0..100+). null allowed if dataset uses non-numeric codes.
  countyRaw: string;      // label from CSV
  countyKey: string;      // canonical key (lowercase, no suffixes)
  value: number;          // projected population
};

// --- Canon helpers ----------------------------------------------------------
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
function niceCounty(label: string) {
  return label
    .replace(/\b(CITY|COUNTY)\s+COUNCIL\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
}

// deterministic color for a county key
function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 55%)`;
}

// Paths and map config
const CSV_PATHS = ["/data/PopLAPro_2050.csv", "/data/esri_population_projections_by_local_authority.csv"];
const GEOJSON_PATH = "/data/la_boundaries_simplified.geojson";
const GEO_NAME_FIELD = "ENG_NAME_VALUE";

// --- Age banding ------------------------------------------------------------
type AgeBandKey = "ALL" | "65PLUS" | "85PLUS";
const AGE_BANDS: { key: AgeBandKey; label: string; inBand: (age: number | null) => boolean }[] = [
  { key: "ALL", label: "All ages", inBand: (_a) => true },
  { key: "65PLUS", label: "65+", inBand: (a) => (a ?? -1) >= 65 },
  { key: "85PLUS", label: "85+", inBand: (a) => (a ?? -1) >= 85 },
];

// --- Component --------------------------------------------------------------
export default function SupplyPage() {
  const [rows, setRows] = useState<ProjLongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [years, setYears] = useState<string[]>([]);        // multi-select OK
  const [scenario, setScenario] = useState<string>("Baseline/Business as usual");
  const [ageBand, setAgeBand] = useState<AgeBandKey>("ALL");
  const [counties, setCounties] = useState<string[]>([]);  // canonical keys

  // load CSV once (wide → long)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      let csvText: string | null = null;
      for (const p of CSV_PATHS) {
        try {
          const res = await fetch(p, { cache: "no-store" });
          if (res.ok) {
            csvText = await res.text();
            break;
          }
        } catch {}
      }
      if (!csvText) {
        setError(`CSV not found. Tried: ${CSV_PATHS.join(", ")}`);
        setLoading(false);
        return;
      }

      const parsed = Papa.parse<Record<string, string | number>>(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      if (parsed.errors?.length) {
        setError(parsed.errors.map((e) => e.message).join("; "));
        setLoading(false);
        return;
      }

      const sample = (parsed.data as any[]).find(Boolean) || {};
      const yearCols = Object.keys(sample).filter((k) => /^year_\d{4}$/i.test(k));
      if (!yearCols.length) {
        setError("No year_* columns found in CSV (expected year_2020…year_2040).");
        setLoading(false);
        return;
      }

      const cooked: ProjLongRow[] = [];
      for (const row of parsed.data as any[]) {
        if (!row) continue;
        const bag: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) bag[k.toLowerCase()] = v;

        const la =
          bag["local authority"] ??
          bag["local_authority"] ??
          bag["la"] ??
          bag["county"] ??
          "";
        const scenario = String(bag["scenario"] ?? "").trim();
        const ageRaw = bag["age"];
        // CSV has numeric 'Age' column (0..100+). Coerce safely.
        let age: number | null = null;
        if (ageRaw !== undefined && ageRaw !== null && String(ageRaw).trim() !== "") {
          const m = String(ageRaw).trim().match(/^(\d+)/);
          age = m ? Number(m[1]) : Number(ageRaw);
          if (!Number.isFinite(age)) age = null;
        }

        for (const ycol of yearCols) {
          const y = ycol.replace(/^year_/i, "");
          const valNum = Number((row as any)[ycol]);
          if (!la || !scenario || !y || !Number.isFinite(valNum)) continue;
          cooked.push({
            year: y,
            scenario,
            age,
            countyRaw: String(la).trim(),
            countyKey: canonCounty(String(la)),
            value: valNum,
          });
        }
      }

      setRows(cooked);
      setLoading(false);
    })();
  }, []);

  // unique lists
  const allYears = useMemo(
    () => Array.from(new Set(rows.map((r) => r.year))).sort(),
    [rows]
  );
  const allScenarios = useMemo(
    () => Array.from(new Set(rows.map((r) => r.scenario))).sort(),
    [rows]
  );
  const allCounties = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (!m.has(r.countyKey)) m.set(r.countyKey, r.countyRaw);
    });
    return Array.from(m.entries()).map(([key, raw]) => ({ key, raw }));
  }, [rows]);

  // default selections on first load: latest year & first scenario present
  useEffect(() => {
    if (!years.length && allYears.length) {
      setYears([allYears[allYears.length - 1]]); // latest (likely 2040)
    }
  }, [allYears, years.length]);
  useEffect(() => {
    if (!scenario && allScenarios.length) {
      setScenario(allScenarios[0]);
    }
  }, [allScenarios, scenario]);

  // filter to Year(s) + Scenario + AgeBand + County picks (if any)
  const filtered = useMemo(() => {
    if (!rows.length) return [];
    const yrs = new Set(years.length ? years : allYears);
    const cs = new Set(counties.length ? counties : allCounties.map((c) => c.key));
    const inBand = AGE_BANDS.find((b) => b.key === ageBand)?.inBand ?? AGE_BANDS[0].inBand;

    return rows.filter(
      (r) =>
        r.scenario === scenario &&
        yrs.has(r.year) &&
        cs.has(r.countyKey) &&
        inBand(r.age)
    );
  }, [rows, years, scenario, ageBand, counties, allYears, allCounties]);

  // aggregate to county for map + bars
  const mapRows = useMemo(() => {
    const agg = new Map<string, number>();
    for (const r of filtered) agg.set(r.countyKey, (agg.get(r.countyKey) ?? 0) + r.value);
    return Array.from(agg.entries()).map(([k, v]) => ({ LA: k, value: v }));
  }, [filtered]);

  const bars = useMemo(() => {
    const by = new Map<string, { label: string; key: string; value: number }>();
    for (const r of filtered) {
      const curr = by.get(r.countyKey) ?? {
        label: niceCounty(r.countyRaw),
        key: r.countyKey,
        value: 0,
      };
      curr.value += r.value;
      by.set(r.countyKey, curr);
    }
    return Array.from(by.values()).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // color map for counties (stable)
  const countyColor: Record<string, string> = useMemo(() => {
    const out: Record<string, string> = {};
    for (const c of allCounties) out[c.key] = colorFor(c.key);
    return out;
  }, [allCounties]);

  // selection handlers
  const toggleCounty = useCallback((labelOrKey: string) => {
    const key = canonCounty(labelOrKey);
    setCounties((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  // selection colors (only for selected keys)
  const selectionColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const k of counties) map[k] = countyColor[k] ?? colorFor(k);
    return map;
  }, [counties, countyColor]);

  const MAP_HEIGHT = 560;

  // shared Select styles (dark)
  const selectStyles = {
    option: (base: any, state: any) => ({
      ...base,
      color: state.isSelected ? "#0b1320" : "white",
      backgroundColor: state.isFocused
        ? "#1e293b"
        : state.isSelected
        ? "#e2e8f0"
        : "#0b1320",
    }),
    menu: (base: any) => ({ ...base, backgroundColor: "#0b1320" }),
    menuList: (base: any) => ({ ...base, backgroundColor: "#0b1320" }),
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: "#0b1320",
      borderColor: state.isFocused ? "#60a5fa" : "#334155",
      boxShadow: state.isFocused ? "0 0 0 1px #60a5fa" : "none",
      ":hover": { borderColor: state.isFocused ? "#60a5fa" : "#475569" },
    }),
    valueContainer: (base: any) => ({ ...base, color: "white" }),
    placeholder: (base: any) => ({ ...base, color: "#94a3b8" }),
    input: (base: any) => ({ ...base, color: "white" }),
    multiValue: (base: any) => ({ ...base, backgroundColor: "#1f2937" }),
    multiValueLabel: (base: any) => ({ ...base, color: "#e5e7eb" }),
    multiValueRemove: (base: any) => ({
      ...base,
      color: "#cbd5e1",
      ":hover": { backgroundColor: "#334155", color: "white" },
    }),
    clearIndicator: (base: any) => ({ ...base, color: "#cbd5e1", ":hover": { color: "white" } }),
    dropdownIndicator: (base: any) => ({ ...base, color: "#cbd5e1", ":hover": { color: "white" } }),
    indicatorSeparator: () => ({ display: "none" }),
  };

  return (
    <div className="min-h-screen w-full p-6 space-y-4 bg-[#0b1320] text-slate-100">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Year(s) */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Year</label>
          <Select
            instanceId="years"
            isMulti
            options={allYears.map((y) => ({ value: y, label: y }))}
            value={years.map((y) => ({ value: y, label: y }))}
            onChange={(vals) => setYears(vals.map((v: any) => v.value))}
            placeholder="Select years"
            classNamePrefix="sel"
            styles={selectStyles}
          />
        </div>

        {/* Scenario (single) */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Scenario</label>
          <Select
            instanceId="scenario"
            isMulti={false}
            options={allScenarios.map((s) => ({ value: s, label: s }))}
            value={scenario ? { value: scenario, label: scenario } : null}
            onChange={(val: any) => setScenario(val?.value ?? "")}
            placeholder="Choose scenario"
            classNamePrefix="sel"
            styles={selectStyles}
          />
        </div>

        {/* Age Band */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">Age band</label>
          <div className="flex gap-2">
            {AGE_BANDS.map((b) => (
              <button
                key={b.key}
                onClick={() => setAgeBand(b.key)}
                className={`px-3 py-2 rounded-lg border text-sm transition ${
                  ageBand === b.key
                    ? "bg-sky-600/20 border-sky-400 text-sky-200"
                    : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700/80"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* County multi-select (optional narrowing / highlight) */}
        <div>
          <label className="mb-1 block text-sm text-slate-300">County</label>
          <Select
            instanceId="counties"
            isMulti
            options={allCounties
              .map((c) => ({ value: c.key, label: niceCounty(c.raw) }))
              .sort((a, b) => a.label.localeCompare(b.label))}
            value={counties.map((k) => ({
              value: k,
              label: niceCounty(allCounties.find((c) => c.key === k)?.raw ?? k),
            }))}
            onChange={(vals) => setCounties(vals.map((v: any) => v.value))}
            placeholder="Select counties (optional)"
            classNamePrefix="sel"
            styles={selectStyles}
          />
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <div
          className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 relative"
          style={{ height: MAP_HEIGHT }}
        >
          {loading && (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">
              Loading…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center text-red-300 text-sm p-4 text-center">
              {error}
            </div>
          )}
          {!loading && !error && (
            <MapLibreLA
              rows={mapRows}
              geojsonPath={GEOJSON_PATH}
              nameField={GEO_NAME_FIELD}
              selectedCounties={counties}
              selectionColors={selectionColors}
              onSelectCounty={toggleCounty}
            />
          )}
          <div className="absolute bottom-3 left-3 text-xs text-slate-300/80 bg-black/40 backdrop-blur px-2 py-1 rounded-md">
            Tip: pick Year(s), Scenario and Age band to populate the choropleth & bars.
          </div>
        </div>

        {/* Ranked bars */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4" style={{ height: MAP_HEIGHT }}>
          <div className="text-slate-300 text-sm mb-2">
            Total projected population — {ageBand === "ALL" ? "All ages" : ageBand === "65PLUS" ? "65+" : "85+"}
            {scenario ? ` · ${scenario}` : ""}{years.length ? ` · ${years.join(", ")}` : ""}
          </div>
          <RankedBarsChartJS
            rows={bars.map((b) => ({ county: b.label, value: b.value }))}
            colors={bars.map((b) => countyColor[b.key] ?? colorFor(b.key))}
            onBarClick={(county) => toggleCounty(county)}
          />
        </div>
      </div>
    </div>
  );
}
