'use client';
import { useState } from 'react';
import { ActionForm, Submit } from './ActionForm';
import { saveMealsAction } from '@/app/actions';

type Row = { id: number; name: string; count: number; editable: boolean; by: string | null };

export function MealsForm({ date, rows, perMeal }: { date: string; rows: Row[]; perMeal: string | null }) {
  const [counts, setCounts] = useState(() => Object.fromEntries(rows.map((r) => [r.id, r.count])));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const anyEditable = rows.some((r) => r.editable);
  return (
    <ActionForm action={saveMealsAction} className="card">
      <input type="hidden" name="date" value={date} />
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="font-medium">{r.name}</p>
              {r.by && <p className="text-xs text-gray-500">Marked by {r.by}</p>}
            </div>
            {r.editable ? (
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost h-10 w-10 p-0 text-xl" aria-label={`Fewer meals for ${r.name}`}
                  onClick={() => setCounts((c) => ({ ...c, [r.id]: Math.max(0, c[r.id] - 1) }))}>−</button>
                <span className="num w-6 text-center text-lg font-semibold">{counts[r.id]}</span>
                <button type="button" className="btn-ghost h-10 w-10 p-0 text-xl" aria-label={`More meals for ${r.name}`}
                  onClick={() => setCounts((c) => ({ ...c, [r.id]: Math.min(20, c[r.id] + 1) }))}>+</button>
                <input type="hidden" name={`meals_${r.id}`} value={counts[r.id]} />
              </div>
            ) : (
              <span className="num text-lg font-semibold">{counts[r.id]}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm text-gray-600">Total <b>{total}</b> meals{perMeal ? ` · ${perMeal} tk per meal` : ''}</span>
        {anyEditable && <Submit>Save</Submit>}
      </div>
    </ActionForm>
  );
}
