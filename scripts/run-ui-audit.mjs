#!/usr/bin/env node
/**
 * Headless CLI Runner for _ct-MATRIX UI/UX Audit
 * Uses native Node 24 WebSocket and Chrome DevTools Protocol to audit
 * 1080p viewport, typography, text wrapping, and clock animations.
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const REPORTS_DIR = join(ROOT_DIR, 'reports');
const AUDIT_ENGINE_PATH = join(__dirname, 'audit-engine.js');

const CHROME_PORT = 9447;
const BASE_URL = 'http://localhost:8000';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch (e) {
          console.error('[CDP] Message parse error:', e);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise = true) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation exception: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function ensureLocalServer() {
  try {
    const res = await fetch(`${BASE_URL}/index.html`);
    if (res.ok) return null;
  } catch (_) {}

  console.log(`Starting local server on ${BASE_URL}...`);
  const serverProc = spawn('python3', ['-m', 'http.server', '8000'], {
    cwd: ROOT_DIR,
    stdio: 'ignore'
  });
  await sleep(1000);
  return serverProc;
}

async function getOrCreateTarget(port, url) {
  const listRes = await fetch(`http://localhost:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await listRes.json();
  return target;
}

async function closeTarget(port, targetId) {
  try {
    await fetch(`http://localhost:${port}/json/close/${targetId}`);
  } catch (_) {}
}

async function main() {
  console.log('====================================================');
  console.log('_ct-MATRIX UI/UX Automated Audit Runner');
  console.log('Target: 1080p (1920x1080) Viewport, Styles & Protocol');
  console.log('====================================================\n');

  mkdirSync(REPORTS_DIR, { recursive: true });
  const auditEngineSource = readFileSync(AUDIT_ENGINE_PATH, 'utf8');

  // Verify server
  const serverProc = await ensureLocalServer();

  // Launch headless Chrome
  console.log(`[1/5] Launching Chrome Headless on port ${CHROME_PORT}...`);
  const chromeArgs = [
    '--headless=new',
    `--remote-debugging-port=${CHROME_PORT}`,
    '--window-size=1920,1080',
    '--force-device-scale-factor=1',
    '--disable-gpu',
    '--no-sandbox',
    '--mute-audio',
    '--hide-scrollbars'
  ];

  const chromeProc = spawn('/usr/bin/google-chrome', chromeArgs, { stdio: 'ignore' });
  const cleanup = () => {
    try { chromeProc.kill(); } catch (_) {}
    if (serverProc) {
      try { serverProc.kill(); } catch (_) {}
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });

  // Wait for CDP readiness
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const v = await fetch(`http://localhost:${CHROME_PORT}/json/version`);
      if (v.ok) { ready = true; break; }
    } catch (_) {}
    await sleep(200);
  }

  if (!ready) {
    console.error('Failed to connect to headless Chrome on port', CHROME_PORT);
    cleanup();
    process.exit(1);
  }
  console.log('Chrome connected successfully.\n');

  const fullReport = {
    generatedAt: new Date().toISOString(),
    pages: []
  };

  const pagesToAudit = [
    { name: 'Live Display (index.html)', url: `${BASE_URL}/index.html`, isSlides: true },
    { name: 'Test Sandbox (test/index.html)', url: `${BASE_URL}/test/index.html`, isSlides: false },
    { name: 'Master Admin Panel (masteradmin.html)', url: `${BASE_URL}/masteradmin.html`, isSlides: false },
    { name: 'Admin 2 Panel (admin2.html)', url: `${BASE_URL}/admin2.html`, isSlides: false },
    { name: 'Handheld Remote (remote.html)', url: `${BASE_URL}/remote.html`, isSlides: false }
  ];

  for (const page of pagesToAudit) {
    console.log(`Auditing: ${page.name}...`);
    const target = await getOrCreateTarget(CHROME_PORT, page.url);
    const client = new CDPClient(target.webSocketDebuggerUrl);

    try {
      await client.connect();
      await client.send('Page.enable');
      await client.send('DOM.enable');
      await client.send('Runtime.enable');
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false
      });

      await sleep(1000);

      // Inject Audit Engine
      await client.evaluate(auditEngineSource);

      let pageAuditResult;
      if (page.isSlides) {
        pageAuditResult = await client.evaluate(`MATRIX_AUDIT.auditAllSlides({ delayMs: 250 })`);
      } else {
        pageAuditResult = await client.evaluate(`MATRIX_AUDIT.auditPage(${JSON.stringify(page.name)})`);
      }

      fullReport.pages.push({
        name: page.name,
        url: page.url,
        isSlides: page.isSlides,
        result: pageAuditResult
      });

      console.log(` -> Completed: ${pageAuditResult.summary ? pageAuditResult.summary.totalViolations : (pageAuditResult.violations?.length || 0)} issues detected.`);
    } catch (err) {
      console.error(`Error auditing ${page.name}:`, err.message);
      fullReport.pages.push({
        name: page.name,
        url: page.url,
        error: err.message
      });
    } finally {
      client.close();
      await closeTarget(CHROME_PORT, target.id);
    }
  }

  cleanup();

  // Format Combined Markdown Report
  console.log('\n[4/5] Formatting UI/UX Audit Report...');
  const mdLines = [];
  mdLines.push('# _ct-MATRIX UI/UX Style, Layout & Typography Audit Report');
  mdLines.push(`* **Generated:** ${fullReport.generatedAt}`);
  mdLines.push(`* **Target Resolution:** 1920 × 1080 (Strict 1080p)`);
  mdLines.push(`* **Evaluated Surfaces:** ${pagesToAudit.map(p => p.name).join(', ')}\n`);

  let grandTotalViolations = 0;
  let grandTotalCritical = 0;
  let grandTotalWarnings = 0;

  for (const p of fullReport.pages) {
    mdLines.push(`## ${p.name}`);
    mdLines.push(`* **URL:** \`${p.url}\``);

    if (p.error) {
      mdLines.push(`* **STATUS: ERROR** - ${p.error}\n`);
      continue;
    }

    if (p.isSlides) {
      const summary = p.result.summary;
      grandTotalViolations += summary.totalViolations;
      grandTotalCritical += summary.critical;
      grandTotalWarnings += summary.warning;

      mdLines.push(`* **Total Violations:** ${summary.totalViolations} (Critical: ${summary.critical}, Warnings: ${summary.warning})`);

      if (p.result.fontStatus && p.result.fontStatus.length > 0) {
        mdLines.push('### Font Loading:');
        for (const f of p.result.fontStatus) {
          mdLines.push(`- [${f.severity}] ${f.message}`);
        }
      }

      mdLines.push('');
      for (const s of p.result.slideReports) {
        mdLines.push(`### Slide ${s.slideIndex} (\`${s.slideId}\`)`);
        if (s.violations.length === 0) {
          mdLines.push(`- **STATUS: PASS** - No issues detected.\n`);
        } else {
          const hasCrit = s.violations.some(v => v.severity === 'CRITICAL');
          mdLines.push(`- **STATUS: ${hasCrit ? 'FAIL (CRITICAL)' : 'WARNING'}** (${s.violations.length} issue${s.violations.length > 1 ? 's' : ''}):`);
          for (const v of s.violations) {
            mdLines.push(`  * **[${v.severity}] ${v.category}**: \`${v.selector}\``);
            mdLines.push(`    - *Details:* ${v.message}`);
            if (v.elementText) mdLines.push(`    - *Text Content:* "${v.elementText}"`);
            if (v.suggestedFix) mdLines.push(`    - *Suggested Fix:* ${v.suggestedFix}`);
          }
          mdLines.push('');
        }
      }
    } else {
      const summary = p.result.summary;
      grandTotalViolations += summary.totalViolations;
      grandTotalCritical += summary.critical;
      grandTotalWarnings += summary.warning;

      mdLines.push(`* **Total Violations:** ${summary.totalViolations} (Critical: ${summary.critical}, Warnings: ${summary.warning})`);
      if (p.result.violations.length === 0) {
        mdLines.push(`- **STATUS: PASS** - No issues detected.\n`);
      } else {
        const hasCrit = p.result.violations.some(v => v.severity === 'CRITICAL');
        mdLines.push(`- **STATUS: ${hasCrit ? 'FAIL (CRITICAL)' : 'WARNING'}** (${p.result.violations.length} issue${p.result.violations.length > 1 ? 's' : ''}):`);
        for (const v of p.result.violations) {
          mdLines.push(`  * **[${v.severity}] ${v.category}**: \`${v.selector}\``);
          mdLines.push(`    - *Details:* ${v.message}`);
          if (v.elementText) mdLines.push(`    - *Text Content:* "${v.elementText}"`);
          if (v.suggestedFix) mdLines.push(`    - *Suggested Fix:* ${v.suggestedFix}`);
        }
        mdLines.push('');
      }
    }
  }

  mdLines.push('## Grand Audit Summary');
  mdLines.push(`* **Total Issues Found:** ${grandTotalViolations}`);
  mdLines.push(`* **Critical Violations (Overspill / Broken Clocks / Ugly Wraps):** ${grandTotalCritical}`);
  mdLines.push(`* **Warnings (Padding / Collisions):** ${grandTotalWarnings}\n`);

  const reportMd = mdLines.join('\n');
  const reportPath = join(REPORTS_DIR, 'ui-audit-report.md');
  writeFileSync(reportPath, reportMd, 'utf8');

  console.log(`[5/5] Report written to: reports/ui-audit-report.md`);
  console.log(`\nGrand Total: ${grandTotalViolations} violations (Critical: ${grandTotalCritical}, Warnings: ${grandTotalWarnings})`);
}

main().catch(err => {
  console.error('Audit runner failed:', err);
  process.exit(1);
});
