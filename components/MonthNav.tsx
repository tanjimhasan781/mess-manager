import Link from 'next/link';
import { prettyMonth, shiftMonth } from '@/lib/dates';

export function MonthNav({ ym, base, extra = '' }: { ym: string; base: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link className="btn-ghost px-3" href={`${base}?month=${shiftMonth(ym, -1)}${extra}`} aria-label="Previous month">‹</Link>
      <span className="font-semibold">{prettyMonth(ym)}</span>
      <Link className="btn-ghost px-3" href={`${base}?month=${shiftMonth(ym, 1)}${extra}`} aria-label="Next month">›</Link>
    </div>
  );
}
