import { defineConfig, devices } from '@playwright/test';

const baseURL = String(process.env.EVARA_QA_BASE_URL || '').replace(/\/$/, '');
const iphone = devices['iPhone 15 Pro'] || devices['iPhone 14 Pro'];
const android = devices['Pixel 7'] || devices['Pixel 5'];

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.mjs',
  outputDir: './test-results/artifacts',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.02
    }
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
    ['json', { outputFile: './test-results/results.json' }]
  ],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 1100 },
        colorScheme: 'light',
        deviceScaleFactor: 1
      }
    },
    {
      name: 'tablet-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1024, height: 1366 },
        colorScheme: 'light',
        deviceScaleFactor: 1
      }
    },
    {
      name: 'iphone-webkit',
      use: {
        ...iphone,
        browserName: 'webkit',
        colorScheme: 'dark'
      }
    },
    {
      name: 'android-chromium',
      use: {
        ...android,
        browserName: 'chromium',
        colorScheme: 'light'
      }
    }
  ]
});
