import { describe, expect, it } from 'vitest';
import {
  duplicateInfo,
  groupTabs,
  isLandingPage,
  matchCustomGroup,
  uniqueByUrl,
} from '../../utils/grouping';
import type { TabInfo } from '../../utils/types';
import { LANDING_PAGES_KEY } from '../../utils/types';

function tab(url: string, title = '', extra: Partial<TabInfo> = {}): TabInfo {
  return { url, title, active: false, isPerchTab: false, ...extra };
}

describe('isLandingPage', () => {
  it('flags configured homepages', () => {
    expect(isLandingPage('https://github.com/')).toBe(true);
    expect(isLandingPage('https://x.com/home')).toBe(true);
    expect(isLandingPage('https://www.youtube.com/')).toBe(true);
  });

  it('does not flag deep links', () => {
    expect(isLandingPage('https://github.com/zara/tab-out')).toBe(false);
    expect(isLandingPage('https://x.com/zara/status/1')).toBe(false);
  });

  it('uses the gmail test for inbox vs threads', () => {
    expect(isLandingPage('https://mail.google.com/mail/u/0/')).toBe(true);
    expect(isLandingPage('https://mail.google.com/mail/u/0/#inbox/thread123')).toBe(false);
  });

  it('detects x.com homepage at both / and /home (and www/twitter)', () => {
    expect(isLandingPage('https://x.com/')).toBe(true);
    expect(isLandingPage('https://x.com/home')).toBe(true);
    expect(isLandingPage('https://www.x.com/')).toBe(true);
    expect(isLandingPage('https://twitter.com/home')).toBe(true);
  });
});

describe('groupTabs', () => {
  it('buckets by hostname and sorts by tab count', () => {
    const groups = groupTabs([
      tab('https://github.com/a/b'),
      tab('https://github.com/c/d'),
      tab('https://example.com/x'),
    ]);
    expect(groups[0].domain).toBe('github.com');
    expect(groups[0].tabs).toHaveLength(2);
    expect(groups[1].domain).toBe('example.com');
  });

  it('pulls homepages into the landing group, sorted first', () => {
    const groups = groupTabs([
      tab('https://example.com/x'),
      tab('https://example.com/y'),
      tab('https://github.com/'),
    ]);
    expect(groups[0].domain).toBe(LANDING_PAGES_KEY);
    expect(groups[0].tabs).toHaveLength(1);
  });

  it('buckets file:// urls under local-files', () => {
    const groups = groupTabs([tab('file:///Users/me/notes.md')]);
    expect(groups[0].domain).toBe('local-files');
  });

  it('groups native tab-group tabs first, by group title', () => {
    const groups = groupTabs(
      [
        tab('https://a.com/x', '', { groupId: 5 }),
        tab('https://b.com/y', '', { groupId: 5 }),
        tab('https://c.com/z'),
      ],
      { nativeGroups: [{ id: 5, title: 'Work', color: 'blue' }] },
    );
    expect(groups[0].domain).toBe('tabgroup:5');
    expect(groups[0].label).toBe('Work');
    expect(groups[0].color).toBe('blue');
    expect(groups[0].tabs).toHaveLength(2);
  });

  it('ignores groupId with no matching native group', () => {
    const groups = groupTabs([tab('https://a.com/x', '', { groupId: 9 })], { nativeGroups: [] });
    expect(groups[0].domain).toBe('a.com');
  });

  it('splits localhost dev servers by port', () => {
    const groups = groupTabs([
      tab('http://localhost:3000/'),
      tab('http://localhost:3000/about'),
      tab('http://localhost:5173/'),
    ]);
    const keys = groups.map((g) => g.domain).sort();
    expect(keys).toEqual(['localhost:3000', 'localhost:5173']);
  });

  it('applies custom group rules', () => {
    const groups = groupTabs([tab('https://app.acme.com/x'), tab('https://docs.acme.com/y')], {
      customGroups: [{ hostnameEndsWith: '.acme.com', groupKey: 'acme', groupLabel: 'Acme' }],
    });
    const acme = groups.find((g) => g.domain === 'acme');
    expect(acme?.label).toBe('Acme');
    expect(acme?.tabs).toHaveLength(2);
  });
});

describe('matchCustomGroup', () => {
  it('matches by suffix and path prefix', () => {
    const rules = [
      { hostnameEndsWith: '.acme.com', pathPrefix: '/docs', groupKey: 'd', groupLabel: 'Docs' },
    ];
    expect(matchCustomGroup('https://x.acme.com/docs/intro', rules)?.groupKey).toBe('d');
    expect(matchCustomGroup('https://x.acme.com/app', rules)).toBeNull();
  });
});

describe('duplicateInfo / uniqueByUrl', () => {
  it('counts duplicates', () => {
    const info = duplicateInfo([tab('https://a.com'), tab('https://a.com'), tab('https://b.com')]);
    expect(info.hasDupes).toBe(true);
    expect(info.totalExtras).toBe(1);
    expect(info.dupeUrls).toEqual(['https://a.com']);
  });

  it('dedupes preserving order', () => {
    const out = uniqueByUrl([tab('https://a.com'), tab('https://a.com'), tab('https://b.com')]);
    expect(out.map((t) => t.url)).toEqual(['https://a.com', 'https://b.com']);
  });
});
