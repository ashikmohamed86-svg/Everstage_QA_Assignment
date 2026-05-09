import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface CatalogEntry {
  area: string;
  priority: string;
  type: string;
  title: string;
}

interface HistoryRow {
  run_id: string;
  run_timestamp: string;
  test_id: string;
  area: string;
  priority: string;
  type: string;
  title: string;
  tags: string;
  status: string;
  duration_ms: string;
  retries: string;
  error_message: string;
}

const CATALOG_PATH = path.join('docs', 'test-cases.csv');
const HISTORY_PATH = path.join('reports', 'run-history.csv');
const DASHBOARD_PATH = path.join('reports', 'dashboard.html');
const SUMMARY_PATH = path.join('reports', 'summary.md');

const HISTORY_HEADER = [
  'run_id',
  'run_timestamp',
  'test_id',
  'area',
  'priority',
  'type',
  'title',
  'tags',
  'status',
  'duration_ms',
  'retries',
  'error_message',
].join(',');

export default class CsvReporter implements Reporter {
  private runId = '';
  private runTimestamp = '';
  private rows: string[] = [];
  private catalog: Map<string, CatalogEntry> = new Map();

  onBegin(): void {
    this.runTimestamp = new Date().toISOString();
    this.runId = this.runTimestamp.replace(/[:.]/g, '-');
    this.catalog = loadCatalog(CATALOG_PATH);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const testId = parseTestId(test.title);
    const meta = (testId && this.catalog.get(testId)) || undefined;

    const titleClean = test.title.replace(/^\[TC-[A-Z]+-\d+\]\s*/, '');
    const area = meta?.area ?? inferArea(test.location?.file ?? '');
    const error = (result.error?.message ?? '').replace(/\s+/g, ' ').slice(0, 400);

    // test.tags is the array of '@foo' tags; fall back to the legacy in-title
    // form for older tests that include @tags directly in their titles.
    const tags = collectTags(test);

    this.rows.push(
      [
        csv(this.runId),
        csv(this.runTimestamp),
        csv(testId ?? ''),
        csv(area),
        csv(meta?.priority ?? ''),
        csv(meta?.type ?? inferTypeFromTags(tags)),
        csv(titleClean),
        csv(tags.join(' ')),
        csv(result.status),
        String(result.duration),
        String(result.retry),
        csv(error),
      ].join(',')
    );
  }

  onEnd(): void {
    if (this.rows.length === 0) return;
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });

    // If the existing file uses an older header (pre-tags), rotate it aside
    // so we don't silently drop the new tags/retries columns on append.
    if (fs.existsSync(HISTORY_PATH)) {
      const existingHeader = fs.readFileSync(HISTORY_PATH, 'utf-8').split(/\r?\n/, 1)[0];
      if (existingHeader && existingHeader.trim() !== HISTORY_HEADER) {
        const archive = HISTORY_PATH.replace(/\.csv$/, `.legacy-${Date.now()}.csv`);
        fs.renameSync(HISTORY_PATH, archive);
      }
    }
    if (!fs.existsSync(HISTORY_PATH)) {
      fs.writeFileSync(HISTORY_PATH, HISTORY_HEADER + '\n');
    }
    fs.appendFileSync(HISTORY_PATH, this.rows.join('\n') + '\n');

    const history = readHistory(HISTORY_PATH);
    fs.writeFileSync(DASHBOARD_PATH, renderDashboard(history));
    fs.writeFileSync(SUMMARY_PATH, renderMarkdownSummary(history));

    // eslint-disable-next-line no-console
    console.log(
      `\n[csv-reporter] +${this.rows.length} rows in ${HISTORY_PATH}\n[csv-reporter] dashboard: ${DASHBOARD_PATH}\n[csv-reporter] summary:   ${SUMMARY_PATH}`
    );
  }
}

function parseTestId(title: string): string | undefined {
  const m = title.match(/\[(TC-[A-Z]+-\d+)\]/);
  return m?.[1];
}

