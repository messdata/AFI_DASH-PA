// lib/mcda.ts
export type LAKey = string;

export type MCDAInput = {
  la: LAKey;
  growth65: number;        // e.g. 0.14 for +14%
  oadr: number;            // e.g. 0.29 (65+ / 15-64)
  dwellingsPer1k65: number;// dwellings per 1,000 aged 65+ (use proxy until LA 65+ lands)
  medianIncome: number;    // € (lower = more need → inverse)
  grantsPer65: number;     // € per 65+ (lower = more need? default inverse)
  ruralIndex?: number;     // 0..1 (0=urban, 1=rural)
};

export type Weights = {
  wGrowth: number;     // benefit
  wOadr: number;       // benefit
  wHousingInv: number; // inverse (lower dwellings → higher score)
  wIncomeInv: number;  // inverse (lower income → higher score)
  wGrantsInv: number;  // inverse (more historic grants → lower score)
};

export type Options = {
  ruralUplift?: number;  // e.g., 0.15 means up to +15% boost at ruralIndex=1
  floorEUR?: number;     // min € per LA
  capShare?: number;     // max share per LA (0..1)
  budgetEUR: number;     // e.g., 117_000_000
};

type Range = { min: number; max: number };
const rng = (vals: number[]): Range => {
  const xs = vals.filter(Number.isFinite);
  if (!xs.length) return { min: 0, max: 1 };
  return { min: Math.min(...xs), max: Math.max(...xs) };
};
const mm = (x: number, r: Range) => (r.max === r.min ? 0.5 : (x - r.min) / (r.max - r.min));
const mmInv = (x: number, r: Range) => (r.max === r.min ? 0.5 : (r.max - x) / (r.max - r.min));

export function scoreAndAllocate(rows: MCDAInput[], w: Weights, opt: Options) {
  const gR = rng(rows.map(r => r.growth65));
  const oR = rng(rows.map(r => r.oadr));
  const hR = rng(rows.map(r => r.dwellingsPer1k65));
  const iR = rng(rows.map(r => r.medianIncome));
  const eR = rng(rows.map(r => r.grantsPer65));

  const items = rows.map(r => {
    const sGrowth = mm(r.growth65, gR);
    const sOadr  = mm(r.oadr, oR);
    const sHInv  = mmInv(r.dwellingsPer1k65, hR);
    const sIInv  = mmInv(r.medianIncome, iR);
    const sGInv  = mmInv(r.grantsPer65, eR);

    let score =
      w.wGrowth     * sGrowth +
      w.wOadr       * sOadr  +
      w.wHousingInv * sHInv  +
      w.wIncomeInv  * sIInv  +
      w.wGrantsInv  * sGInv;

    const ri = Math.max(0, Math.min(1, r.ruralIndex ?? 0));
    if (opt.ruralUplift && opt.ruralUplift > 0) {
      score *= (1 + opt.ruralUplift * ri);
    }

    return { la: r.la, score };
  });

  const totalScore = items.reduce((s, a) => s + a.score, 0) || 1;
  let allocs = items.map(a => ({ ...a, share: a.score / totalScore }));

  // Cap/floor logic
  const B = opt.budgetEUR;
  if (opt.floorEUR || opt.capShare) {
    const floor = Math.max(0, opt.floorEUR ?? 0);
    const cap   = Math.max(0, Math.min(1, opt.capShare ?? 1));
    allocs = allocs.map(a => {
      let eur = a.share * B;
      eur = Math.max(eur, floor);
      eur = Math.min(eur, cap * B);
      return { ...a, eur };
    });
    const spent = allocs.reduce((s, a) => s + a.eur, 0);
    const rem = Math.max(0, B - spent);
    const room = allocs.map(a => ({ la: a.la, room: cap * B - a.eur }));
    const roomTotal = room.reduce((s, r) => s + Math.max(0, r.room), 0) || 1;
    allocs = allocs.map(a => {
      const r = room.find(x => x.la === a.la)!;
      const topUp = Math.max(0, r.room) / roomTotal * rem;
      return { ...a, eur: a.eur + topUp };
    });
  } else {
    allocs = allocs.map(a => ({ ...a, eur: a.share * B }));
  }

  return allocs
    .map(a => ({
      la: a.la,
      score: a.score,
      share: a.share,
      eur: Math.round(a.eur),
    }))
    .sort((x, y) => y.eur - x.eur);
}
