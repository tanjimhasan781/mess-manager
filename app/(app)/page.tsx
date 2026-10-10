import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { balancesOf } from '@/lib/notify';
import { dueThisMonth, monthReport, monthSettings } from '@/lib/ledger';
import { tk } from '@/lib/money';
import { prettyMonth, today, ymOf } from '@/lib/dates';

export default async function Home() {
  const me = await requireMe();
  const ym = ymOf(today());
  const [rows, settings, balances, notes, [mealsToday]] = await Promise.all([
    monthReport(me.mess_id, ym),
    monthSettings(me.mess_id, ym),
    balancesOf(sql, [me.id]),
    sql<{ id: number; title: string; body: string; created_at: Date; read_at: Date | null; url: string | null }[]>`
      select id, title, body, created_at, read_at, url from notifications where member_id = ${me.id} order by created_at desc limit 4`,
    sql<{ count: number }[]>`select count from meals where member_id = ${me.id} and meal_date = ${today()}`,
  ]);
  const mine = rows.find((r) => r.member_id === me.id);
  const balance = balances.get(me.id) ?? 0;
  const due = me.status === 'active' ? dueThisMonth(mine, settings.meal_deposit) : 0;
  const totalMeals = rows.reduce((s, r) => s + r.meals, 0);
  const totalBazar = rows.reduce((s, r) => s + r.bazar, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const unpaid = rows.filter((r) => r.status === 'active').map((r) => ({ ...r, due: dueThisMonth(r, settings.meal_deposit) })).filter((r) => r.due > 0);

  return (
    <>
      <section className={`hero ${balance < 0 ? "bg-red-700" : "bg-brand"}`}>
        <p className="text-sm opacity-80">My balance</p>
        <p className="num text-4xl font-bold">{tk(balance)} <span className="text-xl font-medium">tk</span></p>
        <p className="mt-1 text-sm opacity-90">
          {due > 0 ? <>To pay for {prettyMonth(ym)}: <b>{tk(due)} tk</b></> : balance < 0 ? 'You owe the mess this amount.' : `All paid for ${prettyMonth(ym)}.`}
        </p>
      </section>

      {me.status === 'active' && (
        <Link href="/meals" className="card flex items-center justify-between">
          <span>
            <span className="h2 block">Today&apos;s meals</span>
            <span className="muted">{mealsToday ? `You marked ${mealsToday.count}` : 'Not marked yet'}</span>
          </span>
          <span className="btn-ghost">Mark</span>
        </Link>
      )}

      {me.role === 'manager' && (
        <section className="grid grid-cols-2 gap-3">
          <Link href="/expenses/new" className="btn">+ Add cost</Link>
          <Link href="/deposits" className="btn-ghost bg-white">+ Deposit</Link>
        </section>
      )}
      {me.role !== 'manager' && me.status === 'active' && (
        <Link href="/expenses/new?kind=bazar" className="btn w-full">+ Add today&apos;s bazar</Link>
      )}

      <section className="card">
        <h2 className="h2 mb-2">My {prettyMonth(ym)}</h2>
        <dl className="num grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-gray-500">Brought forward</dt><dd className="text-right">{tk(mine?.opening ?? 0)}</dd>
          <dt className="text-gray-500">Deposited</dt><dd className="text-right">{tk(mine?.deposited ?? 0)}</dd>
          <dt className="text-gray-500">Rent and bills</dt><dd className="text-right">{tk(mine?.rent_bill ?? 0)}</dd>
          <dt className="text-gray-500">Staples</dt><dd className="text-right">{tk(mine?.staple ?? 0)}</dd>
          <dt className="text-gray-500">Bazar ({mine?.meals ?? 0} meal{mine?.meals === 1 ? "" : "s"})</dt><dd className="text-right">{tk(mine?.bazar ?? 0)}</dd>
          {!!mine?.other && <><dt className="text-gray-500">Other</dt><dd className="text-right">{tk(mine.other)}</dd></>}
          <dt className="font-semibold">Spent</dt><dd className="text-right font-semibold">{tk(mine?.spent ?? 0)}</dd>
        </dl>
        <Link href="/ledger" className="mt-3 block text-sm font-medium text-brand">See every cut →</Link>
      </section>

      <section className="card">
        <h2 className="h2 mb-2">Mess this month</h2>
        <dl className="num grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-gray-500">Total spent</dt><dd className="text-right">{tk(totalSpent)} tk</dd>
          <dt className="text-gray-500">Meals eaten</dt><dd className="text-right">{totalMeals}</dd>
          <dt className="text-gray-500">Average bazar per meal</dt><dd className="text-right">{totalMeals ? tk(Math.round(totalBazar / totalMeals)) : '0'} tk</dd>
          <dt className="text-gray-500">Meal deposit</dt><dd className="text-right">{tk(settings.meal_deposit)} tk</dd>
        </dl>
        {me.role === 'manager' && unpaid.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="mb-1 text-sm font-medium">Still to pay</p>
            <ul className="num text-sm">
              {unpaid.map((r) => (
                <li key={r.member_id} className="flex justify-between"><span>{r.name}</span><span>{tk(r.due)} tk</span></li>
              ))}
            </ul>
          </div>
        )}
        <Link href={`/history/${ym}`} className="mt-3 block text-sm font-medium text-brand">Everyone&apos;s totals →</Link>
      </section>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="h2">Latest notifications</h2>
          <Link href="/notifications" className="text-sm text-brand">All</Link>
        </div>
        {notes.length === 0 && <p className="muted">Nothing yet.</p>}
        <ul className="divide-y">
          {notes.map((n) => (
            <li key={n.id} className="py-2">
              <Link href={n.url ?? '/notifications'}>
                <p className={`text-sm ${n.read_at ? '' : 'font-semibold'}`}>{n.title}</p>
                <p className="muted line-clamp-2">{n.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
