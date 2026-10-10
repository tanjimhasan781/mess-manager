import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { activeMonths, monthReport } from '@/lib/ledger';
import { tk } from '@/lib/money';
import { prettyMonth } from '@/lib/dates';

export default async function HistoryPage() {
  const me = await requireMe();
  const months = await activeMonths(me.mess_id);
  const closed = new Set((await sql<{ ym: string }[]>`select ym from months where mess_id = ${me.mess_id} and closed`).map((r) => r.ym));
  const reports = await Promise.all(months.map(async (ym) => ({ ym, rows: await monthReport(me.mess_id, ym) })));

  return (
    <>
      <h1 className="h1">Monthly history</h1>
      <p className="muted">How much came in, how much was spent, and what carried forward each month.</p>
      {reports.length === 0 && <p className="card muted">Nothing recorded yet.</p>}
      {reports.map(({ ym, rows }) => {
        const sum = (k: 'opening' | 'deposited' | 'spent' | 'closing' | 'meals') => rows.reduce((s, r) => s + r[k], 0);
        const mine = rows.find((r) => r.member_id === me.id);
        return (
          <Link key={ym} href={`/history/${ym}`} className="card block active:bg-black/5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="h2">{prettyMonth(ym)}</h2>
              <span className={`pill ${closed.has(ym) ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'}`}>{closed.has(ym) ? 'Closed' : 'Open'}</span>
            </div>
            <dl className="num grid grid-cols-2 gap-y-0.5 text-sm">
              <dt className="text-gray-500">Brought forward</dt><dd className="text-right">{tk(sum('opening'))}</dd>
              <dt className="text-gray-500">Deposited</dt><dd className="text-right">{tk(sum('deposited'))}</dd>
              <dt className="text-gray-500">Spent ({sum('meals')} meals)</dt><dd className="text-right">{tk(sum('spent'))}</dd>
              <dt className="font-semibold">Carried forward</dt><dd className="text-right font-semibold">{tk(sum('closing'))}</dd>
              {mine && <><dt className="text-gray-500">Yours carried forward</dt><dd className="text-right">{tk(mine.closing)}</dd></>}
            </dl>
          </Link>
        );
      })}
    </>
  );
}
