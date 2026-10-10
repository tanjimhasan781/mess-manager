'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import {
  checkPassword, endSession, hashPassword, normalizePhone, requireManager, requireMe, startSession,
} from '@/lib/auth';
import {
  addDeposit, audit, deleteDeposit, deleteExpense, KINDS, monthReport, runChange, saveExpense, setMeals, UserError, type Kind,
} from '@/lib/ledger';
import { parseTk, tk } from '@/lib/money';
import { isDate, isYm, prettyMonth, today } from '@/lib/dates';

export type Result = { ok?: string; error?: string } | null;

async function attempt(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const ok = await fn();
    revalidatePath('/', 'layout');
    return { ok: ok || 'Saved.' };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => str(f, k) || null;
const newInviteCode = () => randomBytes(6).toString('base64url');

// ---------- Accounts ----------

export async function login(_: Result, f: FormData): Promise<Result> {
  const phone = normalizePhone(str(f, 'phone'));
  const [m] = phone
    ? await sql<{ id: number; password_hash: string | null; status: string }[]>`select id, password_hash, status from members where phone = ${phone}`
    : [];
  if (!m?.password_hash || !(await checkPassword(str(f, 'password'), m.password_hash))) {
    return { error: 'Wrong phone number or password.' };
  }
  if (m.status === 'left') return { error: 'This member has left the mess. Ask the manager to re-add you.' };
  await startSession(m.id);
  redirect('/');
}

export async function logout() {
  await endSession();
  redirect('/login');
}

function checkNewPassword(pw: string) {
  if (pw.length < 6) throw new UserError('Password must be at least 6 characters.');
}

export async function createMess(_: Result, f: FormData): Promise<Result> {
  const r = await attempt(async () => {
    const phone = normalizePhone(str(f, 'phone'));
    if (!str(f, 'mess') || !str(f, 'name')) throw new UserError('Fill in the mess name and your name.');
    if (!phone) throw new UserError('Enter a valid Bangladeshi mobile number, e.g. 01712345678.');
    checkNewPassword(str(f, 'password'));
    const [taken] = await sql`select 1 from members where phone = ${phone}`;
    if (taken) throw new UserError('This phone number already has an account. Sign in instead.');
    const hash = await hashPassword(str(f, 'password'));
    const id = await sql.begin(async (tx) => {
      const [mess] = await tx<{ id: number }[]>`insert into messes (name) values (${str(f, 'mess')}) returning id`;
      const [m] = await tx<{ id: number }[]>`
        insert into members (mess_id, name, phone, password_hash, role, joined_on)
        values (${mess.id}, ${str(f, 'name')}, ${phone}, ${hash}, 'manager', ${today()}) returning id`;
      return m.id;
    });
    await startSession(id as number);
  });
  if (r?.error) return r;
  redirect('/members');
}

export async function joinMess(_: Result, f: FormData): Promise<Result> {
  const r = await attempt(async () => {
    const code = str(f, 'code');
    const phone = normalizePhone(str(f, 'phone'));
    if (!phone) throw new UserError('Enter a valid Bangladeshi mobile number, e.g. 01712345678.');
    checkNewPassword(str(f, 'password'));
    const [m] = await sql<{ id: number }[]>`select id from members where invite_code = ${code} and status <> 'left'`;
    if (!m) throw new UserError('This invite link is no longer valid. Ask the manager for a new one.');
    const [taken] = await sql`select 1 from members where phone = ${phone} and id <> ${m.id}`;
    if (taken) throw new UserError('This phone number is already used by another account.');
    await sql`update members set phone = ${phone}, password_hash = ${await hashPassword(str(f, 'password'))}, invite_code = null where id = ${m.id}`;
    await startSession(m.id);
  });
  if (r?.error) return r;
  redirect('/');
}

export async function changePassword(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const me = await requireMe();
    const [m] = await sql<{ password_hash: string }[]>`select password_hash from members where id = ${me.id}`;
    if (!(await checkPassword(str(f, 'current'), m.password_hash))) throw new UserError('Current password is wrong.');
    checkNewPassword(str(f, 'password'));
    await sql`update members set password_hash = ${await hashPassword(str(f, 'password'))} where id = ${me.id}`;
    return 'Password changed.';
  });
}

// ---------- Members ----------

