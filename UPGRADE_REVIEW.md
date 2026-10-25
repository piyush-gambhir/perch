# Node tooling review

Reviewed against origin/main 3c7d697 on 2026-10-26 in an isolated worktree. The original checkout and its untracked .claude directory were not changed or copied.

- Node 24.22.1 to 26.12.1 for development, CI and packaging; pnpm 12.11.2 to 12.15.0; Node types 24.19.2 to 26.6.5.
- TypeScript 7.0.2 runs through an explicit typescript7 CLI alias. TypeScript 6.0.3 remains the API dependency because typescript-eslint 8.72.0 requires TypeScript below 6.1. ESLint 9.39.5 stays because eslint-plugin-react 7.37.5 does not support ESLint 10. Other direct dependencies are current stable versions.
- Preserved upstream security overrides, exact node-forge patch, security regression suite, required CI aggregate job, package/manifest version and publishing conditions.

Validation on Node 26.12.1 and pnpm 12.15.0: frozen install, lint, explicit TypeScript 7 check, 96 tests across 14 files, all 36 security tests, Chrome MV3 build, Firefox MV2 build, Chrome zip, and formatting of changed configuration pass. The local Chrome zip is .output/perch-extension-1.1.0-chrome.zip (470.26 kB). Firefox runtime and store submissions were not tested.

A disposable Playwright Chromium profile loaded the actual packaged extension service worker and new-tab UI. Two local fixture tabs appeared in one domain group, were stashed and closed through the UI, restored through its confirmation dialog, and survived UI reload. No page errors. No user profile or external provider was used.

Production audit: zero findings. Full audit: one high development finding for node-forge 1.4.0, already covered by the inherited reviewed patch and regression suite. The registry has no published fixed version and cannot recognize patch bytes; this is not a claim of a clean full audit. Do not remove that patch or misrepresent the package version.

Gains: current runtime support and tooling, TypeScript 7 checking, and preservation of newer security work. No runtime performance improvement was benchmarked. Node is a build tool here; the extension runs in the browser.

Release triggers remain v* tags or manual publish workflow dispatch with Google OIDC store upload. CI runs on main pushes and pull requests. No workflow was dispatched, no local shelf publishing command ran, and no release, upload, or deployment occurred.
