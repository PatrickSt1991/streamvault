import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import Database from 'better-sqlite3';
import {
  createAtomicBackup,
  findLatestValidBackup,
  restoreLatestValidBackup,
  validateDatabaseFile,
} from './db-lifecycle.js';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'streamvault-db-'));
}

function createDb(file: string, marker: string): InstanceType<typeof Database> {
  const db = new Database(file);
  db.exec(`
    CREATE TABLE channels (id TEXT PRIMARY KEY);
    CREATE TABLE categories (id TEXT PRIMARY KEY);
    CREATE TABLE programs (id INTEGER PRIMARY KEY);
    CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run('marker', marker);
  return db;
}

function readMarker(file: string): string {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    return (db.prepare("SELECT value FROM config WHERE key = 'marker'").get() as { value: string }).value;
  } finally {
    db.close();
  }
}

test('atomic backups replace the same-day file only after a valid backup is ready', () => {
  const dir = tempDir();
  const source = path.join(dir, 'source.db');
  const target = path.join(dir, 'backup.db');
  const db = createDb(source, 'first');

  createAtomicBackup(db, target);
  assert.equal(readMarker(target), 'first');

  db.prepare("UPDATE config SET value = 'second' WHERE key = 'marker'").run();
  createAtomicBackup(db, target);
  assert.equal(readMarker(target), 'second');

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a failed backup does not destroy the previous valid backup', () => {
  const dir = tempDir();
  const source = path.join(dir, 'source.db');
  const target = path.join(dir, 'backup.db');
  const db = createDb(source, 'preserved');
  createAtomicBackup(db, target);
  db.close();

  assert.throws(() => createAtomicBackup(db, target));
  assert.equal(readMarker(target), 'preserved');
  assert.equal(validateDatabaseFile(target).ok, true);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('recovery skips empty or corrupt recent backups and restores the newest valid one', () => {
  const dir = tempDir();
  const backups = path.join(dir, 'backups');
  const destination = path.join(dir, 'streamvault.db');
  fs.mkdirSync(backups);

  const older = path.join(backups, 'streamvault-2026-07-22.db');
  createDb(older, 'valid').close();
  fs.writeFileSync(path.join(backups, 'streamvault-2026-07-23.db'), 'not sqlite');
  fs.writeFileSync(path.join(backups, 'streamvault-2026-07-24.db'), '');

  assert.equal(path.basename(findLatestValidBackup(backups)!), path.basename(older));
  assert.equal(restoreLatestValidBackup(destination, backups), older);
  assert.equal(readMarker(destination), 'valid');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('validation rejects an empty SQLite file with no StreamVault schema', () => {
  const dir = tempDir();
  const empty = path.join(dir, 'empty.db');
  new Database(empty).close();

  const result = validateDatabaseFile(empty);
  assert.equal(result.ok, false);
  assert.match(result.error || '', /(empty|missing required table)/i);

  fs.rmSync(dir, { recursive: true, force: true });
});
