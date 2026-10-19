/**
 * Local export / import — a no-account escape hatch. Bundles all Perch data into a
 * JSON file the user can save and restore (or move between browsers). Nothing leaves
 * the device unless the user shares the file.
 */

import { getSettings, saveSettings, type Settings } from './settings';
import { loadSynced, mutateSynced } from './syncedStore';
import type { AutomationRule, DeferredTab, Routine, Session, StashedTab, Workspace } from './types';

const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
type Raw = Record<string, unknown>;

// Only schemes a restore can actually reopen; keeps javascript:/data:/chrome:// out
// of stashes where a later tabs.create would choke on (or execute) them.
const SAFE_SCHEMES = ['http:', 'https:', 'file:'];
function isRestorableUrl(url: string): boolean {
  try {
    return SAFE_SCHEMES.includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** Optional tags/note metadata, kept only when well-formed. */
function validMeta(x: Raw): { tags?: string[]; note?: string } {
  return {
    ...(Array.isArray(x.tags) ? { tags: x.tags.filter(isStr) } : {}),
    ...(isStr(x.note) ? { note: x.note } : {}),
  };
}

function validTabs(v: unknown): StashedTab[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (t): t is Raw & { url: string } =>
        !!t &&
        typeof t === 'object' &&
        isStr((t as Raw).url) &&
        isRestorableUrl((t as Raw).url as string),
    )
    .map((t) => ({
      url: t.url,
      title: isStr(t.title) ? t.title : t.url,
      ...(isBool(t.pinned) ? { pinned: t.pinned } : {}),
      ...(isStr(t.group) ? { group: t.group } : {}),
      ...validMeta(t),
    }));
}

/**
 * Valid named tab sets (stashes, routines, workspaces), reduced to the fields they
 * share. Each caller adds its own type-specific fields from `raw`, so nothing
 * unvalidated is copied into storage.
 */
function validNamedSets(
  v: unknown,
): { base: Pick<Workspace, 'id' | 'name' | 'tabs' | 'tags' | 'note'>; raw: Raw }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Raw => !!x && typeof x === 'object' && isStr(x.id) && isStr(x.name))
    .map((x) => ({
      base: {
        id: x.id as string,
        name: x.name as string,
        tabs: validTabs(x.tabs),
        ...validMeta(x),
      },
      raw: x,
    }));
}

const createdAt = (raw: Raw) => (isStr(raw.createdAt) ? raw.createdAt : new Date().toISOString());

const ACTIONS: AutomationRule['action'][] = ['stash', 'close-duplicates', 'suspend'];

export interface Backup {
  app: 'perch';
  version: 1;
  exportedAt: string;
  sessions: Session[];
  deferred: DeferredTab[];
  routines: Routine[];
  workspaces: Workspace[];
  settings: Settings;
  automationRules: AutomationRule[];
}

export async function exportAll(): Promise<Backup> {
  const [sessions, deferred, routines, workspaces, settings, automationRules] = await Promise.all([
    loadSynced<Session>('sessions'),
    loadSynced<DeferredTab>('deferred'),
    loadSynced<Routine>('routines'),
    loadSynced<Workspace>('workspaces'),
    getSettings(),
    loadSynced<AutomationRule>('automationRules'),
  ]);
  return {
    app: 'perch',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
    deferred,
    routines,
    workspaces,
    settings,
    automationRules,
  };
}

/** Validate + restore a backup. Each element is validated; malformed entries are
 *  dropped. Writes go through the locked store so they can't race other writers. */
