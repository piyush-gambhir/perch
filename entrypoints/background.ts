/**
 * Service worker — keeps the toolbar badge showing the open-tab count, color-coded
 * by workload. Green ≤10, amber ≤20, red 21+. No server; queries chrome.tabs.
 */

import { browser } from 'wxt/browser';
import { countRealTabs } from '../utils/tabs';

async function updateBadge(): Promise<void> {
  try {
    const count = await countRealTabs();

    await browser.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    if (count === 0) return;

    let color: string;
    if (count <= 10)
      color = '#3d7a4a'; // green — in control
    else if (count <= 20)
      color = '#b8892e'; // amber — piling up
    else color = '#b35a5a'; // red — time to cull

    await browser.action.setBadgeBackgroundColor({ color });
  } catch {
    browser.action.setBadgeText({ text: '' });
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(updateBadge);
  browser.runtime.onStartup.addListener(updateBadge);
  browser.tabs.onCreated.addListener(updateBadge);
  browser.tabs.onRemoved.addListener(updateBadge);
  browser.tabs.onUpdated.addListener(updateBadge);
  updateBadge();
});
