export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <img src="/icon-192.png" alt="" className="mx-auto mb-3 h-14 w-14 rounded-2xl" />
        <h1 className="h1">{title}</h1>
      </div>
      <div className="card">{children}</div>
    </main>
  );
}
