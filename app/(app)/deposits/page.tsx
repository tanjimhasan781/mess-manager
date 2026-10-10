import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { dueThisMonth, monthReport, monthSettings } from '@/lib/ledger';
import { tk } from '@/lib/money';
import { isYm, monthRange, prettyDate, prettyMonth, today, ymOf } from '@/lib/dates';
import { addDepositAction, deleteDepositAction, setMealDepositAction } from '@/app/actions';
import { ActionForm, Submit } from '@/components/ActionForm';
import { MonthNav } from '@/components/MonthNav';

export default async function DepositsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const ym = isYm(sp.month) ? sp.month : ymOf(today());
  const { start, end } = monthRange(ym);
  const [rows, settings, deposits] = await Promise.all([
    monthReport(me.mess_id, ym),
    monthSettings(me.mess_id, ym),
    sql<{ id: number; name: string; amount: number; paid_on: string; method: string; note: string | null }[]>`
      select d.id, m.name, d.amount, d.paid_on, d.method, d.note from deposits d join members m on m.id = d.member_id
      where d.mess_id = ${me.mess_id} and d.deleted_at is null and d.paid_on between ${start} and ${end}
      order by d.paid_on desc, d.id desc`,
  ]);
  const isManager = me.role === 'manager';
  const editable = isManager && !settings.closed;
  const active = rows.filter((r) => r.status === 'active');
  const defaultDate = ymOf(today()) === ym ? today() : start;

  return (
    <>
      <MonthNav ym={ym} base="/deposits" />
      <section className="card">
        <h2 className="h2">Meal deposit for {prettyMonth(ym)}</h2>
        <p className="muted mb-2">
          Each member pays this plus their rent and bills share. Money left from last month counts toward it.
        </p>
        {editable ? (
          <ActionForm action={setMealDepositAction} className="flex gap-2">
            <input type="hidden" name="ym" value={ym} />
            <input name="amount" inputMode="decimal" className="field num" defaultValue={tk(settings.meal_deposit).replace(/,/g, '')} aria-label="Meal deposit in taka" />
            <Submit>Set</Submit>
          </ActionForm>
        ) : (
          <p className="num text-2xl font-bold">{tk(settings.meal_deposit)} tk</p>
        )}
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="num w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr><th className="px-3 py-2">Member</th><th className="px-2 py-2 text-right">Brought fwd</th><th className="px-2 py-2 text-right">Rent+bills</th><th className="px-2 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">To pay</th></tr>
          </thead>
          <tbody className="divide-y">
            {active.map((r) => {
              const due = dueThisMonth(r, settings.meal_deposit);
              return (
                <tr key={r.member_id}>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-2 py-2 text-right">{tk(r.opening)}</td>
                  <td className="px-2 py-2 text-right">{tk(r.rent_bill)}</td>
                  <td className="px-2 py-2 text-right">{tk(r.deposited)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${due ? 'text-red-700' : 'text-emerald-700'}`}>{due ? tk(due) : 'Paid'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {editable && (
        <section className="card">
          <h2 className="h2 mb-2">Record money</h2>
          <ActionForm action={addDepositAction} className="space-y-3" resetOnSuccess>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="member_id">Member</label>
                <select id="member_id" name="member_id" className="field" required>
                  {rows.filter((r) => r.status !== 'left').map((r) => <option key={r.member_id} value={r.member_id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="type">Type</label>
                <select id="type" name="type" className="field">
                  <option value="deposit">Paid to mess</option>
                  <option value="refund">Refund to member</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="damount">Amount (tk)</label>
                <input id="damount" name="amount" inputMode="decimal" className="field num" required />
              </div>
              <div>
                <label className="label" htmlFor="method">How</label>
                <select id="method" name="method" className="field">
                  <option>cash</option><option>bKash</option><option>Nagad</option><option>Rocket</option><option>bank</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="paid_on">Date</label>
                <input id="paid_on" name="paid_on" type="date" className="field" defaultValue={defaultDate} />
              </div>
              <div>
                <label className="label" htmlFor="dnote">Note</label>
                <input id="dnote" name="note" className="field" />
              </div>
            </div>
            <Submit className="btn w-full">Save</Submit>
          </ActionForm>
        </section>
      )}

      <section className="card p-0">
        <h2 className="h2 border-b px-4 py-2">Payments this month</h2>
        {deposits.length === 0 && <p className="muted p-4">None yet.</p>}
        <ul className="divide-y">
          {deposits.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-gray-500">{prettyDate(d.paid_on)} · {d.method}{d.note ? ` · ${d.note}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`num font-semibold ${d.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{d.amount > 0 ? '+' : ''}{tk(d.amount)}</span>
                {editable && (
                  <ActionForm action={deleteDepositAction} confirm={`Remove ${d.name}'s ${tk(d.amount)} tk payment?`}>
                    <input type="hidden" name="id" value={d.id} />
                    <Submit className="text-xs text-red-700">Remove</Submit>
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
