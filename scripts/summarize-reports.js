#!/usr/bin/env node
'use strict';

/*
 * Reads the pa11y-ci and Lighthouse CI reports and prints one Markdown
 * summary table. In GitHub Actions it is also written to the job summary
 * page ($GITHUB_STEP_SUMMARY); in Jenkins it is archived as summary.md.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PA11Y = path.join(ROOT, 'reports', 'pa11y', 'results.json');
const LHCI = path.join(ROOT, 'reports', 'lighthouse', 'manifest.json');
const LHCI_ASSERT = path.join(ROOT, 'reports', 'lighthouse', 'assertion-results.json');
const OUT = path.join(ROOT, 'reports', 'summary.md');

const pathOf = (url) => {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
const pct = (score) => (typeof score === 'number' ? Math.round(score * 100) : '–');
const badge = (score, min) => (typeof score !== 'number' ? '' : score >= min ? ' ✅' : ' ❌');

const lines = ['## Accessibility & performance quality gate', ''];

// ---- pa11y-ci ----
const pa11y = readJson(PA11Y);
if (pa11y) {
  lines.push(`### pa11y-ci (axe-core + HTML_CodeSniffer, WCAG 2 AA): ${pa11y.passes}/${pa11y.total} pages passed`, '');
  lines.push('| Page | Issues |', '|---|---|');
  for (const [url, issues] of Object.entries(pa11y.results)) {
    const count = Array.isArray(issues) ? issues.length : 1;
    lines.push(`| \`${pathOf(url)}\` | ${count === 0 ? '0 ✅' : `${count} ❌`} |`);
  }
  // Group identical problems so the summary shows *kinds* of failure, not 40 copies of one
  const byRule = new Map();
  for (const [url, issues] of Object.entries(pa11y.results)) {
    const list = Array.isArray(issues) ? issues : [{ message: String(issues.message || issues) }];
    for (const issue of list) {
      const message = issue.message.replace(/\s*\(https?:\/\/[^)]+\)\s*$/, '');
      const entry = byRule.get(message) || { count: 0, pages: new Set() };
      entry.count += 1;
      entry.pages.add(pathOf(url));
      byRule.set(message, entry);
    }
  }
  if (byRule.size) {
    lines.push('', '| Problem | Occurrences | Pages |', '|---|---|---|');
    [...byRule.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .forEach(([message, { count, pages }]) => lines.push(`| ${message} | ${count} | ${pages.size} |`));
  }
  lines.push('');
} else {
  lines.push('_pa11y-ci report not found._', '');
}

// ---- Lighthouse CI ----
const manifest = readJson(LHCI);
if (manifest) {
  const failed = (readJson(LHCI_ASSERT) || []).filter((a) => !a.passed && a.level === 'error');
  const failedFor = (url) => [...new Set(failed.filter((a) => a.url === url).map((a) => a.auditId || a.name))];

  lines.push('### Lighthouse CI (median of runs)', '');
  lines.push('| Page | Performance | Accessibility | Best practices | SEO | Failed checks |', '|---|---|---|---|---|---|');
  for (const run of manifest.filter((r) => r.isRepresentativeRun)) {
    const s = run.summary;
    const f = failedFor(run.url);
    lines.push(
      `| \`${pathOf(run.url)}\` | ${pct(s.performance)}${badge(s.performance, 0.9)} | ` +
        `${pct(s.accessibility)}${badge(s.accessibility, 0.95)} | ` +
        `${pct(s['best-practices'])}${badge(s['best-practices'], 0.9)} | ${pct(s.seo)} | ` +
        `${f.length ? `❌ ${f.map((id) => `\`${id}\``).join(', ')}` : 'none ✅'} |`
    );
  }
  lines.push('', 'Gates: performance ≥ 90, accessibility ≥ 95, best practices ≥ 90, page-weight and timing budgets, and key accessibility audits (contrast, alt text, labels).', '');
} else {
  lines.push('_Lighthouse CI report not found._', '');
}

const markdown = lines.join('\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
console.log(markdown);
