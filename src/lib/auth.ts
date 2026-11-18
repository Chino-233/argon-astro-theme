import { createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { AstroCookies } from 'astro';
import type { Entry } from './types';

const derive = promisify(pbkdf2);
const ownerCookie = 'argon_owner';
const limits = new Map<string, { attempts: number; end: number }>();
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

export function authConfigured() {
  return Boolean(signingKey() && process.env.ARGON_ADMIN_PASSWORD_HASH);
}

function signingKey() {
  const secret = process.env.ARGON_SESSION_SECRET ?? '';
  return /^[\da-f]{64}$/i.test(secret) ? Buffer.from(secret, 'hex') : null;
}

function mac(scope: string, expires: string) {
  const key = signingKey();
  return key ? createHmac('sha256', key).update(scope + ':' + expires).digest() : null;
}

function valid(cookies: AstroCookies, name: string, scope: string) {
  const value = cookies.get(name)?.value ?? '';
  const match = value.match(/^(\d{10,12})\.([A-Za-z0-9_-]{43})$/);
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  const expected = mac(scope, match[1]);
  const got = Buffer.from(match[2], 'base64url');
  return Boolean(expected && expected.length === got.length && timingSafeEqual(expected, got));
}

function write(cookies: AstroCookies, name: string, scope: string, url: URL, maxAge: number) {
  const expires = String(Math.floor(Date.now() / 1000) + maxAge);
  const digest = mac(scope, expires);
  if (!digest) return false;
  cookies.set(name, expires + '.' + digest.toString('base64url'), {
    httpOnly: true, sameSite: 'lax', secure: !loopback.has(url.hostname),
    path: '/', maxAge,
  });
  return true;
}

export function isOwner(cookies: AstroCookies) {
  return valid(cookies, ownerCookie, 'owner');
}

export function canRead(entry: Entry, cookies: AstroCookies) {
  if (!entry.visibility || isOwner(cookies)) return true;
  return entry.visibility === 'password' && valid(cookies, 'argon_unlock_' + entry.id, 'entry:' + entry.id + ':' + entry.passwordHash);
}

export function ownerLogin(cookies: AstroCookies, url: URL) {
  return write(cookies, ownerCookie, 'owner', url, 8 * 60 * 60);
}

export function unlockEntry(cookies: AstroCookies, entry: Entry, url: URL) {
  return write(cookies, 'argon_unlock_' + entry.id, 'entry:' + entry.id + ':' + entry.passwordHash, url, 4 * 60 * 60);
}

export function logout(cookies: AstroCookies, cookieHeader: string) {
  for (const name of cookieHeader.split(';').map((part) => part.trim().split('=', 1)[0])) {
    if (name === ownerCookie || /^argon_unlock_[\w-]+$/.test(name)) cookies.delete(name, { path: '/' });
  }
}

export async function verifyPassword(input: string, stored?: string | null) {
  if (!input || Buffer.byteLength(input) > 512 || !stored) return false;
  const [scheme, work, salt64, hash64] = stored.split('$');
  if (scheme !== 'pbkdf2-sha256' || work !== '600000' || !salt64 || !hash64) return false;
  const salt = Buffer.from(salt64, 'base64');
  const expected = Buffer.from(hash64, 'base64');
  if (salt.length !== 16 || expected.length !== 32) return false;
  const actual = await derive(input, salt, 600000, 32, 'sha256');
  return timingSafeEqual(expected, actual);
}

export async function hashPassword(input: string) {
  const salt = randomBytes(16);
  const hash = await derive(input, salt, 600000, 32, 'sha256');
  return ['pbkdf2-sha256', '600000', salt.toString('base64'), hash.toString('base64')].join('$');
}

export function allowAttempt(client: string, scope = 'auth') {
  const now = Date.now();
  for (const [id, value] of limits) if (value.end <= now) limits.delete(id);
  const all = scope + ':all';
  const ip = scope + ':ip:' + client;
  for (const [id, cap] of [[all, 30], [ip, 6]] as const) {
    const value = limits.get(id);
    if (value && value.attempts >= cap) return false;
  }
  for (const id of [all, ip]) {
    const value = limits.get(id);
    limits.set(id, value ? { ...value, attempts: value.attempts + 1 } : { attempts: 1, end: now + 60_000 });
  }
  return true;
}

export function returnPath(value: FormDataEntryValue | null, fallback = '/') {
  if (typeof value !== 'string' || !/^\/(?!\/)/.test(value) || /[\\\r\n\x00-\x1f]/.test(value)) return fallback;
  return value;
}

export function preventCaching(headers: Headers) {
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Vary', 'Cookie');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('Referrer-Policy', 'same-origin');
}
