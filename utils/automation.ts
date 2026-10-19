import { uid } from './id';
import { loadSynced, mutateSynced, onSyncedChanged } from './syncedStore';
import type { AutomationRule, TabInfo } from './types';

const KEY = 'automationRules';

export async function getAutomationRules(): Promise<AutomationRule[]> {
  return loadSynced<AutomationRule>(KEY);
}

export async function addAutomationRule(rule: Omit<AutomationRule, 'id'>): Promise<AutomationRule> {
  const created = { ...rule, id: uid() };
  await mutateSynced<AutomationRule>(KEY, (rules) => [...rules, created]);
  return created;
}

export async function updateAutomationRule(
  id: string,
  patch: Partial<AutomationRule>,
): Promise<void> {
  await mutateSynced<AutomationRule>(KEY, (rules) =>
    rules.map((rule) => (rule.id === id ? { ...rule, ...patch, id } : rule)),
  );
}

export async function deleteAutomationRule(id: string): Promise<void> {
  await mutateSynced<AutomationRule>(KEY, (rules) => rules.filter((rule) => rule.id !== id));
}

export function tabsMatchingRule(
  rule: AutomationRule,
  tabs: TabInfo[],
  now = Date.now(),
): TabInfo[] {
  if (!rule.enabled) return [];
  const hostNeedle = rule.hostname.trim().toLowerCase();
  return tabs.filter((tab) => {
    if (rule.excludePinned && tab.pinned) return false;
    if (hostNeedle) {
      try {
        const host = new URL(tab.url).hostname.toLowerCase();
        if (host !== hostNeedle && !host.endsWith(`.${hostNeedle}`)) return false;
      } catch {
        return false;
      }
    }
    return (
      rule.olderThanDays <= 0 ||
      (!!tab.lastAccessed && now - tab.lastAccessed >= rule.olderThanDays * 86_400_000)
    );
  });
}

export function onAutomationRulesChanged(callback: () => void): () => void {
  return onSyncedChanged(KEY, callback);
}
