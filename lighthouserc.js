'use strict';

/*
 * Layer 3: Lighthouse CI. Each page is audited 3 times (median is used to
 * smooth out noise) and the build fails if any category score or
 * performance budget below is broken.
 *
 *   BASE_URL   which server to audit (default http://localhost:3000)
 *   CHROME_PATH  optional: system Chrome/Chromium to use
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const KB = 1024;

module.exports = {
  ci: {
    collect: {
      url: [`${BASE_URL}/`, `${BASE_URL}/events`, `${BASE_URL}/events/2`, `${BASE_URL}/about`],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless=new --disable-dev-shm-usage',
        // The app is served over plain HTTP inside CI, so skip the HTTPS audits
        skipAudits: ['is-on-https', 'redirects-http', 'uses-http2']
      }
    },
    assert: {
      assertions: {
        // ---- Category score gates (0 to 1) ----
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // ---- Performance budgets ----
        'resource-summary:script:size': ['error', { maxNumericValue: 50 * KB }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 30 * KB }],
        'resource-summary:image:size': ['error', { maxNumericValue: 150 * KB }],
        'resource-summary:total:size': ['error', { maxNumericValue: 300 * KB }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],

        // ---- Individual accessibility audits that must never regress ----
        'color-contrast': 'error',
        'image-alt': 'error',
        label: 'error',
        'html-has-lang': 'error',
        'document-title': 'error',
        'link-name': 'error',
        'button-name': 'error'
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lighthouse'
    }
  }
};
