import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const key = randomBytes(32);
const maxAge = 600;
const sign = (prefix: string, entry: string) => createHmac('sha256', key).update(entry + ':' + prefix).digest();

export function issueCaptcha(entry: string) {
  const a = randomInt(1, 13);
  const b = randomInt(1, 13);
  const prefix = [Math.floor(Date.now() / 1000) + maxAge, a, b, randomBytes(8).toString('hex')].join('.');
  return { label: a + ' + ' + b + ' = ?', token: prefix + '.' + sign(prefix, entry).toString('base64url') };
}

export function verifyCaptcha(entry: string, token: string, answer: string) {
  const parts = token.match(/^(\d{10,12})\.(\d{1,2})\.(\d{1,2})\.[\da-f]{16}\.([\w-]{43})$/);
  if (!parts || Number(parts[1]) <= Math.floor(Date.now() / 1000) || !/^\d{1,2}$/.test(answer)) return false;
  const expected = sign(token.slice(0, token.lastIndexOf('.')), entry);
  const actual = Buffer.from(parts[4], 'base64url');
  return actual.length === expected.length && timingSafeEqual(expected, actual) && Number(answer) === Number(parts[2]) + Number(parts[3]);
}