function inferArea(file: string): string {
  if (file.includes('/api/')) return 'API';
  if (file.includes('/ui/')) return 'UI';
  return '';
}

function collectTags(test: TestCase): string[] {
  const direct = (test as TestCase & { tags?: string[] }).tags ?? [];
  if (direct.length > 0) return [...direct].sort();
  const fromTitle = (test.title.match(/@[a-zA-Z0-9_-]+/g) ?? []).sort();
  return fromTitle;
}

function inferTypeFromTags(tags: string[]): string {
  if (tags.includes('@security')) return 'Security';
  if (tags.includes('@negative')) return 'Negative';
  if (tags.includes('@boundary')) return 'Boundary';
  if (tags.includes('@load')) return 'Load';
  if (tags.includes('@positive')) return 'Positive';
  return '';
}

function csv(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

function loadCatalog(filePath: string): Map<string, CatalogEntry> {
  const map = new Map<string, CatalogEntry>();
  if (!fs.existsSync(filePath)) return map;

  const rows = parseCsv(fs.readFileSync(filePath, 'utf-8'));
  if (rows.length < 2) return map;

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idxId = header.indexOf('test_id');
  const idxArea = header.indexOf('area');
  const idxPriority = header.indexOf('priority');
  const idxType = header.indexOf('type');
  const idxTitle = header.indexOf('title');
  if (idxId < 0) return map;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = row[idxId]?.trim();
    if (!id) continue;
    map.set(id, {
      area: row[idxArea]?.trim() ?? '',
      priority: row[idxPriority]?.trim() ?? '',
      type: row[idxType]?.trim() ?? '',
      title: row[idxTitle]?.trim() ?? '',
    });
  }
  return map;
}

