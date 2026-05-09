#!/usr/bin/env node
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/tmp/pw-list.json', 'utf-8'));
const tests = [];
function walk(suites) {
  for (const s of suites) {
    if (s.specs) for (const spec of s.specs) for (const t of spec.tests) {
      tests.push({ file: spec.file, line: spec.line, title: spec.title, tags: t.tags || spec.tags || [] });
    }
    if (s.suites) walk(s.suites);
  }
}
walk(data.suites);

// Parse TC-ID and clean title
for (const t of tests) {
  const m = t.title.match(/^\[(TC-[A-Z]+-\d+)\]\s*(.+)$/);
  t.id = m ? m[1] : '';
  t.cleanTitle = m ? m[2] : t.title;
  t.area = t.file.startsWith('api/') ? 'API' : 'UI';
  // Determine type from tags (priority order)
  if (t.tags.includes('security')) t.type = 'Security';
  else if (t.tags.includes('load')) t.type = 'Load';
  else if (t.tags.includes('boundary')) t.type = 'Boundary';
  else if (t.tags.includes('negative')) t.type = 'Negative';
  else if (t.tags.includes('positive')) t.type = 'Positive';
  else t.type = '';
  t.documented = /^DOCUMENTED (VULN|UX)/.test(t.cleanTitle);
}

const FEATURE_TITLES = {
  'api/add-card.spec.ts': 'Payment Cards — API (Task 3)',
  'ui/add-card.spec.ts': 'Payment Cards — UI (Task 2)',
  'ui/login.spec.ts': 'Login — UI (Task 1)',
  'api/login.spec.ts': 'Login — API',
  'ui/register.spec.ts': 'Registration — UI',
  'api/register.spec.ts': 'Registration — API',
  'ui/search.spec.ts': 'Search — UI',
  'api/products.spec.ts': 'Products & Search — API',
  'ui/basket.spec.ts': 'Basket / Cart — UI',
  'api/basket.spec.ts': 'Basket / Cart — API',
  'ui/address.spec.ts': 'Address book — UI',
  'api/address.spec.ts': 'Address book — API',
  'ui/change-password.spec.ts': 'Change password — UI',
  'ui/forgot-password.spec.ts': 'Forgot password — UI',
  'ui/contact.spec.ts': 'Customer feedback — UI',
  'api/feedback.spec.ts': 'Customer feedback — API',
  'ui/product-reviews.spec.ts': 'Product details & reviews — UI',
  'ui/navigation.spec.ts': 'Site navigation & UX — UI',
  'ui/account-areas.spec.ts': 'Profile & order history — UI',
  'ui/extra-pages.spec.ts': 'Account-area pages reachability — UI',
  'ui/order-flow.spec.ts': 'Checkout / Order flow — UI (Bonus)',
  'api/order-flow.spec.ts': 'Checkout / Order flow — API (Bonus)',
  'api/wallet.spec.ts': 'Wallet — API',
  'api/recycle.spec.ts': 'Recycle requests — API',
  'api/deliveries.spec.ts': 'Delivery methods — API',
  'api/track-order.spec.ts': 'Track order — API',
  'api/two-factor.spec.ts': 'Two-factor authentication — API',
  'api/complaint.spec.ts': 'Customer complaints — API',
  'api/captcha.spec.ts': 'Captcha endpoints — API',
  'api/whoami.spec.ts': 'User identity & lookup — API',
};

// Group by file in catalog order
const byFile = {};
for (const t of tests) {
  byFile[t.file] = byFile[t.file] || [];
  byFile[t.file].push(t);
}
for (const f of Object.keys(byFile)) {
  byFile[f].sort((a, b) => a.id.localeCompare(b.id));
}

// Counts
const total = tests.length;
const uiCount = tests.filter(t => t.area === 'UI').length;
const apiCount = tests.filter(t => t.area === 'API').length;
const tagCount = (tag) => tests.filter(t => t.tags.includes(tag)).length;
const tagged = tests.filter(t => t.tags.length > 0);

const cats = ['positive', 'negative', 'security', 'boundary', 'load'];
const tasks = ['task1', 'task2', 'task3'];
const buckets = ['smoke', 'regression', 'e2e', 'functional', 'nonfunctional'];

