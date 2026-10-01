'use strict';

/*
 * Layer 2 of the accessibility gate: pa11y-ci loads every page in headless
 * Chrome and scans it with TWO engines (axe-core and HTML_CodeSniffer)
 * against WCAG 2 level AA. Any error fails the pipeline.
 *
 * BASE_URL lets the same config test a dev server, a Docker container, or
 * the live deployment, e.g.  BASE_URL=http://app:3000 npm run gate:a11y
 */

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

module.exports = {
  defaults: {
    standard: 'WCAG2AA',
    runners: ['axe', 'htmlcs'],
    timeout: 30000,
    wait: 250,
    chromeLaunchConfig: {
      // Inside Dockerfile.qa (and on machines without Puppeteer's bundled Chrome)
      // point at the system browser via PUPPETEER_EXECUTABLE_PATH.
      ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    },
    reporters: [
      'cli',
      ['json', { fileName: './reports/pa11y/results.json' }],
      ['pa11y-ci-reporter-html', { destination: './reports/pa11y/html', includeZeroIssues: true }]
    ]
  },
  urls: [
    `${BASE_URL}/`,
    `${BASE_URL}/events`,
    `${BASE_URL}/events?q=zzz-no-results`,
    `${BASE_URL}/events/2`,
    `${BASE_URL}/about`,
    `${BASE_URL}/this-page-does-not-exist`,
    {
      // Error state of the registration form: submit it empty, then scan the
      // page that shows the error summary and inline messages.
      url: `${BASE_URL}/events/1`,
      actions: [
        'click element form[action$="/register"] button[type=submit]',
        'wait for element .alert-error to be visible'
      ]
    },
    {
      // Search flow: type a query, pick a category, submit, scan the results.
      url: `${BASE_URL}/events`,
      actions: [
        'set field #q to docker',
        'set field #category to workshop',
        'click element .filter-form button[type=submit]',
        'wait for element .link-reset to be visible'
      ]
    }
  ]
};
