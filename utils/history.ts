








import { isInternalUrl } from './tabs';
import type { StashedTab } from './types';

const DB_NAME = 'perch';
const STORE = 'history';
const MAX_ENTRIES = 5000;

export interface HistoryEntry {
  url: string;
  title: string;
  ts: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const openPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no indexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'url' });
        store.createIndex('ts', 'ts');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((error) => {
    dbPromise = null;
    throw error;
  });
  dbPromise = openPromise;
  return openPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}


export async function recordHistory(tabs: { url: string; title: string }[]): Promise<void> {
  const entries = tabs.filter((t) => t.url && !isInternalUrl(t.url));
  if (entries.length === 0) return;
  try {
    const db = await openDb();
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      const store = tx(db, 'readwrite');
      for (const t of entries) {
        store.put({ url: t.url, title: t.title || t.url, ts: now } satisfies HistoryEntry);
      }
      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
    void pruneHistory(db);
  } catch {

  }
}


export async function getRecentHistory(limit = 1500): Promise<HistoryEntry[]> {
  try {
    const db = await openDb();
    return await new Promise<HistoryEntry[]>((resolve, reject) => {
      const out: HistoryEntry[] = [];
      const index = tx(db, 'readonly').index('ts');
      const cursorReq = index.openCursor(null, 'prev');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && out.length < limit) {
          out.push(cursor.value as HistoryEntry);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch {
    return [];
  }
}


async function pruneHistory(db: IDBDatabase): Promise<void> {
  try {
    const count = await new Promise<number>((resolve, reject) => {
      const req = tx(db, 'readonly').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (count <= MAX_ENTRIES) return;
    let toDrop = count - MAX_ENTRIES;
    await new Promise<void>((resolve) => {
      const index = tx(db, 'readwrite').index('ts');
      const cursorReq = index.openCursor(null, 'next');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && toDrop > 0) {
          cursor.delete();
          toDrop -= 1;
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    });
  } catch {

  }
}


export function toHistory(tabs: StashedTab[]): { url: string; title: string }[] {
  return tabs.map((t) => ({ url: t.url, title: t.title }));
}
