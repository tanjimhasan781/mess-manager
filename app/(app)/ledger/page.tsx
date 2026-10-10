import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { memberLedger } from '@/lib/ledger';
import { tk } from '@/lib/money';
import { prettyDate, prettyMonth, ymOf } from '@/lib/dates';

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const members = await sql<{ id: number; name: string; status: string }[]>`
    select id, name, status from members where mess_id = ${me.mess_id} order by status = 'active' desc, name`;
  const who = members.find((m) => m.id === Number(sp.member)) ?? members.find((m) => m.id === me.id)!;
  const entries = (await memberLedger(who.id)).reverse(); // newest first
  const balance = entries[0]?.balance ?? 0;
  const byMonth = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = ymOf(e.date);
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }

  return (
    <>
      <h1 className="h1">{who.id === me.id ? 'My ledger' : `${who.name}'s ledger`}</h1>
      <form className="flex gap-2">
        <select name="member" defaultValue={who.id} className="field py-2" aria-label="Show ledger for">
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.status !== 'active' ? ` (${m.status})` : ''}</option>)}
        </select>
        <button className="btn-ghost shrink-0">Show</button>
      </form>
      <section className={`hero ${balance < 0 ? "bg-red-700" : "bg-brand"}`}>
        <p className="text-sm opacity-80">Balance</p>
        <p className="num text-3xl font-bold">{tk(balance)} tk</p>
        <p className="text-sm opacity-90">Every cut and deposit, with the reason. Tap a cut to see the full bill.</p>
      </section>
      {entries.length === 0 && <p className="card muted">No entries yet.</p>}
      {[...byMonth].map(([ym, list]) => (
        <section key={ym} className="card p-0">
          <h2 className="h2 border-b px-4 py-2">{prettyMonth(ym)}</h2>
          <ul className="divide-y">
            {list.map((e, i) => {
              const row = (
                <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-xs text-gray-500">{prettyDate(e.date)}{e.detail ? ` · ${e.detail}` : ''}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`num font-semibold ${e.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{e.amount > 0 ? '+' : ''}{tk(e.amount)}</p>
                    <p className="num text-xs text-gray-500">{tk(e.balance ?? 0)}</p>
                  </div>
                </div>
              );
              return <li key={i}>{e.link ? <Link href={e.link} className="block active:bg-black/5">{row}</Link> : row}</li>;
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
