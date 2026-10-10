import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { PushToggle } from '@/components/PushToggle';
import { MarkRead } from '@/components/MarkRead';

export default async function NotificationsPage() {
  const me = await requireMe();
  const notes = await sql<{ id: number; title: string; body: string; url: string | null; created_at: Date; read_at: Date | null }[]>`
    select id, title, body, url, created_at, read_at from notifications where member_id = ${me.id} order by created_at desc limit 200`;
  const unread = notes.filter((n) => !n.read_at).length;
  return (
    <>
      <h1 className="h1">Notifications</h1>
      <PushToggle />
      <MarkRead unread={unread} />
      {notes.length === 0 && <p className="card muted">No notifications yet. You&apos;ll see one here every time money is cut from your balance.</p>}
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id}>
            <Link href={n.url ?? '#'} className={`card block ${n.read_at ? '' : 'ring-2 ring-brand/40'}`}>
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-gray-700">{n.body}</p>
              <p className="mt-1 text-xs text-gray-500">{n.created_at.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
