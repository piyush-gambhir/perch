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
  isTabOut: boolean;
  /** Epoch ms the tab was last active (Chrome's tab.lastAccessed). */
  lastAccessed?: number;
  /** True if the tab has been discarded/suspended to free memory. */
  discarded?: boolean;
  /** Native Chrome tab-group id, or -1 if ungrouped. */
  groupId?: number;
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
}

/** A named, restorable set of tabs (a "stash"). */
export interface Session {
  id: string;
  name: string;
  createdAt: string;
  tabs: StashedTab[];
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
