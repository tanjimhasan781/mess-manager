import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth';
import { login } from '../actions';
import { ActionForm, Submit } from '@/components/ActionForm';
import { AuthShell } from '@/components/AuthShell';

export default async function LoginPage() {
  if (await getMe()) redirect('/');
  return (
    <AuthShell title="Mess Manager">
      <ActionForm action={login} className="space-y-3">
        <div>
          <label className="label" htmlFor="phone">Mobile number</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01712345678" className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" className="field" required />
        </div>
        <Submit className="btn w-full">Sign in</Submit>
      </ActionForm>
      <p className="muted mt-4 text-center">
        Joining a mess? Open the invite link your manager sent you.
        <br />
        Forgot your password? Ask the manager to reset it.
      </p>
      <p className="mt-4 text-center text-sm">
        <Link href="/setup" className="font-medium text-brand">Start a new mess</Link>
      </p>
    </AuthShell>
  );
}
