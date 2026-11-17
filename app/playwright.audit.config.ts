import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e-street',testMatch:['street_release_test.ts','street_exploration_test.ts','street_episode_test.ts','street_present_test.ts','street_world_journeys_test.ts','street_colorist_test.ts','street_character_cast_test.ts','street_narrative_review_test.ts','street_audit_probe_test.ts'],
 outputDir:'test-results-audit',timeout:180_000,workers:1,
 use:{baseURL:'http://127.0.0.1:4207',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{browserName:'chromium',channel:'chrome',viewport:{width:1440,height:900}}},{name:'android',use:{...devices['Pixel 7'],channel:'chrome'}},{name:'iphone',use:{...devices['iPhone 13'],browserName:'webkit'}}],
});