// Documented findings
const docVulns = tests.filter(t => t.documented).sort((a, b) => a.id.localeCompare(b.id));

let md = '';
md += '# Juice Shop QA — Test Cases Catalog\n\n';
md += `_Generated from the live test suite (${new Date().toISOString().slice(0, 10)}). Single source of truth: re-run \`node tools/gen-catalog.js\` after adding tests._\n\n`;

md += '## Summary\n\n';
md += `- **Total: ${total} tests** across ${Object.keys(byFile).length} spec files (${uiCount} UI · ${apiCount} API)\n`;
md += `- **Tagged with \`@everstage-qa\`: ${tagCount('everstage-qa')}** assignment tests\n`;
md += `- **Documented vulnerabilities / UX findings**: ${docVulns.length} (asserted as actual Juice Shop behavior — see [Findings](#findings-against-the-default-juice-shop-build))\n\n`;

md += '### Coverage by category (from tags)\n\n';
md += '| Category | Count | Notes |\n|---|---|---|\n';
for (const c of cats) {
  const n = tagCount(c);
  const blurb = {
    positive: 'Happy-path assertions',
    negative: 'Bad input is rejected; errors are surfaced',
    security: 'SQLi, XSS, JWT, IDOR/BOLA, mass-assignment, oversized payloads',
    boundary: 'Values at and just past min/max limits',
    load: 'Concurrent or sequential bursts; no lockouts, no 5xx',
  }[c];
  md += `| @${c} | ${n} | ${blurb} |\n`;
}
md += '\n';

md += '### Coverage by assignment task\n\n';
md += '| Task | Tag | Count |\n|---|---|---|\n';
md += `| Task 1 — Login + beforeEach | \`@task1\` | ${tagCount('task1')} |\n`;
md += `| Task 2 — UI add card | \`@task2\` | ${tagCount('task2')} |\n`;
md += `| Task 3 — API add card | \`@task3\` | ${tagCount('task3')} |\n\n`;

md += '### Coverage by run bucket\n\n';
md += '| Bucket | Tag | Count | Use |\n|---|---|---|---|\n';
const bucketNotes = {
  smoke: 'PR-gate slice — must pass before merge',
  regression: 'Full nightly slice',
  e2e: 'End-to-end user journeys',
  functional: 'Behavior tests',
  nonfunctional: 'Latency, masking, robustness',
};
for (const b of buckets) {
  md += `| ${b} | \`@${b}\` | ${tagCount(b)} | ${bucketNotes[b]} |\n`;
}
md += '\n---\n\n';

md += '## How to read a test row\n\n';
md += 'Each test is identified by a stable `TC-{AREA}-{NUMBER}` id embedded in its Playwright title (e.g. `[TC-API-001] POST /api/Cards/ creates a card with unique details`). The id never changes once shipped — refactors keep the same id so the dashboard can track per-test pass-rate over time.\n\n';
md += '- **Type** — derived from the test\'s tags. Order of precedence: Security > Load > Boundary > Negative > Positive.\n';
md += '- **Tags** — Playwright `{ tag: [...] }` values. Multiple per test; lets the same test appear in `@smoke`, `@security`, `@regression`, etc.\n';
md += '- **Documented** — for `DOCUMENTED VULN:` / `DOCUMENTED UX:` rows, the assertion encodes Juice Shop\'s *actual* (often vulnerable) behavior so the suite stays green on the unsafe build. Flip the assertion when running against a hardened build.\n\n';
md += '---\n\n';

md += '## Test cases by feature\n\n';

const orderedFiles = [
  'ui/login.spec.ts', 'api/login.spec.ts',
  'ui/register.spec.ts', 'api/register.spec.ts',
  'ui/add-card.spec.ts', 'api/add-card.spec.ts',
  'ui/order-flow.spec.ts', 'api/order-flow.spec.ts',
  'ui/search.spec.ts', 'api/products.spec.ts',
  'ui/basket.spec.ts', 'api/basket.spec.ts',
  'ui/address.spec.ts', 'api/address.spec.ts',
  'ui/change-password.spec.ts', 'ui/forgot-password.spec.ts',
  'ui/contact.spec.ts', 'api/feedback.spec.ts',
  'ui/product-reviews.spec.ts',
  'ui/navigation.spec.ts', 'ui/account-areas.spec.ts', 'ui/extra-pages.spec.ts',
  'api/wallet.spec.ts', 'api/recycle.spec.ts', 'api/deliveries.spec.ts',
  'api/track-order.spec.ts', 'api/two-factor.spec.ts',
  'api/complaint.spec.ts', 'api/captcha.spec.ts', 'api/whoami.spec.ts',
];

