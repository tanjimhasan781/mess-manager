import { sql } from '@/lib/db';
import { joinMess } from '../../actions';
import { ActionForm, Submit } from '@/components/ActionForm';
import { AuthShell } from '@/components/AuthShell';

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [m] = await sql<{ name: string; mess: string }[]>`
    select m.name, x.name as mess from members m join messes x on x.id = m.mess_id
    where m.invite_code = ${code} and m.status <> 'left'`;
  if (!m) {
    return (
      <AuthShell title="Invite link not valid">
        <p className="muted">This link was already used or replaced. Ask your manager for a new one.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Join ${m.mess}`}>
      <p className="mb-4">Hi <b>{m.name}</b>, set up your sign-in. You will use your mobile number and this password.</p>
      <ActionForm action={joinMess} className="space-y-3">
        <input type="hidden" name="code" value={code} />
        <div>
          <label className="label" htmlFor="phone">Your mobile number</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className="field" placeholder="01712345678" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Choose a password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={6} className="field" required />
        </div>
        <Submit className="btn w-full">Join</Submit>
      </ActionForm>
    </AuthShell>
  );
}
