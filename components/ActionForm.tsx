'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { Result } from '@/app/actions';

type Props = {
  action: (prev: Result, f: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
};

/** A form that shows the server's success or error message under it. */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: Props) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={run}
      className={className}
      onSubmit={(e) => {
        const ask = ((e.nativeEvent as SubmitEvent).submitter as HTMLElement | null)?.dataset.confirm ?? confirm;
        if (ask && !window.confirm(ask)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</p>}
    </form>
  );
}

/** Submit button. `op` fills the form's hidden "op" field, for forms with several actions. */
export function Submit({ children, className = 'btn', op, confirm }: { children: ReactNode; className?: string; op?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      data-confirm={confirm}
      onClick={(e) => {
        const field = e.currentTarget.form?.querySelector<HTMLInputElement>('input[name="op"]');
        if (op && field) field.value = op;
      }}
    >
      {pending ? 'Saving…' : children}
    </button>
  );
}
