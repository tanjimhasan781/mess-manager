import 'server-only';
import webpush from 'web-push';
import { sql, type Tx } from './db';
import { tk } from './money';

export type Note = { memberId: number; title: string; body: string; url?: string };

/** Adds each affected member's new balance to the message, then saves the notifications. */
export async function saveNotes(tx: Tx, notes: Note[]): Promise<Note[]> {
  if (notes.length === 0) return [];
  const ids = [...new Set(notes.map((n) => n.memberId))];
  const bal = await balancesOf(tx, ids);
  const final = notes.map((n) => ({ ...n, body: `${n.body} Balance now: ${tk(bal.get(n.memberId) ?? 0)} tk.` }));
  await tx`insert into notifications ${tx(
    final.map((n) => ({ member_id: n.memberId, title: n.title, body: n.body, url: n.url ?? null })),
    'member_id', 'title', 'body', 'url',
  )}`;
  return final;
}

export async function balancesOf(tx: Tx | typeof sql, ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const rows = await tx<{ id: number; balance: number }[]>`
    select m.id,
      coalesce((select sum(d.amount) from deposits d where d.member_id = m.id and d.deleted_at is null), 0)::int
      - coalesce((select sum(s.amount) from expense_shares s join expenses e on e.id = s.expense_id
                  where s.member_id = m.id and e.deleted_at is null), 0)::int as balance
    from members m where m.id in ${tx(ids)}`;
  return new Map(rows.map((r) => [r.id, r.balance]));
}

let configured = false;
function configure() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
    configured = true;
  }
  return true;
}

/** Sends phone notifications. Call after the transaction has committed. Never throws. */
export async function pushNotes(notes: Note[]) {
  if (notes.length === 0 || !configure()) return;
  try {
    const ids = [...new Set(notes.map((n) => n.memberId))];
    const subs = await sql<{ id: number; member_id: number; endpoint: string; p256dh: string; auth: string }[]>`
      select id, member_id, endpoint, p256dh, auth from push_subscriptions where member_id in ${sql(ids)}`;
    await Promise.all(
      notes.flatMap((n) =>
        subs
          .filter((s) => s.member_id === n.memberId)
          .map(async (s) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                JSON.stringify({ title: n.title, body: n.body, url: n.url ?? '/notifications' }),
                { TTL: 60 * 60 * 24 },
              );
            } catch (e: unknown) {
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) await sql`delete from push_subscriptions where id = ${s.id}`;
            }
          }),
      ),
    );
  } catch (e) {
    console.error('push failed', e);
  }
}
