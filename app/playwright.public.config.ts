import {defineConfig,devices} from '@playwright/test';
/** Smoke tests against the public static release; game saves stay inside isolated browser contexts. */
export default defineConfig({
 testDir:'tests/e2e-street',
 testMatch:['street_release_test.ts','street_exploration_test.ts'],
 outputDir:'test-results-public',
 timeout:180_000,
 workers:1,
 use:{baseURL:process.env['PUBLIC_BASE_URL']??'https://life-3-0.pages.dev',trace:'retain-on-failure'},
 projects:[
  {name:'public-chrome',use:{browserName:'chromium',channel:'chrome'}},
  {name:'public-iphone',use:{...devices['iPhone 13'],browserName:'webkit'}},
 ],
});
