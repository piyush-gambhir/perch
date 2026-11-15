




import { CUSTOM_GROUPS, LANDING_PAGE_PATTERNS } from './config';
import type {
  CustomGroupRule,
  DomainGroup,
  LandingPagePattern,
  NativeGroup,
  TabInfo,
} from './types';
import { LANDING_PAGES_KEY } from './types';

export const TAB_GROUP_PREFIX = 'tabgroup:';


export function isLandingPage(url: string, patterns: LandingPagePattern[] = LANDING_PAGE_PATTERNS) {
  try {
    const parsed = new URL(url);
    return patterns.some((p) => {
      const hostnameMatch = p.hostname
        ? parsed.hostname === p.hostname
        : p.hostnameEndsWith
          ? parsed.hostname.endsWith(p.hostnameEndsWith)
          : false;
      if (!hostnameMatch) return false;
      if (p.test) return p.test(parsed.pathname, url);
      if (p.pathPrefix) return parsed.pathname.startsWith(p.pathPrefix);
      if (p.pathExact) return p.pathExact.includes(parsed.pathname);
      return parsed.pathname === '/';
    });
  } catch {
    return false;
  }
}


export function matchCustomGroup(
  url: string,
  rules: CustomGroupRule[] = CUSTOM_GROUPS,
): CustomGroupRule | null {
  try {
    const parsed = new URL(url);
    return (
      rules.find((r) => {
        const hostMatch = r.hostname
          ? parsed.hostname === r.hostname
          : r.hostnameEndsWith
            ? parsed.hostname.endsWith(r.hostnameEndsWith)
            : false;
        if (!hostMatch) return false;
        if (r.pathPrefix) return parsed.pathname.startsWith(r.pathPrefix);
        return true;
      }) || null
    );
  } catch {
    return null;
  }
}





export function groupTabs(
  tabs: TabInfo[],
  opts: {
    patterns?: LandingPagePattern[];
    customGroups?: CustomGroupRule[];
    nativeGroups?: NativeGroup[];
  } = {},
): DomainGroup[] {
  const patterns = opts.patterns ?? LANDING_PAGE_PATTERNS;
  const customGroups = opts.customGroups ?? CUSTOM_GROUPS;
  const nativeById = new Map((opts.nativeGroups ?? []).map((g) => [g.id, g]));

  const groupMap: Record<string, DomainGroup> = {};
  const landingTabs: TabInfo[] = [];

  for (const tab of tabs) {
    try {

      if (tab.groupId !== undefined && tab.groupId >= 0 && nativeById.has(tab.groupId)) {
        const g = nativeById.get(tab.groupId)!;
        const key = `${TAB_GROUP_PREFIX}${g.id}`;
        if (!groupMap[key])
          groupMap[key] = {
            domain: key,
            label: g.title || 'Tab group',
            color: g.color,
            groupId: g.id,
            tabs: [],
          };
        groupMap[key].tabs.push(tab);
        continue;
      }

      if (isLandingPage(tab.url, patterns)) {
        landingTabs.push(tab);
        continue;
      }

      const customRule = matchCustomGroup(tab.url, customGroups);
      if (customRule) {
        const key = customRule.groupKey;
        if (!groupMap[key]) groupMap[key] = { domain: key, label: customRule.groupLabel, tabs: [] };
        groupMap[key].tabs.push(tab);
        continue;
      }

      let key: string;
      if (tab.url && tab.url.startsWith('file://')) {
        key = 'local-files';
      } else {
        const parsed = new URL(tab.url);

        key =
          parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
            ? parsed.host
            : parsed.hostname;
      }
      if (!key) continue;

      const group = (groupMap[key] ??= { domain: key, tabs: [] });
      group.tabs.push(tab);
    } catch {

    }
  }

  if (landingTabs.length > 0) {
    groupMap[LANDING_PAGES_KEY] = { domain: LANDING_PAGES_KEY, tabs: landingTabs };
  }

  const landingHostnames = new Set(patterns.map((p) => p.hostname).filter(Boolean) as string[]);
  const landingSuffixes = patterns.map((p) => p.hostnameEndsWith).filter(Boolean) as string[];

  function isLandingDomain(domain: string): boolean {
    if (landingHostnames.has(domain)) return true;
    return landingSuffixes.some((s) => domain.endsWith(s));
  }

  const isNative = (d: string) => d.startsWith(TAB_GROUP_PREFIX);

  return Object.values(groupMap).sort((a, b) => {

    const aNative = isNative(a.domain);
    const bNative = isNative(b.domain);
    if (aNative !== bNative) return aNative ? -1 : 1;

    const aIsLanding = a.domain === LANDING_PAGES_KEY;
    const bIsLanding = b.domain === LANDING_PAGES_KEY;
    if (aIsLanding !== bIsLanding) return aIsLanding ? -1 : 1;

    const aIsPriority = isLandingDomain(a.domain);
    const bIsPriority = isLandingDomain(b.domain);
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

    return b.tabs.length - a.tabs.length;
  });
}


export function groupId(domain: string): string {
  return 'domain-' + domain.replace(/[^a-z0-9]/g, '-');
}


export function duplicateInfo(tabs: TabInfo[]) {
  const urlCounts: Record<string, number> = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);
  return {
    urlCounts,
    dupeUrls: dupeUrls.map(([u]) => u),
    hasDupes: dupeUrls.length > 0,
    totalExtras,
  };
}


export function uniqueByUrl(tabs: TabInfo[]): TabInfo[] {
  const seen = new Set<string>();
  const out: TabInfo[] = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) {
      seen.add(tab.url);
      out.push(tab);
    }
  }
  return out;
}