const seen = new Set();
for (const f of orderedFiles) {
  if (!byFile[f]) continue;
  seen.add(f);
  const heading = FEATURE_TITLES[f] || f;
  md += `### ${heading}\n\n`;
  md += `_${f} · ${byFile[f].length} test${byFile[f].length === 1 ? '' : 's'}_\n\n`;
  md += '| ID | Type | Title | Tags |\n|---|---|---|---|\n';
  for (const t of byFile[f]) {
    const tagsStr = t.tags.length > 0 ? t.tags.map(x => `\`@${x}\``).join(' ') : '—';
    const titleEsc = t.cleanTitle.replace(/\|/g, '\\|');
    md += `| \`${t.id}\` | ${t.type || '—'} | ${titleEsc} | ${tagsStr} |\n`;
  }
  md += '\n';
}

// Catch any file we forgot
for (const f of Object.keys(byFile)) {
  if (seen.has(f)) continue;
  md += `### ${f}\n\n`;
  md += `_${f} · ${byFile[f].length} tests_\n\n`;
  md += '| ID | Type | Title | Tags |\n|---|---|---|---|\n';
  for (const t of byFile[f]) {
    const tagsStr = t.tags.length > 0 ? t.tags.map(x => `\`@${x}\``).join(' ') : '—';
    const titleEsc = t.cleanTitle.replace(/\|/g, '\\|');
    md += `| \`${t.id}\` | ${t.type || '—'} | ${titleEsc} | ${tagsStr} |\n`;
  }
  md += '\n';
}

md += '---\n\n';
md += '## Findings against the default Juice Shop build\n\n';
md += 'These tests are written so they **pass on the default vulnerable Juice Shop**. They document a behavior gap; on a hardened build the assertion flips. They are tagged appropriately so they appear in `@security` / `@negative` slices.\n\n';
md += '| ID | Finding | Severity hint | Spec |\n|---|---|---|---|\n';
for (const v of docVulns) {
  const sev = /UserId=null|BOLA|IDOR|SQL|bypass|auth|tampered/i.test(v.cleanTitle) ? 'High' :
              /captcha|enumeration|leaks/i.test(v.cleanTitle) ? 'Medium' :
              'Low / UX';
  md += `| \`${v.id}\` | ${v.cleanTitle.replace(/^DOCUMENTED (VULN|UX):\s*/, '').replace(/\|/g, '\\|')} | ${sev} | \`${v.file}\` |\n`;
}
md += '\n';

md += '---\n\n';
md += '## Reproducing this catalog\n\n';
md += '```bash\n';
md += '# Re-export the test list and regenerate this doc\n';
md += 'npx playwright test --list --reporter=json > /tmp/pw-list.json\n';
md += 'node tools/gen-catalog.js > docs/test-cases.md\n';
md += '```\n';

fs.writeFileSync('docs/test-cases.md', md);
console.error(`Wrote ${md.length} bytes to docs/test-cases.md`);

// Also regenerate the lean CSV catalog so it tracks reality.
const csvHeader = 'test_id,area,type,title,tags,spec_file,documented';
const csvLines = [csvHeader];
const csvFiles = orderedFiles.concat(Object.keys(byFile).filter(x => !orderedFiles.includes(x)));
for (const f of csvFiles) {
  if (!byFile[f]) continue;
  for (const t of byFile[f]) {
    const row = [
      t.id,
      t.area,
      t.type,
      `"${t.cleanTitle.replace(/"/g, '""')}"`,
      t.tags.map(x => '@' + x).join(' '),
      t.file,
      t.documented ? 'yes' : '',
    ];
    csvLines.push(row.join(','));
  }
}
fs.writeFileSync('docs/test-cases.csv', csvLines.join('\n') + '\n');
console.error(`Wrote ${csvLines.length - 1} rows to docs/test-cases.csv`);

console.error(`${total} tests · ${uiCount} UI · ${apiCount} API · ${docVulns.length} documented findings`);
