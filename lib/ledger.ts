import 'server-only';
import { sql, type Tx } from './db';
import type { Me } from './auth';
import { diffShares, splitByMeals, splitWithCustom, type Share } from './split';
import { tk } from './money';
import { monthRange, prettyDate, prettyMonth, ymOf } from './dates';
import { pushNotes, saveNotes, type Note } from './notify';

export const KINDS = {
  rent: 'Rent',
  bill: 'Utility bill',
  staple: 'Staples (chal, dal, tel, spices)',
  bazar: 'Daily bazar',
  other: 'Other',
} as const;
export type Kind = keyof typeof KINDS;

export class UserError extends Error {}

export async function audit(tx: Tx, me: Me, action: string, details: unknown) {
  await tx`insert into audit_log (mess_id, actor_id, action, details) values (${me.mess_id}, ${me.id}, ${action}, ${tx.json(details as never)})`;
}

export async function isMonthClosed(tx: Tx | typeof sql, messId: number, date: string) {
  const [m] = await tx<{ closed: boolean }[]>`select closed from months where mess_id = ${messId} and ym = ${ymOf(date)}`;
  return !!m?.closed;
}

async function assertOpen(tx: Tx, messId: number, date: string) {
  if (await isMonthClosed(tx, messId, date)) {
    throw new UserError(`${prettyMonth(ymOf(date))} is closed. The manager can reopen it from History.`);
  }
}

/** Runs a change in one transaction, saves notifications, then sends phone pushes. */
export async function runChange(fn: (tx: Tx) => Promise<Note[]>): Promise<void> {
  const saved = (await sql.begin(async (tx) => saveNotes(tx, await fn(tx)))) as Note[];
  await pushNotes(saved);
}

type ExpenseRow = {
  id: number; mess_id: number; kind: Kind; title: string; items: string | null; amount: number;
  spent_on: string; bought_by: number | null; note: string | null; deleted_at: string | null;
};

async function loadShares(tx: Tx, expenseId: number): Promise<Share[]> {
  const rows = await tx<{ member_id: number; amount: number; meals: number | null; custom: boolean; reason: string | null }[]>`
    select member_id, amount, meals, custom, reason from expense_shares where expense_id = ${expenseId}`;
  return rows.map((r) => ({ memberId: r.member_id, amount: r.amount, meals: r.meals ?? undefined, custom: r.custom, reason: r.reason }));
}

async function writeShares(tx: Tx, expenseId: number, shares: Share[]) {
  await tx`delete from expense_shares where expense_id = ${expenseId}`;
  if (shares.length === 0) return;
  await tx`insert into expense_shares ${tx(
    shares.map((s) => ({
      expense_id: expenseId, member_id: s.memberId, amount: s.amount,
      meals: s.meals ?? null, custom: !!s.custom, reason: s.reason ?? null,
    })),
    'expense_id', 'member_id', 'amount', 'meals', 'custom', 'reason',
  )}`;
}

async function mealsOn(tx: Tx, messId: number, date: string) {
  const rows = await tx<{ member_id: number; count: number }[]>`
    select member_id, count from meals where mess_id = ${messId} and meal_date = ${date} and count > 0`;
  return rows.map((r) => ({ memberId: r.member_id, count: r.count }));
}

function describe(e: ExpenseRow, share: Share, all: Share[]): string {
  const total = `${tk(e.amount)} tk total`;
  if (e.kind === 'bazar') {
    const meals = all.reduce((s, x) => s + (x.meals ?? 0), 0);
    return `${e.items ? e.items + '. ' : ''}${total}. You ate ${share.meals} of ${meals} meals on ${prettyDate(e.spent_on)}.`;
  }
  if (share.custom) return `${total}. Manager set your share${share.reason ? `: ${share.reason}` : ''}.`;
  return `${total}, split among ${all.filter((s) => !s.custom).length} members.`;
}

