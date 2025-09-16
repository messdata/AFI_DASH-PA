// app/datasets/page.tsx
"use client";

import React from "react";

// ------------------------------
// Types
// ------------------------------
type WhereUsed = "MCDA" | "Gap" | "Demand";
type Dataset = {
  id: string;
  title: string;
  provider: string;
  where: WhereUsed[];
  coverage: { from: number; to: number | "ongoing" };
  geography: string;
  files: { path: string; note?: string }[];
  refs: { label: string; href: string }[];
  summary: string;
  notes?: string[];
};

// ------------------------------
// Data registry (edit here)
// ------------------------------
const DATASETS: Dataset[] = [
  // ---- MCDA / Access ----
  {
    id: "hospital_access_by_county",
    title: "Hospital access by county (derived)",
    provider: "AFI-Dash (derived from HSE hospitals + ESRI projections)",
    where: ["MCDA"],
    coverage: { from: 2022, to: 2040 },
    geography: "Local Authority (31 LAs)",
    files: [
      { path: "/data/mcda/hospital_access_by_county.csv", note: "county, hospitals_total, acute_hospitals_count, hospitals_per_100k_65 ..." },
    ],
    refs: [
      { label: "HSE Hospitals (data.gov.ie)", href: "https://data.gov.ie/" },
      { label: "ESRI Population Projections (county)", href: "https://www.esri.ie/publications/regional-demographics-and-structural-housing-demand-at-a-county-level" },
    ],
    summary:
      "County-level availability & access proxy for acute care. Aggregates hospital sites and (where available) normalises by 65+ population (per 100k) to compare access needs across counties. Used as the Access component in MCDA funding allocation.",
    notes: [
      "If hospitals_per_100k_65 is unavailable, the app falls back to site counts (transparent, but less comparable).",
    ],
  },
  {
    id: "hse_hospitals",
    title: "Hospitals — HSE Ireland (points)",
    provider: "HSE / data.gov.ie",
    where: ["MCDA"],
    coverage: { from: 2022, to: "ongoing" },
    geography: "Point locations (national)",
    files: [
      { path: "/data/mcda/Hospitals_-_HSE_Ireland.geojson", note: "authoritative points (recommended)" },
      { path: "/data/mcda/Hospitals_-_HSE_Ireland.csv", note: "attribute cross-check" },
    ],
    refs: [
      { label: "data.gov.ie (Hospitals)", href: "https://data.gov.ie/" },
      { label: "HSE Hospital Groups", href: "https://www.hse.ie/" },
    ],
    summary:
      "Hospital facility list used to build county aggregates, nearest-hospital logic, and (optionally) pressure overlays via NTPF. Feeds the derived hospital_access_by_county dataset.",
  },

  // ---- Gap / Capacity ----
  {
    id: "hiqa_register",
    title: "HIQA — Older Persons Register (centres & registered places)",
    provider: "HIQA",
    where: ["Gap", "MCDA"],
    coverage: { from: 2023, to: "ongoing" },
    geography: "Designated centres (national); aggregated to county",
    files: [
      { path: "/data/gap/older_persons_register.csv", note: "raw export (optional, if stored locally)" },
      { path: "/data/gap/hiqa_beds_by_county.csv", note: "derived: county, beds_total, centres" },
    ],
    refs: [
      { label: "HIQA register CSV (live export)", href: "https://www.hiqa.ie/centre/export/older_persons_register.csv?_format=csv" },
      { label: "HIQA Older Persons services", href: "https://www.hiqa.ie/" },
    ],
    summary:
      "Regulatory register of designated centres for older persons, including Maximum Occupancy (registered places). Aggregated to county for Residential Care Gap: Required beds (benchmark × 85+ headcount) − Available beds.",
    notes: [
      "Registered places are not the same as staffed beds; annotate this caveat on the Gap page.",
    ],
  },
  {
    id: "hse_home_support",
    title: "HSE — Home Support activity (OP53/OP54)",
    provider: "HSE",
    where: ["Gap"],
    coverage: { from: 2020, to: "ongoing" },
    geography: "CHO / Health Region (optionally by county if available)",
    files: [
      { path: "/data/gap/hse_home_support_hours.csv", note: "year, month, region, delivered_hours, people_in_receipt" },
    ],
    refs: [
      { label: "HSE KPIs (Older Persons)", href: "https://www.hse.ie/" },
      { label: "HSE Performance Profiles", href: "https://www.hse.ie/" },
    ],
    summary:
      "Delivered Home Support hours (and recipients) used to compute Home Support Gap: benchmark hours per 1k aged 65+ minus delivered hours.",
  },

  // ---- Demand / Demographics ----
  {
    id: "esri_popla",
    title: "ESRI — Population projections by LA × age × scenario",
    provider: "ESRI",
    where: ["Demand", "Gap", "MCDA"],
    coverage: { from: 2017, to: 2040 },
    geography: "Local Authority (31 LAs), single-year age",
    files: [
      { path: "/data/PopLAPro_2050.csv", note: "extended to 2050 where applicable" },
    ],
    refs: [
      { label: "ESRI publication", href: "https://www.esri.ie/publications/regional-demographics-and-structural-housing-demand-at-a-county-level" },
      { label: "NPF (50:50 City policy context)", href: "https://npf.ie/" },
    ],
    summary:
      "Backbone for headcounts (esp. 65+ and 85+), growth rates, and scenario comparisons (Baseline, 50:50 City, High/Low Migration). Also used as denominator for access and capacity metrics.",
  },
  {
    id: "cso_oadr_tdr",
    title: "CSO — Projected Dependency Ratios from 2022 (OADR, TDR)",
    provider: "CSO",
    where: ["Demand", "MCDA"],
    coverage: { from: 2023, to: 2057 },
    geography: "National/Regional; mapped to county where appropriate",
    files: [
      { path: "/data/demand/Projected Dependency Ratios from 2022.csv" },
    ],
    refs: [
      { label: "CSO Older Persons Hub", href: "https://www.cso.ie/" },
      { label: "Population & Labour Force Projections", href: "https://www.cso.ie/" },
    ],
    summary:
      "Official burden ratios: OADR (65+ / 15–64) and TDR ((0–14 + 65+) / 15–64). Used for pressure KPIs and MCDA burden criteria.",
  },
  {
    id: "cso_births_deaths",
    title: "CSO — Projected Annual Births & Deaths",
    provider: "CSO",
    where: ["Demand"],
    coverage: { from: 2023, to: 2057 },
    geography: "National/Regional; contextual for county",
    files: [
      { path: "/data/demand/Projected Annual Births and Deaths.csv" },
    ],
    refs: [
      { label: "CSO Projections (PEC tables)", href: "https://www.cso.ie/" },
    ],
    summary:
      "Natural increase (births − deaths) driver for future ageing; supports narrative for scenario differences.",
  },
  {
    id: "census_disability",
    title: "Census 2022 — Disability (Profile 4)",
    provider: "CSO",
    where: ["Demand", "MCDA"],
    coverage: { from: 2022, to: 2022 },
    geography: "County (can be ED/SA for deep dives)",
    files: [
      { path: "/data/demand/disabilty.csv" },
    ],
    refs: [
      { label: "Census 2022 Profile 4", href: "https://www.cso.ie/" },
    ],
    summary:
      "Share/number of people with a long-lasting condition by age. For Demand/MCDA, we use % of 65+ (and optionally 85+) as a need-intensity lens.",
  },
  {
    id: "cso_labour_force",
    title: "CSO — Actual & Projected Labour Force from 2022",
    provider: "CSO",
    where: ["MCDA", "Demand"],
    coverage: { from: 2022, to: 2057 },
    geography: "National/Regional (used for support ratios)",
    files: [
      { path: "/data/demand/Actual and Projected Labour Force from 2022.csv" },
    ],
    refs: [
      { label: "CSO Labour Force Projections", href: "https://www.cso.ie/" },
    ],
    summary:
      "Adds capacity context: workers-per-65+ (or 85+) as a complement to OADR; useful for MCDA sensitivity.",
  },
];

