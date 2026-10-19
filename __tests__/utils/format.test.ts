import { describe, expect, it } from 'vitest';
import {
  cleanTitle,
  faviconSrc,
  friendlyDomain,
  smartTitle,
  stripTitleNoise,
  timeAgo,
} from '../../utils/format';

describe('friendlyDomain', () => {
  it('maps known hosts', () => {
    expect(friendlyDomain('github.com')).toBe('GitHub');
    expect(friendlyDomain('mail.google.com')).toBe('Gmail');
    expect(friendlyDomain('www.x.com')).toBe('X');
  });

  it('handles substack subdomains', () => {
    expect(friendlyDomain('stratechery.substack.com')).toBe("Stratechery's Substack");
  });

  it('handles github pages', () => {
    expect(friendlyDomain('zarazhangrui.github.io')).toBe('Zarazhangrui (GitHub Pages)');
  });

  it('falls back to a capitalized cleaned host', () => {
    expect(friendlyDomain('www.example.com')).toBe('Example');
  });
});

describe('stripTitleNoise', () => {
  it('removes leading notification counts', () => {
    expect(stripTitleNoise('(3) Inbox')).toBe('Inbox');
  });

  it('removes inline counts', () => {
    expect(stripTitleNoise('Inbox (16,359)')).toBe('Inbox');
  });

  it('strips trailing / X', () => {
    expect(stripTitleNoise('Some great post / X')).toBe('Some great post');
  });
});

describe('cleanTitle', () => {
  it('drops a trailing site-name suffix', () => {
    expect(cleanTitle('Cool Article - GitHub', 'github.com')).toBe('Cool Article');
  });

  it('keeps title when suffix is unrelated', () => {
    expect(cleanTitle('Cool Article - Acme', 'github.com')).toBe('Cool Article - Acme');
  });
});

describe('smartTitle', () => {
  it('synthesizes github repo from bare url', () => {
    expect(smartTitle('https://github.com/zara/tab-out', 'https://github.com/zara/tab-out')).toBe(
      'zara/tab-out',
    );
  });

  it('synthesizes github PR title', () => {
    expect(
      smartTitle(
        'https://github.com/zara/tab-out/pull/7',
        'https://github.com/zara/tab-out/pull/7',
      ),
    ).toBe('zara/tab-out PR #7');
  });

  it('synthesizes X post', () => {
    expect(smartTitle('https://x.com/zara/status/123', 'https://x.com/zara/status/123')).toBe(
      'Post by @zara',
    );
  });

  it('keeps a real title untouched', () => {
    expect(smartTitle('My Repo', 'https://github.com/zara/tab-out')).toBe('My Repo');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-06-29T12:00:00Z');
  it('formats minutes/hours/days', () => {
    expect(timeAgo(new Date('2026-06-29T11:59:40Z').toISOString(), now)).toBe('just now');
    expect(timeAgo(new Date('2026-06-29T11:30:00Z').toISOString(), now)).toBe('30 min ago');
    expect(timeAgo(new Date('2026-06-29T09:00:00Z').toISOString(), now)).toBe('3 hrs ago');
    expect(timeAgo(new Date('2026-06-28T12:00:00Z').toISOString(), now)).toBe('yesterday');
    expect(timeAgo(new Date('2026-06-26T12:00:00Z').toISOString(), now)).toBe('3 days ago');
  });
});

describe('faviconSrc', () => {
  const extensionUrl = (path: string) => `chrome-extension://perch${path}`;
  const chrome = { firefox: false, extensionUrl };
  const firefox = { firefox: true, extensionUrl };
  const page = 'https://example.com/a?b=1#c';

  it("uses Chrome's local _favicon cache for the page", () => {
    expect(faviconSrc(page, 'https://example.com/favicon.ico', chrome)).toBe(
      `chrome-extension://perch/_favicon/?pageUrl=${encodeURIComponent(page)}&size=32`,
    );
  });

  it('on Firefox uses only an inline data: favicon, never a remote one', () => {
    expect(faviconSrc(page, 'data:image/png;base64,AAAA', firefox)).toBe(
      'data:image/png;base64,AAAA',
    );
    expect(faviconSrc(page, 'https://example.com/favicon.ico', firefox)).toBe('');
    expect(faviconSrc(page, undefined, firefox)).toBe('');
  });

  it('never points at a third-party favicon service', () => {
    for (const target of [chrome, firefox]) {
      for (const icon of [undefined, 'http://tracker.test/i.png?u=1']) {
        const src = faviconSrc(page, icon, target);
        expect(src === '' || src.startsWith('chrome-extension://') || src.startsWith('data:')).toBe(
          true,
        );
      }
    }
  });
});
