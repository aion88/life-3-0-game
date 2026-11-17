import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e-street',testMatch:'street_narrative_review_test.ts',outputDir:'test-results-narrative',timeout:180_000,workers:1,
 use:{baseURL:'http://127.0.0.1:4206',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{browserName:'chromium',channel:'chrome',viewport:{width:1440,height:900}}},{name:'iphone',use:{...devices['iPhone 13'],browserName:'webkit'}}],
 webServer:{command:'npx vite build --outDir dist-narrative && npx vite preview --outDir dist-narrative --host 127.0.0.1 --port 4206 --strictPort',url:'http://127.0.0.1:4206',reuseExistingServer:false},
});
