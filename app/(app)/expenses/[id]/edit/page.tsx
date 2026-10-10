import { notFound } from 'next/navigation';
import { requireManager } from '@/lib/auth';
import { sql } from '@/lib/db';
import { chargeableMembers } from '@/lib/members';
import { tk } from '@/lib/money';
import { ExpenseForm } from '@/components/ExpenseForm';

export default async function EditExpense({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireManager();
  const id = Number((await params).id);
  const [e] = await sql<{ id: number; kind: string; title: string; items: string | null; amount: number; spent_on: string; bought_by: number | null; note: string | null; has_receipt: boolean }[]>`
    select id, kind, title, items, amount, spent_on, bought_by, note, receipt is not null as has_receipt
    from expenses where id = ${id} and mess_id = ${me.mess_id} and deleted_at is null`;
  if (!e) notFound();
  const shares = await sql<{ member_id: number; amount: number; custom: boolean; reason: string | null }[]>`
    select member_id, amount, custom, reason from expense_shares where expense_id = ${id}`;
  return (
    <>
      <h1 className="h1">Edit cost</h1>
      <p className="muted">Everyone whose share changes will get a notification showing the old and new amount.</p>
      <ExpenseForm
        me={me.id}
        isManager
        members={await chargeableMembers(me.mess_id, id)}
        initial={{
          id: e.id, kind: e.kind, title: e.title, items: e.items ?? '', amount: tk(e.amount).replace(/,/g, ''),
          spent_on: e.spent_on, bought_by: e.bought_by, note: e.note ?? '', hasReceipt: e.has_receipt,
          picks: Object.fromEntries(shares.map((s) => [s.member_id, s.custom ? { custom: tk(s.amount).replace(/,/g, ''), reason: s.reason ?? '' } : null])),
        }}
      />
    </>
  );
}
