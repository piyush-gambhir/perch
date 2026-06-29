# Perch — Chrome Web Store listing

Copy/paste fields for the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).

---

## Name (45 max)

Perch — Tab Dashboard & New Tab

## Summary / short description (132 max)

A calm home for your tabs. Group open tabs by site, stash & restore sessions, search with ⌘K, and free memory — all 100% local.

## Category

Productivity / Workflow & Planning

## Language

English (United States)

---

## Detailed description

**Perch turns your new tab page into a calm command center for everything you have open.**

If you live with 40 tabs and are afraid to close any of them, Perch is for you. It groups your open tabs by site, makes closing safe with stashes and undo, and lets you find any tab instantly.

**Organize**
• Every open tab, grouped by site and sorted busiest-first
• Homepages (Gmail, X, LinkedIn, GitHub, YouTube) collected into one card
• localhost tabs show their port so you can tell dev projects apart

**Stop fearing the close button**
• Stash a group — or all tabs — as a named, restorable session, then close them for real
• One-click restore brings them all back
• Undo reopens whatever you just closed

**Find anything**
• ⌘K command palette: fuzzy-search open tabs, saved items, and stashes
• Jump to any tab — even across windows — by keyboard

**Tidy up**
• Duplicate detection with one-click cleanup
• Suspend inactive tabs to free memory
• A gentle nudge for tabs you haven't touched in a while

**Yours, and private**
• 100% local — no account, no servers, no tracking
• Light & dark themes, density and sound controls
• Settings sync across your devices through your browser profile

No setup. Open a new tab and you're home.

---

## Permission justifications (paste into the dashboard's "Privacy practices" tab)

- **tabs** — Perch reads open tab titles/URLs to display, group, focus, suspend, and close them on the dashboard. Core functionality.
- **storage** — Saves your "Saved for later" items, stashes, routines, and settings (locally, and synced across your own devices via the browser profile).
- **tabGroups** — Reflects Chrome's native tab groups on the dashboard and lets you create/ungroup them.
- **alarms** — Runs the optional hourly auto-stash of stale tabs (off by default).
- **contextMenus** — Adds the right-click "Stash in Perch" / "Save for later" actions.

**Remote code:** No. All code is bundled in the package.
**Data usage:** Perch does not collect or transmit user data. (See PRIVACY.md.)
**Host permissions:** None requested.

---

## Assets

- Icon: `public/icon/128.png` (store also derives others)
- Screenshots: `store/screenshots/*.png` (1280×800)
- Privacy policy URL: host `PRIVACY.md` (e.g. on piyushgambhir.com) and paste the link

## Submission checklist

1. [ ] Create a developer account ($5 one-time) at the dashboard
2. [ ] Run `pnpm zip` → upload `.output/perch-<version>-chrome.zip`
3. [ ] Fill Name / Summary / Description / Category (above)
4. [ ] Upload 1–5 screenshots from `store/screenshots/`
5. [ ] Upload the 128px icon (auto-detected from the package)
6. [ ] Privacy tab: paste permission justifications + privacy policy URL; declare no data collection
7. [ ] Set visibility (Public / Unlisted) and submit for review
