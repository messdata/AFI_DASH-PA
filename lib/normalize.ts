export function normalizeLA(name: string) {
  return String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[–-]/g, " ")                            // hyphens → space
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// optional aliases if names differ between CSV and GeoJSON
const LA_ALIASES: Record<string, string> = {
  // "dun laoghaire–rathdown" (with dash) → "dun laoghaire rathdown"
  "dun laoghaire rathdown": "dun laoghaire rathdown",
};

export function canonicalLA(name: string) {
  const n = normalizeLA(name);
  return LA_ALIASES[n] ?? n;
}
