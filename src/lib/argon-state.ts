import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateOptions } from './argon-options';

export function stateDir() {
  return resolve(process.env.ARGON_STATE_DIR || '.argon-state');
}

let loaded: { file: string; value: Promise<Record<string, string>> } | undefined;
let writes = Promise.resolve();

export function loadOverrides() {
  const file = resolve(stateDir(), 'settings.json');
  if (loaded?.file !== file) {
    const value = readFile(file, 'utf8')
      .then((contents) => validateOptions(JSON.parse(contents)))
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return {};
        throw error;
      });
    loaded = { file, value };
    void value.catch(() => { if (loaded?.value === value) loaded = undefined; });
  }
  return loaded.value;
}

export function saveOverrides(settings: Record<string, string>) {
  const job = writes.then(async () => {
    const next = { ...await loadOverrides(), ...settings };
    const dir = stateDir();
    const file = resolve(dir, 'settings.json');
    const temp = resolve(dir, 'settings.' + randomUUID() + '.tmp');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    try { await rename(temp, file); }
    finally { await unlink(temp).catch(() => {}); }
    loaded = { file, value: Promise.resolve(next) };
  });
  writes = job.catch(() => {});
  return job;
}
