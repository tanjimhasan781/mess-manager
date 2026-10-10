import { headers } from 'next/headers';
import { requireMe } from '@/lib/auth';
import { sql } from '@/lib/db';
import { balancesOf } from '@/lib/notify';
import { tk } from '@/lib/money';
import { prettyDate, today } from '@/lib/dates';
import { addMember, updateMember } from '@/app/actions';
import { ActionForm, Submit } from '@/components/ActionForm';
import { CopyLink } from '@/components/CopyLink';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  deactivated: 'bg-amber-100 text-amber-800',
  left: 'bg-gray-200 text-gray-700',
};

export default async function MembersPage() {
  const me = await requireMe();
  const members = await sql<{ id: number; name: string; phone: string | null; role: string; status: string; joined_on: string; invite_code: string | null; signed_up: boolean }[]>`
    select id, name, phone, role, status, joined_on, invite_code, password_hash is not null as signed_up
    from members where mess_id = ${me.mess_id}
    order by array_position(array['active','deactivated','left'], status), role = 'manager' desc, name`;
  const balances = await balancesOf(sql, members.map((m) => m.id));
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const isManager = me.role === 'manager';

  return (
    <>
      <h1 className="h1">Members</h1>
      {isManager && (
        <section className="card">
          <h2 className="h2 mb-2">Add a member</h2>
          <ActionForm action={addMember} className="space-y-3" resetOnSuccess>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" name="name" className="field" required />
              </div>
              <div>
                <label className="label" htmlFor="joined_on">Joined on</label>
                <input id="joined_on" name="joined_on" type="date" className="field" defaultValue={today()} />
              </div>
            </div>
            <Submit className="btn w-full">Add member</Submit>
          </ActionForm>
          <p className="muted mt-2">After adding, share their invite link. They choose their own password.</p>
        </section>
      )}

      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {m.name}
                  {m.role === 'manager' && <span className="pill ml-1 bg-brand/10 text-brand">Manager</span>}
                  <span className={`pill ml-1 ${STATUS_STYLE[m.status]}`}>{m.status}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {m.phone ?? 'Not signed up yet'} · joined {prettyDate(m.joined_on)}
                </p>
              </div>
              <a href={`/ledger?member=${m.id}`} className={`num text-right font-semibold ${(balances.get(m.id) ?? 0) < 0 ? 'text-red-700' : ''}`}>
                {tk(balances.get(m.id) ?? 0)} tk
              </a>
            </div>

            {isManager && m.invite_code && m.status !== 'left' && <CopyLink url={`${origin}/join/${m.invite_code}`} name={m.name} />}

            {isManager && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-brand">Manage</summary>
                <div className="mt-2 space-y-2">
                  <ActionForm action={updateMember} className="flex gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="op" value="rename" />
                    <input name="name" defaultValue={m.name} className="field py-1.5" aria-label="Name" />
                    <Submit className="btn-ghost py-1.5 text-sm">Rename</Submit>
                  </ActionForm>
                  {m.id !== me.id && (
                    <ActionForm action={updateMember} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="op" defaultValue="" />
                      {m.status === 'active' && (
                        <Submit op="deactivate" className="btn-ghost py-1.5 text-sm"
                          confirm={`Deactivate ${m.name}? They won't be charged for new costs until reactivated.`}>Deactivate</Submit>
                      )}
                      {m.status !== 'active' && <Submit op="activate" className="btn-ghost py-1.5 text-sm">Make active</Submit>}
                      {m.status !== 'left' && (
                        <Submit op="left" className="btn-ghost py-1.5 text-sm"
                          confirm={`Mark ${m.name} as left? They can no longer sign in. Settle their balance (${tk(balances.get(m.id) ?? 0)} tk) with a deposit or refund.`}>Mark as left</Submit>
                      )}
                      {m.status === 'active' && m.signed_up && (
                        <Submit op="manager" className="btn-ghost py-1.5 text-sm"
                          confirm={`Make ${m.name} the manager? You will become a normal member.`}>Make manager</Submit>
                      )}
                      {m.signed_up && m.status !== 'left' && (
                        <Submit op="reset" className="btn-ghost py-1.5 text-sm"
                          confirm={`Reset ${m.name}'s password? They'll set a new one with a fresh invite link.`}>Reset password</Submit>
                      )}
                      {!m.signed_up && m.status !== 'left' && <Submit op="invite" className="btn-ghost py-1.5 text-sm">New invite link</Submit>}
                    </ActionForm>
                  )}
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