/** Notifications for a newly charged expense, or for every member whose charge changed. */
function notesForChange(e: ExpenseRow, before: Share[], after: Share[], isNew: boolean, why?: string): Note[] {
  const url = `/expenses/${e.id}`;
  if (isNew) {
    return after.map((s) => ({
      memberId: s.memberId,
      title: `${tk(s.amount)} tk cut: ${e.title}`,
      body: describe(e, s, after),
      url,
    }));
  }
  return diffShares(before, after).map((d) => {
    const s = after.find((x) => x.memberId === d.memberId);
    const detail = s ? describe(e, s, after) : 'You are no longer charged for this.';
    return {
      memberId: d.memberId,
      title: `Charge corrected: ${e.title}`,
      body: `Was ${tk(d.before)} tk, now ${tk(d.after)} tk${why ? ` (${why})` : ''}. ${detail}`,
      url,
    };
  });
}

export type ExpenseInput = {
  kind: Kind;
  title: string;
  items: string | null;
  amount: number;
  spent_on: string;
  bought_by: number | null;
  note: string | null;
  receipt?: { data: Buffer; type: string } | null; // undefined = keep existing
  picks: { memberId: number; custom?: number | null; reason?: string | null }[];
};

export async function saveExpense(me: Me, input: ExpenseInput, id?: number): Promise<number> {
  if (!(input.kind in KINDS)) throw new UserError('Unknown cost type.');
  if (!input.title.trim()) throw new UserError('Give the cost a name.');
  if (!(input.amount > 0)) throw new UserError('Enter an amount above 0.');
  if (me.status !== 'active') throw new UserError('Deactivated members cannot add costs.');
  if (me.role !== 'manager' && (id || input.kind !== 'bazar')) {
    throw new UserError('Only the manager can add rent, bills and staples, or edit costs.');
  }
  let savedId = id ?? 0;
  await runChange(async (tx) => {
    await assertOpen(tx, me.mess_id, input.spent_on);
    let before: Share[] = [];
    if (id) {
      const [old] = await tx<ExpenseRow[]>`select * from expenses where id = ${id} and mess_id = ${me.mess_id} and deleted_at is null for update`;
      if (!old) throw new UserError('That cost no longer exists.');
      await assertOpen(tx, me.mess_id, old.spent_on);
      before = await loadShares(tx, id);
    }
    if (input.bought_by) {
      const [b] = await tx`select 1 from members where id = ${input.bought_by} and mess_id = ${me.mess_id}`;
      if (!b) throw new UserError('Unknown buyer.');
    }

    let shares: Share[];
    if (input.kind === 'bazar') {
      shares = splitByMeals(input.amount, await mealsOn(tx, me.mess_id, input.spent_on));
    } else {
      // Picked members must be active, except people already on this cost (so old entries stay editable).
      const allowed = new Set(
        (await tx<{ id: number }[]>`select id from members where mess_id = ${me.mess_id} and status = 'active'`).map((r) => r.id),
      );
      before.forEach((s) => allowed.add(s.memberId));
      if (input.picks.some((p) => !allowed.has(p.memberId))) throw new UserError('Only active members can be charged.');
      try {
        shares = splitWithCustom(input.amount, input.picks);
      } catch (e) {
        throw new UserError((e as Error).message);
      }
    }

    const fields = {
      kind: input.kind, title: input.title.trim(), items: input.items, amount: input.amount, spent_on: input.spent_on,
      bought_by: input.bought_by, note: input.note,
    };
    let row: ExpenseRow;
    if (id) {
      [row] = await tx<ExpenseRow[]>`update expenses set ${tx(fields)}, updated_at = now() where id = ${id} returning *`;
    } else {
      [row] = await tx<ExpenseRow[]>`insert into expenses ${tx({ ...fields, mess_id: me.mess_id, created_by: me.id })} returning *`;
    }
    if (input.receipt !== undefined) {
      await tx`update expenses set receipt = ${input.receipt?.data ?? null}, receipt_type = ${input.receipt?.type ?? null} where id = ${row.id}`;
    }
    await writeShares(tx, row.id, shares);
    await audit(tx, me, id ? 'expense.edit' : 'expense.add', { id: row.id, ...fields, before, after: shares });
    savedId = row.id;
    return notesForChange(row, before, shares, !id, id ? `edited by ${me.name}` : undefined);
  });
  return savedId;
}

