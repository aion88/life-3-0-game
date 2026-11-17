import {defineConfig,devices} from '@playwright/test';
/** Local-only playtest. This never runs against the public site or changes the release dist. */
export default defineConfig({
 testDir:'tests/e2e-street',testMatch:['street_moral_worlds_test.ts','street_local_feedback_test.ts','street_episode_test.ts','street_exploration_test.ts','street_world_journeys_test.ts'],
 outputDir:'test-results-local-feedback',timeout:120_000,workers:1,
 use:{baseURL:'http://127.0.0.1:4196',trace:'retain-on-failure'},
 projects:[{name:'local-desktop',use:{browserName:'chromium',channel:'chrome',viewport:{width:1440,height:900}}},{name:'local-iphone',use:{...devices['iPhone 13'],browserName:'webkit'}}],
 webServer:{command:'npx vite build --outDir dist-local && npx vite preview --outDir dist-local --host 127.0.0.1 --port 4196 --strictPort',url:'http://127.0.0.1:4196',reuseExistingServer:false},
});
