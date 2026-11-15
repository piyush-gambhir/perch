import { defineConfig } from 'wxt';


export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {



      if (wxt.config.browser !== 'firefox') delete manifest.browser_specific_settings;

      if (wxt.config.browser === 'firefox')
        manifest.permissions = manifest.permissions?.filter((p) => p !== 'favicon');
    },
  },
  manifest: {
    name: 'Perch',
    description:
      'A calm home for your tabs. New tab page that groups your open tabs by domain and lets you close them with style.',



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
