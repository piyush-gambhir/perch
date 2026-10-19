# Perch

**A calm home for your tabs.** A new-tab dashboard that groups your open tabs by
domain and makes closing them safe. No server, no account, no analytics.

Built with [WXT](https://wxt.dev) + React + TypeScript: typed logic, unit tests,
HMR, and cross-browser builds.

## Features

**Power tools** (what makes Perch a manager, not just a viewer)

- **Stash & restore** — save a group, or all open tabs, as a named session and close them for real; reopen any stash in one click (or in a new window). Closing becomes _safe_.
- **Undo close** — a recently-closed stack reopens what you just closed
- **Drag & drop** — drag a tab onto a stash, the new-stash dropzone, or Saved-for-later; drag stashes to reorder; rename a stash inline
- **⌘K command palette** — fuzzy search across open tabs, saved tabs, and stashes; jump / open / restore by keyboard (`/` also opens it)
- **Search operators** — narrow the palette with `open:`, `saved:`, `stash:`, `workspace:`, or `older:7d`; tags and notes are searchable too
- **Address-bar commands** — type `perch` in the omnibox, then search or run `stash`, `suspend`, or `workspace <name>`
- **Native tab groups** — reflects Chrome's tab groups (color + title); "Group in browser" / "Ungroup" from any card
- **Memory saver** — suspend inactive tabs to free RAM, with an estimated "~X freed"
- **Proactive cleanup** — surfaces tabs untouched for 7+ days to stash or close in bulk
- **Cross-device sync** — settings, stashes, and saved tabs follow you via your browser profile (quota-safe, no login)
- **Recovery timeline** — rolling snapshots every 15 minutes, plus safety snapshots before workspace switches; restore only missing tabs
- **Control center** — health checks for duplicates, stale tabs, tracking URLs, and memory-saving candidates
- **Automation rules** — stash, deduplicate, or suspend matching domains by age, with pinned-tab protection
- **Scheduled routines** — optionally open a routine at a local daily time

**Organize**

- Replaces the new-tab page with a dashboard of every open tab
- Tabs grouped by domain, sorted by tab count (busiest first)
- **Homepages** group pulls landing pages (Gmail inbox, x.com/home, LinkedIn, GitHub, YouTube home) into one card so you can clear them without touching deep links
- `file://` tabs collected under a **Local Files** group
- `localhost` tabs show their **port number** so you can tell dev projects apart
- Custom grouping rules (merge subdomains, or split a site by path) via `utils/config.ts`

**Read at a glance**

- Friendly domain names (`github.com` → GitHub, `mail.google.com` → Gmail, …)
- Cleaned-up titles: strips notification counts `(3)`, inline counts, email addresses, and `· X` suffixes
- Smart titles synthesized from the URL for GitHub repos/PRs/issues, X posts, Reddit threads, YouTube videos
- Per-site favicons from Chrome's own cache (never fetched from the internet); live toolbar **badge** with the open-tab count, color-coded green → amber → red as it grows

**Act**

- Click any tab to **jump to it** — even across other Chrome windows
- Close a single tab, or **close a whole group** at once
- **Duplicate detection** — flags repeated URLs with a `(2x)` badge and a one-click "Close N duplicates" (keeps one)
- **Close all** open tabs for a fresh start
- Cards show the first 8 tabs with an expandable **"+N more"**
- **Self-duplicate banner** — if you have several Perch tabs open, one click closes the extras

**Save for later**

- Bookmark a tab to a checklist before closing it
- Check items off into a collapsible **archive**; **search** the archive; dismiss anything
- Persists in `browser.storage.local` across restarts
- Add searchable tags and notes to saved tabs and stashes

**Feel**

- Soft-modern UI, bundled Inter font, **automatic light/dark** (or a fixed theme in Settings), borderless cards, responsive layout
- Time-of-day greeting, toasts, and an "inbox zero" empty state
- **Live-updating** — the dashboard reflects tab changes in real time
- **No server** and no account: data stays in your browser, and only Chrome Sync (if you use it) carries it between your own devices. See [PRIVACY.md](PRIVACY.md)
- **Portable backups** — export plain JSON or an AES-256-GCM encrypted backup protected by your passphrase

**Under the hood**

- Manifest V3, cross-browser (Chrome + Firefox builds), React 19 + TypeScript
- Pure, unit-tested grouping/formatting logic; typed wrappers over the tabs/storage APIs

## Stack

| What      | How                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework | WXT (Manifest V3), React 19, TypeScript                                                                                                                      |
| Styling   | Token-based design system in `entrypoints/newtab/style.css` — soft-modern, Inter, light + dark via `prefers-color-scheme` (Tailwind v4 available for new UI) |
| Storage   | `browser.storage.local` + `storage.sync`                                                                                                                     |
| Tests     | Vitest (pure logic in `utils/`)                                                                                                                              |

## Develop

```bash
pnpm install
pnpm dev          # launches a dev browser with the extension loaded
pnpm test         # typecheck + unit tests
pnpm build        # production build → .output/chrome-mv3
pnpm build:local  # refresh ~/chrome-extensions/perch; loaded local builds auto-reload
pnpm zip          # packaged zip for the store
pnpm build:firefox / pnpm dev:firefox
```

### Load unpacked (manual)

1. `pnpm build`
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked**
3. Select `.output/chrome-mv3`
4. Open a new tab.

> No standard Chrome on this machine? `pnpm dev` reads `web-ext.config.ts`
> (gitignored) to point at a specific Chrome binary — e.g. a "Chrome for Testing"
> build. Edit the path there for your machine.

## Layout

```
entrypoints/
  background.ts          # service worker — toolbar badge (tab count, color-coded)
  newtab/                # the dashboard (overrides the new-tab page)
    index.html · main.tsx · App.tsx · style.css
components/              # DomainCard, TabChip, SavedForLater, DupeBanner, Toast, icons
hooks/                  # useTabs (live tab events), useDeferred (saved-for-later)
utils/                  # tabs, storage, sessions, grouping, format, snapshots, automation, config, types
__tests__/utils/        # grouping + format unit tests
tools/generate-icons.mjs
public/icon/            # icon.svg (bird-on-a-perch) → generated PNGs
```

## Customize grouping

Edit `utils/config.ts`:

- `FRIENDLY_DOMAINS` — hostname → display name
- `LANDING_PAGE_PATTERNS` — which URLs collapse into the "Homepages" card
- `CUSTOM_GROUPS` — merge subdomains / split a site by path into its own card

All grouping logic in `utils/grouping.ts` is pure and unit-tested.

---

Built by Piyush Gambhir. Original concept by
[Zara](https://x.com/zarazhangrui) ([zarazhangrui/tab-out](https://github.com/zarazhangrui/tab-out)).
