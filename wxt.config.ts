import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Perch',
    description:
      'A calm home for your tabs. New tab page that groups your open tabs by domain and lets you close them with style.',
    // version is taken from package.json by WXT — bump it there for releases.
    permissions: ['tabs', 'storage', 'tabGroups', 'alarms', 'contextMenus'],
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
    action: {
      default_title: 'Perch',
    },
  },
});
