import { describe, expect, it } from 'vitest';
import { diffShares, splitByMeals, splitEqual, splitWithCustom } from '../lib/split';
import { parseTk, tk } from '../lib/money';

const sum = (s: { amount: number }[]) => s.reduce((a, b) => a + b.amount, 0);

describe('plan worked examples', () => {
  it('rent + bills 21,000 tk among 6 = 3,500 each', () => {
    const s = splitEqual(2_100_000, [1, 2, 3, 4, 5, 6]);
    expect(s.every((x) => x.amount === 350_000)).toBe(true);
  });

  it('bazar 450 tk over 12 meals: 3 meals = 112.50, 1 meal = 37.50', () => {
    const s = splitByMeals(45_000, [
      { memberId: 1, count: 3 }, { memberId: 2, count: 2 }, { memberId: 3, count: 2 },
      { memberId: 4, count: 2 }, { memberId: 5, count: 2 }, { memberId: 6, count: 1 },
    ]);
    expect(s.find((x) => x.memberId === 1)?.amount).toBe(11_250);
    expect(s.find((x) => x.memberId === 6)?.amount).toBe(3_750);
    expect(sum(s)).toBe(45_000);
  });
});

describe('splitting edge cases', () => {
  it('never loses a paisa', () => {
    const s = splitEqual(100_000, [1, 2, 3]); // 1000 tk / 3
    expect(s.map((x) => x.amount)).toEqual([33_334, 33_333, 33_333]);
    expect(sum(s)).toBe(100_000);
  });

  it('skips members who ate nothing, and returns nothing when no meals are marked', () => {
    expect(splitByMeals(10_000, [{ memberId: 1, count: 0 }, { memberId: 2, count: 2 }])).toEqual([
      { memberId: 2, amount: 10_000, meals: 2 },
    ]);
    expect(splitByMeals(10_000, [])).toEqual([]);
  });

  it('custom amount for a mid-month joiner, rest split equally', () => {
    const s = splitWithCustom(1_800_000, [
      { memberId: 1 }, { memberId: 2 }, { memberId: 3 }, { memberId: 7, custom: 100_000, reason: 'joined 16th' },
    ]);
    expect(s.find((x) => x.memberId === 7)).toMatchObject({ amount: 100_000, custom: true, reason: 'joined 16th' });
    expect(s.filter((x) => x.memberId !== 7).every((x) => x.amount === 566_667 || x.amount === 566_666)).toBe(true);
    expect(sum(s)).toBe(1_800_000);
  });

  it('rejects impossible custom amounts', () => {
    expect(() => splitWithCustom(1000, [{ memberId: 1, custom: 2000 }, { memberId: 2 }])).toThrow();
    expect(() => splitWithCustom(1000, [{ memberId: 1, custom: 500 }])).toThrow();
    expect(() => splitWithCustom(1000, [])).toThrow();
  });

  it('diffs show only changed members', () => {
    expect(diffShares([{ memberId: 1, amount: 100 }, { memberId: 2, amount: 50 }], [{ memberId: 1, amount: 100 }, { memberId: 3, amount: 50 }]))
      .toEqual([{ memberId: 2, before: 50, after: 0 }, { memberId: 3, before: 0, after: 50 }]);
  });
});

describe('money', () => {
  it('formats and parses taka', () => {
    expect(tk(11_250)).toBe('112.50');
    expect(tk(2_100_000)).toBe('21,000');
    expect(tk(-5_000)).toBe('-50');
    expect(parseTk('1,200.5')).toBe(120_050);
    expect(parseTk('abc')).toBeNull();
  });
});
