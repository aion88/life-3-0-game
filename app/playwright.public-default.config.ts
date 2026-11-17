import {defineConfig,devices} from '@playwright/test';
/** Smoke of the DEFAULT public path (short mode, French, worlds played by the situation player). Run after going live; saves stay inside isolated browser contexts. */
export default defineConfig({
 testDir:'tests/e2e-public',
 testMatch:['**/*_test.ts'],
 outputDir:'test-results-public-default',
 timeout:180_000,
 workers:1,
 use:{baseURL:process.env['PUBLIC_BASE_URL']??'https://life-3-0.pages.dev',trace:'retain-on-failure'},
 projects:[
  {name:'public-chrome',use:{browserName:'chromium',channel:'chrome',locale:'fr-FR'}},
  {name:'public-iphone',use:{...devices['iPhone 13'],browserName:'webkit',locale:'fr-FR'}},
 ],
});
