






import { browser } from 'wxt/browser';
import { saveTabForLater } from '../utils/storage';
import { appendOrCreateSession, closableTabs, saveSession, toStashedTabs } from '../utils/sessions';
import { getSettings } from '../utils/settings';
import { staleTabs } from '../utils/stale';
import {
  closeTabsByIds,
  countRealTabs,
  fetchOpenTabs,
  focusTab,
  isInternalUrl,
  openUrl,
  suspendTabsByIds,
  suspendTabsExcept,
} from '../utils/tabs';
import { captureSnapshot } from '../utils/snapshots';
import { duplicateIdsToClose, getAutomationRules, tabsMatchingRule } from '../utils/automation';
import { getWorkspaces, switchWorkspace } from '../utils/workspaces';
import { getRoutines, openRoutine } from '../utils/routines';

const AUTO_STASH_ALARM = 'perch-auto-stash';
const SNAPSHOT_ALARM = 'perch-snapshot';
const LOCAL_RELOAD_ALARM = 'perch-local-reload';
const CTX_STASH = 'perch-ctx-stash';
const CTX_SAVE = 'perch-ctx-save';

let badgeTimer: ReturnType<typeof setTimeout> | null = null;
let localBuildId: string | null = null;





async function checkLocalBuild(): Promise<void> {
  try {
    const localMarkerUrl = (browser.runtime.getURL as (path: string) => string)(
      '/local-build.json',
    );
    const response = await fetch(localMarkerUrl, {
      cache: 'no-store',
    });
    if (!response.ok) return;
    const marker = (await response.json()) as { builtAt?: string };
    if (!marker.builtAt) return;
    if (!localBuildId) {
      localBuildId = marker.builtAt;
      const alarm = await browser.alarms.get(LOCAL_RELOAD_ALARM);
      if (!alarm) await browser.alarms.create(LOCAL_RELOAD_ALARM, { periodInMinutes: 0.5 });
    } else if (localBuildId !== marker.builtAt) {
      browser.runtime.reload();
    }
  } catch {

  }
}

function enableLocalBuildReload(): void {

  void checkLocalBuild().then(() => {
    if (localBuildId) setInterval(checkLocalBuild, 2_000);
  });
}


type BadgeApi = {
  setBadgeText: (d: { text: string }) => Promise<void>;
  setBadgeBackgroundColor: (d: { color: string }) => Promise<void>;
};
const badgeApi = (): BadgeApi | undefined =>
  (browser as unknown as { action?: BadgeApi; browserAction?: BadgeApi }).action ??
  (browser as unknown as { browserAction?: BadgeApi }).browserAction;

async function updateBadge(): Promise<void> {
  const action = badgeApi();
  if (!action) return;
  try {
    const count = await countRealTabs();
    await action.setBadgeText({ text: count > 0 ? String(count) : '' });
    if (count === 0) return;

    let color: string;
    if (count <= 10) color = '#3d7a4a';
    else if (count <= 20) color = '#b8892e';
    else color = '#b35a5a';

    await action.setBadgeBackgroundColor({ color });
  } catch {
    await action.setBadgeText({ text: '' }).catch(() => {});
  }
}


function scheduleBadge(): void {
  if (badgeTimer) clearTimeout(badgeTimer);
  badgeTimer = setTimeout(updateBadge, 400);
}


async function runAutoStash(): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoStash) return;
  const tabs = await fetchOpenTabs();
  const real = tabs.filter((t) => !t.isPerchTab && !isInternalUrl(t.url));
  const stale = staleTabs(real, Date.now(), settings.staleDays);
  if (stale.length === 0) return;
  const stashed = toStashedTabs(stale);
  const label = `Auto-stash · ${new Date().toLocaleDateString()}`;
  await appendOrCreateSession(label, stashed);
  await closeTabsByIds(stale.map((t) => t.id));
}

async function runAutomationRules(): Promise<void> {
  for (const rule of await getAutomationRules()) {

    const tabs = (await fetchOpenTabs()).filter(
      (tab) => !tab.isPerchTab && !isInternalUrl(tab.url),
    );
    const matches = tabsMatchingRule(rule, tabs);
    if (!matches.length) continue;

    if (rule.action === 'stash') {
      const stashed = toStashedTabs(matches);
      await appendOrCreateSession(`Rule · ${rule.name}`, stashed);
      await closeTabsByIds(matches.map((tab) => tab.id));
    } else if (rule.action === 'close-duplicates') {
      await closeTabsByIds(duplicateIdsToClose(matches, tabs));
    } else if (rule.action === 'suspend') {
      await suspendTabsByIds(matches.map((tab) => tab.id));
    }
  }
}

