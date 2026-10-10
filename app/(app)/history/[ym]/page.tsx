import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { monthReport, monthSettings } from '@/lib/ledger';
import { tk } from '@/lib/money';
import { isYm, prettyMonth, shiftMonth } from '@/lib/dates';
import { closeMonthAction } from '@/app/actions';
import { ActionForm, Submit } from '@/components/ActionForm';

export default async function MonthPage({ params }: { params: Promise<{ ym: string }> }) {
  const me = await requireMe();
  const { ym } = await params;
  if (!isYm(ym)) notFound();
  const [rows, settings] = await Promise.all([monthReport(me.mess_id, ym), monthSettings(me.mess_id, ym)]);
  const total = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const cols: [keyof (typeof rows)[number], string][] = [
    ['opening', 'Brought fwd'], ['deposited', 'Deposited'], ['rent_bill', 'Rent+bills'], ['staple', 'Staples'],
    ['meals', 'Meals'], ['bazar', 'Bazar'], ['other', 'Other'], ['spent', 'Spent'], ['closing', 'Carried fwd'],
  ];
  const shown = cols.filter(([k]) => k !== 'other' || total('other') !== 0);
  const meals = total('meals');

  return (
    <>
      <div className="flex items-center justify-between">
        <Link className="btn-ghost px-3" href={`/history/${shiftMonth(ym, -1)}`} aria-label="Previous month">‹</Link>
        <span className="font-semibold">{prettyMonth(ym)} {settings.closed && <span className="pill ml-1 bg-gray-200 text-gray-700">Closed</span>}</span>
        <Link className="btn-ghost px-3" href={`/history/${shiftMonth(ym, 1)}`} aria-label="Next month">›</Link>
      </div>
      <section className="card">
        <dl className="num grid grid-cols-2 gap-y-0.5 text-sm">
          <dt className="text-gray-500">Total spent</dt><dd className="text-right">{tk(total('spent'))} tk</dd>
          <dt className="text-gray-500">Meals</dt><dd className="text-right">{meals}</dd>
          <dt className="text-gray-500">Average bazar per meal</dt><dd className="text-right">{meals ? tk(Math.round(total('bazar') / meals)) : 0} tk</dd>
          <dt className="text-gray-500">Carried forward (whole mess)</dt><dd className="text-right font-semibold">{tk(total('closing'))} tk</dd>
        </dl>
      </section>
      <section className="card overflow-x-auto p-0">
        <table className="num w-full whitespace-nowrap text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left">Member</th>
              {shown.map(([k, l]) => <th key={k} className="px-2 py-2 text-right">{l}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.member_id} className={r.member_id === me.id ? 'font-semibold' : ''}>
                <td className="sticky left-0 bg-white px-3 py-2"><Link href={`/ledger?member=${r.member_id}`} className="text-brand">{r.name}</Link></td>
                {shown.map(([k]) => (
                  <td key={k} className={`px-2 py-2 text-right ${k === 'closing' && r.closing < 0 ? 'text-red-700' : ''}`}>
                    {k === 'meals' ? r.meals : tk(r[k] as number)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="sticky left-0 bg-gray-50 px-3 py-2">Total</td>
              {shown.map(([k]) => <td key={k} className="px-2 py-2 text-right">{k === 'meals' ? meals : tk(total(k))}</td>)}
            </tr>
          </tbody>
        </table>
      </section>
      <p className="muted">Negative carried forward means the member owes the mess.</p>
      {me.role === 'manager' && (
        <ActionForm
          action={closeMonthAction}
          confirm={settings.closed ? 'Reopen this month for changes?' : 'Close this month? Nothing in it can be changed until reopened, and everyone gets their month summary.'}
        >
          <input type="hidden" name="ym" value={ym} />
          <input type="hidden" name="op" value={settings.closed ? 'reopen' : 'close'} />
          <Submit className={settings.closed ? 'btn-ghost w-full bg-white' : 'btn w-full'}>{settings.closed ? 'Reopen month' : 'Close month and carry forward'}</Submit>
        </ActionForm>
      )}
    </>
  );
}
