import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { tk } from '@/lib/money';

type Row = { id: number; action: string; details: Record<string, unknown>; created_at: Date; actor: string | null };

function describe(r: Row, names: Map<number, string>): string {
  const d = r.details as Record<string, never>;
  const who = (id: unknown) => names.get(Number(id)) ?? 'someone';
  switch (r.action) {
    case 'expense.add': return `added ${d.title} (${tk(d.amount)} tk, ${d.spent_on})`;
    case 'expense.edit': return `edited ${d.title} (now ${tk(d.amount)} tk)`;
    case 'expense.delete': return `deleted ${d.title} (${tk(d.amount)} tk)`;
    case 'meals.set': return `set ${who(d.member)}'s meals on ${d.date} from ${d.before} to ${d.after}`;
    case 'deposit.add': return `recorded ${tk(d.amount)} tk from ${who(d.memberId)} (${d.method})`;
    case 'deposit.delete': return `removed a ${tk(d.amount)} tk deposit from ${who(d.member_id)}`;
    case 'month.deposit': return `set the ${d.ym} meal deposit to ${tk(d.amount)} tk`;
    case 'month.close': return `closed ${d.ym}`;
    case 'month.reopen': return `reopened ${d.ym}`;
    default: {
      const [, op] = r.action.split('.');
      const verbs: Record<string, string> = {
        add: 'added member', rename: 'renamed', deactivate: 'deactivated', activate: 'reactivated', left: 'marked as left',
        manager: 'made manager', invite: 'made a new invite for', reset: 'reset the password of',
      };
      return `${verbs[op] ?? r.action} ${d.name ?? ''}`;
    }
  }
}

export default async function ActivityPage() {
  const me = await requireMe();
  const rows = await sql<Row[]>`
    select a.id, a.action, a.details, a.created_at, m.name as actor
    from audit_log a left join members m on m.id = a.actor_id
    where a.mess_id = ${me.mess_id} order by a.created_at desc limit 300`;
  const names = new Map((await sql<{ id: number; name: string }[]>`select id, name from members where mess_id = ${me.mess_id}`).map((m) => [m.id, m.name]));
  return (
    <>
      <h1 className="h1">Activity log</h1>
      <p className="muted">Every change, by whom and when. Nothing can be removed from this list.</p>
      <ul className="card divide-y p-0">
        {rows.length === 0 && <li className="muted p-4">No activity yet.</li>}
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-2.5 text-sm">
            <b>{r.actor ?? 'Someone'}</b> {describe(r, names)}
            <span className="block text-xs text-gray-500">{r.created_at.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
