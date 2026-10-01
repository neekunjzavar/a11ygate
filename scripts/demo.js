#!/usr/bin/env node
'use strict';

/*
 * Live-demo helper: deliberately introduces realistic regressions so you can
 * show the pipeline catching them, then puts everything back.
 *
 *   npm run demo:break-markup    remove an image's alt text and a form label  -> stage 1 fails
 *   npm run demo:break-contrast  make grey text low-contrast                  -> stage 3 fails
 *   npm run demo:break-a11y      both of the above
 *   npm run demo:break-perf      add a 700 KB main-thread-blocking script     -> Lighthouse fails
 *   npm run demo:reset           restore the original files
 *
 * Works on Windows, macOS and Linux (no git or sed needed).
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BACKUP = path.join(ROOT, '.demo-backup');
const file = (rel) => path.join(ROOT, rel);

function backup(rel) {
  const dest = path.join(BACKUP, rel);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file(rel), dest);
  }
}

function edit(rel, from, to, description) {
  backup(rel);
  const before = fs.readFileSync(file(rel), 'utf8');
  if (!before.includes(from)) {
    console.log(`  - already applied: ${description}`);
    return;
  }
  fs.writeFileSync(file(rel), before.replace(from, to));
  console.log(`  ✗ ${description}  (${rel})`);
}

function breakMarkup() {
  console.log('Introducing accessibility bugs in the HTML (caught by stage 1, the static tests):');
  edit(
    'views/index.ejs',
    ' alt="Illustration of three students performing on a stage under a gold star"',
    '',
    'hero image has no alt text'
  );
  edit('views/events.ejs', '<label for="q">Search</label>', '<span>Search</span>', 'search box has no <label>');
  console.log('\nRun `npm test` or push this to a branch: stage 1 should fail.');
}

function breakContrast() {
  console.log('Introducing a colour-contrast bug (valid HTML, so unit tests pass; caught by pa11y-ci and Lighthouse):');
  edit('public/css/styles.css', '--muted: #4a5360;', '--muted: #b4bac2;', 'grey text now fails colour contrast');
  console.log('\nRun `npm run gate` or push this to a branch: stages 1 and 2 pass, stage 3 fails.');
}

function breakA11y() {
  breakMarkup();
  console.log('');
  breakContrast();
}

function breakPerf() {
  console.log('Introducing performance regressions:');
  const rel = 'public/js/analytics-bundle.js';
  fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
  // Random data so gzip can't shrink it (a real minified bundle barely compresses either)
  const filler = require('node:crypto').randomBytes(525 * 1024).toString('base64');
  fs.writeFileSync(
    file(rel),
    '/* Simulated heavy third-party bundle */\n' +
      `window.__bundle = "${filler}";\n` +
      '// After the page renders, hog the main thread in three 350 ms chunks (what slow trackers do)\n' +
      'function hog() { var t = Date.now(); while (Date.now() - t < 350) { /* busy */ } }\n' +
      'window.addEventListener("load", function () { hog(); setTimeout(hog, 50); setTimeout(hog, 100); });\n'
  );
  console.log(`  ✗ created a 700 KB script that freezes the page for about 1 second  (${rel})`);
  edit(
    'views/partials/head.ejs',
    '<link rel="stylesheet" href="/css/styles.css">',
    '<link rel="stylesheet" href="/css/styles.css">\n  <script src="/js/analytics-bundle.js"></script>',
    'render-blocking <script> added to every page'
  );
  console.log('\nRun the gate (npm run gate) or push this to a branch: Lighthouse CI should fail.');
}

function reset() {
  console.log('Restoring original files:');
  if (fs.existsSync(BACKUP)) {
    const walk = (dir) =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
        d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]
      );
    for (const saved of walk(BACKUP)) {
      const rel = path.relative(BACKUP, saved);
      fs.copyFileSync(saved, file(rel));
      console.log(`  ✓ ${rel}`);
    }
    fs.rmSync(BACKUP, { recursive: true, force: true });
  }
  fs.rmSync(file('public/js'), { recursive: true, force: true });
  console.log('  ✓ removed public/js/analytics-bundle.js\nDone.');
}

const actions = {
  'break-markup': breakMarkup,
  'break-contrast': breakContrast,
  'break-a11y': breakA11y,
  'break-perf': breakPerf,
  reset
};
const action = actions[process.argv[2]];
if (!action) {
  console.error('Usage: node scripts/demo.js <break-markup | break-contrast | break-a11y | break-perf | reset>');
  process.exit(1);
}
action();