export async function deleteExpense(me: Me, id: number) {
  if (me.role !== 'manager') throw new UserError('Only the manager can delete costs.');
  await runChange(async (tx) => {
    const [e] = await tx<ExpenseRow[]>`select * from expenses where id = ${id} and mess_id = ${me.mess_id} and deleted_at is null for update`;
    if (!e) throw new UserError('That cost no longer exists.');
    await assertOpen(tx, me.mess_id, e.spent_on);
    const before = await loadShares(tx, id);
    await tx`update expenses set deleted_at = now() where id = ${id}`;
    await audit(tx, me, 'expense.delete', { id, title: e.title, amount: e.amount, shares: before });
    return before.map((s) => ({
      memberId: s.memberId,
      title: `Charge removed: ${e.title}`,
      body: `${tk(s.amount)} tk from ${prettyDate(e.spent_on)} was returned to your balance (removed by ${me.name}).`,
      url: `/expenses/${id}`,
    }));
  });
}

/** Re-splits every bazar cost on a date after meal counts change. */
async function recomputeBazar(tx: Tx, messId: number, date: string, why: string): Promise<Note[]> {
  const list = await tx<ExpenseRow[]>`
    select * from expenses where mess_id = ${messId} and kind = 'bazar' and spent_on = ${date} and deleted_at is null for update`;
  if (list.length === 0) return [];
  const meals = await mealsOn(tx, messId, date);
  const notes: Note[] = [];
  for (const e of list) {
    const before = await loadShares(tx, e.id);
    const after = splitByMeals(e.amount, meals);
    const changed = diffShares(before, after).length > 0 || before.some((b) => b.meals !== after.find((a) => a.memberId === b.memberId)?.meals);
    if (!changed) continue;
    await writeShares(tx, e.id, after);
    // A member who was charged for the first time gets a normal "cut" message.
    for (const n of notesForChange(e, before, after, false, why)) {
      const wasCharged = before.some((b) => b.memberId === n.memberId);
      if (!wasCharged) {
        const s = after.find((a) => a.memberId === n.memberId)!;
        notes.push({ memberId: n.memberId, title: `${tk(s.amount)} tk cut: ${e.title}`, body: describe(e, s, after), url: n.url });
      } else notes.push(n);
    }
  }
  return notes;
}

/** Sets meal counts for one date. Members may only change their own; the manager may change anyone's. */
export async function setMeals(me: Me, date: string, entries: { memberId: number; count: number }[]) {
  if (me.status !== 'active') throw new UserError('Deactivated members cannot mark meals.');
  for (const e of entries) {
    if (!Number.isInteger(e.count) || e.count < 0 || e.count > 20) throw new UserError('Meal count must be 0 to 20.');
    if (me.role !== 'manager' && e.memberId !== me.id) throw new UserError('You can only mark your own meals.');
  }
  await runChange(async (tx) => {
    await assertOpen(tx, me.mess_id, date);
    const active = await tx<{ id: number; name: string }[]>`select id, name from members where mess_id = ${me.mess_id} and status = 'active'`;
    const names = new Map(active.map((m) => [m.id, m.name]));
    const notes: Note[] = [];
    let changed = false;
    for (const e of entries) {
      if (!names.has(e.memberId)) throw new UserError('Meals can only be marked for active members.');
      const [old] = await tx<{ count: number }[]>`select count from meals where member_id = ${e.memberId} and meal_date = ${date}`;
      const prev = old?.count ?? 0;
      if (prev === e.count) continue;
      changed = true;
      await tx`
        insert into meals (mess_id, member_id, meal_date, count, updated_by)
        values (${me.mess_id}, ${e.memberId}, ${date}, ${e.count}, ${me.id})
        on conflict (member_id, meal_date) do update set count = excluded.count, updated_by = excluded.updated_by, updated_at = now()`;
      await audit(tx, me, 'meals.set', { member: e.memberId, date, before: prev, after: e.count });
      if (e.memberId !== me.id) {
        notes.push({
          memberId: e.memberId,
          title: old ? `Your meals on ${prettyDate(date)} changed` : `Meals marked for ${prettyDate(date)}`,
          body: old ? `${me.name} set your meals to ${e.count} (was ${prev}).` : `${me.name} marked ${e.count} meal${e.count === 1 ? '' : 's'} for you.`,
          url: `/meals?date=${date}`,
        });
      }
    }
    if (!changed) return [];
    return [...notes, ...(await recomputeBazar(tx, me.mess_id, date, 'meal count changed'))];
  });
}

