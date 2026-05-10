import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  TestError,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Rich self-contained HTML reporter for the Juice Shop assignment.
 *
 * Reads the rich per-test data Playwright already produces (steps, errors,
 * attachments, stdout, stderr, retries) plus the historical run-history.csv
 * trend data, and emits a single `reports/test-report.html` file with:
 *
 *   - Search bar (live filter on title / id / tag / file)
 *   - Filter chips (status, area UI/API, category, smoke/regression/e2e)
 *   - Stat cards (total, passed, failed, flaky, pass rate, total duration)
 *   - Per-test detail panel (status, plain-English description, tags,
 *     duration, error + stack, steps tree, attachments, API call dumps)
 *   - Pass-rate trend chart (per run)
 *   - Tag breakdown bar chart (pass / fail / total per tag)
 *   - Print-friendly styling, mobile-responsive layout
 *
 * Designed so a non-technical reader can scan it for the headline numbers
 * and so an engineer can drill into any failure without leaving the page.
 *
 * The companion CSV reporter (`csv-reporter.ts`) keeps writing
 * `reports/run-history.csv` so trend data accumulates across runs. This
 * reporter consumes that file but does not modify it.
 */

interface AttachmentRecord {
  name: string;
  contentType: string;
  /** Base64 of inline body, or null if the attachment is on disk. */
  bodyBase64: string | null;
  /** Path to attachment on disk, if any. */
  path: string | null;
  /** Decoded UTF-8 string for textual attachments (small ones only). */
  text: string | null;
}

interface StepRecord {
  title: string;
  durationMs: number;
  category: string;
  error: string | null;
  steps: StepRecord[];
}

interface TestRecord {
  id: string;
  title: string;
  cleanTitle: string;
  file: string;
  line: number;
  area: 'UI' | 'API' | 'OTHER';
  category: string;
  tags: string[];
  status: TestResult['status'];
  durationMs: number;
  retries: number;
  startedAt: string;
  error: { message: string; stack: string } | null;
  steps: StepRecord[];
  attachments: AttachmentRecord[];
  stdout: string;
  stderr: string;
  /** All `api-call:*` attachments parsed back into structured form. */
  apiCalls: ApiCallRecord[];
}

interface ApiCallRecord {
  method: string;
  url: string;
  durationMs: number;
  request: {
    headers: Record<string, string>;
    params: unknown;
    body: unknown;
  };
  response: {
    status: number;
    ok: boolean;
    headers: Record<string, string>;
    body: unknown;
  };
}

interface RunSummary {
  runId: string;
  startedAt: string;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
}

const REPORT_PATH = path.join('reports', 'test-report.html');
const RUN_JSON_PATH = path.join('reports', 'last-run.json');
const HISTORY_PATH = path.join('reports', 'run-history.csv');

export default class RichHtmlReporter implements Reporter {
  private records: TestRecord[] = [];
  private runId = '';
  private startedAt = '';

  onBegin(): void {
    this.startedAt = new Date().toISOString();
    this.runId = this.startedAt.replace(/[:.]/g, '-');
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const cleanTitle = test.title.replace(/^\[TC-[A-Z]+-\d+\]\s*/, '');
    const idMatch = test.title.match(/\[(TC-[A-Z]+-\d+)\]/);
    const file = test.location?.file ?? '';
    const area = inferArea(file);
    const tags = collectTags(test);
    const category = inferCategory(tags);

    const apiCalls: ApiCallRecord[] = [];
    const attachments: AttachmentRecord[] = [];
    for (const a of result.attachments) {
      const text =
        a.body && a.contentType.startsWith('application/json')
          ? safeUtf8(a.body)
          : a.body && a.contentType.startsWith('text/')
            ? safeUtf8(a.body)
            : null;
      attachments.push({
        name: a.name,
        contentType: a.contentType,
        bodyBase64: a.body ? a.body.toString('base64') : null,
        path: a.path ?? null,
        text,
      });
      if (a.name.startsWith('api-call:') && text) {
        try {
          apiCalls.push(JSON.parse(text) as ApiCallRecord);
        } catch {
          /* malformed; surfaced as raw attachment */
        }
      }
    }

    this.records.push({
      id: idMatch?.[1] ?? '',
      title: test.title,
      cleanTitle,
      file: path.relative(process.cwd(), file),
      line: test.location?.line ?? 0,
      area,
      category,
      tags,
      status: result.status,
      durationMs: result.duration,
      retries: result.retry,
      startedAt: result.startTime.toISOString(),
      error: result.error
        ? {
            message: stripAnsi(result.error.message ?? ''),
            stack: stripAnsi(result.error.stack ?? ''),
          }
        : null,
      steps: convertSteps(result.steps),
      attachments,
      stdout: bufferArrayToString(result.stdout),
      stderr: bufferArrayToString(result.stderr),
      apiCalls,
    });
  }

  onEnd(): void {
    if (this.records.length === 0) return;

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });

    const summary: RunSummary = {
      runId: this.runId,
      startedAt: this.startedAt,
      total: this.records.length,
      passed: this.records.filter((r) => r.status === 'passed').length,
      failed: this.records.filter((r) => r.status === 'failed' || r.status === 'timedOut').length,
      flaky: this.records.filter((r) => r.retries > 0 && r.status === 'passed').length,
      skipped: this.records.filter((r) => r.status === 'skipped').length,
      durationMs: this.records.reduce((s, r) => s + r.durationMs, 0),
    };

    const history = readHistoryTrend(HISTORY_PATH);

    fs.writeFileSync(
      RUN_JSON_PATH,
      JSON.stringify({ summary, records: this.records, history }, null, 2)
    );
    fs.writeFileSync(REPORT_PATH, renderHtml(summary, this.records, history));

    // eslint-disable-next-line no-console
    console.log(`\n[rich-reporter] open ${REPORT_PATH}`);
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function inferArea(file: string): 'UI' | 'API' | 'OTHER' {
  if (file.includes('/api/')) return 'API';
  if (file.includes('/ui/')) return 'UI';
  return 'OTHER';
}

// Only accept @-tags whose body is a clean identifier. Playwright's built-in
// title scanner uses `@\S+`, which mistakenly turns email addresses inside a
// title (e.g. UPPER@x.test) into "tags" like @x.test and @x.test) — they end
// up polluting the tag-coverage panel. Whitelisting the body to [\w-]+ drops
// those without affecting any real tag we set via `{ tag: [...] }`.
const TAG_BODY = /^@[\w-]+$/;

function collectTags(test: TestCase): string[] {
  const direct = (test as TestCase & { tags?: string[] }).tags ?? [];
  const fromTitle = direct.length > 0 ? [] : (test.title.match(/@[\w-]+/g) ?? []);
  const merged = [...new Set([...direct, ...fromTitle])];
  return merged.filter((t) => TAG_BODY.test(t)).sort();
}

function inferCategory(tags: string[]): string {
  if (tags.includes('@security')) return 'Security';
  if (tags.includes('@load')) return 'Load';
  if (tags.includes('@boundary')) return 'Boundary';
  if (tags.includes('@negative')) return 'Negative';
  if (tags.includes('@nonfunctional')) return 'Non-functional';
  if (tags.includes('@positive')) return 'Positive';
  if (tags.includes('@functional')) return 'Functional';
  return 'Other';
}

function convertSteps(steps: TestStep[] | undefined): StepRecord[] {
  if (!steps) return [];
  return steps
    .filter((s) => s.category !== 'hook' || s.title.toLowerCase().includes('beforeeach'))
    .map((s) => ({
      title: stripAnsi(s.title),
      durationMs: s.duration,
      category: s.category,
      error: s.error ? stripAnsi(formatError(s.error)) : null,
      steps: convertSteps(s.steps),
    }));
}

function formatError(err: TestError): string {
  return err.message ?? String(err);
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, '');
}