function readHistory(filePath: string): HistoryRow[] {
  if (!fs.existsSync(filePath)) return [];
  const rows = parseCsv(fs.readFileSync(filePath, 'utf-8'));
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const get = (row: string[], key: string) => row[header.indexOf(key)] ?? '';

  return rows.slice(1).map((row) => ({
    run_id: get(row, 'run_id'),
    run_timestamp: get(row, 'run_timestamp'),
    test_id: get(row, 'test_id'),
    area: get(row, 'area'),
    priority: get(row, 'priority'),
    type: get(row, 'type'),
    title: get(row, 'title'),
    tags: get(row, 'tags'),
    status: get(row, 'status'),
    duration_ms: get(row, 'duration_ms'),
    retries: get(row, 'retries'),
    error_message: get(row, 'error_message'),
  }));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadgeClass(status: string): string {
  if (status === 'passed') return 'pass';
  if (status === 'failed' || status === 'timedOut') return 'fail';
  if (status === 'flaky') return 'flaky';
  return 'skip';
}

interface RunBucket {
  rows: HistoryRow[];
}

interface TagSlice {
  tag: string;
  total: number;
  passed: number;
  failed: number;
  rate: number;
}

function tagSlices(rows: HistoryRow[]): TagSlice[] {
  const map = new Map<string, { passed: number; failed: number }>();
  for (const r of rows) {
    if (!r.tags) continue;
    for (const tag of r.tags.split(/\s+/).filter(Boolean)) {
      if (!map.has(tag)) map.set(tag, { passed: 0, failed: 0 });
      const e = map.get(tag)!;
      if (r.status === 'passed') e.passed += 1;
      else if (r.status === 'failed' || r.status === 'timedOut') e.failed += 1;
    }
  }
  return [...map.entries()]
    .map(([tag, v]) => {
      const total = v.passed + v.failed;
      const rate = total > 0 ? Math.round((v.passed / total) * 100) : 0;
      return { tag, total, passed: v.passed, failed: v.failed, rate };
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

function renderDashboard(history: HistoryRow[]): string {
  const runs = new Map<string, HistoryRow[]>();
  for (const r of history) {
    if (!runs.has(r.run_id)) runs.set(r.run_id, []);
    runs.get(r.run_id)!.push(r);
  }

  const sortedRunIds = [...runs.keys()].sort((a, b) => {
    const ta = runs.get(a)![0].run_timestamp;
    const tb = runs.get(b)![0].run_timestamp;
    return tb.localeCompare(ta);
  });

  const latestRunId = sortedRunIds[0];
  const latestRows = latestRunId ? runs.get(latestRunId)! : [];
  const latestPassed = latestRows.filter((r) => r.status === 'passed').length;
  const latestFailed = latestRows.filter(
    (r) => r.status === 'failed' || r.status === 'timedOut'
  ).length;
  const latestRetried = latestRows.filter((r) => parseInt(r.retries, 10) > 0).length;
  const latestTotal = latestRows.length;
  const latestDurationMs = latestRows.reduce(
    (sum, r) => sum + (parseInt(r.duration_ms, 10) || 0),
    0
  );

  const totalPassed = history.filter((r) => r.status === 'passed').length;
  const overallPassRate = history.length > 0 ? Math.round((totalPassed / history.length) * 100) : 0;

  const testIds = [...new Set(history.map((r) => r.test_id).filter((x) => x))].sort();
  const perTest = testIds.map((id) => {
    const xs = history.filter((r) => r.test_id === id);
    const passed = xs.filter((r) => r.status === 'passed').length;
    const total = xs.length;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const last = xs[xs.length - 1];
    return {
      id,
      title: last.title,
      area: last.area,
      priority: last.priority,
      type: last.type,
      tags: last.tags,
      total,
      passed,
      failed: total - passed,
      rate,
    };
  });

  const recentRuns = sortedRunIds.slice(0, 10).map((id) => {
    const xs = runs.get(id)!;
    const passed = xs.filter((r) => r.status === 'passed').length;
    const failed = xs.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
    const totalDuration = xs.reduce((sum, r) => sum + (parseInt(r.duration_ms, 10) || 0), 0);
    return { ts: xs[0].run_timestamp, total: xs.length, passed, failed, durationMs: totalDuration };
  });

  // Tag slices for the latest run only (most actionable view).
  const latestTagSlices = tagSlices(latestRows);
  const taskTagSlices = latestTagSlices.filter((t) => /^@task\d+$/.test(t.tag));
  const categoryTagSlices = latestTagSlices.filter((t) =>
    ['@positive', '@negative', '@security', '@boundary', '@load'].includes(t.tag)
  );
  const otherTagSlices = latestTagSlices.filter(
    (t) => !taskTagSlices.includes(t) && !categoryTagSlices.includes(t)
  );

  // Top slow tests (latest run).
  const slowest = [...latestRows]
    .map((r) => ({ ...r, ms: parseInt(r.duration_ms, 10) || 0 }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 8);

  // Failures from the latest run.
  const failures = latestRows.filter(
    (r) => r.status === 'failed' || r.status === 'timedOut'
  );

  // Documented vulns (titles starting with "DOCUMENTED VULN").
  const documentedVulns = latestRows.filter((r) => /^DOCUMENTED VULN/i.test(r.title));

  const latestRowsHtml = latestRows
    .sort((a, b) => a.test_id.localeCompare(b.test_id))
    .map(
      (r) => `<tr>
      <td><code>${escapeHtml(r.test_id)}</code></td>
      <td>${escapeHtml(r.area)}</td>
      <td>${escapeHtml(r.type)}</td>
      <td>${renderTags(r.tags)}</td>
      <td>${escapeHtml(r.title)}</td>
      <td><span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>${parseInt(r.retries, 10) > 0 ? ` <span class="retries">↻${escapeHtml(r.retries)}</span>` : ''}</td>
      <td class="num">${escapeHtml(r.duration_ms)} ms</td>
      <td class="err">${escapeHtml(r.error_message)}</td>
    </tr>`
    )
    .join('');

  const perTestHtml = perTest
    .map(
      (t) => `<tr>
      <td><code>${escapeHtml(t.id)}</code></td>
      <td>${escapeHtml(t.area)}</td>
      <td>${escapeHtml(t.type)}</td>
      <td>${renderTags(t.tags)}</td>
      <td>${escapeHtml(t.title)}</td>
      <td class="num">${t.total}</td>
      <td class="num"><span class="pass">${t.passed}</span> / <span class="${t.failed > 0 ? 'fail' : ''}">${t.failed}</span></td>
      <td><div class="bar"><span style="width:${t.rate}%"></span></div> <span class="rate">${t.rate}%</span></td>
    </tr>`
    )
    .join('');

  const recentHtml = recentRuns
    .map(
      (r) => `<tr>
      <td>${escapeHtml(r.ts)}</td>
      <td class="num">${r.total}</td>
      <td class="num pass">${r.passed}</td>
      <td class="num ${r.failed > 0 ? 'fail' : ''}">${r.failed}</td>
      <td class="num">${(r.durationMs / 1000).toFixed(1)} s</td>
    </tr>`
    )
    .join('');

  const tagCard = (slice: TagSlice): string => `<div class="tag-card">
    <div class="tag-card-head"><code class="tag">${escapeHtml(slice.tag)}</code><span class="tag-rate ${slice.failed > 0 ? 'fail' : 'pass'}">${slice.rate}%</span></div>
    <div class="bar"><span style="width:${slice.rate}%"></span></div>
    <div class="tag-card-foot">${slice.passed}/${slice.total} passed${slice.failed > 0 ? `, <span class="fail">${slice.failed} failed</span>` : ''}</div>
  </div>`;

  const slowestHtml = slowest.length === 0 ? '<tr><td colspan="3" class="muted">No data.</td></tr>' :
    slowest.map(
      (s) => `<tr>
      <td><code>${escapeHtml(s.test_id)}</code></td>
      <td>${escapeHtml(s.title)}</td>
      <td class="num">${s.ms} ms</td>
    </tr>`
    ).join('');

  const failuresHtml = failures.length === 0
    ? '<tr><td colspan="3" class="muted">All tests in the latest run passed. ✨</td></tr>'
    : failures
        .map(
          (f) => `<tr>
      <td><code>${escapeHtml(f.test_id)}</code></td>
      <td>${escapeHtml(f.title)}</td>
      <td class="err">${escapeHtml(f.error_message)}</td>
    </tr>`
        )
        .join('');

  const documentedVulnsHtml = documentedVulns.length === 0
    ? ''
    : `<section>
        <h2>Documented Juice Shop vulnerabilities (asserted as actual behavior)</h2>
        <p class="muted">These tests pass because they encode the <em>vulnerable</em> production behavior. A hardened build should flip the assertion.</p>
        <table>
          <thead><tr><th>Test ID</th><th>Title</th><th>Tags</th><th>Status</th></tr></thead>
          <tbody>${documentedVulns
            .map(
              (v) => `<tr>
              <td><code>${escapeHtml(v.test_id)}</code></td>
              <td>${escapeHtml(v.title)}</td>
              <td>${renderTags(v.tags)}</td>
              <td><span class="badge ${statusBadgeClass(v.status)}">${escapeHtml(v.status)}</span></td>
            </tr>`
            )
            .join('')}</tbody>
        </table>
      </section>`;

  const generatedAt = new Date().toISOString();
  const pageTitle = 'Juice Shop QA Dashboard';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pageTitle}</title>
<style>
  :root {
    --bg: #f8fafc;
    --surface: #ffffff;
    --border: #e2e8f0;
    --text: #0f172a;
    --muted: #64748b;
    --pass: #16a34a;
    --pass-bg: #dcfce7;
    --fail: #dc2626;
    --fail-bg: #fee2e2;
    --skip: #ca8a04;
    --skip-bg: #fef3c7;
    --flaky: #c2410c;
    --flaky-bg: #ffedd5;
    --accent: #2563eb;
    --tag-bg: #eef2ff;
    --tag-fg: #3730a3;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    margin: 0;
    padding: 32px 24px 64px;
    line-height: 1.5;
  }
  .container { max-width: 1280px; margin: 0 auto; }
  header { margin-bottom: 24px; }
  h1 { margin: 0 0 6px; font-size: 24px; }
  header p { margin: 0; color: var(--muted); font-size: 14px; }
  header p a { color: var(--accent); text-decoration: none; }
  header p a:hover { text-decoration: underline; }

  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin: 24px 0 24px;
  }
  .stat {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
  }
  .stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; }
  .stat .value { font-size: 28px; font-weight: 600; margin-top: 4px; }
  .stat .sub { font-size: 13px; color: var(--muted); margin-top: 2px; }

  section { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; margin-bottom: 20px; overflow-x: auto; }
  section h2 { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
  section h3 { margin: 18px 0 10px; font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); font-size: 13px; }

  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { padding: 9px 10px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 600; background: #f8fafc; }
  tr:last-child td { border-bottom: none; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.err { color: #991b1b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; max-width: 360px; word-break: break-word; }
  td code, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }

  .badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  .badge.pass { background: var(--pass-bg); color: #166534; }
  .badge.fail { background: var(--fail-bg); color: #991b1b; }
  .badge.skip { background: var(--skip-bg); color: #854d0e; }
  .badge.flaky { background: var(--flaky-bg); color: #9a3412; }
  .retries { font-size: 11px; color: var(--flaky); font-weight: 600; }

  .pass { color: var(--pass); font-weight: 600; }
  .fail { color: var(--fail); font-weight: 600; }

  .bar { display: inline-block; width: 110px; height: 7px; background: var(--border); border-radius: 999px; overflow: hidden; vertical-align: middle; }
  .bar > span { display: block; height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); }
  .rate { font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--muted); margin-left: 6px; vertical-align: middle; }

  .tag { display: inline-block; padding: 2px 7px; border-radius: 6px; background: var(--tag-bg); color: var(--tag-fg); font-size: 11.5px; font-weight: 600; margin-right: 4px; }

  .tag-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .tag-card { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
  .tag-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .tag-card .bar { width: 100%; }
  .tag-card-foot { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .tag-rate { font-variant-numeric: tabular-nums; font-size: 13px; }
</style>
</head>
<body>
<div class="container">
<header>
  <h1>${pageTitle}</h1>
  <p>Generated ${escapeHtml(generatedAt)} · <a href="../playwright-report/index.html">Open Playwright HTML report</a> (traces, screenshots, videos) · <a href="summary.md">Markdown summary</a></p>
</header>

<div class="summary">
  <div class="stat">
    <div class="label">Latest run</div>
    <div class="value">${latestPassed}/${latestTotal}</div>
    <div class="sub">${latestFailed > 0 ? `<span class="fail">${latestFailed} failed</span>` : 'all passing'}${latestRetried > 0 ? ` · ${latestRetried} retried` : ''}</div>
  </div>
  <div class="stat">
    <div class="label">Latest run timestamp</div>
    <div class="value" style="font-size:14px; font-family: ui-monospace, monospace;">${escapeHtml(latestRows[0]?.run_timestamp ?? '—')}</div>
    <div class="sub">${(latestDurationMs / 1000).toFixed(1)}s wall time</div>
  </div>
  <div class="stat">
    <div class="label">Overall pass rate</div>
    <div class="value pass">${overallPassRate}%</div>
    <div class="sub">${totalPassed}/${history.length} across all runs</div>
  </div>
  <div class="stat">
    <div class="label">Coverage</div>
    <div class="value">${testIds.length}</div>
    <div class="sub">${runs.size} runs tracked</div>
  </div>
</div>

${taskTagSlices.length > 0 ? `<section>
  <h2>Assignment tasks (latest run)</h2>
  <div class="tag-grid">${taskTagSlices.map(tagCard).join('')}</div>
</section>` : ''}

${categoryTagSlices.length > 0 ? `<section>
  <h2>Coverage by category (latest run)</h2>
  <div class="tag-grid">${categoryTagSlices.map(tagCard).join('')}</div>
</section>` : ''}

${otherTagSlices.length > 0 ? `<section>
  <h2>Other tags (latest run)</h2>
  <div class="tag-grid">${otherTagSlices.map(tagCard).join('')}</div>
</section>` : ''}

<section>
  <h2>Failures in the latest run</h2>
  <table>
    <thead><tr><th>Test ID</th><th>Title</th><th>Error</th></tr></thead>
    <tbody>${failuresHtml}</tbody>
  </table>
</section>

${documentedVulnsHtml}

<section>
  <h2>Slowest 8 tests in the latest run</h2>
  <table>
    <thead><tr><th>Test ID</th><th>Title</th><th>Duration</th></tr></thead>
    <tbody>${slowestHtml}</tbody>
  </table>
</section>

<section>
  <h2>Latest run · all tests</h2>
  <table>
    <thead><tr><th>Test ID</th><th>Area</th><th>Type</th><th>Tags</th><th>Title</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead>
    <tbody>${latestRowsHtml}</tbody>
  </table>
</section>

<section>
  <h2>Per-test pass rate (across all runs)</h2>
  <table>
    <thead><tr><th>Test ID</th><th>Area</th><th>Type</th><th>Tags</th><th>Title</th><th>Runs</th><th>Pass / Fail</th><th>Pass rate</th></tr></thead>
    <tbody>${perTestHtml}</tbody>
  </table>
</section>

<section>
  <h2>Recent runs</h2>
  <table>
    <thead><tr><th>Timestamp</th><th>Total</th><th>Passed</th><th>Failed</th><th>Duration</th></tr></thead>
    <tbody>${recentHtml}</tbody>
  </table>
</section>

</div>
</body>
</html>
`;
}

function renderTags(tagsRaw: string): string {
  if (!tagsRaw) return '';
  return tagsRaw
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `<code class="tag">${escapeHtml(t)}</code>`)
    .join(' ');
}

function renderMarkdownSummary(history: HistoryRow[]): string {
  const runs = new Map<string, HistoryRow[]>();
  for (const r of history) {
    if (!runs.has(r.run_id)) runs.set(r.run_id, []);
    runs.get(r.run_id)!.push(r);
  }

  const sortedRunIds = [...runs.keys()].sort((a, b) => {
    const ta = runs.get(a)![0].run_timestamp;
    const tb = runs.get(b)![0].run_timestamp;
    return tb.localeCompare(ta);
  });
  const latest = sortedRunIds[0] ? runs.get(sortedRunIds[0])! : [];
  const passed = latest.filter((r) => r.status === 'passed').length;
  const failed = latest.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
  const retried = latest.filter((r) => parseInt(r.retries, 10) > 0).length;
  const total = latest.length;
  const wallSec = (latest.reduce((s, r) => s + (parseInt(r.duration_ms, 10) || 0), 0) / 1000).toFixed(1);

  const slices = tagSlices(latest);
  const tagLines = slices
    .map((s) => `- \`${s.tag}\` — ${s.passed}/${s.total} (${s.rate}%)${s.failed > 0 ? ` · **${s.failed} failed**` : ''}`)
    .join('\n');

  const failureLines = latest
    .filter((r) => r.status === 'failed' || r.status === 'timedOut')
    .map((r) => `- \`${r.test_id}\` — ${r.title}\n  - ${r.error_message}`)
    .join('\n');

  const ts = latest[0]?.run_timestamp ?? new Date().toISOString();

  return `# Juice Shop QA — Run Summary

_Run at ${ts}_

## Latest run
- **${passed}/${total} passed** (${total > 0 ? Math.round((passed / total) * 100) : 0}% pass rate)
- **${failed} failed**${retried > 0 ? `, ${retried} retried` : ''}
- Wall time: ${wallSec}s

## Coverage by tag

${tagLines || '_No tagged tests._'}

## Failures

${failureLines || '_None._'}

---
_Open \`reports/dashboard.html\` for the full interactive dashboard._
`;
}
