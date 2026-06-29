/**
 * Service worker:
 *  - keeps the toolbar badge showing the open-tab count, color-coded by workload;
 *  - runs the hourly auto-stash alarm (when enabled in Settings);
 *  - provides the right-click context menu ("Stash in Perch" / "Save for later").
 */

import { browser } from 'wxt/browser';
import { saveTabForLater } from '../utils/storage';
import { appendOrCreateSession, saveSession, toStashedTabs } from '../utils/sessions';
import { getSettings } from '../utils/settings';
import { staleTabs } from '../utils/stale';
import { closeTabsByIds, countRealTabs, fetchOpenTabs, isInternalUrl } from '../utils/tabs';

const AUTO_STASH_ALARM = 'perch-auto-stash';
const CTX_STASH = 'perch-ctx-stash';
const CTX_SAVE = 'perch-ctx-save';

let badgeTimer: ReturnType<typeof setTimeout> | null = null;

async function updateBadge(): Promise<void> {
  try {
    const count = await countRealTabs();
    await browser.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    if (count === 0) return;

    let color: string;
    if (count <= 10) color = '#3d7a4a';
    else if (count <= 20) color = '#b8892e';
    else color = '#b35a5a';

    await browser.action.setBadgeBackgroundColor({ color });
  } catch {
    await browser.action.setBadgeText({ text: '' }).catch(() => {});
  }
}

/** Coalesce bursts of tab events into one badge refresh. */
function scheduleBadge(): void {
  if (badgeTimer) clearTimeout(badgeTimer);
  badgeTimer = setTimeout(updateBadge, 400);
}

/** When enabled, stash stale tabs into today's auto-stash session and close them. */
async function runAutoStash(): Promise<void> {
  const settings = await getSettings();
  if (!settings.autoStash) return;
  const tabs = await fetchOpenTabs();
  const real = tabs.filter((t) => !t.isPerchTab && !isInternalUrl(t.url));
  const stale = staleTabs(real, Date.now(), settings.staleDays); // excludes active + suspended
  if (stale.length === 0) return;
  const stashed = toStashedTabs(stale);
  const label = `Auto-stash · ${new Date().toLocaleDateString()}`;
  await appendOrCreateSession(label, stashed); // reuse today's session instead of spawning one/hour
  await closeTabsByIds(stale.map((t) => t.id));
}

/** Create the alarm only if it doesn't already exist, so we don't reset its schedule. */
async function ensureAlarm(): Promise<void> {
  try {
    const existing = await browser.alarms.get(AUTO_STASH_ALARM);
    if (!existing) await browser.alarms.create(AUTO_STASH_ALARM, { periodInMinutes: 60 });
  } catch {
    /* alarms unavailable */
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
  browser.runtime.onInstalled.addListener(() => {
    updateBadge();
    setupContextMenus();
    ensureAlarm();
  });
  browser.runtime.onStartup.addListener(() => {
    updateBadge();
    ensureAlarm();
  });

  browser.tabs.onCreated.addListener(scheduleBadge);
  browser.tabs.onRemoved.addListener(scheduleBadge);
  browser.tabs.onUpdated.addListener(scheduleBadge);

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === AUTO_STASH_ALARM) runAutoStash();
  });

  browser.contextMenus?.onClicked.addListener(async (info, tab) => {
    if (!tab?.url || !tab.title) return;
    const t = { url: tab.url, title: tab.title };
    if (info.menuItemId === CTX_SAVE) {
      await saveTabForLater(t);
    } else if (info.menuItemId === CTX_STASH) {
      await saveSession(tab.title, [t]);
      if (tab.id !== undefined) await browser.tabs.remove(tab.id);
    }
  });

  setupContextMenus();
  updateBadge();
});
