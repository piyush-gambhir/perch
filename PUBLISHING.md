# Publishing Perch

Perch ships to the Chrome Web Store as an **Unlisted** item: anyone with the link can
install it, and it does not appear in store search. After the first submission, tagged
releases are published by GitHub Actions (`.github/workflows/publish.yml`).

---

## Try it without the store

1. `pnpm build`
2. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked**
3. Select `.output/chrome-mv3` and open a new tab. Reload the extension after each build.

`pnpm build:local` copies the build to `~/chrome-extensions/perch` (or
`$CHROME_EXTENSIONS_DIR/perch`); a copy loaded from there reloads itself after each run.

---

## First submission (once, in the dashboard)

The Web Store API can update an item but cannot create one, and Google requires the
store listing and privacy tabs to be filled in by hand before the first publish.

1. `pnpm zip`, then in the [developer dashboard](https://chrome.google.com/webstore/devconsole)
   choose **Add new item** and upload `.output/perch-extension-<version>-chrome.zip`.
2. Fill the listing, privacy and distribution tabs from [`store/LISTING.md`](store/LISTING.md).
   The privacy policy URL is this repository's [`PRIVACY.md`](PRIVACY.md).
3. Set **Visibility → Unlisted** and submit for review.
4. Copy the item ID from the dashboard URL and set it as the repository variable
   `CHROME_EXTENSION_ID`.

## How CI authenticates

The workflow uses the Chrome Web Store API v2 (v1.1, with OAuth client IDs, secrets and
refresh tokens, shut down on 2026-10-15). Nothing secret is stored in GitHub: the run's
OIDC token is exchanged through Workload Identity Federation for the `cws-publisher`
service account in the Google Cloud project `piyush-cws-publishing`, and that account is
linked to the publisher under **Account** in the developer dashboard.

Repository variables (Settings → Secrets and variables → Actions → Variables):

| Variable                         | Value                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `CHROME_EXTENSION_ID`            | the item ID from the first submission                                                  |
| `CHROME_PUBLISHER_ID`            | publisher ID from the dashboard URL (`/devconsole/<publisher-id>`)                     |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/122613507304/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_SERVICE_ACCOUNT`            | `cws-publisher@piyush-cws-publishing.iam.gserviceaccount.com`                          |

Check access without uploading: Actions → **Publish to Chrome Web Store** → Run workflow
with **dry-run** ticked.

## Shipping an update

1. Bump `"version"` in `package.json` (the manifest takes its version from there). Every
   submission needs a higher version than the last.
2. Commit, then push a matching tag: `git tag v<version> && git push origin v<version>`.
3. The workflow typechecks, tests, zips, and submits the package for review. It goes live
   for users once Google's review clears; check the dashboard for the result.
