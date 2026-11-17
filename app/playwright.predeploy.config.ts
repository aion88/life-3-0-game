import { defineConfig, devices } from '@playwright/test';
const port = process.env['PREVIEW_PORT'] ?? '4293';
export default defineConfig({
 testDir: 'tests/e2e-street',
 outputDir: 'test-results-predeploy',
 testMatch: ['street_release_test.ts','street_present_test.ts','street_episode_test.ts','street_world_journeys_test.ts','street_colorist_test.ts'],
 timeout: 120_000,
 workers: 1,
 use: {baseURL:`http://localhost:${port}`,trace:'retain-on-failure'},
 projects: [
  {name:'android-chrome',use:{...devices['Pixel 7'],channel:'chrome'}},
  {name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit'}},
 ],
 webServer:{command:'npm run build && npm run preview',url:`http://localhost:${port}`,reuseExistingServer:!process.env['CI']},
});
