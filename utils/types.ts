/**
 * Shared domain types for Perch.
 */

/** A normalized open browser tab. */
export interface TabInfo {
  id?: number;
  url: string;
  title: string;
  windowId?: number;
  active: boolean;
  /** True if this tab is Perch's own new-tab page. */
  isPerchTab: boolean;
  /** Epoch ms the tab was last active (Chrome's tab.lastAccessed). */
  lastAccessed?: number;
  /** True if the tab has been discarded/suspended to free memory. */
  discarded?: boolean;
  /** Native Chrome tab-group id, or -1 if ungrouped. */
  groupId?: number;
  /** True if the tab is pinned — pinned tabs are protected from bulk close/stash/suspend. */
  pinned?: boolean;
  /** True if the tab is currently playing audio. */
  audible?: boolean;
  /** The favicon the browser already has for this tab, when available. */
  favIconUrl?: string;
}

/** A native Chrome tab group (chrome.tabGroups). */
export interface NativeGroup {
  id: number;
  title: string;
  color: string;
}

/** A lightweight saved reference to a tab (used by sessions + undo). */
export interface StashedTab {
  url: string;
  title: string;
  pinned?: boolean;
  group?: string;
  tags?: string[];
  note?: string;
}

/** A named, restorable set of tabs (a "stash"). */
export interface Session {
  id: string;
  name: string;
  createdAt: string;
  tabs: StashedTab[];
  /** True for sessions created by the auto-stash job (so it can append, not duplicate). */
  auto?: boolean;
  tags?: string[];
  note?: string;
}

/** A record of a recent close, kept so it can be undone. */
export interface ClosedRecord {
  id: string;
  closedAt: string;
  label: string;
  tabs: StashedTab[];
}

/** A reusable, named set of tabs you open on demand (not consumed on open). */
export interface Routine {
  id: string;
  name: string;
  createdAt: string;
  tabs: StashedTab[];
  tags?: string[];
  note?: string;
  /** Optional local time (HH:MM) used by scheduled automation. */
  schedule?: string;
}

/** A named tab context you switch between; holds the tabs captured when you left it. */
export interface Workspace {
  id: string;
  name: string;
  tabs: StashedTab[];
  tags?: string[];
  note?: string;
}

/** A group of tabs shown as one card on the dashboard. */
export interface DomainGroup {
  /** Hostname, a custom group key, 'tabgroup:<id>', or the '__landing-pages__' sentinel. */
  domain: string;
  /** Optional friendly label for custom/native groups. */
  label?: string;
  /** Native tab-group color (dot), when this card represents a Chrome tab group. */
  color?: string;
  /** Native tab-group id, when applicable. */
  groupId?: number;
  tabs: TabInfo[];
}

/** A tab saved to the "Saved for Later" checklist (chrome.storage.local). */
export interface DeferredTab {
  id: string;
  url: string;
  title: string;
  savedAt: string;
  completed: boolean;
  completedAt?: string;
  dismissed: boolean;
  tags?: string[];
  note?: string;
}

export interface Snapshot {
  id: string;
  createdAt: string;
  reason: 'automatic' | 'manual' | 'before-switch';
  windows: { windowId?: number; tabs: StashedTab[] }[];
}

export type AutomationAction = 'stash' | 'close-duplicates' | 'suspend';

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  hostname: string;
  olderThanDays: number;
  action: AutomationAction;
  excludePinned: boolean;
}

/** Active vs. archived split of saved tabs. */
export interface SavedTabs {
  active: DeferredTab[];
  archived: DeferredTab[];
}

/** Rule for pulling "homepage" URLs into the Homepages group. */
export interface LandingPagePattern {
  hostname?: string;
  hostnameEndsWith?: string;
  pathExact?: string[];
  pathPrefix?: string;
  test?: (pathname: string, url: string) => boolean;
}

/** Rule for merging/splitting tabs into a custom group. */
export interface CustomGroupRule {
  hostname?: string;
  hostnameEndsWith?: string;
  pathPrefix?: string;
  groupKey: string;
  groupLabel: string;
}

export const LANDING_PAGES_KEY = '__landing-pages__';
