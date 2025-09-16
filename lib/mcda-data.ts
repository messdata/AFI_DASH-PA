// lib/mcda-data.ts
// Reads your CSVs, builds MCDAInput[] with per-LA metrics.
// Assumes CSVs live in /public/data/* so they can be fetched at runtime.

import Papa from "papaparse";
import { countyToRegion } from "@/lib/regionAdapter"; // you already have this

// Try multiple candidate filenames and return the first that exists.
async function csvFirst(urls: string[]): Promise<Record<string, string>[]> {
  let lastErr: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const { data } = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Failed to fetch any of: ${urls.join(", ")}` + (lastErr ? ` — last error: ${String(lastErr)}` : ""));
}

// IMPORTANT: URLs start with /data (NOT /public/data) and encode spaces with %20
const FILES = {
  projections: [
    "/data/esriPOP.csv",
    // "/data/Population Projection.csv",
  ],
  oadr: [
    "/data/oadr.csv",
    // "/data/Projected%20Dependency%20Ratios.csv",
    // "/data/projected-dependency-ratios.csv",
  ],
  housing: [
    "/data/housing stock.csv",
  ],
  income: [
    "/data/Household Income.csv",
    // "/data/household-income.csv",
  ],
  persons: [
    "/data/AvgHouseholdMembers.csv",
    // "/data/Average%20Number%20of%20Persons%20per%20Private%20Household%20-22.csv",
    // "/data/avg-persons-private-household-2022.csv",
  ],
  grants: [
    "/data/housingGrant.csv", 
  ],
};

import type { MCDAInput } from "@/lib/mcda";

/** Where the files live (encode spaces exactly like below) */
// const FILES = {
//   projections: "/data/PopulationProjection.csv",
//   oadr: "/data/ProjectedDependencyRatios.csv",
//   housing: "/data/housingstock22.csv",
//   income: "/data/HouseholdIncome.csv",
//   persons: "/data/average number of household.csv",
//   grants: "/data/housing_adaptation_grants_for_older_people_2014-2020.csv",
// };

// ---------- tiny CSV fetcher ----------
async function csv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  const text = await res.text();
  const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return data;
}

// ---------- helpers ----------
function toNumber(x: any): number {
  if (x == null) return 0;
  if (typeof x === "number") return x;
  const s = String(x).replace(/[,€\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function cleanLA(s: string): string {
  return (s || "").trim();
}
function asPercentToRatio(x: any): number {
  return toNumber(x) / 100;
}

// Our “weird CSV” fix-ups:
// - Persons file has split labels e.g. "Dún" (for Dún Laoghaire-Rathdown) and "South" (for South Dublin),
//   and duplicate keys "Cork" (city+county), "Galway" (city+county). We reconcile here.
function fixPersonsLAName(raw: string): string {
  const s = (raw || "").trim();
  if (s === "Dublin") return "Dublin City";
  if (s === "Dún") return "Dún Laoghaire-Rathdown";
  if (s === "South") return "South Dublin";
  return s;
}
// Grants LA cleanup: "Carlow County Council" -> "Carlow", "Dublin City Council" -> "Dublin City", etc.
function stripCouncil(raw: string): string {
  const s = (raw || "").trim();
  return s
    .replace(/ County Council$/i, "")
    .replace(/ City and County Council$/i, "")
    .replace(/ City Council$/i, "")
    .replace(/ County$/i, "") // rare variants
    .replace(/\u2013|\u2014/g, "-") // normalize en-dash
    .replace(/Dun Laoghaire.*Rathdown/i, "Dún Laoghaire-Rathdown")
    .trim();
}
// Income county to LA fan-out: "Co. Dublin" => 4 LAs, "Co. Cork" => City+County, "Co. Galway" => City+County
const DUBLIN_LAS = ["Dublin City", "Dún Laoghaire-Rathdown", "Fingal", "South Dublin"];
const CORK_SPLIT = ["Cork City", "Cork County"];
const GALWAY_SPLIT = ["Galway City", "Galway County"];

// ---------- projections: region 65+ (2022, 2031) + growth ----------
type Region65 = Record<string, { y2022: number; y2031: number; growth: number }>;
async function loadRegion65(): Promise<Region65> {
  const rows = await csv(FILES.projections);
  // Filter: Statistic Label "Projected Population", Sex "Both sexes", Criteria "Method - M1"
  const good = rows.filter(r =>
    (r["Statistic Label"] || "").includes("Projected Population") &&
    (r["Sex"] || r["Sex "] || "Both sexes") === "Both sexes" &&
    (r["Criteria for Projection"] || "").includes("Method - M1")
  );

  // Parse min age >= 65
  const minAge = (ageStr: string): number => {
    const s = String(ageStr || "");
    if (/All ages/i.test(s)) return 0;
    if (/Under 1/i.test(s)) return 0;
    const m = s.match(/^(\d+)/);
    return m ? Number(m[1]) : 0;
  };

  const regYearValue: Record<string, Record<number, number>> = {};
  for (const r of good) {
    const age = minAge(r["Age"]);
    if (age < 65) continue;
    const region = (r["NUTS 3 Region"] || "").trim();
    const year = Number(r["Year"]);
    let v = toNumber(r["VALUE"]);
    // Units are in "Thousand" -> convert to persons
    const unit = (r["UNIT"] || "").toLowerCase();
    if (unit.startsWith("thousand")) v = v * 1000;
    if (!region || !Number.isFinite(year)) continue;
    (regYearValue[region] ??= {})[year] = ((regYearValue[region] ?? {})[year] || 0) + v;
  }

  const out: Region65 = {};
  for (const region of Object.keys(regYearValue)) {
    const y2022 = regYearValue[region][2022] ?? 0;
    const y2031 = regYearValue[region][2031] ?? 0;
    const growth = y2022 > 0 ? (y2031 / y2022) - 1 : 0;
    out[region] = { y2022, y2031, growth };
  }
  return out;
}

// ---------- OADR by region (2022, Method M1, Old dependency %) ----------
async function loadOADRByRegion(): Promise<Record<string, number>> {
  const rows = await csv(FILES.oadr);
  const good = rows.filter(r =>
    (r["Criteria for Projection"] || "").includes("Method - M1") &&
    String(r["Year"]) === "2022" &&
    (r["Dependents Status"] || "").toLowerCase().startsWith("old")
  );
  const out: Record<string, number> = {};
  for (const r of good) {
    const region = (r["NUTS 3 Region"] || "").trim();
    out[region] = asPercentToRatio(r["VALUE"]); // 27.3% -> 0.273
  }
  return out;
}

// ---------- Housing stock 2022 (LA) ----------
async function loadHousing22(): Promise<Record<string, number>> {
  const rows = await csv(FILES.housing);
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (String(r["CensusYear"]) !== "2022") continue;
    const la = cleanLA(r["County and City"]);
    if (!la || la === "State") continue;
    out[la] = toNumber(r["VALUE"]);
  }
  return out;
}

// ---------- Persons in private households 2022 (LA total pop proxy) ----------
async function loadPersons2022(): Promise<Record<string, number>> {
  const rows = await csv(FILES.persons);
  const outRaw: { name: string; value: number }[] = [];
  for (const r of rows) {
    if ((r["Statistic Label"] || "").trim() !== "Persons in private households") continue;
    if (String(r["Census Year"]) !== "2022") continue;
    const name = fixPersonsLAName(r["Administrative Counties"]);
    const value = toNumber(r["VALUE"]);
    if (!name || name === "Ireland") continue;
    outRaw.push({ name, value });
  }

  // Disambiguate duplicates "Cork" and "Galway": assign smaller to City, larger to County.
  const out: Record<string, number> = {};
  const grouped = outRaw.reduce<Record<string, number[]>>((acc, { name, value }) => {
    (acc[name] ??= []).push(value);
    return acc;
  }, {});
  for (const [name, values] of Object.entries(grouped)) {
    if (name === "Cork" && values.length === 2) {
      const [a, b] = values.sort((x, y) => x - y);
      out["Cork City"] = a; out["Cork County"] = b;
    } else if (name === "Galway" && values.length === 2) {
      const [a, b] = values.sort((x, y) => x - y);
      out["Galway City"] = a; out["Galway County"] = b;
    } else if (name === "Dublin") {
      // already remapped to "Dublin City" in fixPersonsLAName
      out["Dublin City"] = values[0];
    } else if (name === "Dún") {
      out["Dún Laoghaire-Rathdown"] = values[0];
    } else if (name === "South") {
      out["South Dublin"] = values[0];
    } else {
      out[name] = values[0];
    }
  }
  return out;
}

// ---------- Income 2022 (median household gross) fanned to LAs ----------
async function loadIncomeByLA(): Promise<Record<string, number>> {
  const rows = await csv(FILES.income);
  const out: Record<string, number> = {};
  for (const r of rows) {
    if ((r["Statistic Label"] || "").trim() !== "Median Gross Household Income") continue;
    if (String(r["Year"]) !== "2022") continue;
    const county = (r["County"] || "").trim(); // e.g., "Co. Dublin"
    const val = toNumber(r["VALUE"]);
    if (!county) continue;

    if (/^Co\. Dublin$/i.test(county)) {
      for (const la of DUBLIN_LAS) out[la] = val;
    } else if (/^Co\. Cork$/i.test(county)) {
      for (const la of CORK_SPLIT) out[la] = val;
    } else if (/^Co\. Galway$/i.test(county)) {
      for (const la of GALWAY_SPLIT) out[la] = val;
    } else {
      out[county.replace(/^Co\.\s+/i, "")] = val; // "Co. Clare" -> "Clare"
    }
  }
  return out;
}

// ---------- Grants (avg € 2018–2020) ----------
async function loadGrantsAvg(): Promise<Record<string, number>> {
  const rows = await csv(FILES.grants);
  const out: Record<string, number> = {};
  for (const r of rows) {
    const la = stripCouncil(r["Local Authority"]);
    if (!la) continue;
    const v2018 = toNumber(r["Value of payments € 2018"]);
    const v2019 = toNumber(r["Value of payments € 2019"]);
    const v2020 = toNumber(r["Value of payments € 2020"]);
    const avg = (v2018 + v2019 + v2020) / 3;
    out[la] = avg;
  }
  return out;
}

// ---------- Downscale region 65+ to LA using each LA's share of total pop in that region ----------
function estimateLA65(
  region65_2022: Record<string, number>, // region -> persons 65+ (2022)
  laTotalPop_2022: Record<string, number> // LA -> persons (total pop proxy)
): Record<string, number> {
  // Group LA totals by region
  const byRegion: Record<string, { las: string[]; total: number }> = {};
  for (const [la, pop] of Object.entries(laTotalPop_2022)) {
    const reg = countyToRegion(la);
    if (!reg) continue;
    (byRegion[reg] ??= { las: [], total: 0 });
    byRegion[reg].las.push(la);
    byRegion[reg].total += pop || 0;
  }
  // Distribute region 65+ into LAs by share of total pop
  const out: Record<string, number> = {};
  for (const [reg, { las, total }] of Object.entries(byRegion)) {
    const region65 = region65_2022[reg] || 0;
    const denom = total || 1;
    for (const la of las) {
      const share = (laTotalPop_2022[la] || 0) / denom;
      out[la] = region65 * share;
    }
  }
  return out;
}

// ---------- Public API: build MCDAInput[] ----------
export async function loadMCDAInputs(): Promise<MCDAInput[]> {
  const [
    region65All,       // Region65 {y2022,y2031,growth}
    oadrByRegion,      // region -> ratio
    housing22,         // LA -> dwellings
    persons2022,       // LA -> persons (proxy)
    incomeByLA,        // LA -> €
    grantsAvgByLA      // LA -> €
  ] = await Promise.all([
    loadRegion65(),
    loadOADRByRegion(),
    loadHousing22(),
    loadPersons2022(),
    loadIncomeByLA(),
    loadGrantsAvg(),
  ]);

  // region 65 (2022) map for downscaling
  const region65_2022: Record<string, number> = {};
  for (const [reg, o] of Object.entries(region65All)) region65_2022[reg] = o.y2022;

  // estimate LA 65+ using persons share
  const estLA65_2022 = estimateLA65(region65_2022, persons2022);

  // Build MCDA rows for all LAs seen in housing (solid 31 set)
  const las = Object.keys(housing22);

  // For robustness: compute overall median income as fallback
  const overallMedianIncome =
    Object.values(incomeByLA).filter(Number.isFinite).reduce((a, b) => a + b, 0) /
    Math.max(1, Object.values(incomeByLA).filter(Number.isFinite).length);

  const rows: MCDAInput[] = las.map(la => {
    const region = countyToRegion(la) || "Unknown";
    const reg65 = region65All[region]; // includes growth
    const growth65 = reg65 ? reg65.growth : 0;
    const oadr = oadrByRegion[region] ?? 0;

    const p65 = estLA65_2022[la] ?? 0;
    const dwell = housing22[la] ?? 0;
    const dwellPer1k65 = p65 > 0 ? (dwell / p65) * 1000 : 0;

    let income = incomeByLA[la];
    if (!Number.isFinite(income)) {
      // fallback: use region average or overall median
      const regionIncomes = DUBLIN_LAS.concat(CORK_SPLIT, GALWAY_SPLIT).includes(la) ? Object.values(incomeByLA) : Object.values(incomeByLA);
      const regionMean = regionIncomes.filter(Number.isFinite).reduce((a, b) => a + b, 0) / Math.max(1, regionIncomes.filter(Number.isFinite).length);
      income = Number.isFinite(regionMean) ? regionMean : overallMedianIncome || 0;
    }

    const grantsAvg = grantsAvgByLA[la] ?? 0;
    const grantsPer65 = p65 > 0 ? (grantsAvg / p65) : 0;

    const r: MCDAInput = {
      la,
      growth65,
      oadr,
      dwellingsPer1k65: dwellPer1k65,
      medianIncome: income,
      grantsPer65,
      // ruralIndex optional; leave undefined for now (UI can apply uplift=0..)
    };
    return r;
  });

  return rows;
}
