/**
 * Pure helpers for turning raw hostnames and tab titles into clean, human-friendly
 * display strings. No DOM or browser APIs — fully unit-testable.
 */

import { FRIENDLY_DOMAINS } from './config';

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Map a hostname to a friendly name (e.g. "github.com" → "GitHub"). */
export function friendlyDomain(hostname: string): string {
  if (!hostname) return '';
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname];

  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return capitalize(hostname.replace('.substack.com', '')) + "'s Substack";
  }
  if (hostname.endsWith('.github.io')) {
    return capitalize(hostname.replace('.github.io', '')) + ' (GitHub Pages)';
  }

  const clean = hostname
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|co\.uk|co\.jp)$/, '');

  return clean
    .split('.')
    .map((part) => capitalize(part))
    .join(' ');
}

/** Strip notification counts, email addresses, and "· X" suffix noise from a title. */
export function stripTitleNoise(title: string): string {
  if (!title) return '';
  // Leading notification count: "(2) Title"
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  // Inline counts like "Inbox (16,359)"
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  // Email addresses (privacy + cleaner display)
  title = title.replace(/\s*[-‐-―]\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
  // X/Twitter formatting
  title = title.replace(/\s+on X:\s*/, ': ');
  title = title.replace(/\s*\/\s*X\s*$/, '');
  return title.trim();
}

/** Drop a trailing site-name suffix ("Some Article - GitHub" → "Some Article"). */
export function cleanTitle(title: string, hostname: string): string {
  if (!title || !hostname) return title || '';

  const friendly = friendlyDomain(hostname);
  const domain = hostname.replace(/^www\./, '');
  const seps = [' - ', ' | ', ' — ', ' · ', ' – '];

  for (const sep of seps) {
    const idx = title.lastIndexOf(sep);
    if (idx === -1) continue;
    const suffix = title.slice(idx + sep.length).trim();
    const suffixLow = suffix.toLowerCase();
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return title;
}

/** Synthesize a readable title from the URL when the tab title is a bare URL. */
export function smartTitle(title: string, url: string): string {
  if (!url) return title || '';
  let pathname = '';
  let hostname = '';
  try {
    const u = new URL(url);
    pathname = u.pathname;
    hostname = u.hostname;
  } catch {
    return title || '';
  }

  const titleIsUrl =
    !title || title === url || title.startsWith(hostname) || title.startsWith('http');

  if (
    (hostname === 'x.com' || hostname === 'twitter.com' || hostname === 'www.x.com') &&
    pathname.includes('/status/')
  ) {
    const username = pathname.split('/')[1];
    if (username) return titleIsUrl ? `Post by @${username}` : title;
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts;
      if (rest[0] === 'issues' && rest[1]) return `${owner}/${repo} Issue #${rest[1]}`;
      if (rest[0] === 'pull' && rest[1]) return `${owner}/${repo} PR #${rest[1]}`;
      if (rest[0] === 'blob' || rest[0] === 'tree')
        return `${owner}/${repo} — ${rest.slice(2).join('/')}`;
      if (titleIsUrl) return `${owner}/${repo}`;
    }
  }

  if ((hostname === 'www.youtube.com' || hostname === 'youtube.com') && pathname === '/watch') {
    if (titleIsUrl) return 'YouTube Video';
  }

  if (
    (hostname === 'www.reddit.com' || hostname === 'reddit.com' || hostname === 'old.reddit.com') &&
    pathname.includes('/comments/')
  ) {
    const parts = pathname.split('/').filter(Boolean);
    const subIdx = parts.indexOf('r');
    if (subIdx !== -1 && parts[subIdx + 1]) {
      if (titleIsUrl) return `r/${parts[subIdx + 1]} post`;
    }
  }

  return title || url;
}

/** Convenience: full title pipeline for a tab. */
export function displayTitle(title: string, url: string, hostname = ''): string {
  return cleanTitle(smartTitle(stripTitleNoise(title || ''), url), hostname);
}

/** ISO date string → human-friendly relative time ("2 hrs ago"). */
export function timeAgo(dateStr: string, now: Date = new Date()): string {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const diffMins = Math.floor((now.getTime() - then.getTime()) / 60000);
  const diffHours = Math.floor((now.getTime() - then.getTime()) / 3600000);
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + ' min ago';
  if (diffHours < 24) return diffHours + ' hr' + (diffHours !== 1 ? 's' : '') + ' ago';
  if (diffDays === 1) return 'yesterday';
  return diffDays + ' days ago';
}

export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getDateDisplay(now: Date = new Date()): string {
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Google's favicon service URL for a hostname. */
export function faviconUrl(hostname: string): string {
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
}
