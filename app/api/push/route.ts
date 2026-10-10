import { getMe } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(req: Request) {
  const me = await getMe();
  if (!me) return new Response('Sign in first', { status: 401 });
  const sub = await req.json().catch(() => null);
  const endpoint = sub?.endpoint, p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return new Response('Bad subscription', { status: 400 });
  }
  await sql`
    insert into push_subscriptions (member_id, endpoint, p256dh, auth) values (${me.id}, ${endpoint}, ${p256dh}, ${auth})
    on conflict (endpoint) do update set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await getMe();
  if (!me) return new Response('Sign in first', { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  await sql`delete from push_subscriptions where member_id = ${me.id} and endpoint = ${String(endpoint)}`;
  return Response.json({ ok: true });
}
