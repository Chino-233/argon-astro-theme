import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { stateDir } from './argon-state';
import type { Entry } from './types';

export interface EditableEntry {
  entry: Entry;
  source: string;
  format: 'markdown' | 'html';
  draft: boolean;
  revision: string;
  live?: Entry | null;
}

export function publishedEditorialEntry(record: EditableEntry) {
  return record.live === undefined ? (record.draft ? undefined : record.entry) : record.live ?? undefined;
}

let connection: { path: string; db: DatabaseSync } | undefined;

function database(create: boolean) {
  const dir = stateDir();
  const path = resolve(dir, 'editor.sqlite');
  if (connection?.path === path) return connection.db;
  if (!create && !existsSync(path)) return undefined;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  connection?.db.close();
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS edits (id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, revision TEXT NOT NULL, record TEXT NOT NULL) STRICT;`);
  connection = { path, db };
  return db;
}

export function editorialChanges() {
  const rows = database(false)?.prepare('SELECT id,record FROM edits').all() ?? [];
  return new Map(rows.map((row) => [String(row.id), JSON.parse(String(row.record)) as EditableEntry]));
}

export function saveEditorialChange(record: EditableEntry, expected: string) {
  const db = database(true)!;
  const id = String(record.entry.id);
  const path = record.entry.path;
  const data = JSON.stringify(record);
  const result = expected
    ? db.prepare('UPDATE edits SET revision=?, record=? WHERE id=? AND revision=?').run(record.revision, data, id, expected)
    : db.prepare('INSERT OR IGNORE INTO edits(id,path,revision,record) VALUES (?,?,?,?)').run(id, path, record.revision, data);
  return result.changes === 1;
}
