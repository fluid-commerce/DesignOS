import { defineConfig } from '@playwright/test';

// When running locally, you'll usually have `npm run dev` going in another
// terminal, and Playwright will reuse that server (reuseExistingServer: true).
// In CI, there is no pre-running server, so Playwright boots one via the
// command below. Set PLAYWRIGHT_SKIP_WEBSERVER=1 if you want the old "assume
// Vite is running" behavior (useful when debugging the server separately).
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5174',
    headless: true,
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5174',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
