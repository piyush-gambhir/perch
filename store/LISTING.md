# Perch: Chrome Web Store listing

Copy for the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).
This file is the source for the next submission, not a record of what the dashboard holds.
Check it against the built manifest and [PRIVACY.md](../PRIVACY.md) before you paste.

- **Visibility:** Unlisted
- **Package:** `.output/perch-extension-<version>-chrome.zip` from `pnpm zip`
- **Privacy policy URL:** https://github.com/piyush-gambhir/perch/blob/main/PRIVACY.md

---

## Name (45 max)

```text
Perch: Tab Dashboard & New Tab
```

## Summary (132 max)

```text
A calm new tab for everything you have open. Group tabs by site, stash and restore sessions, find any tab with ⌘K, and undo closes.
```

131 characters. Recount after any edit; the dashboard truncates silently.

## Category and language

Productivity, Workflow & Planning. English (United States).

## Description

```text
Perch turns your new tab page into a calm home for everything you have open.

If you keep forty tabs open because closing one feels risky, Perch is for you. It groups your tabs by site, makes closing safe with stashes, undo and recovery snapshots, and finds any tab in a keystroke.

ORGANIZE
• Every open tab, grouped by site
• Homepages (Gmail, X, LinkedIn, GitHub, YouTube) collected into one card
• Chrome's tab groups shown with their colour and name; group or ungroup a site's tabs from its card
• Workspaces: switch between sets of tabs for different projects

CLOSE WITHOUT FEAR
• Stash a group, or every tab, as a named session, then close them for real
• Restore a stash in place or in a new window; drag tabs onto a stash
• Undo brings back tabs you close from the dashboard
• Recovery snapshots every 15 minutes, so you can reopen only the tabs that went missing
• Pinned tabs are never closed by bulk actions

FIND ANYTHING
• ⌘K command palette across open tabs, saved tabs and stashes
• Filters such as open:, saved:, stash: and older:7d, plus your own tags and notes
• Type "perch" in the address bar to search or run a command

TIDY UP
• Control center: duplicates, tabs you haven't touched in days, tracking parameters, and tabs worth suspending
• Suspend inactive tabs to free memory
• Automation rules that stash, deduplicate or suspend tabs by site and age
• Routines: reusable sets of tabs you can open on demand or at a set time each day

YOURS
• No account, no analytics, no servers; icons come from Chrome's own cache
• Saved tabs, stashes and settings follow you across your devices through Chrome Sync
• Export a backup, optionally encrypted with a passphrase
• Light and dark themes

Open a new tab and you're home.
```

---

## Privacy practices tab

### Single purpose

```text
Perch replaces the new tab page with a dashboard for the tabs you have open, so you can see, group, find, save and close them, and bring closed tabs back.
```

### Permission justifications

| Permission     | Justification                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`         | Perch reads the titles, URLs and state of your open tabs to show them grouped on the dashboard and to focus, suspend, stash, restore and close them when you ask.                                           |
| `storage`      | Keeps your saved tabs, stashes, routines, workspaces, automation rules and settings. Most of it syncs between your own devices through Chrome Sync; undo history and recovery snapshots stay on the device. |
| `tabGroups`    | Shows Chrome's tab groups on the dashboard and creates or removes a group when you press "Group in browser" or "Ungroup".                                                                                   |
| `alarms`       | Runs scheduled background jobs: a recovery snapshot every 15 minutes, the automation rules you create, routines you schedule, and the optional auto-stash.                                                  |
| `contextMenus` | Adds the right-click "Stash in Perch" and "Save for later" actions.                                                                                                                                         |
| `favicon`      | Shows each tab's icon from Chrome's local favicon cache, so no icon is fetched from the internet.                                                                                                           |

The manifest also declares the `perch` address-bar keyword (no permission needed).

**Host permissions:** none. **Remote code:** No, all code ships in the package.

### Data usage

Google requires disclosure even when data never leaves the device
([User Data FAQ, Q3](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)).

- Tick **Web history**: Perch stores titles and URLs of your tabs (saved tabs, stashes,
  snapshots, search history), and Chrome Sync carries part of it between your devices.
- Leave every other category unticked.
- Certify all three statements: data is not sold to third parties, not used or transferred
  for purposes unrelated to the single purpose, and not used to determine creditworthiness.

---

## Graphics

| File                                      | Size     | Shows                    |
| ----------------------------------------- | -------- | ------------------------ |
| `store/screenshots/1-dashboard-light.png` | 1280x800 | Dashboard, light theme   |
| `store/screenshots/2-dashboard-dark.png`  | 1280x800 | Dashboard, dark theme    |
| `store/screenshots/3-command-palette.png` | 1280x800 | ⌘K palette with a filter |
| `store/screenshots/4-control-center.png`  | 1280x800 | Control center           |
| `store/promo-tile.png`                    | 440x280  | Small promo tile         |

Store icon: `public/icon/128.png` (also in the package).

## Submit checklist

1. [ ] `pnpm test` and `pnpm build` are green; `.output/chrome-mv3/manifest.json` lists exactly
       `tabs, storage, tabGroups, alarms, contextMenus, favicon` and no host permissions.
2. [ ] `pnpm zip`, then upload `.output/perch-extension-<version>-chrome.zip`.
3. [ ] Paste name, summary, description, category and language from this file.
4. [ ] Upload the screenshots and promo tile.
5. [ ] Privacy tab: single purpose, permission justifications, "No" to remote code, Web history
       ticked, certifications, and the privacy policy URL.
6. [ ] Distribution: Unlisted, all regions.
7. [ ] Submit for review, then set the repository variable `CHROME_EXTENSION_ID` to the new item's
       ID so tagged releases publish from CI (see [PUBLISHING.md](../PUBLISHING.md)).
