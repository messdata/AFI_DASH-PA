// app/docs/page.tsx
"use client";

import React from "react";
import Link from "next/link";

type PageMeta = {
  route: string;
  title: string;
  summary: string;
  kpis?: string[];
  charts?: string[];
  map?: string;
  methods?: { name: string; formula?: string; notes?: string[] }[];
  datasets?: { name: string; file?: string; purpose: string }[];
  status?: "ready"|"wip"|"planned";
};

const PAGES: PageMeta[] = [
  {
    route: "/",
    title: "Overview",
    summary: "Landing overview of AFI metrics (high-level).",
    status: "planned",
  },
  {
    route: "/demand",
    title: "Demand",
    summary: "Demographic demand: 65+ growth, OADR, and projections with heatmap & scatter; NUTS‑3 selectable map.",
    kpis: ["65+ Growth %", "85+ Growth %", "OADR", "Projected 65+ headcount", "Δ65+ from today"],
    charts: ["65+ Growth trend (lines)", "Region × Year heatmap (growth %)", "OADR vs 65+ Growth (scatter)"],
    map: "County polygons; highlights/zooms by NUTS‑3 selection",
    methods: [
      {
        name: "Old-Age Dependency Ratio (OADR)",
        formula: "OADR = population_65plus / population_15to64",
        notes: ["Used for latest available year to plot against 65+ growth."]
      },
      {
        name: "Growth % for 65+ (by region, by year)",
        formula: "growth_%(y) = ((value_y − value_base) / value_base) × 100",
        notes: ["Base year is the earliest selected year.", "Heatmap cells use the % value for each (region, year)."]
      }
    ],
    datasets: [
      { name: "Projected Dependency Ratios", file: "Projected Dependency Ratios.csv", purpose: "OADR per year/region" },
      { name: "Population Projections", file: "Population Projection.csv", purpose: "65+ headcount by year & region" },
      { name: "Census/HSE Populations", file: "HSE Health Region Populations - Census 2022.xlsx", purpose: "Baselines by region" }
    ],
    status: "ready",
  },
  {
    route: "/gap",
    title: "Gap",
    summary: "Need vs supply gap for Health (GP per 10k 65+) and Residence (Beds per 1k 65+). Treemap, radials, and +/- area trend.",
    kpis: ["Average GP per 10k (65+)", "Average Beds per 1k (65+)", "Gap vs target"],
    charts: ["Region treemap (gap spread)", "Radials (supply vs target)", "Area trend with positive/negative fills"],
    map: "Zoom to selected NUTS‑3 (same selection model as Demand)",
    methods: [
      {
        name: "Gap (per region)",
        formula: "gap = supply − target",
        notes: [
          "Health domain: supply = GP sites per 10k (65+), target ≈ 10",
          "Residence domain: supply = LTC beds per 1k (65+), target ≈ 30"
        ]
      },
      {
        name: "Average gap (years×regions)",
        formula: "avg_gap(year) = mean(gap(region, year)) over selected regions",
        notes: ["Drives the area chart for the chosen years."]
      }
    ],
    datasets: [
      { name: "GP/Provider registry (by region)", purpose: "Counts of GP sites or similar provider density" },
      { name: "LTC bed capacity (by region)", purpose: "Beds per 1k (65+) supply" },
      { name: "Population 65+ (by region/year)", file: "Population Projection.csv", purpose: "Denominators for rates" }
    ],
    status: "ready",
  },
  {
    route: "/supply",
    title: "Supply",
    summary: "Facilities/providers & capacity (map and tabular); integrates with residency and GP density.",
    status: "wip",
    datasets: [
      { name: "Provider registry", purpose: "Locations & categories" },
      { name: "Capacity data", purpose: "Beds/slots" }
    ]
  },
  {
  route: "/mcda",
  title: "MCDA",
  summary: "Multi-criteria decision analysis that scores each Local Authority on 5 criteria and allocates a €117m fund by score.",
  status: "ready",
  methods: [
    {
      name: "Indicators (per LA)",
      notes: [
        "Benefit: 65+ growth (2022→2031), OADR (old-age dependency ratio).",
        "Cost (inverted): Housing stock per 1k age 65+, Household income (median), Existing grants (€ per 65+)."
      ]
    },
    {
      name: "Normalisation (min–max, per indicator)",
      formula:
`Benefit: s_i = (x_i − min x) / (max x − min x)
Cost (inverse): s_i = (max x − x_i) / (max x − min x)
If (max x == min x), set s_i = 0.5`,
      notes: [
        "Each indicator is scaled independently to [0,1] before weighting.",
        "‘Cost’ indicators are inverted so that higher need ⇒ higher score."
      ]
    },
    {
      name: "Composite score (weights sum to 1)",
      formula:
`Score_i = w_g*s_growth + w_o*s_oadr + w_h*s_housingInv + w_inc*s_incomeInv + w_gr*s_grantsInv`,
      notes: [
        "Default weights: Growth 0.30, OADR 0.25, Housing (inv) 0.20, Income (inv) 0.15, Grants (inv) 0.10.",
        "Weights are user-editable in the MCDA UI and auto-normalised."
      ]
    },
    {
      name: "Rural uplift (optional)",
      formula:
`Score_i ← Score_i × (1 + u * RuralIndex_i), with 0 ≤ u ≤ 0.25 and 0 ≤ RuralIndex ≤ 1`,
      notes: [
        "Adds up to +u (e.g., +15%) to the score for highly rural LAs.",
        "If no RuralIndex is provided, uplift defaults to 0."
      ]
    },
    {
      name: "Allocation (share and €)",
      formula:
`share_i = Score_i / Σ_j Score_j
€_i = share_i × Budget`,
      notes: [
        "Budget default: €117,000,000.",
        "Optional constraints: minimum € floor per LA and maximum share cap.",
        "If floor/cap applied, any remainder is re-balanced proportionally among LAs with headroom."
      ]
    },
    {
      name: "Per-65+ denominators (Housing & Grants)",
      formula:
`dwellingsPer1k65_i = dwellings_2022_i / pop65_2022_i × 1000
grantsPer65_i      = avgGrants€_i / pop65_2022_i`,
      notes: [
        "Where LA-level pop65_2022 is not available, it is **estimated** by downscaling NUTS-3 65+ to LAs using each LA's share of total persons (Census 2022)."
      ]
    },
    {
      name: "Downscaling NUTS-3 65+ to LAs (proxy for denominators)",
      formula:
`For region R and LA k in R:
share_k = PersonsTotal_2022_k / Σ_{ℓ∈R} PersonsTotal_2022_ℓ
est_pop65_2022_k = pop65_2022_R × share_k`,
      notes: [
        "This proxy is used only to derive per-65+ housing/grants rates when a direct LA 65+ count is not available.",
        "When LA-level 65+ (Census 2022) is provided, the model swaps in the true values without other changes."
      ]
    },
    {
      name: "Interpretation of results",
      notes: [
        "Rural counties tend to gain share (higher OADR, lower income, lower housing per 65+).",
        "Large cities usually retain the highest absolute € totals, but their **share** of the total pot declines under these weights and rules."
      ]
    }
  ],
  datasets: [
    { name: "Population projections (NUTS-3)", file: "Population Projection.csv", purpose: "65+ totals (2022 & 2031) and growth per region (used for benefit + downscaling base)" },
    { name: "Dependency ratios (NUTS-3)", file: "oadr.csv (aka Projected Dependency Ratios.csv)", purpose: "Old-age dependency ratio (benefit) per region (2022, Method M1)" },
    { name: "Housing stock (LA, 2022)", file: "housing stock 22.csv", purpose: "Dwellings by Local Authority (for dwellingsPer1k65)" },
    { name: "Persons in private households (LA, 2022)", file: "Average Number of Persons per Private Household -22.csv", purpose: "Total persons per LA (proxy to downscale NUTS-3 65+ to LA)" },
    { name: "Household income (county, 2022)", file: "Household Income.csv", purpose: "Median household income (fanned to city/county splits where needed; inverse indicator)" },
    { name: "Housing adaptation grants (LA)", file: "housing_adaptation_grants_for_older_people_2014-2020.csv", purpose: "Avg € (2018–2020) per LA; used as grantsPer65 numerator (inverse indicator)" },
    { name: "LA boundaries (map)", file: "la_boundaries_simplified.geojson", purpose: "Choropleth of scores/allocations on the map" }
  ]
}

];

