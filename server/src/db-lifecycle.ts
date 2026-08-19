import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_TABLES = ['channels', 'categories', 'programs', 'config'] as const;

export interface DatabaseValidation {
  ok: boolean;
  error?: string;
}

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function validateOpenDatabase(db: InstanceType<typeof Database>): DatabaseValidation {
  try {
    const result = db.pragma('quick_check') as Array<{ quick_check: string }>;
    if (result.length !== 1 || result[0]?.quick_check !== 'ok') {
      return { ok: false, error: `quick_check returned: ${JSON.stringify(result)}` };
    }

    const rows = db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_TABLES.map(() => '?').join(', ')})`
    ).all(...REQUIRED_TABLES) as Array<{ name: string }>;
    const found = new Set(rows.map(row => row.name));
    const missing = REQUIRED_TABLES.filter(table => !found.has(table));
    if (missing.length > 0) {
      return { ok: false, error: `Missing required table(s): ${missing.join(', ')}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function validateDatabaseFile(file: string): DatabaseValidation {
  if (!fs.existsSync(file)) return { ok: false, error: 'Database file does not exist' };
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0) return { ok: false, error: 'Database file is empty' };

  let db: InstanceType<typeof Database> | null = null;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
    return validateOpenDatabase(db);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    try { db?.close(); } catch { /* ignore close errors during validation */ }
  }
}

export function createAtomicBackup(db: InstanceType<typeof Database>, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    db.exec(`VACUUM INTO ${quoteSqlString(temp)}`);
    const validation = validateDatabaseFile(temp);
    if (!validation.ok) throw new Error(`Backup validation failed: ${validation.error}`);
    fs.renameSync(temp, target);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch { /* temp may not have been created */ }
    throw error;
  }
}

export function findLatestValidBackup(backupDir: string): string | null {
  if (!fs.existsSync(backupDir)) return null;
  const candidates = fs.readdirSync(backupDir)
    .filter(file => /^streamvault-\d{4}-\d{2}-\d{2}\.db$/.test(file))
    .map(file => path.join(backupDir, file))
    .sort((a, b) => path.basename(b).localeCompare(path.basename(a)));

  for (const candidate of candidates) {
    if (validateDatabaseFile(candidate).ok) return candidate;
  }
  return null;
}

export function restoreLatestValidBackup(destination: string, backupDir: string): string | null {
  const source = findLatestValidBackup(backupDir);
  if (!source) return null;

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = `${destination}.restore-${process.pid}-${Date.now()}`;
  try {
    fs.copyFileSync(source, temp);
    const validation = validateDatabaseFile(temp);
    if (!validation.ok) throw new Error(`Restored backup validation failed: ${validation.error}`);
    fs.renameSync(temp, destination);
    return source;
  } catch (error) {
    try { fs.unlinkSync(temp); } catch { /* ignore cleanup errors */ }
    throw error;
  }
}

export function isDatabaseCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  return code === 'SQLITE_CORRUPT' || /database disk image is malformed/i.test(error.message);
}
