// Creates the tables. Usage: DATABASE_URL=postgres://... npm run migrate
import fs from 'node:fs';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL first'); process.exit(1); }
const sql = postgres(url, { ssl: url.includes('localhost') ? false : 'require', max: 1, onnotice: () => {} });
await sql.unsafe(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
console.log('Database is ready.');
await sql.end();
