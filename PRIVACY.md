# Privacy Policy: Perch

_Last updated: October 20, 2026_

**Perch does not collect, sell, or share your data.** The developer runs no server and
receives nothing from the extension: no analytics, no telemetry, no accounts.

Perch is a new-tab dashboard for the tabs you already have open. Everything it does
happens in your browser. The only way your Perch data leaves your device is Chrome
Sync, which your browser performs on your behalf, as described below.

## What Perch reads, and why

- **Your open tabs** (`tabs` permission): titles, URLs, and whether a tab is pinned,
  playing audio, or idle. Perch uses them to show, group, search, focus, suspend, stash,
  and close your tabs. They are shown only to you.
- **Tab groups** (`tabGroups`): to reflect Chrome's tab groups on the dashboard, and to
  create or ungroup one when you ask.
- **Favicons** (`favicon`): each tab's icon is read from Chrome's own favicon cache. Perch
  never fetches an icon from the internet.
- **Alarms** (`alarms`): to run background jobs on a schedule: a recovery snapshot of your
  open tabs every 15 minutes, the automation rules you create, routines you schedule, and
  the optional auto-stash of stale tabs (off by default).
- **Context menus** (`contextMenus`): the right-click "Stash in Perch" and "Save for later"
  actions.
- **Address bar**: when you type `perch` and a command in the address bar, Perch reads
  what you typed to run that command.

## What Perch stores

Perch stores data with the browser's extension storage API and, for search, in an
on-device database (IndexedDB).

**Synced to your other devices through Chrome Sync, and kept on this device:** settings,
saved-for-later tabs (with your tags and notes), stashes, routines (with their schedules),
workspaces, and automation rules. These include tab titles and URLs. If you are signed in
to Chrome with sync turned on, Chrome stores this data in your Google Account to keep your
own devices in step. Chrome does this under Google's privacy policy; Perch has no access to
it. If sync is off or its quota is full, the data stays on this device only.

**Only on this device:**

- the last 12 closed groups of tabs, for undo
- up to 24 recovery snapshots of your open tabs
- a search history of tabs you closed, stashed, or saved (up to 5,000 entries, oldest
  removed first)
- which workspace is active on this device

## Backups

You can export your data to a file, optionally encrypted with a passphrase (AES-256-GCM).
The file is saved where you choose, and Perch never uploads it. Exports include settings,
saved tabs, stashes, routines, workspaces, and automation rules. Recovery snapshots, undo
history, and search history are not exported.

## What Perch does not do

- No analytics, telemetry, tracking, fingerprinting, or advertising.
- No accounts or login.
- No servers and no remote code. All code and the interface font ship inside the
  extension.
- No selling, sharing, or transferring of data to anyone, and no use of it for any purpose
  other than the features described here.

## Deleting your data

- Delete saved tabs, stashes, routines, workspaces, rules, and snapshots inside Perch at any
  time. A deleted item can still appear in recovery snapshots and search history until those
  roll over.
- Uninstalling Perch removes everything it stored on this device. To remove synced copies
  as well, delete the items in Perch before uninstalling, or clear your Chrome Sync data at
  https://chrome.google.com/sync.

## Contact

Piyush Gambhir, https://piyushgambhir.com