export async function addDeposit(me: Me, d: { memberId: number; amount: number; paid_on: string; method: string; note: string | null }) {
  if (me.role !== 'manager') throw new UserError('Only the manager can record deposits.');
  if (d.amount === 0) throw new UserError('Enter an amount.');
  await runChange(async (tx) => {
    await assertOpen(tx, me.mess_id, d.paid_on);
    const [m] = await tx`select 1 from members where id = ${d.memberId} and mess_id = ${me.mess_id}`;
    if (!m) throw new UserError('Unknown member.');
    const [row] = await tx<{ id: number }[]>`
      insert into deposits (mess_id, member_id, amount, paid_on, method, note, created_by)
      values (${me.mess_id}, ${d.memberId}, ${d.amount}, ${d.paid_on}, ${d.method}, ${d.note}, ${me.id}) returning id`;
    await audit(tx, me, 'deposit.add', { id: row.id, ...d });
    const refund = d.amount < 0;
    return [{
      memberId: d.memberId,
      title: refund ? `Refund recorded: ${tk(-d.amount)} tk` : `Deposit received: ${tk(d.amount)} tk`,
      body: `${refund ? 'Paid back to you' : 'Paid'} by ${d.method} on ${prettyDate(d.paid_on)}${d.note ? ` (${d.note})` : ''}.`,
      url: '/ledger',
    }];
  });
}

export async function deleteDeposit(me: Me, id: number) {
  if (me.role !== 'manager') throw new UserError('Only the manager can remove deposits.');
  await runChange(async (tx) => {
    const [d] = await tx<{ member_id: number; amount: number; paid_on: string }[]>`
      select member_id, amount, paid_on from deposits where id = ${id} and mess_id = ${me.mess_id} and deleted_at is null`;
    if (!d) throw new UserError('That deposit no longer exists.');
    await assertOpen(tx, me.mess_id, d.paid_on);
    await tx`update deposits set deleted_at = now() where id = ${id}`;
    await audit(tx, me, 'deposit.delete', { id, ...d });
    return [{
      memberId: d.member_id,
      title: `Deposit removed: ${tk(d.amount)} tk`,
      body: `The deposit from ${prettyDate(d.paid_on)} was removed by ${me.name}.`,
      url: '/ledger',
    }];
  });
}

// ---------- Reports ----------

export type MonthRow = {
  member_id: number; name: string; status: string;
  opening: number; deposited: number; rent_bill: number; staple: number; bazar: number; other: number;
  meals: number; spent: number; closing: number;
};

