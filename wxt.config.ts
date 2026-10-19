import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      // `browser_specific_settings` (Gecko id, data collection declaration) is for
      // Firefox only. WXT keeps it on every target, so drop it from other builds to
      // keep the Chrome manifest free of keys Chrome does not use.
      if (wxt.config.browser !== 'firefox') delete manifest.browser_specific_settings;
      // Firefox has no `favicon` permission or `_favicon` endpoint (see faviconSrc).
      if (wxt.config.browser === 'firefox')
        manifest.permissions = manifest.permissions?.filter((p) => p !== 'favicon');
    },
  },
  manifest: {
    name: 'Perch',
    description:
      'A calm home for your tabs. New tab page that groups your open tabs by domain and lets you close them with style.',
    // version is taken from package.json by WXT — bump it there for releases.
    // `favicon` lets pages read the browser's local favicon cache via `_favicon`
    // (Chrome only), so no favicon is ever fetched from a third party.
    permissions: ['tabs', 'storage', 'tabGroups', 'alarms', 'contextMenus', 'favicon'],
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
    action: {
      default_title: 'Perch',
    },
    omnibox: {
      keyword: 'perch',
    },
    browser_specific_settings: {
      gecko: {
        id: 'perch-extension@piyushgambhir.com',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