export async function importAll(raw: unknown): Promise<string> {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Perch backup file.');
  const data = raw as Partial<Backup>;
  if (data.app !== 'perch') throw new Error('Not a Perch backup file.');

  const counts: string[] = [];

  if (data.sessions !== undefined) {
    const sessions: Session[] = validNamedSets(data.sessions).map(({ base, raw }) => ({
      ...base,
      createdAt: createdAt(raw),
      ...(isBool(raw.auto) ? { auto: raw.auto } : {}),
    }));
    await mutateSynced<Session>('sessions', () => sessions);
    counts.push(`${sessions.length} stashes`);
  }
  if (data.routines !== undefined) {
    const routines: Routine[] = validNamedSets(data.routines).map(({ base, raw }) => ({
      ...base,
      createdAt: createdAt(raw),
      // Same HH:MM shape the Routines schedule prompt accepts.
      ...(isStr(raw.schedule) && /^\d{2}:\d{2}$/.test(raw.schedule)
        ? { schedule: raw.schedule }
        : {}),
    }));
    await mutateSynced<Routine>('routines', () => routines);
    counts.push(`${routines.length} routines`);
  }
  if (data.workspaces !== undefined) {
    const workspaces: Workspace[] = validNamedSets(data.workspaces).map(({ base }) => base);
    await mutateSynced<Workspace>('workspaces', () => workspaces);
    counts.push(`${workspaces.length} workspaces`);
  }
  if (data.deferred !== undefined) {
    const deferred = (Array.isArray(data.deferred) ? data.deferred : [])
      .filter(
        (t): t is DeferredTab =>
          !!t &&
          typeof t === 'object' &&
          isStr((t as DeferredTab).id) &&
          isStr((t as DeferredTab).url) &&
          isRestorableUrl((t as DeferredTab).url),
      )
      .map((t) => ({
        id: t.id,
        url: t.url,
        title: isStr(t.title) ? t.title : t.url,
        savedAt: isStr(t.savedAt) ? t.savedAt : new Date().toISOString(),
        completed: t.completed === true,
        dismissed: t.dismissed === true,
        ...(t.completed === true && isStr(t.completedAt) ? { completedAt: t.completedAt } : {}),
        ...validMeta(t as unknown as Raw),
      }));
    await mutateSynced<DeferredTab>('deferred', () => deferred);
    counts.push(`${deferred.length} saved`);
  }
  if (data.settings && typeof data.settings === 'object') {
    await saveSettings(data.settings as Partial<Settings>);
  }
  if (data.automationRules !== undefined) {
    const rules: AutomationRule[] = (
      Array.isArray(data.automationRules) ? (data.automationRules as unknown[]) : []
    )
      .filter(
        (rule): rule is Raw =>
          !!rule &&
          typeof rule === 'object' &&
          isStr((rule as Raw).id) &&
          isStr((rule as Raw).name) &&
          isStr((rule as Raw).hostname) &&
          ACTIONS.includes((rule as Raw).action as AutomationRule['action']) &&
          Number.isFinite((rule as Raw).olderThanDays) &&
          ((rule as Raw).olderThanDays as number) >= 0,
      )
      .map((rule) => ({
        id: rule.id as string,
        name: rule.name as string,
        enabled: rule.enabled === true,
        hostname: rule.hostname as string,
        olderThanDays: rule.olderThanDays as number,
        action: rule.action as AutomationRule['action'],
        // Missing means protect: a rule must opt in to touching pinned tabs.
        excludePinned: rule.excludePinned !== false,
      }));
    await mutateSynced<AutomationRule>('automationRules', () => rules);
    counts.push(`${rules.length} rules`);
  }
  return counts.length ? `Imported ${counts.join(', ')}` : 'Nothing to import';
}

/** Trigger a download of the current backup as a .json file. */
export async function downloadBackup(): Promise<void> {
  const data = await exportAll();
  downloadJson(
    JSON.stringify(data, null, 2),
    `perch-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

interface EncryptedBackup {
  app: 'perch-encrypted';
  version: 1;
  salt: string;
  iv: string;
  data: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (value: string): Uint8Array =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function encryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 250_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(passphrase: string): Promise<EncryptedBackup> {
  if (passphrase.length < 8) throw new Error('Passphrase must be at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(passphrase, salt),
    encoder.encode(JSON.stringify(await exportAll())),
  );
  return {
    app: 'perch-encrypted',
    version: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackup(raw: unknown, passphrase: string): Promise<Backup> {
  if (!raw || typeof raw !== 'object' || (raw as EncryptedBackup).app !== 'perch-encrypted')
    throw new Error('Not an encrypted Perch backup.');
  const envelope = raw as EncryptedBackup;
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) as BufferSource },
    await encryptionKey(passphrase, fromBase64(envelope.salt)),
    fromBase64(envelope.data) as BufferSource,
  );
  return JSON.parse(decoder.decode(decrypted)) as Backup;
}

export async function downloadEncryptedBackup(passphrase: string): Promise<void> {
  const envelope = await encryptBackup(passphrase);
  downloadJson(
    JSON.stringify(envelope),
    `perch-backup-${new Date().toISOString().slice(0, 10)}.encrypted.json`,
  );
}

function downloadJson(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
