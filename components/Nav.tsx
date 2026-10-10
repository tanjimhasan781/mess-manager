'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/', label: 'Home', icon: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { href: '/meals', label: 'Meals', icon: 'M4 3v8a3 3 0 006 0V3M7 3v18M17 3c-2 0-3 3-3 7h3v11' },
  { href: '/expenses', label: 'Costs', icon: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4' },
  { href: '/ledger', label: 'My ledger', icon: 'M4 19h16M7 16V9M12 16V5M17 16v-4' },
  { href: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {items.map((it) => {
          const active = it.href === '/' ? path === '/' : path.startsWith(it.href) ||
            (it.href === '/more' && ['/members', '/deposits', '/history', '/notifications', '/activity', '/account'].some((p) => path.startsWith(p)));
          return (
            <li key={it.href} className="flex-1">
              <Link href={it.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? 'text-brand' : 'text-gray-500'}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
