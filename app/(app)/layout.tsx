import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { BottomNav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  const [{ unread }] = await sql<{ unread: number }[]>`
    select count(*)::int as unread from notifications where member_id = ${me.id} and read_at is null`;
  return (
    <div className="mx-auto max-w-xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#f4f6f5]/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <div>
          <p className="text-xs text-gray-500">{me.mess_name}</p>
          <p className="font-semibold">
            {me.name} {me.role === 'manager' && <span className="pill ml-1 bg-brand/10 text-brand">Manager</span>}
            {me.status === 'deactivated' && <span className="pill ml-1 bg-amber-100 text-amber-800">Deactivated</span>}
          </p>
        </div>
        <Link href="/notifications" aria-label={`Notifications, ${unread} unread`} className="relative rounded-full p-2 text-gray-700 active:bg-black/5">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>
      </header>
      <main className="space-y-4 px-4">{children}</main>
      <BottomNav />
    </div>
  );
}
