# Publishing Perch

Perch ships to the Chrome Web Store as a **private (trusted-testers)** item, published
automatically by GitHub Actions (`.github/workflows/publish.yml`).

---

## Test directly right now (no store, instant)

1. `pnpm zip` (or `pnpm build`)
2. Chrome → `chrome://extensions` → enable **Developer mode** (top-right)
3. **Load unpacked** → select `.output/chrome-mv3`
4. Open a new tab. Reload the extension after each `pnpm build` to pick up changes.

This is the fastest loop and exercises the full feature set. The store path below is for
installing on other machines / sharing with testers.

---

## One-time setup (only you can do these)

### 1. Developer account ($5, once)
Register at the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)
and pay the one-time $5 fee.

### 2. Create the item once, by hand (to get the Extension ID)
The Web Store API can only **update** an existing item, not create a new one — so the
very first upload is manual:

1. Dashboard → **Add new item** → upload `.output/perch-extension-<version>-chrome.zip`.
2. Fill the listing from [`store/LISTING.md`](store/LISTING.md); add the screenshots in
   [`store/screenshots/`](store/screenshots) and the promo tile `store/promo-tile.png`.
3. Host [`PRIVACY.md`](PRIVACY.md) somewhere public (e.g. piyushgambhir.com/perch-privacy)
   and paste the URL into the **Privacy practices** tab; paste the permission
   justifications from `store/LISTING.md`.
4. **Visibility → Private**, and under **Trusted testers** add each tester's Google email.
5. Submit. Once it's reviewed, copy the **Extension ID** (the long id in the item's URL).

### 3. API credentials (for automated updates)
Follow Google's flow (≈5 min):
[How to generate Chrome Web Store API keys](https://github.com/fregante/chrome-webstore-upload/blob/main/How%20to%20generate%20Google%20API%20keys.md).
In short:
1. [Google Cloud Console](https://console.cloud.google.com) → new project → **enable the
   "Chrome Web Store API"**.
2. OAuth consent screen (External, add yourself as a test user) → create **OAuth client ID**
   of type **Desktop app** → note the **Client ID** and **Client secret**.
3. Generate a **refresh token**:
   `npx chrome-webstore-upload-keys` and follow the prompts (it opens the consent flow and
   prints the refresh token).

### 4. Add GitHub secrets
Repo → Settings → Secrets and variables → Actions → add:

| Secret | Value |
|--------|-------|
| `CWS_EXTENSION_ID` | the Extension ID from step 2 |
| `CWS_CLIENT_ID` | OAuth client id |
| `CWS_CLIENT_SECRET` | OAuth client secret |
| `CWS_REFRESH_TOKEN` | refresh token from step 3 |

---

## Shipping an update (after setup)

1. Bump the version in `package.json` (the manifest version derives from it):
   `npm version patch` (or edit `"version"`).
2. Commit, then either:
   - **Tag-triggered:** `git tag v<version> && git push --tags` → the workflow builds,
     tests, uploads, and **publishes to trusted testers** automatically; or
   - **Manual:** GitHub → Actions → **Publish to Chrome Web Store** → *Run workflow*
     (choose `trustedTesters` or `default`).
3. Or publish from your machine (with the four values exported as `EXTENSION_ID`,
   `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`): `pnpm release:store`.

Testers install/update from the item's store URL while signed in with an allow-listed
email. Going public later = flip Visibility to **Public** and run the workflow with
`target: default`.

> Every store submission needs a **higher version** than the last — always bump
> `package.json` before releasing, or the upload is rejected.
