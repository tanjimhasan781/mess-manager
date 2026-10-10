'use client';
import { useMemo, useState } from 'react';
import { ActionForm, Submit } from './ActionForm';
import { saveExpenseAction } from '@/app/actions';

type Member = { id: number; name: string };
type Pick = { custom: string; reason: string; on: boolean; open: boolean };

export type ExpenseInitial = {
  id?: number;
  kind: string;
  title: string;
  items: string;
  amount: string;
  spent_on: string;
  bought_by: number | null;
  note: string;
  hasReceipt: boolean;
  picks: Record<number, { custom: string; reason: string } | null>; // null = picked, equal share
};

const KIND_LABELS: Record<string, string> = {
  bazar: 'Daily bazar (split by meals)',
  staple: 'Staples: chal, dal, tel, spices (split equally)',
  rent: 'Rent (split equally)',
  bill: 'Utility bill (split equally)',
  other: 'Other (split equally)',
};

const TITLE_HINTS: Record<string, string> = {
  bazar: 'Bazar', staple: 'Chal, dal, tel', rent: 'Flat rent', bill: 'Electricity bill', other: '',
};

/** Shrinks a photo to a small JPEG so receipts stay light. */
async function compress(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

export function ExpenseForm({ members, initial, isManager, me }: { members: Member[]; initial: ExpenseInitial; isManager: boolean; me: number }) {
  const [kind, setKind] = useState(initial.kind);
  const [amount, setAmount] = useState(initial.amount);
  const [receipt, setReceipt] = useState<string>('');
  const [picks, setPicks] = useState<Record<number, Pick>>(() =>
    Object.fromEntries(
      members.map((m) => {
        const p = initial.picks[m.id];
        const on = initial.id ? m.id in initial.picks : true;
        return [m.id, { on, custom: p?.custom ?? '', reason: p?.reason ?? '', open: !!p?.custom }];
      }),
    ),
  );
  const set = (id: number, patch: Partial<Pick>) => setPicks((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const preview = useMemo(() => {
    const total = Number(amount.replace(/,/g, '')) || 0;
    const on = members.filter((m) => picks[m.id].on);
    const fixed = on.filter((m) => picks[m.id].open && picks[m.id].custom).reduce((s, m) => s + (Number(picks[m.id].custom) || 0), 0);
    const rest = on.filter((m) => !(picks[m.id].open && picks[m.id].custom)).length;
    return rest ? ((total - fixed) / rest).toFixed(2) : null;
  }, [amount, picks, members]);

  const kinds = isManager ? Object.keys(KIND_LABELS) : ['bazar'];

  return (
    <ActionForm action={saveExpenseAction} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="receipt" value={receipt} />
      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="kind">Type of cost</label>
          <select id="kind" name="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="amount">Amount (tk)</label>
            <input id="amount" name="amount" inputMode="decimal" className="field num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="450" required />
          </div>
          <div>
            <label className="label" htmlFor="spent_on">{kind === 'bazar' ? 'Meal date' : 'Date'}</label>
            <input id="spent_on" name="spent_on" type="date" className="field" defaultValue={initial.spent_on} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="title">Name</label>
          <input id="title" name="title" className="field" defaultValue={initial.title} placeholder={TITLE_HINTS[kind]} />
        </div>
        {(kind === 'bazar' || kind === 'staple' || kind === 'other') && (
          <div>
            <label className="label" htmlFor="items">What was bought</label>
            <textarea id="items" name="items" rows={2} className="field" defaultValue={initial.items} placeholder="Fish 250, vegetables 120, eggs 80" />
          </div>
        )}
        {(kind === 'bazar' || kind === 'staple') && (
          <div>
            <label className="label" htmlFor="bought_by">Bought by</label>
            <select id="bought_by" name="bought_by" className="field" defaultValue={initial.bought_by ?? me}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="note">Note (optional)</label>
          <input id="note" name="note" className="field" defaultValue={initial.note} />
        </div>
        <div>
          <span className="label">Receipt photo (optional)</span>
          <input
            type="file" accept="image/*" className="block w-full text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setReceipt(f ? await compress(f) : '');
            }}
          />
          {receipt && receipt !== 'remove' && <img src={receipt} alt="Receipt preview" className="mt-2 max-h-40 rounded-lg" />}
          {initial.hasReceipt && !receipt && (
            <button type="button" className="mt-2 text-sm text-red-700" onClick={() => setReceipt('remove')}>Remove current photo</button>
          )}
          {receipt === 'remove' && <p className="mt-1 text-sm text-gray-500">Photo will be removed.</p>}
        </div>
      </div>

      {kind === 'bazar' ? (
        <p className="card text-sm text-gray-600">
          This bazar is split by the meals each person eats on the meal date. If meals change later, everyone&apos;s share is recalculated and they are notified.
        </p>
      ) : (
        <div className="card">
          <h2 className="h2">Who pays?</h2>
          <p className="muted mb-2">Untick anyone who should not pay, or set a custom amount (for example, someone who joined mid-month).</p>
          <ul className="divide-y">
            {members.map((m) => {
              const p = picks[m.id];
              return (
                <li key={m.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="pick" value={m.id} checked={p.on} onChange={(e) => set(m.id, { on: e.target.checked })} className="h-5 w-5 accent-brand" />
                      <span>{m.name}</span>
                    </label>
                    {p.on && (
                      <span className="flex items-center gap-2">
                        {!p.open && preview && <span className="num text-sm text-gray-500">{preview}</span>}
                        <button type="button" className="text-sm text-brand" onClick={() => set(m.id, { open: !p.open, custom: p.open ? '' : p.custom })}>
                          {p.open ? 'Equal share' : 'Custom'}
                        </button>
                      </span>
                    )}
                  </div>
                  {p.on && p.open && (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <input name={`custom_${m.id}`} inputMode="decimal" className="field num col-span-1" placeholder="tk" value={p.custom} onChange={(e) => set(m.id, { custom: e.target.value })} />
                      <input name={`reason_${m.id}`} className="field col-span-2" placeholder="Reason, e.g. joined on 16th" value={p.reason} onChange={(e) => set(m.id, { reason: e.target.value })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Submit className="btn w-full">{initial.id ? 'Save changes' : 'Add cost'}</Submit>
    </ActionForm>
  );
}
