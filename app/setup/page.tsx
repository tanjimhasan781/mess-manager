import Link from 'next/link';
import { createMess } from '../actions';
import { ActionForm, Submit } from '@/components/ActionForm';
import { AuthShell } from '@/components/AuthShell';

export default function SetupPage() {
  return (
    <AuthShell title="Start a new mess">
      <p className="muted mb-4">You will be the manager. You can add the other members next.</p>
      <ActionForm action={createMess} className="space-y-3">
        <div>
          <label className="label" htmlFor="mess">Mess name</label>
          <input id="mess" name="mess" className="field" placeholder="e.g. Green Villa Mess" required />
        </div>
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" className="field" autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Your mobile number</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className="field" placeholder="01712345678" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Choose a password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={6} className="field" required />
        </div>
        <Submit className="btn w-full">Create mess</Submit>
      </ActionForm>
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-brand">Back to sign in</Link></p>
    </AuthShell>
  );
}
