import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

const args = process.argv.slice(2);
const privateDir = args.length === 2 && args[0] === '--private-dir' ? args[1].replaceAll('\\', '/') : '';
if ((args.length && !privateDir) || /["\r\n]/.test(privateDir)) {
  console.error('Usage: npm run admin:setup -- [--private-dir PATH]');
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error('Run this setup from an interactive terminal.');
  process.exit(1);
}

let mute = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!mute) process.stdout.write(chunk, encoding);
    callback();
  },
});
output.isTTY = true;
const rl = createInterface({ input: process.stdin, output, terminal: true });
const password = await new Promise((resolve) => {
  process.stdout.write('New site owner password (at least 12 characters): ');
  mute = true;
  rl.question('', resolve);
});
mute = false;
rl.close();
process.stdout.write('\n');
if (password.length < 12 || Buffer.byteLength(password) > 512) {
  console.error('Use a password between 12 characters and 512 bytes.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 600000, 32, 'sha256');
const encoded = ['pbkdf2-sha256', '600000', salt.toString('base64'), hash.toString('base64')].join('$');
try {
  writeFileSync('.env', [
    'ARGON_ADMIN_PASSWORD_HASH=' + encoded,
    'ARGON_SESSION_SECRET=' + randomBytes(32).toString('hex'),
    ...(privateDir ? ['ARGON_PRIVATE_CONTENT_DIR="' + privateDir + '"'] : []),
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Wrote .env. Restart the Astro server and open /auth/.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.error('.env already exists. Keep its current configuration or back it up before rerunning.');
  process.exitCode = 1;
}
