import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { stateDir } from './argon-state';

let connection: { path: string; db: DatabaseSync } | undefined;

export function counterEnabled() {
  return process.env.ARGON_COUNTER === 'true';
}

function database() {
  const dir = stateDir();
  const path = resolve(dir, 'counter.sqlite');
  if (connection?.path === path) return connection.db;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  connection?.db.close();
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS totals (name TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, recorded INTEGER NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS events_recorded ON events(recorded);
    CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, views INTEGER NOT NULL) STRICT;`);
  connection = { path, db };
  return db;
}

export function currentTotals() {
  const rows = database().prepare("SELECT name, value FROM totals WHERE name IN ('views', 'visitors')").all();
  const totals = new Map(rows.map((row) => [String(row.name), Number(row.value)]));
  return { views: totals.get('views') ?? 0, visitors: totals.get('visitors') ?? 0 };
}

export function additionalPostViews(id: string | number) {
  return counterEnabled() ? Number(database().prepare('SELECT views FROM posts WHERE id=?').get(String(id))?.views ?? 0) : 0;
}

export function recordView(event: string, visitor?: string, article?: string | number) {
  const db = database();
  const now = Math.floor(Date.now() / 1000);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM events WHERE recorded < ?').run(now - 86400);
    if (db.prepare('INSERT OR IGNORE INTO events (id,recorded) VALUES (?,?)').run(event, now).changes) {
      const increase = db.prepare('INSERT INTO totals (name,value) VALUES (?,1) ON CONFLICT(name) DO UPDATE SET value=value+1');
      increase.run('views');
      if (visitor) {
        const digest = createHash('sha256').update(visitor).digest('hex');
        if (db.prepare('INSERT OR IGNORE INTO visitors (id) VALUES (?)').run(digest).changes) increase.run('visitors');
      }
      if (article !== undefined) {
        db.prepare('INSERT INTO posts (id,views) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET views=views+1').run(String(article));
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { ...currentTotals(), article: article === undefined ? undefined : additionalPostViews(article) };
}
