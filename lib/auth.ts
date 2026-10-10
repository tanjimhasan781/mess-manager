import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { sql } from './db';

const COOKIE = 'mess_session';

export type Me = {
  id: number;
  mess_id: number;
  mess_name: string;
  name: string;
  phone: string | null;
  role: 'manager' | 'member';
  status: 'active' | 'deactivated' | 'left';
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET must be set (at least 16 characters)');
  return new TextEncoder().encode(s);
}

export function normalizePhone(input: string): string | null {
  let d = String(input || '').replace(/\D/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  if (!/^01\d{9}$/.test(d)) return null;
  return d;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function startSession(memberId: number) {
  const token = await new SignJWT({ mid: memberId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('180d')
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in member, or null. Cached for the duration of one request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [me] = await sql<Me[]>`
      select m.id, m.mess_id, x.name as mess_name, m.name, m.phone, m.role, m.status
      from members m join messes x on x.id = m.mess_id
      where m.id = ${Number(payload.mid)} and m.password_hash is not null`;
    // Members who have left can no longer sign in; deactivated members still can (to see their history).
    if (!me || me.status === 'left') return null;
    return me;
  } catch {
    return null;
  }
});

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect('/login');
  return me;
}

export async function requireManager(): Promise<Me> {
  const me = await requireMe();
  if (me.role !== 'manager') throw new Error('Only the manager can do this.');
  return me;
}
