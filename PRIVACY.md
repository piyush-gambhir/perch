# Privacy Policy — Perch

_Last updated: June 29, 2026_

**Perch does not collect, transmit, sell, or share any personal data. Ever.**

Perch is a new-tab dashboard that organizes the tabs you already have open. It runs
entirely on your device.

## What Perch accesses

- **Your open tabs** (titles and URLs) — read with the `tabs` permission solely to
  display, group, focus, suspend, and close them on the dashboard. This information
  is shown only to you, in your browser, and is never sent anywhere.
- **Native tab groups** (`tabGroups` permission) — read to reflect Chrome's tab
  groups on the dashboard, and used when you create or ungroup one. Stays on-device.
- **Alarms** (`alarms` permission) — schedules the optional hourly auto-stash of stale
  tabs (off by default). Runs entirely locally.
- **Context menus** (`contextMenus` permission) — adds the right-click "Stash" / "Save
  for later" actions.
- **Storage** (`storage` permission) — your "Saved for later" items, stashes,
  routines, workspaces, and settings are stored with the browser's storage API.
  - They are kept in `storage.local` (on your device) and also mirrored to
    `storage.sync`, which Chrome may sync between your own signed-in devices through
    your existing browser profile. This data includes tab titles and URLs. The sync
    is performed entirely by the browser — Perch operates no server and receives none
    of it. The active-workspace selection stays local to each device.
  - You can export everything to (or import from) a local JSON file at any time, and
    uninstalling removes all of it.

## What Perch does NOT do

- No analytics, telemetry, tracking, or fingerprinting.
- No accounts, no login, no advertising.
- No external servers — Perch has no backend.
- No selling or sharing of data with third parties.

## Network requests

The only network requests Perch makes are to load **favicons** (small site icons)
from Google's public favicon service (`https://www.google.com/s2/favicons`) and the
**Inter web font** from Google Fonts, purely to render the interface. No personal
data is included in these requests beyond the website domain whose icon is being
displayed.

## Data deletion

Uninstalling Perch removes all locally stored data. You can also clear saved items,
stashes, and settings from within the extension at any time.

## Contact

Questions: Piyush Gambhir — https://piyushgambhir.com
