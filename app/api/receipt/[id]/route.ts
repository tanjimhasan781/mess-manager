import { getMe } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) return new Response('Sign in first', { status: 401 });
  const [r] = await sql<{ receipt: Buffer | null; receipt_type: string | null }[]>`
    select receipt, receipt_type from expenses where id = ${Number((await params).id)} and mess_id = ${me.mess_id}`;
  if (!r?.receipt) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(r.receipt), {
    headers: { 'Content-Type': r.receipt_type ?? 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
  });
}
