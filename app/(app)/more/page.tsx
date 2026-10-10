import Link from 'next/link';
import { requireMe } from '@/lib/auth';
import { logout } from '@/app/actions';

export default async function MorePage() {
  const me = await requireMe();
  const links = [
    { href: '/members', title: 'Members', sub: me.role === 'manager' ? 'Add, invite, deactivate, hand over manager' : 'Everyone and their balance' },
    { href: '/deposits', title: 'Deposits', sub: me.role === 'manager' ? 'Record payments, set meal deposit' : 'Who has paid this month' },
    { href: '/history', title: 'Monthly history', sub: 'Spent and carried forward each month' },
    { href: '/notifications', title: 'Notifications', sub: 'Every cut, and phone alerts' },
    { href: '/activity', title: 'Activity log', sub: 'Every change anyone made' },
    { href: '/account', title: 'My account', sub: 'Change password, install the app' },
  ];
  return (
    <>
      <h1 className="h1">More</h1>
      <ul className="card divide-y p-0">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center justify-between px-4 py-3 active:bg-black/5">
              <span><span className="block font-medium">{l.title}</span><span className="muted">{l.sub}</span></span>
              <span className="text-gray-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout}>
        <button className="btn-danger w-full bg-white">Sign out</button>
      </form>
    </>
  );
}