async function runScheduledRoutines(): Promise<void> {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const state = (await browser.storage.local.get('routineScheduleRuns')) as {
    routineScheduleRuns?: Record<string, string>;
  };
  const runs = state.routineScheduleRuns ?? {};
  for (const routine of await getRoutines()) {
    if (!routine.schedule || runs[routine.id] === today) continue;
    const [hours = NaN, mins = NaN] = routine.schedule.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) continue;
    const target = hours * 60 + mins;
    if (minutes < target || minutes - target >= 20) continue;
    await openRoutine(routine.id);
    runs[routine.id] = today;
  }
  await browser.storage.local.set({ routineScheduleRuns: runs });
}






async function syncAlarmToSettings(): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.autoStash) {
      const existing = await browser.alarms.get(AUTO_STASH_ALARM);
      if (!existing) await browser.alarms.create(AUTO_STASH_ALARM, { periodInMinutes: 60 });
    } else {
      await browser.alarms.clear(AUTO_STASH_ALARM);
    }
    const snapshot = await browser.alarms.get(SNAPSHOT_ALARM);
    if (!snapshot) await browser.alarms.create(SNAPSHOT_ALARM, { periodInMinutes: 15 });
  } catch {

  }
}

function setupContextMenus(): void {
  if (!browser.contextMenus) return;
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({
      id: CTX_STASH,
      title: 'Stash this tab in Perch',
      contexts: ['page'],
    });
    browser.contextMenus.create({
      id: CTX_SAVE,
      title: 'Save this tab for later',
      contexts: ['page'],
    });
  });
}

export default defineBackground(() => {
  enableLocalBuildReload();
  browser.runtime.onInstalled.addListener(() => {
    updateBadge();
    setupContextMenus();
    void syncAlarmToSettings();
  });
  browser.runtime.onStartup.addListener(() => {
    updateBadge();
    void syncAlarmToSettings();
  });

  browser.tabs.onCreated.addListener(scheduleBadge);
  browser.tabs.onRemoved.addListener(scheduleBadge);
  browser.tabs.onUpdated.addListener(scheduleBadge);



  browser.storage.onChanged.addListener((changes, area) => {
    if ((area === 'sync' || area === 'local') && 'settings' in changes) {
      void syncAlarmToSettings();
    }
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTO_STASH_ALARM) {
      runAutoStash().catch(() => {

      });
    }
    if (alarm.name === SNAPSHOT_ALARM) {



      void (async () => {
        await captureSnapshot('automatic').catch(() => {});
        await runAutomationRules().catch(() => {});
        await runScheduledRoutines().catch(() => {});
      })();
    }
    if (alarm.name === LOCAL_RELOAD_ALARM) void checkLocalBuild();
  });

  const omnibox = (
    browser as unknown as {
      omnibox?: {
        setDefaultSuggestion: (suggestion: { description: string }) => void;
        onInputEntered: { addListener: (callback: (text: string) => void) => void };
      };
    }
  ).omnibox;
  omnibox?.setDefaultSuggestion({
    description: 'Search Perch tabs, or use: stash, suspend, workspace &lt;name&gt;',
  });
  omnibox?.onInputEntered.addListener((raw) => {
    void (async () => {
      const query = raw.trim();
      const lower = query.toLowerCase();
      if (lower === 'stash') {


        const tabs = closableTabs(await fetchOpenTabs());
        await saveSession('Omnibox stash', toStashedTabs(tabs));
        await closeTabsByIds(tabs.map((tab) => tab.id));
      } else if (lower === 'suspend') {
        await suspendTabsExcept([]);
      } else if (lower.startsWith('workspace ')) {
        const name = lower.slice(10).trim();
        const workspace = (await getWorkspaces()).find((item) =>
          item.name.toLowerCase().includes(name),
        );
        if (workspace) await switchWorkspace(workspace.id);
      } else {
        const tabs = await fetchOpenTabs();
        const match = tabs.find((tab) => `${tab.title} ${tab.url}`.toLowerCase().includes(lower));
        if (match) await focusTab(match.url);
        else if (/^https?:\/\//i.test(query)) await openUrl(query);
        else await openUrl(browser.runtime.getURL(`/newtab.html?q=${encodeURIComponent(query)}`));
      }
    })();
  });

  browser.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (!tab?.url || !tab.title || isInternalUrl(tab.url) || tab.incognito) return;
    const t = { url: tab.url, title: tab.title };
    if (info.menuItemId === CTX_SAVE) {
      await saveTabForLater(t);
    } else if (info.menuItemId === CTX_STASH) {
      await saveSession(tab.title, [t]);
      if (tab.id !== undefined) await browser.tabs.remove(tab.id);
    }
  });

  updateBadge();
});
