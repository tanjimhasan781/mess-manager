import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isMonthClosed } from '@/lib/ledger';
import { isDate, prettyDate, shiftDay, today } from '@/lib/dates';
import { tk } from '@/lib/money';
import { MealsForm } from '@/components/MealsForm';

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const date = isDate(sp.date) ? sp.date : today();
  const closed = await isMonthClosed(sql, me.mess_id, date);
  const rows = await sql<{ id: number; name: string; count: number | null; by: string | null }[]>`
    select m.id, m.name, ml.count, u.name as by
    from members m
    left join meals ml on ml.member_id = m.id and ml.meal_date = ${date}
    left join members u on u.id = ml.updated_by and u.id <> m.id
    where m.mess_id = ${me.mess_id} and (m.status = 'active' or ml.count > 0)
    order by m.id = ${me.id} desc, m.name`;
  const bazar = await sql<{ id: number; title: string; amount: number }[]>`
    select id, title, amount from expenses where mess_id = ${me.mess_id} and kind = 'bazar' and spent_on = ${date} and deleted_at is null`;
  const bazarTotal = bazar.reduce((s, b) => s + b.amount, 0);
  const meals = rows.reduce((s, r) => s + (r.count ?? 0), 0);
  const canEdit = (id: number) => !closed && me.status === 'active' && (me.role === 'manager' || id === me.id);

  return (
    <>
      <div className="flex items-center justify-between">
        <Link className="btn-ghost px-3" href={`/meals?date=${shiftDay(date, -1)}`} aria-label="Previous day">‹</Link>
        <div className="text-center">
          <p className="font-semibold">{date === today() ? 'Today' : prettyDate(date)}</p>
          <p className="text-xs text-gray-500">{date}</p>
        </div>
        <Link className="btn-ghost px-3" href={`/meals?date=${shiftDay(date, 1)}`} aria-label="Next day">›</Link>
      </div>
      <p className="muted">
        {me.role === 'manager' ? 'You can mark meals for everyone.' : 'Mark how many meals you ate. The manager can also change it.'}
        {closed && ' This month is closed, so meals are read-only.'}
      </p>
      <MealsForm
        key={date}
        date={date}
        rows={rows.map((r) => ({ id: r.id, name: r.id === me.id ? `${r.name} (you)` : r.name, count: r.count ?? 0, editable: canEdit(r.id), by: r.by }))}
        perMeal={bazarTotal && meals ? tk(Math.round(bazarTotal / meals)) : null}
      />
      <section className="card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="h2">Bazar for this day</h2>
          {!closed && me.status === 'active' && (
            <Link href={`/expenses/new?kind=bazar&date=${date}`} className="text-sm font-medium text-brand">+ Add</Link>
          )}
        </div>
        {bazar.length === 0 ? (
          <p className="muted">No bazar entered for this day.</p>
        ) : (
          <ul className="divide-y text-sm">
            {bazar.map((b) => (
              <li key={b.id} className="flex justify-between py-2">
                <Link href={`/expenses/${b.id}`} className="text-brand">{b.title}</Link>
                <span className="num">{tk(b.amount)} tk</span>
              </li>
            ))}
          </ul>
        )}
        {bazarTotal > 0 && meals === 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">No meals marked yet, so nobody has been charged for this bazar.</p>
        )}
      </section>
    </>
  );
}
