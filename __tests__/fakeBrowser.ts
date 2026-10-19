/**
 * A small in-memory stand-in for the parts of `browser` that Perch's storage and tab
 * code touch. Tests opt in with:
 *
 *   vi.mock('wxt/browser', async () => ({ browser: (await import('../fakeBrowser')).fakeBrowser }));
 *
 * Storage values are JSON round-tripped like chrome.storage does, so `undefined`
 * fields disappear exactly as they would in the browser.
 */

export interface FakeTab {
  id: number;
  url: string;
  title?: string;
  windowId: number;
  pinned?: boolean;
  active?: boolean;
  incognito?: boolean;
  lastAccessed?: number;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function storageArea() {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(keys?: string | string[] | null) {
      const wanted = keys == null ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const key of wanted) if (data.has(key)) out[key] = clone(data.get(key));
      return out;
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) data.set(key, clone(value));
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
    },
  };
}

export const fake = {
  tabs: [] as FakeTab[],
  /** URLs that tabs.create / windows.create reject, like an unopenable restore target. */
  failUrls: new Set<string>(),
  nextTabId: 1,
  nextWindowId: 2,
};

export const fakeBrowser = {
  runtime: { getURL: (path: string) => `chrome-extension://perch${path}` },
  storage: {
    local: storageArea(),
    sync: storageArea(),
    onChanged: { addListener: () => {}, removeListener: () => {} },
  },
  tabs: {
    async query(query: { windowId?: number } = {}) {
      return fake.tabs
        .filter((tab) => query.windowId === undefined || tab.windowId === query.windowId)
        .map((tab) => ({ ...tab }));
    },
    async create(props: { url?: string; pinned?: boolean; windowId?: number }) {
      if (props.url && fake.failUrls.has(props.url)) throw new Error(`cannot open ${props.url}`);
      const tab: FakeTab = {
        id: fake.nextTabId++,
        url: props.url ?? '',
        windowId: props.windowId ?? 1,
        pinned: props.pinned ?? false,
      };
      fake.tabs.push(tab);
      return { ...tab };
    },
    async update(id: number, props: Partial<FakeTab>) {
      const tab = fake.tabs.find((item) => item.id === id);
      if (!tab) throw new Error(`no tab ${id}`);
      Object.assign(tab, props);
      return { ...tab };
    },
    async remove(ids: number | number[]) {
      const gone = new Set(Array.isArray(ids) ? ids : [ids]);
      fake.tabs = fake.tabs.filter((tab) => !gone.has(tab.id));
    },
  },
  windows: {
    async getCurrent() {
      return { id: 1 };
    },
    async create(props: { url?: string } = {}) {
      if (props.url && fake.failUrls.has(props.url)) throw new Error(`cannot open ${props.url}`);
      const id = fake.nextWindowId++;
      if (props.url) fake.tabs.push({ id: fake.nextTabId++, url: props.url, windowId: id });
      return { id };
    },
  },
};

/** Clear all fake state between tests. */
export function resetFakeBrowser(): void {
  fake.tabs = [];
  fake.failUrls.clear();
  fake.nextTabId = 1;
  fake.nextWindowId = 2;
  fakeBrowser.storage.local.data.clear();
  fakeBrowser.storage.sync.data.clear();
}

/** Seed open tabs (window 1 unless given). */
export function openTabs(...tabs: (Partial<FakeTab> & { url: string })[]): FakeTab[] {
  const created = tabs.map((tab) => ({ id: fake.nextTabId++, windowId: 1, ...tab }));
  fake.tabs.push(...created);
  return created;
}
