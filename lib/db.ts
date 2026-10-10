import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var __sql: postgres.Sql | undefined;
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return postgres(url, {
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require',
    max: 5,
    prepare: false, // works with Supabase's transaction pooler
    onnotice: () => {},
    // Keep dates as 'YYYY-MM-DD' strings instead of JS Date objects.
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
}

export const sql: postgres.Sql = globalThis.__sql ?? (globalThis.__sql = connect());
export type Tx = postgres.TransactionSql;
