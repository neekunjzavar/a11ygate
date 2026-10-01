#!/usr/bin/env node
'use strict';

/*
 * Runs `lhci autorun`, then copies Lighthouse CI's assertion results next to
 * the HTML reports (reports/lighthouse/assertion-results.json) so the summary
 * table and CI artifacts can show exactly which checks failed.
 * Exits with lhci's own exit code, so the pipeline still fails when it should.
 * Extra arguments are passed through, e.g. npm run gate:perf -- --collect.numberOfRuns=1
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, '.lighthouseci', 'assertion-results.json');
const DEST = path.join(ROOT, 'reports', 'lighthouse', 'assertion-results.json');

fs.rmSync(SRC, { force: true });

const lhci = require.resolve('@lhci/cli/src/cli.js');
const result = spawnSync(process.execPath, [lhci, 'autorun', '--config=lighthouserc.js', ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit'
});

fs.mkdirSync(path.dirname(DEST), { recursive: true });
if (fs.existsSync(SRC)) fs.copyFileSync(SRC, DEST);
else fs.writeFileSync(DEST, '[]\n');

process.exit(result.status ?? 1);
