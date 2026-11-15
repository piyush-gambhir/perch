




export interface TabInfo {
  id?: number;
  url: string;
  title: string;
  windowId?: number;
  active: boolean;

  isPerchTab: boolean;

  lastAccessed?: number;

  discarded?: boolean;

  groupId?: number;

  pinned?: boolean;

  audible?: boolean;

  favIconUrl?: string;
}


export interface NativeGroup {
  id: number;
  title: string;
  color: string;
}


export interface StashedTab {
  url: string;
  title: string;
  pinned?: boolean;
  group?: string;
  tags?: string[];
  note?: string;
}


export interface Session {
  id: string;
  name: string;
  createdAt: string;
  tabs: StashedTab[];

  auto?: boolean;
  tags?: string[];
  note?: string;
}


export interface ClosedRecord {
  id: string;
  closedAt: string;
  label: string;
  tabs: StashedTab[];
}


export interface Routine {
  id: string;
  name: string;
  createdAt: string;
  tabs: StashedTab[];
  tags?: string[];
  note?: string;

  schedule?: string;
}


export interface Workspace {
  id: string;
  name: string;
  tabs: StashedTab[];
  tags?: string[];
  note?: string;
}


export interface DomainGroup {

  domain: string;

  label?: string;

  color?: string;

  groupId?: number;
  tabs: TabInfo[];
}


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


export interface SavedTabs {
  active: DeferredTab[];
  archived: DeferredTab[];
}


export interface LandingPagePattern {
  hostname?: string;
  hostnameEndsWith?: string;
  pathExact?: string[];
  pathPrefix?: string;
  test?: (pathname: string, url: string) => boolean;
}


export interface CustomGroupRule {
  hostname?: string;
  hostnameEndsWith?: string;
  pathPrefix?: string;
  groupKey: string;
  groupLabel: string;
}

export const LANDING_PAGES_KEY = '__landing-pages__';