const STATUS_STYLE: Record<NonNullable<PageMeta["status"]>, string> = {
  ready: "bg-green-500/20 text-green-200 border-green-500/40",
  wip: "bg-yellow-500/20 text-yellow-100 border-yellow-500/40",
  planned: "bg-slate-500/20 text-slate-200 border-slate-500/40",
};

export default function DocsPage() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Sitemap & Documentation</h1>
        <p className="text-slate-400 text-sm">
          Pages, KPIs, methods, and datasets used across AFI–Dash. This page is config‑driven—update the lists below as the build evolves.
        </p>
      </header>

      <section className="space-y-4">
        {PAGES.map((p) => (
          <article key={p.route} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  <Link href={p.route} className="hover:underline">{p.title}</Link>
                  <span className="ml-2 text-xs text-slate-400">({p.route})</span>
                </h2>
                <p className="text-slate-300 text-sm mt-1">{p.summary}</p>
              </div>
              {p.status && (
                <span className={"px-2 py-1 rounded-md text-xs border " + STATUS_STYLE[p.status]}>
                  {p.status.toUpperCase()}
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {p.kpis?.length ? (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-2">KPIs</div>
                  <ul className="list-disc pl-5 text-sm text-slate-200 space-y-1">
                    {p.kpis.map((k) => <li key={k}>{k}</li>)}
                  </ul>
                </div>
              ) : null}

              {p.charts?.length || p.map ? (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-2">Visualisations</div>
                  <ul className="list-disc pl-5 text-sm text-slate-200 space-y-1">
                    {p.charts?.map((c) => <li key={c}>{c}</li>)}
                    {p.map ? <li>Map: {p.map}</li> : null}
                  </ul>
                </div>
              ) : null}
            </div>

            {p.methods?.length ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-400 mb-2">Methods & Calculations</div>
                <div className="space-y-3">
                  {p.methods.map((m) => (
                    <div key={m.name} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-sm font-medium text-slate-200">{m.name}</div>
                      {m.formula ? (
                        <pre className="mt-2 text-xs text-slate-300 bg-black/40 rounded p-2 overflow-auto">
{m.formula}
                        </pre>
                      ) : null}
                      {m.notes?.length ? (
                        <ul className="mt-2 list-disc pl-5 text-xs text-slate-400 space-y-1">
                          {m.notes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {p.datasets?.length ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-400 mb-2">Datasets</div>
                <div className="grid md:grid-cols-2 gap-2">
                  {p.datasets.map((d) => (
                    <div key={d.name} className="rounded-md border border-slate-800 bg-slate-950 p-3">
                      <div className="text-sm text-slate-200">{d.name}</div>
                      {d.file ? <div className="text-xs text-slate-400 mt-1">{d.file}</div> : null}
                      <div className="text-xs text-slate-300 mt-1">{d.purpose}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
