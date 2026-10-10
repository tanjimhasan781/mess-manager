import 'server-only';
import { sql } from './db';

/** Members who can be charged: active ones, plus anyone already on the given expense. */
export async function chargeableMembers(messId: number, expenseId?: number) {
  return sql<{ id: number; name: string }[]>`
    select id, name from members
    where mess_id = ${messId} and (status = 'active'
      or id in (select member_id from expense_shares where expense_id = ${expenseId ?? 0}))
    order by name`;
}
