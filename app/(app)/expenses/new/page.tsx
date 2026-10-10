import { requireMe } from '@/lib/auth';
import { chargeableMembers } from '@/lib/members';
import { isDate, today } from '@/lib/dates';
import { ExpenseForm } from '@/components/ExpenseForm';

export default async function NewExpense({ searchParams }: { searchParams: Promise<{ kind?: string; date?: string }> }) {
  const me = await requireMe();
  const sp = await searchParams;
  const members = await chargeableMembers(me.mess_id);
  const kind = me.role === 'manager' && sp.kind && ['rent', 'bill', 'staple', 'other'].includes(sp.kind) ? sp.kind : 'bazar';
  if (me.status !== 'active') return <p className="card">Deactivated members cannot add costs.</p>;
  return (
    <>
      <h1 className="h1">Add a cost</h1>
      <ExpenseForm
        me={me.id}
        isManager={me.role === 'manager'}
        members={members}
        initial={{ kind, title: '', items: '', amount: '', spent_on: isDate(sp.date) ? sp.date : today(), bought_by: me.id, note: '', hasReceipt: false, picks: {} }}
      />
    </>
  );
}
