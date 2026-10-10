import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isMonthClosed, KINDS } from '@/lib/ledger';
import { tk } from '@/lib/money';
import { prettyDate } from '@/lib/dates';
import { deleteExpenseAction } from '@/app/actions';
import { ActionForm, Submit } from '@/components/ActionForm';

export default async function ExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const id = Number((await params).id);
  const [e] = await sql<{ id: number; kind: keyof typeof KINDS; title: string; items: string | null; amount: number; spent_on: string; note: string | null;
    buyer: string | null; creator: string | null; created_at: Date; updated_at: Date; deleted_at: Date | null; has_receipt: boolean }[]>`
    select e.id, e.kind, e.title, e.items, e.amount, e.spent_on, e.note, b.name as buyer, c.name as creator,
      e.created_at, e.updated_at, e.deleted_at, e.receipt is not null as has_receipt
    from expenses e left join members b on b.id = e.bought_by left join members c on c.id = e.created_by
    where e.id = ${id} and e.mess_id = ${me.mess_id}`;
  if (!e) notFound();
  const shares = await sql<{ member_id: number; name: string; amount: number; meals: number | null; custom: boolean; reason: string | null }[]>`
    select s.member_id, m.name, s.amount, s.meals, s.custom, s.reason
    from expense_shares s join members m on m.id = s.member_id where s.expense_id = ${id} order by s.amount desc, m.name`;
  const totalMeals = shares.reduce((s, x) => s + (x.meals ?? 0), 0);
  const closed = await isMonthClosed(sql, me.mess_id, e.spent_on);
  const fmt = (d: Date) => d.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <>
      <Link href="/expenses" className="text-sm text-brand">← All costs</Link>
      {e.deleted_at && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This cost was deleted. Nobody is charged for it.</p>}
      <section className="card">
        <p className="muted">{KINDS[e.kind]} · {prettyDate(e.spent_on)}</p>
        <h1 className="h1">{e.title}</h1>
        <p className="num mt-1 text-3xl font-bold">{tk(e.amount)} tk</p>
        {e.items && <p className="mt-2 whitespace-pre-line text-sm">{e.items}</p>}
        {e.note && <p className="mt-2 text-sm text-gray-600">Note: {e.note}</p>}
        <p className="mt-3 text-xs text-gray-500">
          {e.buyer && <>Bought by {e.buyer} · </>}Added by {e.creator ?? 'unknown'} on {fmt(e.created_at)}
          {+e.updated_at - +e.created_at > 1000 && <> · edited {fmt(e.updated_at)}</>}
        </p>
        {e.has_receipt && (
          <a href={`/api/receipt/${e.id}`} target="_blank" rel="noreferrer">
            <img src={`/api/receipt/${e.id}`} alt="Receipt" className="mt-3 max-h-72 rounded-xl ring-1 ring-black/10" />
          </a>
        )}
      </section>

      <section className="card">
        <h2 className="h2 mb-2">Who was charged</h2>
        {shares.length === 0 && (
          <p className="text-sm text-amber-800">{e.kind === 'bazar' ? 'No meals are marked for this day yet. Shares appear once meals are marked.' : 'Nobody.'}</p>
        )}
        <ul className="divide-y">
          {shares.map((s) => (
            <li key={s.member_id} className={`flex justify-between py-2 ${s.member_id === me.id ? 'font-semibold' : ''}`}>
              <span>
                {s.name}
                <span className="block text-xs font-normal text-gray-500">
                  {e.kind === 'bazar' ? `${s.meals} of ${totalMeals} meals` : s.custom ? `Custom${s.reason ? `: ${s.reason}` : ''}` : 'Equal share'}
                </span>
              </span>
              <span className="num">{tk(s.amount)} tk</span>
            </li>
          ))}
        </ul>
      </section>

      {me.role === 'manager' && !e.deleted_at && !closed && (
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/expenses/${e.id}/edit`} className="btn-ghost bg-white">Edit</Link>
          <ActionForm action={deleteExpenseAction} confirm="Delete this cost? Everyone charged will get the money back and a notification.">
            <input type="hidden" name="id" value={e.id} />
            <Submit className="btn-danger w-full bg-white">Delete</Submit>
          </ActionForm>
        </div>
      )}
      {closed && <p className="muted">This month is closed, so this cost can&apos;t be changed.</p>}
    </>
  );
}
