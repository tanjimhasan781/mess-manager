import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { KINDS } from '@/lib/ledger';
import { tk } from '@/lib/money';
import { isYm, monthRange, prettyDate, today, ymOf } from '@/lib/dates';
import { MonthNav } from '@/components/MonthNav';

const KIND_STYLE: Record<string, string> = {
  rent: 'bg-indigo-100 text-indigo-800',
  bill: 'bg-sky-100 text-sky-800',
  staple: 'bg-amber-100 text-amber-800',
  bazar: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-700',
};
const SHORT: Record<string, string> = { rent: 'Rent', bill: 'Bill', staple: 'Staples', bazar: 'Bazar', other: 'Other' };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const ym = isYm(sp.month) ? sp.month : ymOf(today());
  const { start, end } = monthRange(ym);
  const list = await sql<{ id: number; kind: string; title: string; amount: number; spent_on: string; buyer: string | null; people: number }[]>`
    select e.id, e.kind, e.title, e.amount, e.spent_on, b.name as buyer,
      (select count(*)::int from expense_shares s where s.expense_id = e.id) as people
    from expenses e left join members b on b.id = e.bought_by
    where e.mess_id = ${me.mess_id} and e.deleted_at is null and e.spent_on between ${start} and ${end}
    order by e.spent_on desc, e.id desc`;
  const totals = Object.keys(KINDS).map((k) => ({ k, sum: list.filter((e) => e.kind === k).reduce((s, e) => s + e.amount, 0) }));
  const grand = list.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <MonthNav ym={ym} base="/expenses" />
      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="h2">Total spent</h2>
          <span className="num text-xl font-bold">{tk(grand)} tk</span>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-1 text-sm">
          {totals.filter((t) => t.sum).map((t) => (
            <li key={t.k} className="flex justify-between pr-2"><span className="text-gray-500">{SHORT[t.k]}</span><span className="num">{tk(t.sum)}</span></li>
          ))}
        </ul>
      </section>
      {me.status === 'active' && (
        <Link href={me.role === 'manager' ? '/expenses/new' : '/expenses/new?kind=bazar'} className="btn w-full">
          {me.role === 'manager' ? '+ Add cost' : '+ Add bazar'}
        </Link>
      )}
      <section className="card p-0">
        {list.length === 0 && <p className="muted p-4">No costs this month yet.</p>}
        <ul className="divide-y">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`/expenses/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:bg-black/5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="text-xs text-gray-500">
                    <span className={`pill mr-1 ${KIND_STYLE[e.kind]}`}>{SHORT[e.kind]}</span>
                    {prettyDate(e.spent_on)}{e.buyer ? ` · ${e.buyer}` : ''}
                    {e.kind === 'bazar' && e.people === 0 && <span className="ml-1 text-amber-700">· waiting for meals</span>}
                  </p>
                </div>
                <span className="num shrink-0 font-semibold">{tk(e.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
