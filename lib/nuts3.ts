// lib/nuts3.ts
export type Nuts3Key =
  | "dublin" | "mid-east" | "midland" | "mid-west"
  | "south-east" | "south-west" | "west" | "border";

export const canon = (s: string) =>
  String(s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/\bcity and county\b/g, "")
    .replace(/\bcouncil\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const R2C: Record<Nuts3Key, string[]> = {
  "dublin": ["dublin city","south dublin","fingal","dun laoghaire rathdown"],
  "mid-east": ["kildare","meath","wicklow"],
  "midland": ["laois","longford","offaly","westmeath"],
  "mid-west": ["clare","limerick","tipperary"],
  "south-east": ["carlow","kilkenny","waterford","wexford"],
  "south-west": ["cork","kerry"],
  "west": ["galway","mayo","roscommon"],
  "border": ["donegal","leitrim","cavan","monaghan","louth","sligo"],
};

export const ALL_REGIONS = Object.keys(R2C) as Nuts3Key[];
export const countiesForRegion = (r: Nuts3Key) => R2C[r];
export const ALL_COUNTIES = Object.values(R2C).flat().sort((a,b)=>a.localeCompare(b));

export const countyToRegion = (countyLabelOrKey: string): Nuts3Key | undefined => {
  const k = canon(countyLabelOrKey);
  return (ALL_REGIONS.find(r => R2C[r].includes(k)) as Nuts3Key | undefined);
};

export const regionsOfCounties = (countyKeys: string[]): Nuts3Key[] => {
  const set = new Set<Nuts3Key>();
  countyKeys.forEach(c => {
    const r = countyToRegion(c);
    if (r) set.add(r);
  });
  return Array.from(set);
};
