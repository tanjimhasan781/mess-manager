// Pure cost-splitting rules. All amounts are integer paisa so nothing is lost to rounding:
// shares always add up exactly to the expense amount.

export type Share = { memberId: number; amount: number; meals?: number; custom?: boolean; reason?: string | null };

/** Splits `total` across `weights` proportionally (largest remainder), so the result sums to `total`. */
export function splitByWeights(total: number, weights: { memberId: number; weight: number }[]): Share[] {
  const live = weights.filter((w) => w.weight > 0);
  const sum = live.reduce((s, w) => s + w.weight, 0);
  if (sum === 0) return [];
  const raw = live.map((w) => {
    const exact = (total * w.weight) / sum;
    return { memberId: w.memberId, amount: Math.floor(exact), rem: exact - Math.floor(exact) };
  });
  let left = total - raw.reduce((s, r) => s + r.amount, 0);
  // Hand out leftover paisa to the biggest remainders; ties go to the lower member id so it is deterministic.
  const order = [...raw].sort((a, b) => b.rem - a.rem || a.memberId - b.memberId);
  for (const r of order) {
    if (left <= 0) break;
    r.amount += 1;
    left -= 1;
  }
  return raw.map(({ memberId, amount }) => ({ memberId, amount }));
}

/** Equal split. */
export function splitEqual(total: number, memberIds: number[]): Share[] {
  return splitByWeights(total, memberIds.map((memberId) => ({ memberId, weight: 1 })));
}

/**
 * Equal split among the picked members, except those the manager gave a fixed amount.
 * Used for rent, bills, staples and other costs.
 */
export function splitWithCustom(
  total: number,
  picks: { memberId: number; custom?: number | null; reason?: string | null }[],
): Share[] {
  if (picks.length === 0) throw new Error('Pick at least one member to pay this cost.');
  const fixed = picks.filter((p) => p.custom != null);
  const rest = picks.filter((p) => p.custom == null);
  const fixedSum = fixed.reduce((s, p) => s + (p.custom as number), 0);
  if (fixed.some((p) => (p.custom as number) < 0)) throw new Error('Custom amounts cannot be negative.');
  if (fixedSum > total) throw new Error('Custom amounts add up to more than the total.');
  if (rest.length === 0 && fixedSum !== total) throw new Error('Custom amounts must add up to the total when everyone has one.');
  return [
    ...fixed.map((p) => ({ memberId: p.memberId, amount: p.custom as number, custom: true, reason: p.reason ?? null })),
    ...splitEqual(total - fixedSum, rest.map((p) => p.memberId)),
  ];
}

/** Bazar: split by meals eaten that day. Returns [] when nobody has meals marked yet. */
export function splitByMeals(total: number, meals: { memberId: number; count: number }[]): Share[] {
  const byId = new Map(meals.map((m) => [m.memberId, m.count]));
  return splitByWeights(total, meals.map((m) => ({ memberId: m.memberId, weight: m.count }))).map((s) => ({
    ...s,
    meals: byId.get(s.memberId),
  }));
}

/** Compares old and new shares; returns one entry per member whose charge changed. */
export function diffShares(before: Share[], after: Share[]) {
  const ids = new Set([...before, ...after].map((s) => s.memberId));
  const out: { memberId: number; before: number; after: number }[] = [];
  for (const id of ids) {
    const b = before.find((s) => s.memberId === id)?.amount ?? 0;
    const a = after.find((s) => s.memberId === id)?.amount ?? 0;
    if (a !== b) out.push({ memberId: id, before: b, after: a });
  }
  return out;
}
