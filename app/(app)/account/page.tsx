import { requireMe } from '@/lib/auth';
import { changePassword } from '@/app/actions';
import { ActionForm, Submit } from '@/components/ActionForm';

export default async function AccountPage() {
  const me = await requireMe();
  return (
    <>
      <h1 className="h1">My account</h1>
      <section className="card">
        <p><b>{me.name}</b></p>
        <p className="muted">Signs in with {me.phone}</p>
      </section>
      <section className="card">
        <h2 className="h2 mb-2">Install on your phone</h2>
        <p className="text-sm"><b>Android (Chrome):</b> tap the ⋮ menu, then &quot;Install app&quot; or &quot;Add to Home screen&quot;.</p>
        <p className="mt-1 text-sm"><b>iPhone (Safari):</b> tap Share, then &quot;Add to Home Screen&quot;. Open it from the home screen to get notifications.</p>
      </section>
      <section className="card">
        <h2 className="h2 mb-2">Change password</h2>
        <ActionForm action={changePassword} className="space-y-3" resetOnSuccess>
          <input name="current" type="password" autoComplete="current-password" className="field" placeholder="Current password" aria-label="Current password" required />
          <input name="password" type="password" autoComplete="new-password" minLength={6} className="field" placeholder="New password" aria-label="New password" required />
          <Submit>Change password</Submit>
        </ActionForm>
      </section>
    </>
  );
}