/** One row per member for a month: brought forward, deposited, spent by type, carried forward. */
export async function monthReport(messId: number, ym: string): Promise<MonthRow[]> {
  const { start, end } = monthRange(ym);
  const rows = await sql<Omit<MonthRow, 'spent' | 'closing'>[]>`
    select m.id as member_id, m.name, m.status,
      coalesce((select sum(d.amount) from deposits d where d.member_id = m.id and d.deleted_at is null and d.paid_on < ${start}), 0)::int
      - coalesce((select sum(s.amount) from expense_shares s join expenses e on e.id = s.expense_id
                  where s.member_id = m.id and e.deleted_at is null and e.spent_on < ${start}), 0)::int as opening,
      coalesce((select sum(d.amount) from deposits d where d.member_id = m.id and d.deleted_at is null and d.paid_on between ${start} and ${end}), 0)::int as deposited,
      coalesce(sum(s.amount) filter (where e.kind in ('rent','bill')), 0)::int as rent_bill,
      coalesce(sum(s.amount) filter (where e.kind = 'staple'), 0)::int as staple,
      coalesce(sum(s.amount) filter (where e.kind = 'bazar'), 0)::int as bazar,
      coalesce(sum(s.amount) filter (where e.kind = 'other'), 0)::int as other,
      coalesce((select sum(ml.count) from meals ml where ml.member_id = m.id and ml.meal_date between ${start} and ${end}), 0)::int as meals
    from members m
    left join expense_shares s on s.member_id = m.id
      and s.expense_id in (select id from expenses where mess_id = ${messId} and deleted_at is null and spent_on between ${start} and ${end})
    left join expenses e on e.id = s.expense_id
    where m.mess_id = ${messId}
    group by m.id
    order by m.status = 'active' desc, m.name`;
  return rows
    .map((r) => {
      const spent = r.rent_bill + r.staple + r.bazar + r.other;
      return { ...r, spent, closing: r.opening + r.deposited - spent };
    })
    // Hide people who had nothing to do with this month and no balance.
    .filter((r) => r.status === 'active' || r.opening !== 0 || r.deposited !== 0 || r.spent !== 0);
}

/** Months that have any activity, newest first. */
export async function activeMonths(messId: number): Promise<string[]> {
  const rows = await sql<{ ym: string }[]>`
    select distinct ym from (
      select to_char(spent_on, 'YYYY-MM') ym from expenses where mess_id = ${messId} and deleted_at is null
      union select to_char(paid_on, 'YYYY-MM') from deposits where mess_id = ${messId} and deleted_at is null
      union select to_char(meal_date, 'YYYY-MM') from meals where mess_id = ${messId}
      union select ym from months where mess_id = ${messId}
    ) x order by ym desc`;
  return rows.map((r) => r.ym);
}

export type LedgerEntry = {
  date: string; created_at: string; kind: string; title: string; detail: string | null;
  amount: number; link: string | null; balance?: number;
};

/** Every cut and deposit for a member, oldest first, with running balance. */
export async function memberLedger(memberId: number): Promise<LedgerEntry[]> {
  const rows = await sql<LedgerEntry[]>`
    select e.spent_on as date, e.created_at, e.kind, e.title,
      case when e.kind = 'bazar' then 'Ate ' || s.meals || ' of ' ||
        (select sum(x.meals) from expense_shares x where x.expense_id = e.id) || ' meals'
        when s.custom then 'Custom amount' || coalesce(': ' || s.reason, '')
        else 'Split among ' || (select count(*) from expense_shares x where x.expense_id = e.id) || ' members' end as detail,
      -s.amount as amount, '/expenses/' || e.id as link
    from expense_shares s join expenses e on e.id = s.expense_id
    where s.member_id = ${memberId} and e.deleted_at is null
    union all
    select d.paid_on, d.created_at, 'deposit', case when d.amount < 0 then 'Refund' else 'Deposit' end,
      d.method || coalesce(' · ' || d.note, ''), d.amount, null
    from deposits d where d.member_id = ${memberId} and d.deleted_at is null
    order by 1, 2`;
  let bal = 0;
  return rows.map((r) => ({ ...r, balance: (bal += r.amount) }));
}

export async function monthSettings(messId: number, ym: string) {
  const [m] = await sql<{ meal_deposit: number; closed: boolean; closed_at: string | null }[]>`
    select meal_deposit, closed, closed_at from months where mess_id = ${messId} and ym = ${ym}`;
  if (m) return m;
  // New months inherit last month's deposit amount.
  const [prev] = await sql<{ meal_deposit: number }[]>`
    select meal_deposit from months where mess_id = ${messId} and ym < ${ym} order by ym desc limit 1`;
  return { meal_deposit: prev?.meal_deposit ?? 0, closed: false, closed_at: null };
}

/** What a member still needs to pay this month: meal deposit + rent/bills - brought forward - paid so far. */
export function dueThisMonth(row: MonthRow | undefined, mealDeposit: number): number {
  if (!row) return mealDeposit;
  return Math.max(0, mealDeposit + row.rent_bill - row.opening - row.deposited);
}