// ------------------------------
// Helpers
// ------------------------------
const byChronology = (a: Dataset, b: Dataset) => {
  const ta = a.coverage.from;
  const tb = b.coverage.from;
  if (ta !== tb) return ta - tb;
  const enda = a.coverage.to === "ongoing" ? 9999 : a.coverage.to;
  const endb = b.coverage.to === "ongoing" ? 9999 : b.coverage.to;
  return (enda as number) - (endb as number);
};

function fmtCoverage(c: Dataset["coverage"]) {
  const end = c.to === "ongoing" ? "ongoing" : String(c.to);
  return `${c.from}–${end}`;
}

const TAG_COLORS: Record<WhereUsed, string> = {
  MCDA: "bg-sky-600/20 text-sky-200 border-sky-700/40",
  Gap: "bg-amber-600/20 text-amber-200 border-amber-700/40",
  Demand: "bg-emerald-600/20 text-emerald-200 border-emerald-700/40",
};

// ------------------------------
// Page
// ------------------------------
export default function DatasetsPage() {
  const [scope, setScope] = React.useState<"All" | WhereUsed>("All");
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    let rows = [...DATASETS];
    if (scope !== "All") rows = rows.filter(d => d.where.includes(scope));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter(d =>
        d.title.toLowerCase().includes(s) ||
        d.provider.toLowerCase().includes(s) ||
        d.summary.toLowerCase().includes(s) ||
        d.files.some(f => f.path.toLowerCase().includes(s))
      );
    }
    return rows.sort(byChronology);
  }, [scope, q]);

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 space-y-6 bg-[#0b1320] text-slate-100">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Datasets — Sources & Usage</h1>
          <p className="text-slate-300 text-sm mt-1">
            Chronological registry of the datasets used across the dashboard. Each entry includes coverage, geography, file paths, and source references (HSE, CSO, HIQA, ESRI, data.gov.ie).
          </p>
        </div>
        <div className="flex gap-2">
          {(["All","MCDA","Gap","Demand"] as const).map(k => (
            <button
              key={k}
              onClick={() => setScope(k)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                scope === k ? "bg-slate-800 border-sky-600 text-sky-200"
                            : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <label className="text-xs text-slate-400">Search</label>
        <input
          className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2"
          placeholder="Find by title, provider, path..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(d => (
          <article key={d.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-slate-100 font-medium leading-tight">{d.title}</h3>
                <div className="text-slate-400 text-xs mt-0.5">{d.provider}</div>
              </div>
              <div className="flex gap-1">
                {d.where.map(w => (
                  <span key={w} className={`px-2 py-0.5 rounded-md text-[11px] border ${TAG_COLORS[w]}`}>{w}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[13px] text-slate-300">
              <div>
                <div className="text-slate-400 text-xs">Coverage</div>
                <div>{fmtCoverage(d.coverage)}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">Geography</div>
                <div>{d.geography}</div>
              </div>
            </div>

            <p className="text-sm text-slate-200">{d.summary}</p>
            {d.notes && d.notes.length > 0 && (
              <ul className="list-disc list-inside text-xs text-slate-400">
                {d.notes.map((n,i) => <li key={i}>{n}</li>)}
              </ul>
            )}

            <div>
              <div className="text-slate-400 text-xs mb-1">Files in this repo</div>
              <ul className="space-y-1">
                {d.files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <code className="text-[12px] bg-slate-950 border border-slate-800 px-2 py-1 rounded">{f.path}</code>
                    {f.note && <span className="text-[11px] text-slate-400">{f.note}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto">
              <div className="text-slate-400 text-xs mb-1">References</div>
              <div className="flex flex-wrap gap-2">
                {d.refs.map((r, i) => (
                  <a
                    key={i}
                    href={r.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] px-2 py-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sky-200"
                  >
                    {r.label}
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

      <footer className="text-[12px] text-slate-400 pt-2">
        <p>
          Notes: Coverage reflects data vintage or projection horizon. HIQA register counts reflect registered places; staffing levels may differ. ESRI scenarios follow NPF-aligned assumptions; CSO projections use M-scenario frameworks. External links open on provider sites (HSE, CSO, HIQA, ESRI, data.gov.ie).
        </p>
      </footer>
    </main>
  );
}