function safeUtf8(buf: Buffer): string | null {
  try {
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

function bufferArrayToString(arr: (string | Buffer)[] | undefined): string {
  if (!arr) return '';
  return arr
    .map((c) => (typeof c === 'string' ? c : c.toString('utf-8')))
    .join('')
    .slice(0, 8_000);
}

interface HistoryRunPoint {
  runId: string;
  startedAt: string;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
}

function readHistoryTrend(filePath: string): HistoryRunPoint[] {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
  const idxRunId = header.indexOf('run_id');
  const idxRunTs = header.indexOf('run_timestamp');
  const idxStatus = header.indexOf('status');
  const idxRetries = header.indexOf('retries');
  if (idxRunId < 0 || idxStatus < 0) return [];

  const runs = new Map<string, HistoryRunPoint>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    const runId = cols[idxRunId];
    if (!runId) continue;
    if (!runs.has(runId)) {
      runs.set(runId, {
        runId,
        startedAt: cols[idxRunTs] ?? '',
        total: 0,
        passed: 0,
        failed: 0,
        flaky: 0,
      });
    }
    const r = runs.get(runId)!;
    r.total += 1;
    const status = cols[idxStatus];
    if (status === 'passed') {
      r.passed += 1;
      if (parseInt(cols[idxRetries] ?? '0', 10) > 0) r.flaky += 1;
    } else if (status === 'failed' || status === 'timedOut') {
      r.failed += 1;
    }
  }
  return [...runs.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
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
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

// ---------------------------------------------------------------------------
// HTML renderer
// ---------------------------------------------------------------------------

function renderHtml(
  summary: RunSummary,
  records: TestRecord[],
  history: HistoryRunPoint[]
): string {
  const data = JSON.stringify({ summary, records, history }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Juice Shop QA — Test Report (${summary.runId})</title>
<style>${STYLE}</style>
</head>
<body>
<div id="app"></div>
<script>window.__REPORT__ = ${data};</script>
<script>${SCRIPT}</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// inline CSS / JS (kept as template strings so the reporter is self-contained)
// ---------------------------------------------------------------------------

const STYLE = `
:root {
  --bg: #0f172a;
  --panel: #ffffff;
  --panel-soft: #f8fafc;
  --border: #e2e8f0;
  --ink: #0f172a;
  --ink-soft: #475569;
  --ink-faint: #94a3b8;
  --accent: #2563eb;
  --accent-soft: #dbeafe;
  --pass: #10b981;
  --pass-soft: #d1fae5;
  --fail: #ef4444;
  --fail-soft: #fee2e2;
  --flaky: #f59e0b;
  --flaky-soft: #fef3c7;
  --skip: #94a3b8;
  --skip-soft: #f1f5f9;
  --shadow: 0 1px 2px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.06);
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.45; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
button { font: inherit; cursor: pointer; }
code, pre { font-family: var(--mono); font-size: 12px; }
pre { white-space: pre-wrap; word-break: break-word; margin: 0; }

/* layout */
.shell { max-width: 1400px; margin: 0 auto; padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.header h1 { margin: 0 0 4px; font-size: 22px; }
.header .sub { color: var(--ink-soft); font-size: 13px; }
.header .meta { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.tag-pill { background: var(--panel); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 600; color: var(--ink-soft); }

/* stat cards */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); }
.stat-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint); font-weight: 600; }
.stat-card .value { font-size: 28px; font-weight: 700; color: var(--ink); margin-top: 4px; line-height: 1; }
.stat-card .delta { font-size: 12px; color: var(--ink-soft); margin-top: 6px; }
.stat-card.pass .value { color: var(--pass); }
.stat-card.fail .value { color: var(--fail); }
.stat-card.flaky .value { color: var(--flaky); }

/* search + filters */
.controls { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); margin-bottom: 16px; position: sticky; top: 8px; z-index: 5; backdrop-filter: saturate(140%) blur(6px); }
.search-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.search-input { flex: 1 1 280px; min-width: 240px; padding: 9px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; background: var(--panel-soft); }
.search-input:focus { outline: 2px solid var(--accent); outline-offset: 0; border-color: var(--accent); }
.chip-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
.chip-row .group-label { font-size: 11px; font-weight: 700; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.06em; align-self: center; margin-right: 4px; }
.chip { background: var(--panel-soft); border: 1px solid var(--border); border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: pointer; user-select: none; transition: all 0.12s; }
.chip:hover { background: var(--accent-soft); border-color: var(--accent); }
.chip.active { background: var(--accent); border-color: var(--accent); color: white; }
.chip.active:hover { background: var(--accent); opacity: 0.9; }
.chip .count { opacity: 0.6; margin-left: 4px; font-size: 10px; }

/* charts (stacked: trend on top, coverage + findings below — all full width) */
.chart-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.chart-panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); display: flex; flex-direction: column; }
.chart-panel.trend .spark { height: 110px; }
.chart-panel.tag-coverage .tagbar-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 14px 24px; }
@media (max-width: 720px) { .chart-panel.tag-coverage .tagbar-groups { grid-template-columns: 1fr; } }

/* intro / "what is this report" panel */
.intro { position: relative; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #7dd3fc; border-radius: 12px; padding: 14px 18px 14px 16px; margin-bottom: 16px; }
.intro-title { font-weight: 700; font-size: 13px; color: #075985; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
.intro-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 16px; }
.intro-card { background: rgba(255,255,255,0.6); border: 1px solid rgba(125,211,252,0.4); border-radius: 8px; padding: 10px 12px; }
.intro-h { font-weight: 600; font-size: 12.5px; color: #0c4a6e; margin-bottom: 4px; }
.intro-p { font-size: 12px; color: #155e75; line-height: 1.5; }
.intro-p em { font-style: italic; color: #075985; }
.intro-close { position: absolute; top: 8px; right: 10px; background: transparent; border: none; cursor: pointer; font-size: 18px; line-height: 1; color: #0369a1; padding: 2px 8px; border-radius: 4px; }
.intro-close:hover { background: rgba(255,255,255,0.6); color: #0c4a6e; }
.intro-reopen { display: inline-block; background: var(--panel-soft); border: 1px solid var(--border); border-radius: 999px; font-size: 11px; padding: 4px 12px; margin-bottom: 12px; color: var(--ink-soft); cursor: pointer; }
.intro-reopen:hover { background: #f0f9ff; border-color: #7dd3fc; color: #0369a1; }

/* known-issues panel */
.chart-panel.findings .findings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 6px 16px; margin-top: 8px; }
.finding-row { display: grid; grid-template-columns: 90px 90px 110px 1fr; gap: 8px; align-items: center; padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel-soft); cursor: pointer; transition: background 0.1s, transform 0.1s; }
.finding-row:hover { background: var(--accent-soft); transform: translateX(2px); }
.finding-id { font-family: var(--mono); font-size: 11px; color: var(--ink-soft); }
.finding-title { font-size: 12.5px; color: var(--ink); }
.kind { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.02em; text-align: center; }
.kind-vuln { background: #fee2e2; color: #991b1b; }
.kind-ux   { background: #e0e7ff; color: #3730a3; }

.sev-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; }
.sev-critical { background: #fef2f2; color: #7f1d1d; border: 1px solid #fca5a5; }
.sev-high     { background: #fff7ed; color: #9a3412; border: 1px solid #fdba74; }
.sev-medium   { background: #fefce8; color: #854d0e; border: 1px solid #fde68a; }
.sev-low      { background: #f0f9ff; color: #075985; border: 1px solid #bae6fd; }
.finding-row.sev-critical { border-left: 3px solid #dc2626; }
.finding-row.sev-high     { border-left: 3px solid #ea580c; }
.finding-row.sev-medium   { border-left: 3px solid #ca8a04; }
.finding-row.sev-low      { border-left: 3px solid #0284c7; }
.chart-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.chart-panel h3 { margin: 0; font-size: 14px; }
.chart-panel h3 .subtle { color: var(--ink-faint); font-weight: 500; font-size: 12px; }
.kpi-line { display: flex; align-items: baseline; gap: 6px; }
.kpi-num { font-size: 20px; font-weight: 700; }
.kpi-num.green { color: var(--pass); }
.kpi-num.lime { color: #65a30d; }
.kpi-num.amber { color: var(--flaky); }
.kpi-num.red { color: var(--fail); }
.kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-faint); font-weight: 600; }

/* legacy tag-bar (kept for the trend chart's tag fallback) */
.tag-bar { display: grid; grid-template-columns: 140px 1fr 60px; gap: 8px; align-items: center; padding: 4px 0; font-size: 12px; }
.tag-bar .label { color: var(--ink-soft); font-family: var(--mono); font-size: 11px; }
.tag-bar .track { background: var(--border); height: 14px; border-radius: 4px; overflow: hidden; display: flex; }
.tag-bar .track .pass { background: var(--pass); height: 100%; }
.tag-bar .track .fail { background: var(--fail); height: 100%; }
.tag-bar .ratio { font-weight: 600; color: var(--ink-soft); text-align: right; font-size: 11px; }

/* upgraded tag coverage panel */
.tagbar-groups { display: flex; flex-direction: column; gap: 14px; }
.tagbar-group { display: flex; flex-direction: column; gap: 4px; }
.tagbar-group-head { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.tagbar-group-head .icn { font-size: 14px; }
.tagbar-group-head .ttl { flex: 1; }
.tagbar-group-head .sub { font-weight: 500; opacity: 0.7; text-transform: none; letter-spacing: 0; }
.tagbar-group-head.accent-amber  { background: linear-gradient(90deg, #fef3c7, #fef3c7aa); color: #92400e; }
.tagbar-group-head.accent-blue   { background: linear-gradient(90deg, #dbeafe, #dbeafeaa); color: #1e40af; }
.tagbar-group-head.accent-purple { background: linear-gradient(90deg, #ede9fe, #ede9feaa); color: #6d28d9; }
.tagbar-group-head.accent-gray   { background: linear-gradient(90deg, #f1f5f9, #f1f5f9aa); color: var(--ink-soft); }

.tagbar-row { display: grid; grid-template-columns: 140px 1fr 110px; gap: 10px; align-items: center; padding: 4px 6px; border-radius: 5px; cursor: pointer; transition: background 0.1s; }
.tagbar-row:hover { background: var(--panel-soft); }
.tagbar-row.active { background: var(--accent-soft); outline: 1px solid var(--accent); }
.tagbar-label { color: var(--ink); font-family: var(--mono); font-size: 11px; font-weight: 600; }
.tagbar-track { background: var(--panel-soft); height: 12px; border-radius: 6px; overflow: hidden; display: flex; border: 1px solid var(--border); }
.tagbar-track .tb-pass { background: linear-gradient(to right, #34d399, var(--pass)); height: 100%; }
.tagbar-track .tb-fail { background: linear-gradient(to right, #f87171, var(--fail)); height: 100%; }
.tagbar-stat { display: flex; align-items: baseline; gap: 6px; justify-content: flex-end; font-variant-numeric: tabular-nums; }
.tagbar-stat .pct { font-weight: 700; font-size: 12px; }
.tagbar-stat .pct.green { color: var(--pass); }
.tagbar-stat .pct.lime  { color: #65a30d; }
.tagbar-stat .pct.amber { color: var(--flaky); }
.tagbar-stat .pct.red   { color: var(--fail); }
.tagbar-stat .count { font-size: 10px; color: var(--ink-faint); font-family: var(--mono); }
.tagbar-hint { margin-top: 12px; padding: 8px 10px; background: var(--panel-soft); border-radius: 6px; font-size: 11px; color: var(--ink-soft); }

.spark-chart { position: relative; padding: 0 0 0 36px; }
.spark-chart .y-axis { position: absolute; left: 0; top: 0; bottom: 0; width: 32px; display: flex; flex-direction: column; justify-content: space-between; padding: 0 4px 14px 0; font-size: 10px; color: var(--ink-faint); text-align: right; }
.spark-chart .spark-grid { position: absolute; left: 36px; right: 0; top: 0; bottom: 14px; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
.spark-chart .gridline { border-top: 1px dashed var(--border); height: 0; }
.spark-chart .gridline:first-child { border-top-style: solid; border-color: var(--ink-faint); opacity: 0.4; }
.spark-chart .gridline:last-child { border-top-style: solid; border-color: var(--ink-faint); opacity: 0.4; }
.spark { display: flex; align-items: flex-end; gap: 3px; position: relative; }
.spark-bar { flex: 1; min-width: 6px; border-radius: 3px 3px 0 0; cursor: pointer; transition: opacity 0.12s, transform 0.12s; opacity: 0.85; }
.spark-bar:hover { opacity: 1; transform: translateY(-1px); }
.spark-bar.green { background: linear-gradient(to top, var(--pass), #34d399); }
.spark-bar.lime { background: linear-gradient(to top, #65a30d, #84cc16); }
.spark-bar.amber { background: linear-gradient(to top, var(--flaky), #fbbf24); }
.spark-bar.red { background: linear-gradient(to top, var(--fail), #f87171); }
.spark-tooltip { position: absolute; background: var(--ink); color: white; padding: 8px 10px; border-radius: 6px; font-size: 11px; pointer-events: none; white-space: nowrap; opacity: 0; transition: opacity 0.12s; transform: translateX(-50%); z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.spark-tooltip.visible { opacity: 1; }
.spark-tooltip .tt-pct { font-weight: 700; font-size: 14px; }
.spark-tooltip .tt-pf { color: #cbd5e1; margin-top: 2px; }
.spark-tooltip .tt-when { color: #94a3b8; margin-top: 2px; font-family: var(--mono); font-size: 10px; }
.spark-tooltip::after { content: ''; position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); border: 4px solid transparent; border-top-color: var(--ink); }
.spark-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--ink-faint); margin-top: 6px; padding-left: 36px; }
.spark-axis .subtle { color: var(--ink-faint); font-style: italic; }

/* tabs */
.tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--border); margin-bottom: 0; }
.tab { padding: 10px 16px; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--ink-soft); border-bottom: 2px solid transparent; margin-bottom: -2px; user-select: none; }
.tab:hover { color: var(--ink); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab .count { color: var(--ink-faint); margin-left: 6px; font-weight: 500; }

/* test list */
.test-list { background: var(--panel); border: 1px solid var(--border); border-top: none; border-radius: 0 0 12px 12px; box-shadow: var(--shadow); overflow: hidden; }
.list-empty { padding: 40px; text-align: center; color: var(--ink-soft); }
.test-group { border-bottom: 1px solid var(--border); }
.test-group:last-child { border-bottom: none; }
.group-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--panel-soft); cursor: pointer; user-select: none; font-weight: 600; font-size: 13px; transition: background 0.12s; border-left: 4px solid transparent; }
.group-header:hover { background: #f1f5f9; }
.group-header .group-name { display: flex; align-items: center; gap: 8px; }
.group-header .group-name .caret { color: var(--ink-faint); transition: transform 0.18s; }
.group-header.collapsed .caret { transform: rotate(-90deg); }
.group-header .group-summary { color: var(--ink-soft); font-weight: 500; font-size: 12px; }
.group-header.group-ui  { border-left-color: #2563eb; background: linear-gradient(90deg, #eff6ff 0%, var(--panel-soft) 60%); }
.group-header.group-api { border-left-color: #7c3aed; background: linear-gradient(90deg, #f5f3ff 0%, var(--panel-soft) 60%); }
.test-row { display: grid; grid-template-columns: 100px 1fr auto auto; gap: 12px; align-items: center; padding: 10px 16px; border-top: 1px solid var(--border); cursor: pointer; transition: background 0.08s, padding-left 0.12s; }
.test-row:hover { background: var(--panel-soft); padding-left: 22px; }
.test-row.expanded { background: var(--accent-soft); border-left: 3px solid var(--accent); padding-left: 13px; }
.test-row.expanded:hover { padding-left: 19px; }
.test-row .id { font-family: var(--mono); font-size: 11px; color: var(--ink-soft); }
.test-row .title { font-size: 13px; color: var(--ink); }
.test-row .title .tags { display: inline-flex; gap: 4px; margin-left: 8px; }
.test-row .title .tag { font-size: 10px; background: var(--panel-soft); border: 1px solid var(--border); padding: 1px 6px; border-radius: 999px; color: var(--ink-soft); }
.test-row .duration { font-size: 11px; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.status-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; }
.status-badge.passed { background: var(--pass-soft); color: #065f46; }
.status-badge.failed, .status-badge.timedOut { background: var(--fail-soft); color: #991b1b; }
.status-badge.skipped { background: var(--skip-soft); color: var(--ink-soft); }
.status-badge.flaky { background: var(--flaky-soft); color: #92400e; }

/* detail panel (expanded inline) */
.detail { padding: 0 16px 16px 16px; background: var(--panel-soft); border-top: 1px solid var(--border); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding-top: 16px; }
@media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr; } }
.detail h4 { margin: 0 0 8px; font-size: 12px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.06em; }
.detail .summary-line { color: var(--ink); font-size: 13px; padding: 8px 12px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; }
.error-panel { background: var(--fail-soft); border: 1px solid var(--fail); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
.error-panel .msg { font-weight: 600; color: #991b1b; margin-bottom: 6px; font-size: 13px; }
.error-panel pre { font-size: 11px; color: #7f1d1d; max-height: 240px; overflow: auto; }
.steps-panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 0; max-height: 360px; overflow: auto; }
.step { display: flex; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--border); font-size: 12px; }
.step:last-child { border-bottom: none; }
.step.has-error { background: var(--fail-soft); }
.step .tt { color: var(--ink); flex: 1; font-family: var(--mono); }
.step .dt { color: var(--ink-faint); font-size: 11px; }
.step .cat { color: var(--ink-faint); font-size: 10px; text-transform: uppercase; padding-right: 8px; }
.step.nested { padding-left: 24px; background: var(--panel-soft); }
.step.nested.nested { padding-left: 36px; }

.api-call { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
.api-call .head { display: flex; gap: 8px; padding: 8px 12px; align-items: center; cursor: pointer; user-select: none; }
.api-call .head:hover { background: var(--panel-soft); }
.api-call .method { font-family: var(--mono); font-weight: 700; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.api-call .method.GET { background: #dbeafe; color: #1e40af; }
.api-call .method.POST { background: #dcfce7; color: #166534; }
.api-call .method.PUT { background: #fef3c7; color: #92400e; }
.api-call .method.DELETE { background: #fee2e2; color: #991b1b; }
.api-call .url { font-family: var(--mono); font-size: 11px; color: var(--ink); flex: 1; word-break: break-all; }
.api-call .status { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }
.api-call .status.ok { background: var(--pass-soft); color: #065f46; }
.api-call .status.bad { background: var(--fail-soft); color: #991b1b; }
.api-call .body { padding: 0; display: none; border-top: 1px solid var(--border); }
.api-call.open .body { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
@media (max-width: 800px) { .api-call.open .body { grid-template-columns: 1fr; } }
.api-call .pane { padding: 10px 12px; }
.api-call .pane:first-child { border-right: 1px solid var(--border); }
.api-call .pane h5 { margin: 0 0 6px; font-size: 11px; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.06em; }
.api-call .pane pre { font-size: 11px; max-height: 280px; overflow: auto; background: var(--panel-soft); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; }

.attach-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.attach { padding: 6px 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 999px; font-size: 11px; }

/* trace cards */
.trace-card { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #93c5fd; border-radius: 10px; padding: 12px; margin-bottom: 8px; }
.trace-head { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.trace-icon { font-size: 22px; }
.trace-meta { flex: 1; }
.trace-name { font-weight: 600; font-size: 13px; color: var(--ink); }
.trace-path { font-size: 11px; color: var(--ink-soft); font-family: var(--mono); word-break: break-all; }
.trace-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.trace-hint { font-size: 11px; color: #1e40af; line-height: 1.5; }
.btn-primary { background: var(--accent); color: white; border: 1px solid var(--accent); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.12s; }
.btn-primary:hover { background: #1d4ed8; }
.btn-primary.copied { background: var(--pass); border-color: var(--pass); }
.btn-primary code { background: rgba(255,255,255,0.2); padding: 1px 4px; border-radius: 3px; margin-left: 4px; font-size: 11px; }
.btn-secondary { background: white; color: var(--accent); border: 1px solid #93c5fd; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; transition: all 0.12s; }
.btn-secondary:hover { background: var(--accent-soft); text-decoration: none; }

/* screenshots + videos */
.screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
.screenshot-link { display: block; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; transition: transform 0.15s, box-shadow 0.15s; background: var(--panel-soft); }
.screenshot-link:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.screenshot-thumb { display: block; width: 100%; height: auto; }
.video-player { width: 100%; max-width: 400px; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 6px; background: black; }

/* plain-english explainer */
.plain { background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%); border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 13px; color: #713f12; }
.plain .icon { display: inline-block; margin-right: 6px; }

/* footer */
.footer { color: var(--ink-faint); text-align: center; font-size: 11px; padding: 24px 0; }
.footer a { color: var(--ink-faint); }

@media print {
  .controls, .tabs, .group-header, .test-row .duration { display: none !important; }
  .test-list { box-shadow: none; }
  .stat-grid, .chart-grid { break-inside: avoid; }
}
`;

const SCRIPT = `
(function() {
  const data = window.__REPORT__;
  const root = document.getElementById('app');

  // ---- helpers ----
  const fmtMs = (ms) => {
    if (ms < 1000) return ms + 'ms';
    const s = ms / 1000;
    if (s < 60) return s.toFixed(1) + 's';
    const m = Math.floor(s / 60), rs = Math.round(s % 60);
    return m + 'm ' + rs + 's';
  };
  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const json = (v) => {
    if (v === null || v === undefined) return '∅';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  };

  // ---- plain-english explainer ----
  const STATUS_BLURB = {
    passed: 'This test passed — the behavior under check is working as expected.',
    failed: 'This test failed — the assertion below describes what was expected vs what actually happened.',
    timedOut: 'This test ran longer than its budget and was killed. Treat as a failure.',
    skipped: 'This test was skipped (often because of a tag filter or a manual skip()).',
  };
  const CATEGORY_BLURB = {
    Positive: 'Happy-path check — confirms the feature works under normal use.',
    Negative: 'Bad-input check — confirms the system rejects invalid input cleanly.',
    Boundary: 'Edge-of-range check — confirms behavior at min/max values.',
    Security: 'Security probe — confirms common attacks (SQLi, XSS, JWT tampering, IDOR/BOLA) cannot succeed.',
    Load: 'Concurrency check — confirms the system survives N parallel or sequential calls without locking up.',
    Functional: 'Behavioral check — verifies the feature does what the spec asks for.',
    'Non-functional': 'Quality-of-service check — latency, masking, robustness rather than feature correctness.',
    Other: 'General-purpose test.',
  };

  // ---- state ----
  const state = {
    search: '',
    filters: {
      status: new Set(),     // 'passed', 'failed' (incl. timedOut), 'skipped', 'flaky'
      area: new Set(),       // 'UI', 'API'
      category: new Set(),   // 'Positive' etc.
      gate: new Set(),       // '@smoke', '@regression', '@e2e'
    },
    groupBy: 'area',         // 'area' | 'category' | 'file' | 'tag'
    expanded: new Set(),     // test ids that are open
    collapsedGroups: new Set(),  // group keys (e.g. 'UI', 'API') the user has folded
  };

  // ---- top-level render ----
  function render() {
    // Preserve search-input focus + caret across re-renders. Without this,
    // every keystroke recreates the input element and the user loses focus
    // after each character — making search appear broken.
    const active = document.activeElement;
    const wasSearch = active && active.id === 'search-input';
    const caret = wasSearch ? active.selectionStart : null;

    root.innerHTML = '';
    root.appendChild(el('div', { class: 'shell' }, [
      renderHeader(),
      renderIntro(),
      renderStats(),
      renderCharts(),
      renderControls(),
      renderTabs(),
      renderList(),
      renderFooter(),
    ]));

    if (wasSearch) {
      const next = document.getElementById('search-input');
      if (next) {
        next.focus();
        if (caret != null) {
          try { next.setSelectionRange(caret, caret); } catch {}
        }
      }
    }
  }

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    if (children) for (const c of [].concat(children)) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  // ---- header ----
  function renderHeader() {
    const passRate = data.summary.total
      ? Math.round((data.summary.passed / data.summary.total) * 100)
      : 0;
    return el('div', { class: 'header' }, [
      el('div', {}, [
        el('h1', {}, ['Juice Shop QA — Test Report']),
        el('div', { class: 'sub' }, [
          'Run started ' + fmtDate(data.summary.startedAt) + ' · ',
          el('strong', {}, [data.summary.total + ' tests']),
          ' · ' + passRate + '% passing · ' + fmtMs(data.summary.durationMs) + ' total runtime',
        ]),
      ]),
      el('div', { class: 'meta' }, [
        el('span', { class: 'tag-pill' }, ['Run ' + data.summary.runId.slice(0, 19)]),
        el('span', { class: 'tag-pill' }, ['Playwright']),
      ]),
    ]);
  }

  // ---- intro / "what is this?" panel ----
  function renderIntro() {
    const dismissed = (function() {
      try { return localStorage.getItem('jsqa_intro_dismissed') === '1'; } catch { return false; }
    })();
    if (dismissed) {
      const reopen = el('button', { class: 'intro-reopen', title: 'Show the help banner again' }, ['ⓘ  What is this report?']);
      reopen.addEventListener('click', () => {
        try { localStorage.removeItem('jsqa_intro_dismissed'); } catch {}
        render();
      });
      return reopen;
    }

    const close = el('button', { class: 'intro-close', title: 'Hide this banner (you can reopen it from the link below the header)' }, ['×']);
    close.addEventListener('click', () => {
      try { localStorage.setItem('jsqa_intro_dismissed', '1'); } catch {}
      render();
    });

    return el('div', { class: 'intro' }, [
      close,
      el('div', { class: 'intro-title' }, ['What this report shows']),
      el('div', { class: 'intro-grid' }, [
        el('div', { class: 'intro-card' }, [
          el('div', { class: 'intro-h' }, ['1.  Pass / fail at a glance']),
          el('div', { class: 'intro-p' }, ['The cards below show how many tests passed, failed, retried, or were skipped, plus the wall-clock runtime.']),
        ]),
        el('div', { class: 'intro-card' }, [
          el('div', { class: 'intro-h' }, ['2.  Trend & coverage']),
          el('div', { class: 'intro-p' }, ['The Pass-rate trend bars show how recent runs went. The Coverage panel shows which tags (assignment, CI gates, categories) were exercised.']),
        ]),
        el('div', { class: 'intro-card' }, [
          el('div', { class: 'intro-h' }, ['3.  Known issues we test for']),
          el('div', { class: 'intro-p' }, [
            'Some of these tests don’t check that a feature works — they check that a ',
            el('em', {}, ['known bug']),
            ' is still present. They pass on the default vulnerable Juice Shop. The day the build is hardened, those tests fail and tell the team “a thing changed”. ',
            el('em', {}, ['Green = bug still exists, by design.']),
          ]),
        ]),
        el('div', { class: 'intro-card' }, [
          el('div', { class: 'intro-h' }, ['4.  Search & drill in']),
          el('div', { class: 'intro-p' }, ['Use the search box or filters to narrow the list. Click any test row to see its steps, captured API calls, error stack, and trace / screenshot links.']),
        ]),
      ]),
    ]);
  }

  // ---- stats ----
  function renderStats() {
    const s = data.summary;
    const passRate = s.total ? Math.round((s.passed / s.total) * 100) : 0;
    return el('div', { class: 'stat-grid' }, [
      statCard('Total tests', s.total, ''),
      statCard('Passed', s.passed, passRate + '% pass rate', 'pass'),
      statCard('Failed', s.failed, s.failed === 0 ? 'no failures 🎉' : 'see failures below', 'fail'),
      statCard('Flaky', s.flaky, s.flaky === 0 ? 'none retried' : 'passed on retry', 'flaky'),
      statCard('Skipped', s.skipped, ''),
      statCard('Total runtime', fmtMs(s.durationMs), 'serial'),
    ]);
  }
  function statCard(label, value, delta, cls) {
    return el('div', { class: 'stat-card ' + (cls || '') }, [
      el('div', { class: 'label' }, [label]),
      el('div', { class: 'value' }, [String(value)]),
      delta ? el('div', { class: 'delta' }, [delta]) : null,
    ]);
  }

  // ---- charts ----
  function renderCharts() {
    return el('div', { class: 'chart-grid' }, [
      renderTrendChart(),
      renderTagBars(),
      renderFindings(),
    ]);
  }
  // Surfaces every DOCUMENTED VULN: / DOCUMENTED UX: row with a severity
  // badge, mirroring docs/SECURITY-FINDINGS.md so the runtime report doubles
  // as a security audit at a glance.
  function renderFindings() {
    const CRITICAL = ['TC-UI-120', 'TC-API-204'];
    const HIGH     = ['TC-API-901','TC-API-1301','TC-API-904','TC-API-1621','TC-API-1001','TC-UI-720','TC-API-153','TC-API-168'];
    const MEDIUM   = ['TC-API-1401','TC-API-1503','TC-API-110','TC-API-111','TC-API-112','TC-API-115','TC-API-302'];
    function sevOf(id) {
      if (CRITICAL.indexOf(id) >= 0) return 'critical';
      if (HIGH.indexOf(id) >= 0)     return 'high';
      if (MEDIUM.indexOf(id) >= 0)   return 'medium';
      return 'low';
    }
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    const findings = data.records
      .filter((r) => /DOCUMENTED (VULN|UX)/.test(r.title))
      .map((r) => ({
        id: r.id,
        kind: /DOCUMENTED UX/.test(r.title) ? 'UX' : 'VULN',
        title: r.cleanTitle.replace(/^DOCUMENTED (VULN|UX):\s*/, ''),
        sev: sevOf(r.id),
      }))
      .sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev] || a.id.localeCompare(b.id));

    if (findings.length === 0) {
      return el('div', { class: 'chart-panel findings' }, [
        el('div', { class: 'chart-panel-head' }, [
          el('h3', {}, ['Known issues we test for ', el('span', { class: 'subtle' }, ['· none in this run'])]),
        ]),
      ]);
    }

    const counts = findings.reduce((a, f) => { a[f.sev] = (a[f.sev] || 0) + 1; return a; }, {});
    const sevBadge = (sev, label) =>
      counts[sev] ? el('span', { class: 'sev-badge sev-' + sev }, [counts[sev] + ' ' + label]) : null;

    const SEV_LABEL = {
      critical: 'Critical',
      high:     'High',
      medium:   'Medium',
      low:      'Low',
    };
    const KIND_LABEL = {
      VULN: 'Security bug',
      UX:   'UX gap',
    };

    const rows = findings.map((f) => {
      const node = el('div', { class: 'finding-row sev-' + f.sev, title: 'Click to filter the test list to ' + f.id }, [
        el('span', { class: 'sev-badge sev-' + f.sev }, [SEV_LABEL[f.sev]]),
        el('code', { class: 'finding-id' }, [f.id]),
        el('span', { class: 'kind kind-' + f.kind.toLowerCase() }, [KIND_LABEL[f.kind]]),
        el('span', { class: 'finding-title' }, [f.title]),
      ]);
      node.addEventListener('click', () => { state.search = f.id.toLowerCase(); render(); });
      return node;
    });

    return el('div', { class: 'chart-panel findings' }, [
      el('div', { class: 'chart-panel-head' }, [
        el('h3', {}, [
          'Known issues we test for ',
          el('span', { class: 'subtle' }, ['· ' + findings.length + ' total']),
        ]),
        el('div', { class: 'kpi-line' }, [
          sevBadge('critical', 'critical'),
          sevBadge('high', 'high'),
          sevBadge('medium', 'medium'),
          sevBadge('low', 'low'),
        ]),
      ]),
      el('div', { class: 'plain' }, [
        el('span', { class: 'icon' }, ['💡']),
        'These tests pass because they assert that a known bug is still present in the build. ',
        el('strong', {}, ['Green = bug still there, by design.']),
        ' If a row turns red after a future code change, the team has fixed (or accidentally changed) something — investigate that test.',
      ]),
      el('div', { class: 'findings-grid' }, rows),
      el('div', { class: 'tagbar-hint' }, ['Click any row to filter the test list to that issue. Full write-up lives in ', el('a', { href: '../docs/SECURITY-FINDINGS.md' }, ['docs/SECURITY-FINDINGS.md']), '.']),
    ]);
  }
  function renderTrendChart() {
    const points = data.history.slice(-30);
    if (points.length === 0) {
      return el('div', { class: 'chart-panel trend' }, [
        el('h3', {}, ['Pass-rate trend']),
        el('div', { class: 'list-empty' }, ['No history yet — this is the first run.']),
      ]);
    }
    // Plot pass rate (0-100%), not test count. The previous version
    // scaled bars by total count, which made a 9-test smoke run look
    // tiny next to a 207-test full run even when both passed 100%.
    const sums = points.reduce((acc, p) => ({
      passed: acc.passed + p.passed,
      failed: acc.failed + p.failed,
      total: acc.total + p.total,
    }), { passed: 0, failed: 0, total: 0 });
    const overallRate = sums.total ? Math.round((sums.passed / sums.total) * 100) : 0;

    const tooltipEl = el('div', { class: 'spark-tooltip' });

    const bars = points.map((p) => {
      const pct = p.total ? (p.passed / p.total) * 100 : 0;
      const cls =
        pct >= 100 ? 'green' :
        pct >= 95 ? 'lime' :
        pct >= 80 ? 'amber' : 'red';
      const bar = el('div', {
        class: 'spark-bar ' + cls,
        style: 'height: ' + Math.max(2, pct) + '%',
        'data-pct': Math.round(pct) + '%',
        'data-pf': p.passed + ' passed' + (p.failed ? ' · ' + p.failed + ' failed' : ''),
        'data-time': p.startedAt.slice(0, 19).replace('T', ' '),
      });
      bar.addEventListener('mouseenter', (ev) => {
        tooltipEl.replaceChildren(
          el('div', { class: 'tt-pct' }, [Math.round(pct) + '%']),
          el('div', { class: 'tt-pf' }, [p.passed + ' passed' + (p.failed ? ' · ' + p.failed + ' failed' : '') + ' · ' + p.total + ' total']),
          el('div', { class: 'tt-when' }, [p.startedAt.slice(0, 19).replace('T', ' ')]),
        );
        tooltipEl.classList.add('visible');
        const rect = ev.target.getBoundingClientRect();
        const wrapRect = ev.target.closest('.spark-chart').getBoundingClientRect();
        tooltipEl.style.left = (rect.left - wrapRect.left + rect.width / 2) + 'px';
        tooltipEl.style.bottom = (wrapRect.bottom - rect.top + 8) + 'px';
      });
      bar.addEventListener('mouseleave', () => tooltipEl.classList.remove('visible'));
      return bar;
    });

    const grid = el('div', { class: 'spark-grid' }, [
      el('div', { class: 'gridline' }),  // 100%
      el('div', { class: 'gridline' }),  // 75%
      el('div', { class: 'gridline' }),  // 50%
      el('div', { class: 'gridline' }),  // 25%
      el('div', { class: 'gridline' }),  // 0%
    ]);

    return el('div', { class: 'chart-panel trend' }, [
      el('div', { class: 'chart-panel-head' }, [
        el('h3', {}, ['Pass-rate trend ', el('span', { class: 'subtle' }, ['· last ' + points.length + ' runs'])]),
        el('div', { class: 'kpi-line' }, [
          el('span', { class: 'kpi-num ' + (overallRate >= 100 ? 'green' : overallRate >= 95 ? 'lime' : 'amber') }, [overallRate + '%']),
          el('span', { class: 'kpi-label' }, ['rolling avg']),
        ]),
      ]),
      el('div', { class: 'spark-chart' }, [
        grid,
        el('div', { class: 'spark', style: 'height: 110px' }, bars),
        tooltipEl,
        el('div', { class: 'y-axis' }, [
          el('span', {}, ['100%']),
          el('span', {}, ['75%']),
          el('span', {}, ['50%']),
          el('span', {}, ['25%']),
          el('span', {}, ['0%']),
        ]),
      ]),
      el('div', { class: 'spark-axis' }, [
        el('span', {}, [points[0].startedAt.slice(0, 10)]),
        el('span', { class: 'subtle' }, ['hover a bar for details']),
        el('span', {}, [points[points.length - 1].startedAt.slice(0, 10)]),
      ]),
    ]);
  }
  function renderTagBars() {
    // Also filter at render-time so older reports whose persisted data
    // already contains junk tags (e.g. an email substring like @x.test
    // captured by Playwright's @\\S+ scanner) still render cleanly.
    // Note: this whole function lives inside a template literal — every
    // backslash that should reach the emitted JS must be doubled here.
    const validTag = /^@[\\w-]+$/;
    const map = new Map();
    for (const r of data.records) {
      for (const t of r.tags) {
        if (!validTag.test(t)) continue;
        if (!map.has(t)) map.set(t, { passed: 0, failed: 0 });
        const e = map.get(t);
        if (r.status === 'passed') e.passed++;
        else if (r.status === 'failed' || r.status === 'timedOut') e.failed++;
      }
    }
    const all = [...map.entries()]
      .map(([tag, v]) => ({ tag, ...v, total: v.passed + v.failed }))
      .sort((a, b) => b.total - a.total);

    // Categorize tags into purposeful groups so a reviewer can scan
    // "what did this suite cover?" in one glance instead of squinting at
    // a flat alphabetical list.
    const GROUPS = [
      {
        key: 'assignment',
        title: 'Assignment scope',
        icon: '⭐',
        accent: 'amber',
        match: (t) => ['@everstage-qa', '@task1', '@task2', '@task3'].includes(t),
      },
      {
        key: 'gate',
        title: 'CI gates',
        icon: '🚦',
        accent: 'blue',
        match: (t) => ['@smoke', '@regression', '@e2e'].includes(t),
      },
      {
        key: 'category',
        title: 'Test category',
        icon: '🧪',
        accent: 'purple',
        match: (t) => ['@positive', '@negative', '@boundary', '@security', '@load', '@functional', '@nonfunctional'].includes(t),
      },
    ];

    const groupedSets = new Set();
    const groups = GROUPS.map((g) => {
      const rows = all.filter((r) => g.match(r.tag));
      rows.forEach((r) => groupedSets.add(r.tag));
      return { ...g, rows };
    });
    const otherRows = all.filter((r) => !groupedSets.has(r.tag));
    if (otherRows.length) {
      groups.push({
        key: 'other',
        title: 'Other',
        icon: '🏷️',
        accent: 'gray',
        rows: otherRows.slice(0, 8),
      });
    }

    const totalPasses = data.records.filter((r) => r.status === 'passed').length;
    const totalFailures = data.records.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;

    const renderRow = (r) => {
      const passPct = r.total ? (r.passed / r.total) * 100 : 0;
      const failPct = 100 - passPct;
      const isActive = state.filters.gate.has(r.tag) || state.filters.category.has(r.tag);
      const cell = el('div', {
        class: 'tagbar-row' + (isActive ? ' active' : ''),
        title: 'Click to filter the test list by ' + r.tag,
      }, [
        el('div', { class: 'tagbar-label' }, [r.tag]),
        el('div', { class: 'tagbar-track' }, [
          r.passed > 0 ? el('div', { class: 'tb-pass', style: 'width:' + passPct + '%' }) : null,
          r.failed > 0 ? el('div', { class: 'tb-fail', style: 'width:' + failPct + '%' }) : null,
        ]),
        el('div', { class: 'tagbar-stat' }, [
          el('span', { class: 'pct ' + (passPct >= 100 ? 'green' : passPct >= 95 ? 'lime' : passPct >= 80 ? 'amber' : 'red') }, [Math.round(passPct) + '%']),
          el('span', { class: 'count' }, [r.passed + '/' + r.total]),
        ]),
      ]);
      cell.addEventListener('click', () => {
        // Use the gate filter set for assignment + CI gate tags, category
        // set for category tags. (Both are checked in applyFilters.)
        const target = ['@positive', '@negative', '@boundary', '@security', '@load', '@functional', '@nonfunctional']
          .includes(r.tag) ? state.filters.category : state.filters.gate;
        if (target.has(r.tag)) target.delete(r.tag);
        else target.add(r.tag);
        render();
      });
      return cell;
    };

    const groupBlocks = groups
      .filter((g) => g.rows.length)
      .map((g) =>
        el('div', { class: 'tagbar-group' }, [
          el('div', { class: 'tagbar-group-head accent-' + g.accent }, [
            el('span', { class: 'icn' }, [g.icon]),
            el('span', { class: 'ttl' }, [g.title]),
            el('span', { class: 'sub' }, [g.rows.length + ' tag' + (g.rows.length === 1 ? '' : 's')]),
          ]),
          ...g.rows.map(renderRow),
        ])
      );

    return el('div', { class: 'chart-panel tag-coverage' }, [
      el('div', { class: 'chart-panel-head' }, [
        el('h3', {}, ['Coverage by tag ', el('span', { class: 'subtle' }, ['· ' + all.length + ' tags total'])]),
        el('div', { class: 'kpi-line' }, [
          el('span', { class: 'kpi-num green' }, [String(totalPasses)]),
          el('span', { class: 'kpi-label' }, ['passes']),
          totalFailures > 0 ? el('span', { class: 'kpi-num red', style: 'margin-left: 12px' }, [String(totalFailures)]) : null,
          totalFailures > 0 ? el('span', { class: 'kpi-label' }, ['fails']) : null,
        ]),
      ]),
      groupBlocks.length
        ? el('div', { class: 'tagbar-groups' }, groupBlocks)
        : el('div', { class: 'list-empty' }, ['No tags found in this run.']),
      el('div', { class: 'tagbar-hint' }, ['💡  Click any tag bar to filter the test list below by that tag.']),
    ]);
  }

  // ---- controls (search + filters) ----
  function renderControls() {
    const wrap = el('div', { class: 'controls' });
    const searchInput = el('input', {
      id: 'search-input',
      class: 'search-input',
      placeholder: '🔍  Search by test id, title, file, tag, or error… (try "@security" or "TC-API-001")',
      type: 'search',
      autocomplete: 'off',
      spellcheck: 'false',
      value: state.search,
      oninput: (e) => { state.search = e.target.value.toLowerCase(); render(); },
    });
    const groupSel = el('select', {
      class: 'search-input',
      style: 'flex: 0 0 auto; max-width: 180px;',
      onchange: (e) => { state.groupBy = e.target.value; render(); },
    }, [
      optEl('area', 'Group by Area'),
      optEl('category', 'Group by Category'),
      optEl('file', 'Group by File'),
      optEl('tag', 'Group by Tag'),
    ]);
    groupSel.value = state.groupBy;

    wrap.appendChild(el('div', { class: 'search-row' }, [searchInput, groupSel]));

    const statusCounts = countBy(data.records, (r) => normalizedStatus(r));
    const areaCounts = countBy(data.records, (r) => r.area);
    const categoryCounts = countBy(data.records, (r) => r.category);
    const gateCounts = {
      '@everstage-qa': data.records.filter((r) => r.tags.includes('@everstage-qa')).length,
      '@task1': data.records.filter((r) => r.tags.includes('@task1')).length,
      '@task2': data.records.filter((r) => r.tags.includes('@task2')).length,
      '@task3': data.records.filter((r) => r.tags.includes('@task3')).length,
      '@smoke': data.records.filter((r) => r.tags.includes('@smoke')).length,
      '@regression': data.records.filter((r) => r.tags.includes('@regression')).length,
      '@e2e': data.records.filter((r) => r.tags.includes('@e2e')).length,
    };

    wrap.appendChild(filterChips('Status', 'status', [
      { key: 'passed', label: '✓ Passed' },
      { key: 'failed', label: '✗ Failed' },
      { key: 'flaky', label: '↻ Flaky' },
      { key: 'skipped', label: '∅ Skipped' },
    ], statusCounts));
    wrap.appendChild(filterChips('Layer', 'area', [
      { key: 'UI', label: 'UI' },
      { key: 'API', label: 'API' },
      { key: 'OTHER', label: 'Other' },
    ], areaCounts));
    wrap.appendChild(filterChips('Category', 'category', [
      { key: 'Positive', label: 'Positive' },
      { key: 'Negative', label: 'Negative' },
      { key: 'Boundary', label: 'Boundary' },
      { key: 'Security', label: 'Security' },
      { key: 'Load', label: 'Load' },
      { key: 'Functional', label: 'Functional' },
      { key: 'Non-functional', label: 'Non-functional' },
    ], categoryCounts));
    wrap.appendChild(filterChips('Assignment', 'gate', [
      { key: '@everstage-qa', label: '⭐ Assessment cases' },
      { key: '@task1', label: 'Task 1 — login' },
      { key: '@task2', label: 'Task 2 — UI add card' },
      { key: '@task3', label: 'Task 3 — API add card' },
    ], gateCounts));
    wrap.appendChild(filterChips('CI gate', 'gate', [
      { key: '@smoke', label: '@smoke' },
      { key: '@regression', label: '@regression' },
      { key: '@e2e', label: '@e2e' },
    ], gateCounts));

    return wrap;
  }
  function optEl(value, text) { return el('option', { value }, [text]); }
  function filterChips(groupLabel, filterKey, options, counts) {
    return el('div', { class: 'chip-row' }, [
      el('span', { class: 'group-label' }, [groupLabel]),
      ...options.map((o) => {
        const isActive = state.filters[filterKey].has(o.key);
        return el('div', {
          class: 'chip' + (isActive ? ' active' : ''),
          onclick: () => {
            if (isActive) state.filters[filterKey].delete(o.key);
            else state.filters[filterKey].add(o.key);
            render();
          },
        }, [
          o.label,
          el('span', { class: 'count' }, [String(counts[o.key] || 0)]),
        ]);
      }),
    ]);
  }
  function countBy(arr, fn) {
    const c = {};
    for (const x of arr) { const k = fn(x); c[k] = (c[k] || 0) + 1; }
    return c;
  }
  function normalizedStatus(r) {
    if (r.retries > 0 && r.status === 'passed') return 'flaky';
    if (r.status === 'timedOut') return 'failed';
    return r.status;
  }

  // ---- tabs (none right now; we use inline expansion) ----
  function renderTabs() {
    const filtered = applyFilters(data.records);
    return el('div', { class: 'tabs' }, [
      el('div', { class: 'tab active' }, [
        'All matching ',
        el('span', { class: 'count' }, [String(filtered.length) + ' / ' + data.records.length]),
      ]),
    ]);
  }

  // ---- test list ----
  function applyFilters(records) {
    return records.filter((r) => {
      if (state.search) {
        const hay = [r.id, r.title, r.file, ...r.tags, r.error?.message ?? ''].join(' ').toLowerCase();
        if (!hay.includes(state.search)) return false;
      }
      const f = state.filters;
      if (f.status.size && !f.status.has(normalizedStatus(r))) return false;
      if (f.area.size && !f.area.has(r.area)) return false;
      if (f.category.size && !f.category.has(r.category)) return false;
      if (f.gate.size && ![...f.gate].some((g) => r.tags.includes(g))) return false;
      return true;
    });
  }
  function renderList() {
    const filtered = applyFilters(data.records);
    if (filtered.length === 0) {
      return el('div', { class: 'test-list' }, [
        el('div', { class: 'list-empty' }, ['No tests match the current filters.']),
      ]);
    }
    const groups = new Map();
    const keyFn = {
      area: (r) => r.area,
      category: (r) => r.category,
      file: (r) => r.file,
      tag: (r) => r.tags.find((t) => ['@smoke', '@regression', '@e2e'].includes(t)) || (r.tags[0] || 'untagged'),
    }[state.groupBy];
    for (const r of filtered) {
      const k = keyFn(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const groupKeys = [...groups.keys()].sort();
    const wrap = el('div', { class: 'test-list' });
    for (const gk of groupKeys) {
      wrap.appendChild(renderGroup(gk, groups.get(gk)));
    }
    return wrap;
  }
  function renderGroup(name, rows) {
    const passed = rows.filter((r) => r.status === 'passed').length;
    const failed = rows.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
    const summary = passed + ' passed' + (failed ? ' · ' + failed + ' failed' : '');
    const isCollapsed = state.collapsedGroups.has(name);
    const list = el('div', { style: isCollapsed ? 'display:none' : '' });
    for (const r of rows) list.appendChild(renderRow(r));
    const areaCls = name === 'UI' ? ' group-ui' : name === 'API' ? ' group-api' : '';
    const header = el('div', { class: 'group-header' + areaCls + (isCollapsed ? ' collapsed' : '') }, [
      el('div', { class: 'group-name' }, [
        el('span', { class: 'caret' }, ['▾']),
        el('span', {}, [name]),
        el('span', { class: 'tag-pill' }, [String(rows.length)]),
      ]),
      el('div', { class: 'group-summary' }, [summary]),
    ]);
    header.addEventListener('click', () => {
      // Persist collapse state across re-renders so opening a test row in
      // one group does not re-show another collapsed group.
      if (state.collapsedGroups.has(name)) state.collapsedGroups.delete(name);
      else state.collapsedGroups.add(name);
      render();
    });
    return el('div', { class: 'test-group' }, [header, list]);
  }
  function renderRow(r) {
    // Expand-key prefers the TC id over the title — id is stable across renames.
    const key = r.id || r.title;
    const isOpen = state.expanded.has(key);
    const stat = normalizedStatus(r);
    const row = el('div', { class: 'test-row' + (isOpen ? ' expanded' : '') }, [
      el('span', { class: 'id' }, [r.id || '—']),
      el('span', { class: 'title' }, [
        r.cleanTitle,
        el('span', { class: 'tags' }, r.tags.slice(0, 5).map((t) => el('span', { class: 'tag' }, [t]))),
      ]),
      el('span', { class: 'duration' }, [fmtMs(r.durationMs)]),
      el('span', { class: 'status-badge ' + stat }, [stat]),
    ]);
    row.addEventListener('click', () => {
      if (state.expanded.has(key)) state.expanded.delete(key);
      else state.expanded.add(key);
      render();
    });
    if (!isOpen) return row;
    return el('div', {}, [row, renderDetail(r)]);
  }

  // ---- detail panel ----
  function renderDetail(r) {
    const wrap = el('div', { class: 'detail' });
    // plain-english header
    const blurb = (STATUS_BLURB[r.status] || '') + ' ' + (CATEGORY_BLURB[r.category] || '');
    wrap.appendChild(el('div', { class: 'plain' }, [
      el('span', { class: 'icon' }, ['💡']),
      blurb,
    ]));
    // summary line
    wrap.appendChild(el('div', { class: 'summary-line' }, [
      el('strong', {}, [r.cleanTitle]),
      el('br'),
      'File: ', el('code', {}, [r.file + ':' + r.line]),
      ' · Duration: ', el('code', {}, [fmtMs(r.durationMs)]),
      ' · Retries: ', el('code', {}, [String(r.retries)]),
      ' · Tags: ', el('code', {}, [r.tags.join(' ') || '—']),
    ]));

    const grid = el('div', { class: 'detail-grid' });
    // left column: error + steps + stdout/stderr
    const left = el('div', {});
    if (r.error) {
      left.appendChild(el('div', { class: 'error-panel' }, [
        el('div', { class: 'msg' }, ['Failure: ' + r.error.message.split('\\n')[0]]),
        el('pre', {}, [r.error.stack || r.error.message]),
      ]));
    }
    if (r.steps.length) {
      left.appendChild(el('h4', {}, ['Steps']));
      const stepWrap = el('div', { class: 'steps-panel' });
      const flat = flattenSteps(r.steps);
      for (const s of flat) stepWrap.appendChild(renderStepLine(s));
      left.appendChild(stepWrap);
    }
    if (r.stdout || r.stderr) {
      left.appendChild(el('h4', { style: 'margin-top: 12px' }, ['Console output']));
      if (r.stdout) {
        left.appendChild(el('pre', { class: 'steps-panel', style: 'padding: 10px 12px; max-height: 200px; overflow: auto;' }, [r.stdout]));
      }
      if (r.stderr) {
        left.appendChild(el('pre', { class: 'steps-panel', style: 'padding: 10px 12px; max-height: 200px; overflow: auto; color: #991b1b' }, [r.stderr]));
      }
    }

    // right column: API calls + attachments
    const right = el('div', {});
    if (r.apiCalls.length) {
      right.appendChild(el('h4', {}, ['API calls (' + r.apiCalls.length + ')']));
      for (const c of r.apiCalls) right.appendChild(renderApiCall(c));
    } else if (r.area === 'API') {
      right.appendChild(el('h4', {}, ['API calls']));
      right.appendChild(el('div', { class: 'plain', style: 'background: #f1f5f9; border-color: var(--border); color: var(--ink-soft)' }, [
        'No HTTP calls were captured for this test. Wrap your request fixture with logged(request) from tests/helpers/logged-request.ts to see full request/response payloads here.',
      ]));
    }
    const nonApiAttachments = r.attachments.filter((a) => !a.name.startsWith('api-call:'));
    const traces = nonApiAttachments.filter((a) => a.contentType === 'application/zip' && /trace/i.test(a.name));
    const screenshots = nonApiAttachments.filter((a) => a.contentType.startsWith('image/'));
    const videos = nonApiAttachments.filter((a) => a.contentType.startsWith('video/'));
    const others = nonApiAttachments.filter((a) =>
      a.contentType !== 'application/zip' &&
      !a.contentType.startsWith('image/') &&
      !a.contentType.startsWith('video/')
    );

    right.appendChild(el('h4', { style: 'margin-top: 12px' }, ['Trace']));
    if (traces.length) {
      for (const t of traces) right.appendChild(renderTraceCard(t));
    } else {
      right.appendChild(el('div', {
        class: 'plain',
        style: 'background: #f1f5f9; border-color: var(--border); color: var(--ink-soft)',
      }, [
        'No trace was recorded for this run. Locally, the default config now sets trace: "on" so every test gets one. If you don\\'t see traces, run: npm test (or npm run test:with-traces). In CI, traces are only kept on failure — set TRACE_MODE=on to override.',
      ]));
    }
    if (screenshots.length) {
      right.appendChild(el('h4', { style: 'margin-top: 12px' }, ['Screenshots']));
      const grid = el('div', { class: 'screenshot-grid' });
      for (const s of screenshots) {
        const src = s.path ? 'file://' + s.path : 'data:' + s.contentType + ';base64,' + s.bodyBase64;
        const img = el('img', { src, class: 'screenshot-thumb', alt: s.name });
        const wrapEl = el('a', { href: src, target: '_blank', class: 'screenshot-link', title: s.name }, [img]);
        grid.appendChild(wrapEl);
      }
      right.appendChild(grid);
    }
    if (videos.length) {
      right.appendChild(el('h4', { style: 'margin-top: 12px' }, ['Videos']));
      for (const v of videos) {
        const src = v.path ? 'file://' + v.path : 'data:' + v.contentType + ';base64,' + v.bodyBase64;
        right.appendChild(el('video', { src, controls: '', class: 'video-player' }));
      }
    }
    if (others.length) {
      right.appendChild(el('h4', { style: 'margin-top: 12px' }, ['Other attachments']));
      const grid = el('div', { class: 'attach-grid' });
      for (const a of others) {
        const link = a.path
          ? el('a', { class: 'attach', href: 'file://' + a.path, target: '_blank' }, [a.name + ' (' + a.contentType + ')'])
          : el('span', { class: 'attach' }, [a.name + ' (' + a.contentType + ')']);
        grid.appendChild(link);
      }
      right.appendChild(grid);
    }

    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    return wrap;
  }

  function flattenSteps(steps, depth = 0) {
    const out = [];
    for (const s of steps) {
      out.push({ ...s, depth });
      if (s.steps && s.steps.length) out.push(...flattenSteps(s.steps, depth + 1));
    }
    return out;
  }
  function renderStepLine(s) {
    return el('div', {
      class: 'step' + (s.depth > 0 ? ' nested' : '') + (s.error ? ' has-error' : ''),
    }, [
      el('span', { class: 'cat' }, [s.category]),
      el('span', { class: 'tt' }, [s.title]),
      el('span', { class: 'dt' }, [fmtMs(s.durationMs)]),
    ]);
  }
  function renderApiCall(c) {
    const ok = c.response.ok ? 'ok' : 'bad';
    const wrap = el('div', { class: 'api-call' });
    const head = el('div', { class: 'head' }, [
      el('span', { class: 'method ' + c.method }, [c.method]),
      el('span', { class: 'url' }, [c.url]),
      el('span', { class: 'status ' + ok }, [String(c.response.status)]),
      el('span', { class: 'dt', style: 'color: var(--ink-faint); font-size: 11px' }, [fmtMs(c.durationMs)]),
    ]);
    head.addEventListener('click', () => wrap.classList.toggle('open'));
    const body = el('div', { class: 'body' }, [
      el('div', { class: 'pane' }, [
        el('h5', {}, ['Request']),
        el('pre', {}, ['Headers:\\n' + json(c.request.headers) +
          (c.request.params ? '\\n\\nParams:\\n' + json(c.request.params) : '') +
          (c.request.body ? '\\n\\nBody:\\n' + json(c.request.body) : '')]),
      ]),
      el('div', { class: 'pane' }, [
        el('h5', {}, ['Response (' + c.response.status + ')']),
        el('pre', {}, ['Headers:\\n' + json(c.response.headers) +
          '\\n\\nBody:\\n' + json(c.response.body)]),
      ]),
    ]);
    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }

  function renderTraceCard(t) {
    const fileUrl = t.path ? 'file://' + t.path : null;
    // Playwright's hosted trace viewer can open a local trace file via
    // its ?trace=<URL> query — but only if the URL is reachable from the
    // browser. file:// won't be (CORS), so we surface both: the CLI
    // command (most reliable) and the hosted-viewer URL (works if user
    // serves the file).
    const cliCmd = t.path ? 'npx playwright show-trace "' + t.path + '"' : '';
    const hosted = fileUrl ? 'https://trace.playwright.dev/?trace=' + encodeURIComponent(fileUrl) : '';

    const wrap = el('div', { class: 'trace-card' });
    wrap.appendChild(el('div', { class: 'trace-head' }, [
      el('span', { class: 'trace-icon' }, ['🎬']),
      el('div', { class: 'trace-meta' }, [
        el('div', { class: 'trace-name' }, [t.name]),
        el('div', { class: 'trace-path' }, [t.path || 'inline']),
      ]),
    ]));
    const actions = el('div', { class: 'trace-actions' });
    if (cliCmd) {
      const copyBtn = el('button', { class: 'btn-primary', title: 'Copy the command and run it in your terminal' }, [
        '📋  Copy: ', el('code', {}, ['npx playwright show-trace …']),
      ]);
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(cliCmd).then(() => {
          copyBtn.classList.add('copied');
          copyBtn.replaceChildren(document.createTextNode('✓  Copied — paste into your terminal'));
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.replaceChildren(document.createTextNode('📋  Copy show-trace command'));
          }, 2200);
        });
      });
      actions.appendChild(copyBtn);
    }
    if (fileUrl) {
      actions.appendChild(el('a', { class: 'btn-secondary', href: fileUrl, target: '_blank', title: 'Download / open the trace file' }, ['📥  Download .zip']));
    }
    if (hosted) {
      actions.appendChild(el('a', { class: 'btn-secondary', href: hosted, target: '_blank', title: 'Try the hosted Playwright trace viewer (requires the file to be reachable from your browser)' }, ['🌐  Open in trace.playwright.dev']));
    }
    wrap.appendChild(actions);
    wrap.appendChild(el('div', { class: 'trace-hint' }, [
      'Playwright traces include: a step-by-step DOM snapshot, network log, console output, source code, and timing. ',
      el('strong', {}, ['Recommended:']),
      ' click "Copy show-trace command" then paste it into your terminal — Playwright opens an interactive viewer.',
    ]));
    return wrap;
  }

  function renderFooter() {
    return el('div', { class: 'footer' }, [
      'Generated by tests/reporters/rich-reporter.ts · raw data in ',
      el('a', { href: 'last-run.json' }, ['reports/last-run.json']),
      ' · ',
      el('a', { href: 'run-history.csv' }, ['reports/run-history.csv']),
    ]);
  }

  render();
})();
`;