export async function addMember(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const me = await requireManager();
    const name = str(f, 'name');
    if (!name) throw new UserError('Enter a name.');
    const joined = isDate(str(f, 'joined_on')) ? str(f, 'joined_on') : today();
    await sql.begin(async (tx) => {
      const [m] = await tx<{ id: number }[]>`
        insert into members (mess_id, name, joined_on, invite_code) values (${me.mess_id}, ${name}, ${joined}, ${newInviteCode()}) returning id`;
      await audit(tx, me, 'member.add', { id: m.id, name, joined });
    });
    return `${name} added. Share their invite link so they can sign in.`;
  });
}

export async function updateMember(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const me = await requireManager();
    const id = Number(f.get('id'));
    const op = str(f, 'op');
    const [m] = await sql<{ id: number; name: string; status: string; role: string; password_hash: string | null }[]>`
      select id, name, status, role, password_hash from members where id = ${id} and mess_id = ${me.mess_id}`;
    if (!m) throw new UserError('Unknown member.');
    let msg = 'Saved.';
    await runChange(async (tx) => {
      const notes = [];
      if (op === 'rename') {
        const name = str(f, 'name');
        if (!name) throw new UserError('Enter a name.');
        await tx`update members set name = ${name} where id = ${id}`;
      } else if (op === 'deactivate' || op === 'activate' || op === 'left') {
        if (id === me.id) throw new UserError('Hand the manager role to someone else first.');
        const status = op === 'activate' ? 'active' : op === 'left' ? 'left' : 'deactivated';
        await tx`update members set status = ${status} where id = ${id}`;
        if (status === 'left') await tx`delete from push_subscriptions where member_id = ${id}`;
        msg = `${m.name} is now ${status === 'left' ? 'marked as left' : status}.`;
        if (status !== 'left') {
          notes.push({
            memberId: id,
            title: status === 'active' ? 'You are active again' : 'You have been deactivated',
            body: status === 'active'
              ? `${me.name} reactivated you. You will be included in costs from now on.`
              : `${me.name} deactivated you. You will not be charged for new costs until reactivated.`,
            url: '/',
          });
        }
      } else if (op === 'manager') {
        if (m.status !== 'active' || !m.password_hash) throw new UserError('The new manager must be active and signed up.');
        await tx`update members set role = 'member' where id = ${me.id}`;
        await tx`update members set role = 'manager' where id = ${id}`;
        msg = `${m.name} is now the manager.`;
        notes.push({ memberId: id, title: 'You are now the manager', body: `${me.name} handed the manager role to you.`, url: '/' });
      } else if (op === 'invite') {
        await tx`update members set invite_code = ${newInviteCode()} where id = ${id}`;
        msg = 'New invite link made.';
      } else if (op === 'reset') {
        // Lets a member who forgot their password sign up again through a new invite link.
        await tx`update members set password_hash = null, invite_code = ${newInviteCode()} where id = ${id}`;
        msg = `Password reset. Send ${m.name} their new invite link.`;
      } else throw new UserError('Unknown action.');
      await audit(tx, me, `member.${op}`, { id, name: m.name });
      return notes;
    });
    return msg;
  });
}

// ---------- Costs ----------

function readExpense(f: FormData) {
  const amount = parseTk(str(f, 'amount'));
  if (amount == null || amount <= 0) throw new UserError('Enter the amount in taka, e.g. 450 or 450.50.');
  const kind = str(f, 'kind') as Kind;
  if (!(kind in KINDS)) throw new UserError('Pick what kind of cost this is.');
  const spent_on = str(f, 'spent_on');
  if (!isDate(spent_on)) throw new UserError('Pick a date.');
  const picks = f.getAll('pick').map((v) => {
    const memberId = Number(v);
    const raw = str(f, `custom_${memberId}`);
    const custom = raw ? parseTk(raw) : null;
    if (raw && custom == null) throw new UserError(`"${raw}" is not a valid amount.`);
    return { memberId, custom, reason: opt(f, `reason_${memberId}`) };
  });
  let receipt: { data: Buffer; type: string } | null | undefined;
  const dataUrl = str(f, 'receipt');
  if (dataUrl === 'remove') receipt = null;
  else if (dataUrl.startsWith('data:image/')) {
    const [head, b64] = dataUrl.split(',');
    receipt = { data: Buffer.from(b64, 'base64'), type: head.slice(5, head.indexOf(';')) };
    if (receipt.data.length > 2_000_000) throw new UserError('Receipt photo is too large.');
  }
  return {
    kind, amount, spent_on, picks, receipt,
    title: str(f, 'title') || KINDS[kind],
    items: opt(f, 'items'),
    note: opt(f, 'note'),
    bought_by: Number(f.get('bought_by')) || null,
  };
}

export async function saveExpenseAction(_: Result, f: FormData): Promise<Result> {
  let id = 0;
  const r = await attempt(async () => {
    const me = await requireMe();
    const existing = Number(f.get('id')) || undefined;
    id = await saveExpense(me, readExpense(f), existing);
  });
  if (r?.error) return r;
  redirect(`/expenses/${id}`);
}

export async function deleteExpenseAction(_: Result, f: FormData): Promise<Result> {
  const r = await attempt(async () => deleteExpense(await requireMe(), Number(f.get('id'))));
  if (r?.error) return r;
  redirect('/expenses');
}

// ---------- Meals ----------

export async function saveMealsAction(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const me = await requireMe();
    const date = str(f, 'date');
    if (!isDate(date)) throw new UserError('Pick a date.');
    const entries = [...f.keys()]
      .filter((k) => k.startsWith('meals_'))
      .map((k) => ({ memberId: Number(k.slice(6)), count: Number(f.get(k)) }));
    await setMeals(me, date, entries);
    return 'Meals saved.';
  });
}

// ---------- Deposits and months ----------

export async function addDepositAction(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const me = await requireMe();
    const amount = parseTk(str(f, 'amount'));
    if (amount == null || amount === 0) throw new UserError('Enter the amount in taka.');
    const paid_on = isDate(str(f, 'paid_on')) ? str(f, 'paid_on') : today();
    const refund = str(f, 'type') === 'refund';
    await addDeposit(me, {
      memberId: Number(f.get('member_id')),
      amount: refund ? -Math.abs(amount) : Math.abs(amount),
      paid_on, method: str(f, 'method') || 'cash', note: opt(f, 'note'),
    });
    return `${refund ? 'Refund' : 'Deposit'} of ${tk(Math.abs(amount))} tk recorded.`;
  });
}

export async function deleteDepositAction(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    await deleteDeposit(await requireMe(), Number(f.get('id')));
    return 'Deposit removed.';
  });
}

export async function setMealDepositAction(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const me = await requireManager();
    const ym = str(f, 'ym');
    const amount = parseTk(str(f, 'amount'));
    if (!isYm(ym) || amount == null || amount < 0) throw new UserError('Enter the meal deposit in taka.');
    await sql.begin(async (tx) => {
      await tx`
        insert into months (mess_id, ym, meal_deposit) values (${me.mess_id}, ${ym}, ${amount})
        on conflict (mess_id, ym) do update set meal_deposit = excluded.meal_deposit`;
      await audit(tx, me, 'month.deposit', { ym, amount });
    });
    return `Meal deposit for ${prettyMonth(ym)} set to ${tk(amount)} tk.`;
  });
}

export async function closeMonthAction(_: Result, f: FormData): Promise<Result> {
  return attempt(async () => {
    const me = await requireManager();
    const ym = str(f, 'ym');
    const close = str(f, 'op') === 'close';
    if (!isYm(ym)) throw new UserError('Unknown month.');
    const rows = close ? await monthReport(me.mess_id, ym) : [];
    await runChange(async (tx) => {
      await tx`
        insert into months (mess_id, ym, closed, closed_at) values (${me.mess_id}, ${ym}, ${close}, ${close ? new Date() : null})
        on conflict (mess_id, ym) do update set closed = excluded.closed, closed_at = excluded.closed_at`;
      await audit(tx, me, close ? 'month.close' : 'month.reopen', { ym });
      return rows.filter((r) => r.status !== 'left').map((r) => ({
        memberId: r.member_id,
        title: `${prettyMonth(ym)} closed`,
        body: `Brought forward ${tk(r.opening)}, deposited ${tk(r.deposited)}, spent ${tk(r.spent)} tk (rent/bills ${tk(r.rent_bill)}, staples ${tk(r.staple)}, bazar ${tk(r.bazar)}${r.other ? `, other ${tk(r.other)}` : ''}). Carried forward ${tk(r.closing)} tk.`,
        url: `/history/${ym}`,
      }));
    });
    return close ? `${prettyMonth(ym)} closed. Balances carry forward.` : `${prettyMonth(ym)} reopened for edits.`;
  });
}

// ---------- Notifications ----------

export async function markAllReadAction() {
  const me = await requireMe();
  await sql`update notifications set read_at = now() where member_id = ${me.id} and read_at is null`;
  revalidatePath('/', 'layout');
}
