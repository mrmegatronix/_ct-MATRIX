#!/usr/bin/env node
/**
 * ============================================================================
 * NIKKO'S D CHECK (nikkos-d-check.mjs) — v1.0.0
 * ============================================================================
 * 5-Pillar Automated Diagnostic & Audit Suite:
 *   1. DESIGN   — 1080p/400x200 bounds, overflow, ugly line wraps, contrast,
 *                 collisions, typography hierarchy, broken images & QR codes
 *   2. CODE     — JS/HTML syntax, scope hazards, duplicate IDs/functions,
 *                 broken paths, ?v= cache-buster drift, duration drift
 *   3. RULES    — Blinking clock colons, keyboard navigation contract,
 *                 TBC/TBA filter, NRL filter, venue hours, 8PM curfew, weather
 *   4. PROBLEMS — Headless CDP runtime exceptions, JSDOM full-loop + synthetic
 *                 time-window stress tests, git conflict markers, repo bloat
 *   5. SECURITY — Secret/PAT scan, hardcoded PIN mismatch, DOM XSS sinks,
 *                 postMessage origin checks, target=_blank rel=noopener, SRI
 *
 * STRICT PATH BOUNDARY:
 *   Hard-locked to /run/media/zeus/6TB-1/__GITHUB NUC/ (and Windows equivalent).
 *   Refuses to scan any path or symlink resolving outside the workspace root.
 *
 * REPORT-ONLY MODE:
 *   Never modifies project source code. Saves timestamped reports & logs to:
 *   <project-root>/nikkos-d-check-reports/<YYYY-MM-DD_HH-mm-ss>/
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import os from 'node:os';
import readline from 'node:readline';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. STRICT WORKSPACE BOUNDARY LOCK
// ============================================================================
const LINUX_ALLOWED_ROOT = '/run/media/zeus/6TB-1/__GITHUB NUC';

function detectAllowedRoot() {
  if (process.platform !== 'win32' && fs.existsSync(LINUX_ALLOWED_ROOT)) {
    return fs.realpathSync(LINUX_ALLOWED_ROOT);
  }
  // Cross-platform fallback for Windows or mounted __GITHUB NUC root
  let cur = path.resolve(__dirname);
  while (cur && cur !== path.dirname(cur)) {
    const base = path.basename(cur);
    if (base === '__GITHUB NUC' || base === '__GITHUB') {
      return fs.realpathSync(cur);
    }
    cur = path.dirname(cur);
  }
  throw new Error(
    `[BOUNDARY LOCK] Cannot locate allowed workspace root ("${LINUX_ALLOWED_ROOT}"). Aborting.`
  );
}

const ALLOWED_ROOT = detectAllowedRoot();

function isInsideAllowedRoot(candidatePath) {
  try {
    const resolved = fs.existsSync(candidatePath)
      ? fs.realpathSync(candidatePath)
      : path.resolve(candidatePath);
    const rel = path.relative(ALLOWED_ROOT, resolved);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  } catch (_) {
    return false;
  }
}

function assertInsideAllowedRoot(candidatePath, label = 'Target path') {
  if (!isInsideAllowedRoot(candidatePath)) {
    console.error(`\n[FATAL BOUNDARY VIOLATION] ${label} ("${candidatePath}") is outside "${ALLOWED_ROOT}".`);
    console.error(`Nikko's D Check is strictly locked to "${ALLOWED_ROOT}" and its subfolders.`);
    process.exit(2);
  }
}

// ============================================================================
// 2. CLI ARGUMENTS & CONTEXT DETECTION
// ============================================================================
const rawArgs = process.argv.slice(2);
const FLAGS = {
  quick: rawArgs.includes('--quick'),
  online: rawArgs.includes('--online'),
  noMenu: rawArgs.includes('--no-menu') || !process.stdin.isTTY,
  jsonOnly: rawArgs.includes('--json'),
  pillar: (rawArgs.find(a => a.startsWith('--pillar=')) || '').split('=')[1]?.toUpperCase() || null,
  module: (rawArgs.find(a => a.startsWith('--module=')) || '').split('=')[1] || null,
  target: (rawArgs.find(a => a.startsWith('--target=')) || '').split('=')[1] || null
};

const MATRIX_SIBLING_MODULES = [
  'ct-ACE2',
  '_ct-MMR',
  '_ct-wea1',
  '_ct-QUIZ',
  '_ct-FIR',
  '_ct-SOC',
  '_ct-TIK',
  '_ct-FACEB',
  '_ct-INSTA',
  '_ct-WEST',
  '_ct-HALLO',
  '_ct-TRIP'
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.git_bad',
  '_UNUSED',
  '_old',
  'z_OLD',
  'dist',
  'build',
  'coverage',
  'nikkos-d-check-reports',
  'slide_exports',
  'snaps',
  'scratch',
  '_tools'
]);

function resolveProjectRoot(startDir) {
  assertInsideAllowedRoot(startDir, 'Working directory');
  const realStart = fs.realpathSync(startDir);
  if (realStart === ALLOWED_ROOT) {
    const matrixCandidate = path.join(ALLOWED_ROOT, '_ct-MATRIX');
    if (fs.existsSync(matrixCandidate)) return matrixCandidate;
    return ALLOWED_ROOT;
  }
  // Walk up until direct child of ALLOWED_ROOT
  let cur = realStart;
  while (path.dirname(cur) !== ALLOWED_ROOT && cur !== ALLOWED_ROOT) {
    cur = path.dirname(cur);
  }
  assertInsideAllowedRoot(cur, 'Resolved project root');
  return cur;
}

const INVOKED_DIR = FLAGS.target ? path.resolve(FLAGS.target) : process.cwd();
const PRIMARY_PROJECT_ROOT = resolveProjectRoot(INVOKED_DIR);
const PRIMARY_PROJECT_NAME = path.basename(PRIMARY_PROJECT_ROOT);

// ============================================================================
// 3. TIMESTAMPED REPORT DIRECTORY, LOGGING & GITIGNORE GUARD
// ============================================================================
function formatTimestamp(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

const RUN_TIMESTAMP = formatTimestamp(new Date());
const REPORTS_BASE_DIR = path.join(PRIMARY_PROJECT_ROOT, 'nikkos-d-check-reports');
const RUN_REPORT_DIR = path.join(REPORTS_BASE_DIR, RUN_TIMESTAMP);
const SCREENSHOTS_DIR = path.join(RUN_REPORT_DIR, 'screenshots');
const SCAN_LOG_PATH = path.join(RUN_REPORT_DIR, 'scan.log');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const logBuffer = [];
function log(msg, level = 'INFO') {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  logBuffer.push(line);
  try {
    fs.appendFileSync(SCAN_LOG_PATH, line + '\n', 'utf8');
  } catch (_) {}
  if (!FLAGS.jsonOnly) {
    console.log(msg);
  }
}

function ensureGitignoreHasReports(projectDir) {
  assertInsideAllowedRoot(projectDir, 'Project gitignore directory');
  const gitignorePath = path.join(projectDir, '.gitignore');
  const entry = 'nikkos-d-check-reports/';
  try {
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const lines = content.split(/\r?\n/).map(l => l.trim());
      if (!lines.includes(entry) && !lines.includes('nikkos-d-check-reports')) {
        const prefix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
        fs.appendFileSync(gitignorePath, `${prefix}${entry}\n`, 'utf8');
        log(`Added "${entry}" to ${path.relative(ALLOWED_ROOT, gitignorePath)}`);
      }
    } else if (fs.existsSync(path.join(projectDir, '.git'))) {
      fs.writeFileSync(gitignorePath, `${entry}\n`, 'utf8');
      log(`Created ${path.relative(ALLOWED_ROOT, gitignorePath)} with "${entry}"`);
    }
  } catch (err) {
    log(`Could not update .gitignore: ${err.message}`, 'WARN');
  }
}

function pruneOldReports(reportsDir, maxKeep = 20) {
  try {
    if (!fs.existsSync(reportsDir)) return;
    const entries = fs.readdirSync(reportsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();
    if (entries.length > maxKeep) {
      const toRemove = entries.slice(maxKeep);
      for (const oldFolder of toRemove) {
        const fullOld = path.join(reportsDir, oldFolder);
        if (isInsideAllowedRoot(fullOld)) {
          fs.rmSync(fullOld, { recursive: true, force: true });
          log(`Pruned old report folder: ${oldFolder}`);
        }
      }
    }
  } catch (err) {
    log(`Failed to prune old reports: ${err.message}`, 'WARN');
  }
}

// ============================================================================
// 4. TARGET MODULE DISCOVERY
// ============================================================================
function discoverScanTargets(primaryRoot) {
  const targets = [];
  const seenRealPaths = new Set();

  function addTarget(dirPath, role = 'primary') {
    if (!fs.existsSync(dirPath)) return;
    if (!isInsideAllowedRoot(dirPath)) {
      log(`Skipping out-of-boundary path: ${dirPath}`, 'WARN');
      return;
    }
    const real = fs.realpathSync(dirPath);
    if (seenRealPaths.has(real)) return;
    seenRealPaths.add(real);
    targets.push({
      name: path.basename(dirPath),
      dir: real,
      relDir: path.relative(ALLOWED_ROOT, real) || '.',
      role
    });
  }

  addTarget(primaryRoot, 'primary');

  if (path.basename(primaryRoot) === '_ct-MATRIX') {
    for (const modName of MATRIX_SIBLING_MODULES) {
      const siblingPath = path.join(ALLOWED_ROOT, modName);
      if (fs.existsSync(siblingPath)) {
        addTarget(siblingPath, 'module');
      }
    }
    // Also inspect matrix-core.js for any additional local ../<folder>/ references
    const matrixCorePath = path.join(primaryRoot, 'matrix-core.js');
    if (fs.existsSync(matrixCorePath)) {
      const src = fs.readFileSync(matrixCorePath, 'utf8');
      const matches = src.matchAll(/\.\.\/([A-Za-z0-9_-]+)\//g);
      for (const m of matches) {
        const candidate = path.join(ALLOWED_ROOT, m[1]);
        if (fs.existsSync(candidate) && !IGNORED_DIRS.has(m[1])) {
          addTarget(candidate, 'module');
        }
      }
    }
  }

  if (FLAGS.module) {
    return targets.filter(t => t.name.toLowerCase() === FLAGS.module.toLowerCase());
  }
  return targets;
}

// ============================================================================
// 5. FINDINGS STORE & HELPERS
// ============================================================================
const ALL_FINDINGS = [];

function addFinding({
  pillar,
  severity = 'WARNING',
  moduleName,
  type,
  file = '',
  line = null,
  selector = '',
  detail,
  fixHint = ''
}) {
  if (FLAGS.pillar && pillar !== FLAGS.pillar) return;
  ALL_FINDINGS.push({
    id: `F-${String(ALL_FINDINGS.length + 1).padStart(4, '0')}`,
    pillar,
    severity,
    module: moduleName,
    type,
    file,
    line,
    selector,
    detail,
    fixHint
  });
}

function walkProjectFiles(rootDir, maxDepth = 4) {
  const results = [];
  function walk(curDir, depth) {
    if (depth > maxDepth) return;
    if (!isInsideAllowedRoot(curDir)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(curDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.git')) continue;
      if (entry.name.includes('_backup_')) continue;
      if (entry.name === 'test' && depth === 0 && path.basename(rootDir) === '_ct-MATRIX') {
        // Skip duplicate test/ mirror workspace in _ct-MATRIX unless specifically inspecting bloat
        continue;
      }
      const fullPath = path.join(curDir, entry.name);
      if (entry.isSymbolicLink()) {
        // Check broken or out-of-boundary symlink
        try {
          const targetReal = fs.realpathSync(fullPath);
          if (!isInsideAllowedRoot(targetReal)) {
            addFinding({
              pillar: 'SECURITY',
              severity: 'CRITICAL',
              moduleName: path.basename(rootDir),
              type: 'SYMLINK_OUTSIDE_BOUNDARY',
              file: path.relative(ALLOWED_ROOT, fullPath),
              detail: `Symlink points outside allowed root to "${targetReal}".`,
              fixHint: 'Remove or repoint symlink to stay inside __GITHUB NUC.'
            });
          }
        } catch (_) {
          addFinding({
            pillar: 'PROBLEMS',
            severity: 'WARNING',
            moduleName: path.basename(rootDir),
            type: 'BROKEN_SYMLINK',
            file: path.relative(ALLOWED_ROOT, fullPath),
            detail: `Broken symbolic link detected at "${entry.name}".`,
            fixHint: 'Remove or repair broken symlink.'
          });
        }
        continue;
      }
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }
  walk(rootDir, 0);
  return results;
}

// ============================================================================
// 6. PILLAR 2 (CODE), PILLAR 4 (STATIC PROBLEMS) & PILLAR 5 (SECURITY)
// ============================================================================
function runStaticCodeProblemsSecurityChecks(target) {
  const modName = target.name;
  const files = walkProjectFiles(target.dir);
  const htmlCacheBusters = new Map();

  for (const filePath of files) {
    const relFile = path.relative(ALLOWED_ROOT, filePath);
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath);

    // Repo Hygiene: Bloat / Temp / Archive files
    if (
      ext === '.zip' ||
      ext === '.tar' ||
      ext === '.gz' ||
      /^tmp\.|^debug_|^test_loop/i.test(baseName)
    ) {
      addFinding({
        pillar: 'PROBLEMS',
        severity: 'INFO',
        moduleName: modName,
        type: 'REPO_ARTIFACT_BLOAT',
        file: relFile,
        detail: `Temporary test script or archive file ("${baseName}") present in repository root/tree.`,
        fixHint: `Remove "${baseName}" or add it to .gitignore before pushing.`
      });
    }

    if (!['.js', '.mjs', '.cjs', '.html', '.css', '.json'].includes(ext)) {
      continue;
    }

    let content = '';
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 5 * 1024 * 1024) continue; // Skip >5MB bundles
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      continue;
    }

    const lines = content.split(/\r?\n/);

    // Check Git Conflict Markers across all text files
    lines.forEach((lineText, idx) => {
      if (/^(<<<<<<<|=======|>>>>>>>)(\s|$)/.test(lineText)) {
        addFinding({
          pillar: 'PROBLEMS',
          severity: 'CRITICAL',
          moduleName: modName,
          type: 'GIT_CONFLICT_MARKER',
          file: relFile,
          line: idx + 1,
          detail: `Unresolved Git merge conflict marker ("${lineText.slice(0, 20)}") on line ${idx + 1}.`,
          fixHint: 'Resolve merge conflict and remove conflict markers.'
        });
      }
    });

    // Security: Secret / Token / Private Key Scan
    const secretPatterns = [
      { name: 'GitHub PAT', regex: /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/ },
      { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
      { name: 'Slack/Webhook Token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ }
    ];
    lines.forEach((lineText, idx) => {
      for (const sp of secretPatterns) {
        if (sp.regex.test(lineText)) {
          addFinding({
            pillar: 'SECURITY',
            severity: 'CRITICAL',
            moduleName: modName,
            type: 'EXPOSED_SECRET_TOKEN',
            file: relFile,
            line: idx + 1,
            detail: `Potential ${sp.name} exposed in source file.`,
            fixHint: 'Revoke credential immediately and move secrets to environment config.'
          });
        }
      }
    });

    // JSON validation (support JSONC comments/trailing commas in tsconfig*.json)
    if (ext === '.json') {
      try {
        const jsonToParse = baseName.startsWith('tsconfig')
          ? content
              .replace(/\/\*[\s\S]*?\*\//g, '')
              .replace(/^\s*\/\/.*$/gm, '')
              .replace(/,\s*([}\]])/g, '$1')
          : content;
        JSON.parse(jsonToParse);
      } catch (err) {
        addFinding({
          pillar: 'CODE',
          severity: 'CRITICAL',
          moduleName: modName,
          type: 'INVALID_JSON',
          file: relFile,
          detail: `Invalid JSON syntax: ${err.message}`,
          fixHint: 'Fix JSON syntax error.'
        });
      }
      continue;
    }

    // JS Syntax & Code Quality Checks
    if (['.js', '.mjs', '.cjs'].includes(ext)) {
      checkJavaScriptSource(content, relFile, modName, baseName);
    }

    // HTML Checks: Inline <script> syntax, duplicate IDs, broken local links, cache-busters, security
    if (ext === '.html') {
      checkHtmlSource(content, filePath, relFile, modName, htmlCacheBusters);
    }
  }

  // Check ?v= cache-buster drift within the module
  for (const [assetName, versionsMap] of htmlCacheBusters.entries()) {
    const distinctVersions = Array.from(versionsMap.keys());
    if (distinctVersions.length > 1) {
      const breakdown = distinctVersions
        .map(v => `${v} (${versionsMap.get(v).join(', ')})`)
        .join(' vs ');
      addFinding({
        pillar: 'CODE',
        severity: 'WARNING',
        moduleName: modName,
        type: 'CACHE_BUSTER_DRIFT',
        file: modName,
        detail: `Asset "${assetName}" has inconsistent ?v= cache-buster query strings across HTML files: ${breakdown}.`,
        fixHint: `Synchronize ?v= version string for "${assetName}" across all HTML entry points.`
      });
    }
  }

  // Special cross-file checks for _ct-MATRIX
  if (modName === '_ct-MATRIX') {
    runMatrixCrossFileChecks(target.dir, modName);
  }
}

function checkJavaScriptSource(source, relFile, modName, baseName) {
  // Skip syntax check on scripts/nikkos-d-check* itself
  if (baseName.startsWith('nikkos-d-check')) return;

  // 1. VM Syntax check (strip ESM import/export lightly if needed for vm.Script or test as module-compatible)
  const hasEsmSyntax = /^\s*(import|export)\s+/m.test(source);
  if (!hasEsmSyntax) {
    try {
      new vm.Script(source, { filename: relFile });
    } catch (err) {
      const lineMatch = err.stack && err.stack.match(/:(\d+)\n/);
      addFinding({
        pillar: 'CODE',
        severity: 'CRITICAL',
        moduleName: modName,
        type: 'JS_SYNTAX_ERROR',
        file: relFile,
        line: lineMatch ? Number(lineMatch[1]) : null,
        detail: `JavaScript syntax error: ${err.message}`,
        fixHint: 'Fix syntax error before deploying.'
      });
    }
  }

  // 2. Duplicate top-level function declarations in non-minified files
  if (!relFile.endsWith('.min.js')) {
    const fnLines = new Map();
    const lines = source.split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = line.match(/^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
      if (m) {
        const fnName = m[1];
        if (fnLines.has(fnName)) {
          addFinding({
            pillar: 'CODE',
            severity: 'WARNING',
            moduleName: modName,
            type: 'DUPLICATE_FUNCTION_DECLARATION',
            file: relFile,
            line: i + 1,
            detail: `Top-level function "${fnName}()" is declared multiple times (lines ${fnLines.get(fnName)} and ${i + 1}).`,
            fixHint: `Consolidate or rename duplicate "${fnName}()" definition.`
          });
        } else {
          fnLines.set(fnName, i + 1);
        }
      }
    });

    // 3. Security: postMessage listener without origin/data validation
    lines.forEach((line, i) => {
      if (/addEventListener\s*\(\s*['"]message['"]/.test(line)) {
        const windowSlice = lines.slice(i, Math.min(lines.length, i + 12)).join('\n');
        if (!/\.origin\b/.test(windowSlice) && !/e\.data|event\.data|msg\.data/.test(windowSlice)) {
          addFinding({
            pillar: 'SECURITY',
            severity: 'WARNING',
            moduleName: modName,
            type: 'UNVALIDATED_POSTMESSAGE_LISTENER',
            file: relFile,
            line: i + 1,
            detail: `window "message" listener at line ${i + 1} does not verify event.origin.`,
            fixHint: 'Validate event.origin or strictly whitelist message schemas.'
          });
        }
      }
      if (/\beval\s*\(/.test(line) && !relFile.includes('test') && !relFile.includes('audit')) {
        addFinding({
          pillar: 'SECURITY',
          severity: 'WARNING',
          moduleName: modName,
          type: 'DANGEROUS_EVAL_USAGE',
          file: relFile,
          line: i + 1,
          detail: `Direct eval() usage detected on line ${i + 1}.`,
          fixHint: 'Replace eval() with JSON.parse() or safe property lookup.'
        });
      }
    });
  }
}

function checkHtmlSource(content, htmlFilePath, relFile, modName, htmlCacheBusters) {
  const htmlDir = path.dirname(htmlFilePath);
  const baseName = path.basename(htmlFilePath);

  // 1. Duplicate DOM id attributes
  const idMap = new Map();
  const lines = content.split(/\r?\n/);
  // Strip <script> and <style> blocks before scanning static HTML IDs
  let inScriptOrStyle = false;
  lines.forEach((line, idx) => {
    if (/<(script|style)\b/i.test(line)) inScriptOrStyle = true;
    if (!inScriptOrStyle) {
      const idMatches = line.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi);
      for (const m of idMatches) {
        const idVal = m[1].trim();
        if (!idVal || idVal.includes('${') || idVal.includes('{{')) continue;
        if (idMap.has(idVal)) {
          addFinding({
            pillar: 'CODE',
            severity: 'WARNING',
            moduleName: modName,
            type: 'DUPLICATE_HTML_ID',
            file: relFile,
            line: idx + 1,
            detail: `Duplicate HTML id="${idVal}" on lines ${idMap.get(idVal)} and ${idx + 1}.`,
            fixHint: `Ensure id="${idVal}" is unique within ${baseName}.`
          });
        } else {
          idMap.set(idVal, idx + 1);
        }
      }
    }
    if (/<\/(script|style)>/i.test(line)) inScriptOrStyle = false;
  });

  // 2. Inline <script> syntax validation
  const scriptBlockRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptBlockRegex.exec(content)) !== null) {
    const attrs = match[1] || '';
    const scriptBody = match[2] || '';
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const isModule = /\btype\s*=\s*["']module["']/i.test(attrs);
    const isJson = /\btype\s*=\s*["'](application\/(?:ld\+)?json|importmap)["']/i.test(attrs);

    if (srcMatch) {
      const rawSrc = srcMatch[1].trim();
      checkAssetReference(rawSrc, htmlDir, relFile, baseName, modName, 'script', htmlCacheBusters);
      if (/^https?:\/\//i.test(rawSrc) && !/\bintegrity\s*=/i.test(attrs) && !rawSrc.includes('tailwindcss') && !rawSrc.includes('gstatic.com') && !rawSrc.includes('googleapis.com') && !rawSrc.includes('unpkg.com') && !rawSrc.includes('cdn.jsdelivr.net')) {
        addFinding({
          pillar: 'SECURITY',
          severity: 'INFO',
          moduleName: modName,
          type: 'CDN_SCRIPT_MISSING_SRI',
          file: relFile,
          detail: `External script "${rawSrc}" is loaded without a Subresource Integrity (integrity="...") attribute.`,
          fixHint: 'Add integrity and crossorigin="anonymous" attributes where static versions are used.'
        });
      }
    } else if (scriptBody.trim() && !isModule && !isJson && !/\btype\s*=\s*["']text\/babel["']/i.test(attrs)) {
      try {
        new vm.Script(scriptBody, { filename: `${relFile}[inline-script]` });
      } catch (err) {
        addFinding({
          pillar: 'CODE',
          severity: 'CRITICAL',
          moduleName: modName,
          type: 'INLINE_SCRIPT_SYNTAX_ERROR',
          file: relFile,
          detail: `Inline <script> syntax error in ${baseName}: ${err.message}`,
          fixHint: 'Fix JavaScript syntax inside inline <script> block.'
        });
      }
    }
  }

  // 3. Check <link href>, <img src>, <iframe src>
  const assetAttrRegex = /<(link|img|iframe)\b([^>]+)>/gi;
  while ((match = assetAttrRegex.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const attrName = tag === 'link' ? 'href' : 'src';
    const valMatch = attrs.match(new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']+)["']`, 'i'));
    if (!valMatch) continue;
    const rawUrl = valMatch[1].trim();
    if (tag === 'link') {
      const relMatch = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i);
      const relVal = relMatch ? relMatch[1].toLowerCase() : '';
      if (!['stylesheet', 'icon', 'preload', 'manifest'].some(r => relVal.includes(r))) continue;
    }
    checkAssetReference(rawUrl, htmlDir, relFile, baseName, modName, tag, htmlCacheBusters);
  }

  // 4. Security: <a target="_blank"> without rel="noopener" (grouped per file)
  const anchorRegex = /<a\b([^>]+)>/gi;
  let missingNoopenerCount = 0;
  while ((match = anchorRegex.exec(content)) !== null) {
    const attrs = match[1];
    if (/\btarget\s*=\s*["']_blank["']/i.test(attrs) && !/\brel\s*=\s*["'][^"']*(noopener|noreferrer)[^"']*["']/i.test(attrs)) {
      missingNoopenerCount++;
    }
  }
  if (missingNoopenerCount > 0) {
    addFinding({
      pillar: 'SECURITY',
      severity: 'INFO',
      moduleName: modName,
      type: 'TARGET_BLANK_MISSING_NOOPENER',
      file: relFile,
      detail: `${missingNoopenerCount} <a target="_blank"> link(s) in ${baseName} missing rel="noopener noreferrer".`,
      fixHint: 'Add rel="noopener noreferrer" to external target="_blank" links.'
    });
  }
}

function checkAssetReference(rawUrl, htmlDir, relFile, htmlBaseName, modName, tagType, htmlCacheBusters) {
  if (
    !rawUrl ||
    rawUrl === 'about:blank' ||
    rawUrl.startsWith('about:') ||
    rawUrl.startsWith('data:') ||
    rawUrl.startsWith('blob:') ||
    rawUrl.startsWith('#') ||
    rawUrl.startsWith('javascript:') ||
    rawUrl.startsWith('mailto:') ||
    rawUrl.startsWith('tel:') ||
    rawUrl.includes('${') ||
    rawUrl.includes('{{')
  ) {
    return;
  }

  if (/^http:\/\//i.test(rawUrl) && !rawUrl.includes('localhost') && !rawUrl.includes('127.0.0.1')) {
    addFinding({
      pillar: 'SECURITY',
      severity: 'WARNING',
      moduleName: modName,
      type: 'MIXED_CONTENT_HTTP_URL',
      file: relFile,
      detail: `Insecure HTTP resource ("${rawUrl}") referenced in <${tagType}>; browsers on HTTPS GitHub Pages will block mixed content.`,
      fixHint: 'Upgrade resource URL from http:// to https://.'
    });
    return;
  }

  if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('//')) {
    return;
  }

  const [cleanPathPart, queryPart] = rawUrl.split('?');
  if (!cleanPathPart) return;

  if (queryPart) {
    const vMatch = queryPart.match(/(?:^|&)v=([^&]+)/);
    if (vMatch) {
      const assetKey = path.basename(cleanPathPart);
      if (!htmlCacheBusters.has(assetKey)) {
        htmlCacheBusters.set(assetKey, new Map());
      }
      const verMap = htmlCacheBusters.get(assetKey);
      const ver = vMatch[1];
      if (!verMap.has(ver)) verMap.set(ver, []);
      verMap.get(ver).push(htmlBaseName);
    }
  }

  const resolvedLocal = cleanPathPart.startsWith('/')
    ? path.join(ALLOWED_ROOT, cleanPathPart)
    : path.resolve(htmlDir, cleanPathPart);

  if (!fs.existsSync(resolvedLocal)) {
    addFinding({
      pillar: 'CODE',
      severity: 'CRITICAL',
      moduleName: modName,
      type: 'BROKEN_LOCAL_ASSET_PATH',
      file: relFile,
      detail: `<${tagType}> references missing local path "${rawUrl}" (resolved: ${path.relative(ALLOWED_ROOT, resolvedLocal)}).`,
      fixHint: `Verify file exists at "${rawUrl}" or fix relative path.`
    });
  }
}

function runMatrixCrossFileChecks(matrixDir, modName) {
  const corePath = path.join(matrixDir, 'matrix-core.js');
  const masterAdminPath = path.join(matrixDir, 'masteradmin.html');
  const remotePath = path.join(matrixDir, 'remote.html');

  if (!fs.existsSync(corePath)) return;
  const coreSrc = fs.readFileSync(corePath, 'utf8');

  // 1. Check PIN consistency between matrix-core.js and masteradmin.html
  const corePinMatch = coreSrc.match(/(?:PIN|pin)\s*(?:===|=)\s*['"](\d{4,6})['"]/);
  if (fs.existsSync(masterAdminPath)) {
    const maSrc = fs.readFileSync(masterAdminPath, 'utf8');
    const maPinMatch = maSrc.match(/(?:PIN|pin|MASTER_PIN|ADMIN_PIN|val)\s*(?:===|!==|=)\s*['"](\d{4,6})['"]/);
    const corePin = corePinMatch ? corePinMatch[1] : null;
    const maPin = maPinMatch ? maPinMatch[1] : null;
    if (corePin && maPin && corePin !== maPin) {
      addFinding({
        pillar: 'SECURITY',
        severity: 'WARNING',
        moduleName: modName,
        type: 'ADMIN_PIN_MISMATCH',
        file: '_ct-MATRIX/matrix-core.js vs masteradmin.html',
        detail: `Hardcoded admin PIN mismatch: matrix-core.js uses "${corePin}" while masteradmin.html uses "${maPin}".`,
        fixHint: 'Standardize admin authentication PIN across matrix-core.js and masteradmin.html.'
      });
    }
  }

  // 2. Check ct-mmr duration drift between matrix-core.js and masteradmin.html / remote.html
  const coreMmrBlock = coreSrc.match(/id:\s*['"]ct-mmr['"][\s\S]{0,220}?duration:\s*(\d+)/);
  if (coreMmrBlock && fs.existsSync(remotePath)) {
    const remoteSrc = fs.readFileSync(remotePath, 'utf8');
    const remMmrMatch = remoteSrc.match(/['"]?ct-mmr['"]?\s*[:=,]\s*(\d+)/);
    if (remMmrMatch && coreMmrBlock[1] !== remMmrMatch[1]) {
      addFinding({
        pillar: 'CODE',
        severity: 'WARNING',
        moduleName: modName,
        type: 'MODULE_DURATION_DRIFT',
        file: '_ct-MATRIX/matrix-core.js vs remote.html',
        detail: `Default duration for "ct-mmr" is ${coreMmrBlock[1]}s in matrix-core.js but ${remMmrMatch[1]}s in remote.html.`,
        fixHint: 'Synchronize ct-mmr default duration across matrix-core.js, masteradmin.html, and remote.html.'
      });
    }
  }
}

// ============================================================================
// 7. PILLAR 3 (RULES) & PILLAR 4 (PROBLEMS) — JSDOM FULL-QUEUE & TIME STRESS
// ============================================================================
async function runMatrixJsdomStressSuite(matrixDir) {
  const corePath = path.join(matrixDir, 'matrix-core.js');
  if (!fs.existsSync(corePath)) return;

  let JSDOM;
  try {
    const req = createRequire(path.join(matrixDir, 'package.json'));
    ({ JSDOM } = req('jsdom'));
  } catch (err) {
    log(`JSDOM not available for stress suite: ${err.message}`, 'WARN');
    return;
  }

  log('Running JSDOM Full-Queue Loop & Synthetic Time-Window Stress Suite...');

  try {
    const coreCode = fs.readFileSync(corePath, 'utf8');
    const dom = new JSDOM(
      '<!DOCTYPE html><html><body><div id="slide-viewport"></div><div id="progress-bar"></div><div id="main-clock"></div></body></html>',
      { url: 'http://localhost:8000/index.html', runScripts: 'dangerously' }
    );
    const win = dom.window;
    win.BroadcastChannel = class {
      postMessage() {}
      close() {}
    };
    win.requestAnimationFrame = cb => {
      try { cb(); } catch (_) {}
      return 1;
    };
    win.fetch = async () => ({ ok: false, text: async () => '' });

    win.eval(coreCode);

    // Synthetic events to test TBC/TBA filter, NRL filter, and 25+ queue length for weather cadence
    const syntheticEvents = [
      { title: 'TBC Band Night', event_type: 'Music', notes: 'Should be filtered out' },
      { title: 'Friday Live Band', event_type: 'Music', notes: 'TBA artist' },
      { title: 'NRL Warriors Watch Party', event_type: 'Sport', notes: 'Should be filtered out' },
      ...Array.from({ length: 16 }, (_, idx) => ({
        title: `Valid Club Event ${idx + 1}`,
        event_type: idx % 3 === 0 ? 'Special' : 'Music',
        date: 'Friday',
        time: '7:00 PM',
        notes: 'Live entertainment in the main lounge'
      }))
    ];

    win.buildSlideQueue([{ week_starting: 'Stress Test Week', events: syntheticEvents }]);
    const slides = win.MATRIX?.STATE?.slides || [];

    // 1. Verify TBC / TBA & NRL Ruthless Filtering
    const leakedForbidden = slides.filter(s => {
      const dump = JSON.stringify(s.data || {}).toLowerCase();
      return dump.includes('tbc band') || dump.includes('tba artist') || dump.includes('nrl warriors');
    });
    if (leakedForbidden.length > 0) {
      addFinding({
        pillar: 'RULES',
        severity: 'CRITICAL',
        moduleName: '_ct-MATRIX',
        type: 'FORBIDDEN_EVENT_FILTER_BYPASS',
        file: '_ct-MATRIX/matrix-core.js',
        detail: `TBC/TBA or NRL events leaked into buildSlideQueue (${leakedForbidden.length} leaked slides).`,
        fixHint: 'Ensure buildSlideQueue ruthlessly strips TBC, TBA, and NRL events.'
      });
    }

    // 2. Verify Weather (ct-wea1) Every-10th-Slide 15s Rule
    const weaSlides = slides
      .map((s, idx) => ({ ...s, idx }))
      .filter(s => s.id === 'ct-wea1');
    if (slides.length >= 10 && weaSlides.length === 0) {
      addFinding({
        pillar: 'RULES',
        severity: 'WARNING',
        moduleName: '_ct-MATRIX',
        type: 'WEATHER_CADENCE_MISSING',
        file: '_ct-MATRIX/matrix-core.js',
        detail: `Queue has ${slides.length} slides but zero "ct-wea1" weather slides were inserted.`,
        fixHint: 'Insert ct-wea1 every 10th slide for 15 seconds.'
      });
    } else {
      for (const ws of weaSlides) {
        if (Number(ws.duration) !== 15) {
          addFinding({
            pillar: 'RULES',
            severity: 'WARNING',
            moduleName: '_ct-MATRIX',
            type: 'WEATHER_DURATION_RULE_VIOLATION',
            file: '_ct-MATRIX/matrix-core.js',
            detail: `Weather slide "${ws.slotKey || ws.id}" has duration ${ws.duration}s instead of required 15s.`,
            fixHint: 'Set inserted ct-wea1 slide duration to 15s.'
          });
        }
      }
    }

    // 3. Step through 2 full queue revolutions (slides.length * 2 + 4) checking for ReferenceError/TypeError or dead timers
    const activeSlides = slides.filter(s =>
      typeof win.isSlideActive === 'function' ? win.isSlideActive(s) : true
    );
    const totalSteps = slides.length * 2 + 4;
    const visitedIndices = new Set([win.MATRIX.STATE.currentIndex]);
    for (let step = 0; step < totalSteps; step++) {
      try {
        win.nextSlide(true, true);
        visitedIndices.add(win.MATRIX.STATE.currentIndex);
      } catch (err) {
        addFinding({
          pillar: 'PROBLEMS',
          severity: 'CRITICAL',
          moduleName: '_ct-MATRIX',
          type: 'SLIDE_LOOP_RUNTIME_EXCEPTION',
          file: '_ct-MATRIX/matrix-core.js',
          detail: `Uncaught ${err.name} during nextSlide() at step ${step}: ${err.message}`,
          fixHint: 'Fix undeclared variable or runtime throw inside nextSlide() / renderActiveSlide().'
        });
        break;
      }
    }

    if (activeSlides.length > 1 && visitedIndices.size < activeSlides.length) {
      addFinding({
        pillar: 'PROBLEMS',
        severity: 'CRITICAL',
        moduleName: '_ct-MATRIX',
        type: 'SLIDE_QUEUE_STUCK_LOOP',
        file: '_ct-MATRIX/matrix-core.js',
        detail: `Full-queue loop only visited ${visitedIndices.size} of ${activeSlides.length} active slides across ${totalSteps} transitions.`,
        fixHint: 'Inspect nextSlide() index modulo progression and countdown lock conditions.'
      });
    }

    // 4. Verify slotKey preservation when buildSlideQueue re-runs on ct-wea1#2
    const secondWeaIdx = slides.findIndex(s => s.slotKey === 'ct-wea1#2');
    if (secondWeaIdx !== -1) {
      win.MATRIX.STATE.currentIndex = secondWeaIdx;
      win.buildSlideQueue([{ week_starting: 'Stress Test Week', events: syntheticEvents }]);
      if (win.MATRIX.STATE.currentIndex !== secondWeaIdx) {
        addFinding({
          pillar: 'PROBLEMS',
          severity: 'WARNING',
          moduleName: '_ct-MATRIX',
          type: 'WEATHER_SLOT_RESET_ON_SYNC',
          file: '_ct-MATRIX/matrix-core.js',
          detail: `Re-running buildSlideQueue while on "ct-wea1#2" (index ${secondWeaIdx}) jumped to index ${win.MATRIX.STATE.currentIndex}.`,
          fixHint: 'Preserve unique slotKey (ct-wea1#1, ct-wea1#2) during background data refreshes.'
        });
      }
    }

    // 5. Synthetic Time-Window Simulation: Tuesday 17:20 (ACE Draw Lock)
    const RealDate = win.Date;
    win.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          // 2026-10-27T17:20:00 (Tuesday 5:20 PM)
          super(2026, 9, 27, 17, 20, 0);
        } else {
          super(...args);
        }
      }
    };
    try {
      const aceIdx = win.MATRIX.STATE.slides.findIndex(s => s.id === 'ct-ace2');
      if (aceIdx !== -1) {
        win.MATRIX.STATE.currentIndex = aceIdx;
        win.nextSlide(true, false); // Non-forced nextSlide during Tue 5:20 PM draw window
        if (win.MATRIX.STATE.currentIndex !== aceIdx) {
          addFinding({
            pillar: 'RULES',
            severity: 'WARNING',
            moduleName: '_ct-MATRIX',
            type: 'ACE_DRAW_WINDOW_LOCK_FAILED',
            file: '_ct-MATRIX/matrix-core.js',
            detail: 'ct-ace2 did not hold slide progression during synthetic Tuesday 5:20 PM draw countdown window.',
            fixHint: 'Verify getAceDrawWindow() and isSlideCountdownLocked() hold ct-ace2 during Tue 5:00-7:05 PM & Sat 4:30-7:05 PM.'
          });
        }
      }
    } catch (err) {
      addFinding({
        pillar: 'PROBLEMS',
        severity: 'CRITICAL',
        moduleName: '_ct-MATRIX',
        type: 'DRAW_WINDOW_SIMULATION_CRASH',
        file: '_ct-MATRIX/matrix-core.js',
        detail: `Exception during Tuesday 5:20 PM draw window simulation: ${err.message}`,
        fixHint: 'Ensure draw-time variables are accessible at module scope.'
      });
    } finally {
      win.Date = RealDate;
    }

    if (win.MATRIX?.STATE?.timer) clearTimeout(win.MATRIX.STATE.timer);
    dom.window.close();
  } catch (err) {
    addFinding({
      pillar: 'PROBLEMS',
      severity: 'CRITICAL',
      moduleName: '_ct-MATRIX',
      type: 'JSDOM_BOOT_FAILURE',
      file: '_ct-MATRIX/matrix-core.js',
      detail: `Failed to boot matrix-core.js in JSDOM: ${err.message}`,
      fixHint: 'Check top-level DOM assumptions in matrix-core.js.'
    });
  }
}

// ============================================================================
// 8. PILLAR 1 (DESIGN), PILLAR 3 (RULES) & PILLAR 4 (RUNTIME) — HEADLESS CHROME CDP
// ============================================================================
function findChromeExecutable() {
  const candidates = process.platform === 'win32'
    ? [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : [
        process.env.CHROME_PATH,
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function startLocalWorkspaceServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://127.0.0.1');
        const decodedPath = decodeURIComponent(parsedUrl.pathname);
        let filePath = path.join(rootDir, decodedPath);

        if (!isInsideAllowedRoot(filePath)) {
          res.writeHead(403);
          res.end('Forbidden: Outside Allowed Root');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

class CDPSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        } else if (msg.method && this.listeners.has(msg.method)) {
          for (const handler of this.listeners.get(msg.method)) {
            handler(msg.params || {});
          }
        }
      } catch (_) {}
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout on ${method}`));
        }
      }, 15000);
      this.pending.set(id, {
        resolve: val => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: err => {
          clearTimeout(timer);
          reject(err);
        }
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      if (this.ws) this.ws.close();
    } catch (_) {}
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runHeadlessBrowserAudit(targets) {
  const chromeBin = findChromeExecutable();
  if (!chromeBin) {
    log('Chrome executable not found; skipping headless DESIGN/RUNTIME checks.', 'WARN');
    return;
  }

  const engineScriptPath = path.join(__dirname, 'nikkos-d-check-engine.js');
  const engineCode = fs.readFileSync(engineScriptPath, 'utf8');

  const { server, port } = await startLocalWorkspaceServer(ALLOWED_ROOT);
  const cdpPort = 9330 + Math.floor(Math.random() * 500);
  const tmpProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikkos-d-check-chrome-'));

  log(`Launching Headless Chrome (${chromeBin}) on CDP port ${cdpPort}, HTTP port ${port}...`);

  const chromeProc = spawn(
    chromeBin,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--autoplay-policy=no-user-gesture-required',
      '--hide-scrollbars',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${tmpProfileDir}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  try {
    // Wait for Chrome DevTools JSON endpoint
    let pageWsUrl = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
        if (res.ok) {
          const tabs = await res.json();
          const pageTab = tabs.find(t => t.type === 'page');
          if (pageTab && pageTab.webSocketDebuggerUrl) {
            pageWsUrl = pageTab.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (_) {}
      await sleep(250);
    }

    if (!pageWsUrl) {
      throw new Error('Could not connect to Headless Chrome DevTools WebSocket.');
    }

    const cdp = new CDPSession(pageWsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');

    // Decision #4: Block live Firebase RTDB / Firestore traffic during headless scans!
    await cdp.send('Network.setBlockedURLs', {
      urls: [
        '*firebaseio.com*',
        '*firebasedatabase.app*',
        '*firestore.googleapis.com*',
        '*gstatic.com/firebasejs*'
      ]
    });

    let activePageContext = { moduleName: '', relUrl: '' };

    // Pre-navigation Runtime Exception & Console Error traps
    cdp.on('Runtime.exceptionThrown', params => {
      const details = params.exceptionDetails || {};
      const desc = details.exception?.description || details.text || 'Uncaught runtime exception';
      if (desc.includes('firebase') || desc.includes('Firebase')) return;
      addFinding({
        pillar: 'PROBLEMS',
        severity: 'CRITICAL',
        moduleName: activePageContext.moduleName,
        type: 'RUNTIME_UNCAUGHT_EXCEPTION',
        file: activePageContext.relUrl,
        line: details.lineNumber ? details.lineNumber + 1 : null,
        detail: `Uncaught exception on ${activePageContext.relUrl}: ${desc.split('\n')[0]}`,
        fixHint: 'Check browser console stack trace and guard null/undefined references.'
      });
    });

    cdp.on('Log.entryAdded', params => {
      const entry = params.entry || {};
      if (entry.level === 'error') {
        const txt = entry.text || '';
        const entryUrl = entry.url || '';
        // Ignore intentional blocked Firebase URLs or external favicons
        if (
          txt.includes('ERR_BLOCKED_BY_CLIENT') ||
          txt.includes('firebase') ||
          txt.includes('favicon.ico') ||
          entryUrl.includes('favicon.ico') ||
          entryUrl.includes('firebase')
        ) {
          return;
        }
        addFinding({
          pillar: 'PROBLEMS',
          severity: 'WARNING',
          moduleName: activePageContext.moduleName,
          type: 'BROWSER_LOG_ERROR',
          file: activePageContext.relUrl,
          detail: `Browser error on ${activePageContext.relUrl}: ${txt.slice(0, 160)} (${entry.url || ''})`
        });
      }
    });

    for (const target of targets) {
      const pagesToAudit = getPagesForTarget(target);
      for (const pageSpec of pagesToAudit) {
        activePageContext = { moduleName: target.name, relUrl: pageSpec.relUrl };
        const fullUrl = `http://127.0.0.1:${port}/${pageSpec.relUrl.split(path.sep).join('/')}`;

        log(`  -> Auditing [${target.name}] ${pageSpec.label} (${pageSpec.width}x${pageSpec.height})...`);

        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: pageSpec.width,
          height: pageSpec.height,
          deviceScaleFactor: 1,
          mobile: false
        });

        await cdp.send('Page.navigate', { url: fullUrl });
        await sleep(pageSpec.waitMs || 2200);

        // Inject Nikko's D Check browser engine
        await cdp.send('Runtime.evaluate', {
          expression: engineCode,
          awaitPromise: false
        });

        if (pageSpec.isMatrixMainSlideshow) {
          await auditMatrixMainSlideshowStates(cdp, target.name, pageSpec);
        } else {
          await auditSinglePageState(cdp, target.name, pageSpec, pageSpec.screenshotSlug);
        }
      }
    }

    cdp.close();
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch (_) {}
    server.close();
    try {
      fs.rmSync(tmpProfileDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

function getPagesForTarget(target) {
  const pages = [];
  const addPage = (htmlFile, label, opts = {}) => {
    const full = path.join(target.dir, htmlFile);
    if (!fs.existsSync(full)) return;
    const relUrl = path.relative(ALLOWED_ROOT, full);
    pages.push({
      label,
      htmlFile,
      relUrl,
      width: opts.width || 1920,
      height: opts.height || 1080,
      isSignagePage: opts.isSignagePage !== false,
      isMatrixMainSlideshow: Boolean(opts.isMatrixMainSlideshow),
      waitMs: opts.waitMs || 2200,
      screenshotSlug: `${target.name}_${path.basename(htmlFile, '.html')}`
    });
  };

  if (target.name === '_ct-MATRIX') {
    addPage('index.html', 'Main 1080p Signage Display', { isSignagePage: true, isMatrixMainSlideshow: true, waitMs: 3200 });
    addPage('billboard.html', 'LED Billboard (400x200)', { width: 400, height: 200, isSignagePage: true, waitMs: 1800 });
    addPage('masteradmin.html', 'Master Admin Panel', { isSignagePage: false, waitMs: 1800 });
    addPage('admin2.html', 'Admin2 Control Panel', { isSignagePage: false, waitMs: 1800 });
    addPage('remote.html', 'Mobile/TV Remote Control', { isSignagePage: false, waitMs: 1800 });
    addPage('navi.html', 'Navigation Hub', { isSignagePage: false, waitMs: 1500 });
  } else if (target.name === 'ct-ACE2') {
    if (fs.existsSync(path.join(target.dir, 'dist', 'index.html'))) {
      addPage('dist/index.html', `${target.name} Built Display`, { isSignagePage: true, waitMs: 2500 });
    } else {
      addPage('index.html', `${target.name} Display`, { isSignagePage: true, waitMs: 2000 });
    }
  } else {
    addPage('index.html', `${target.name} Display`, { isSignagePage: true, waitMs: 2200 });
  }

  return pages;
}

async function auditSinglePageState(cdp, moduleName, pageSpec, screenshotSlug) {
  const evalRes = await cdp.send('Runtime.evaluate', {
    expression: `window.NIKKOS_D_CHECK.runAudit({ viewportWidth: ${pageSpec.width}, viewportHeight: ${pageSpec.height}, isSignagePage: ${pageSpec.isSignagePage} })`,
    returnByValue: true
  });

  const auditData = evalRes?.result?.value;
  const violations = auditData?.violations || [];

  for (const v of violations) {
    addFinding({
      pillar: v.pillar || 'DESIGN',
      severity: v.severity || 'WARNING',
      moduleName,
      type: v.type,
      file: pageSpec.relUrl,
      selector: v.selector,
      detail: `[${pageSpec.label}] ${v.detail}`,
      fixHint: 'Adjust CSS layout, font-size, overflow, or container dimensions.'
    });
  }

  if (pageSpec.isSignagePage) {
    const kbRes = await cdp.send('Runtime.evaluate', {
      expression: `window.NIKKOS_D_CHECK.runKeyboardContractAudit()`,
      returnByValue: true
    });
    const kbFindings = kbRes?.result?.value?.findings || [];
    for (const kf of kbFindings) {
      addFinding({
        pillar: kf.pillar || 'RULES',
        severity: kf.severity || 'WARNING',
        moduleName,
        type: kf.type,
        file: pageSpec.relUrl,
        selector: kf.selector,
        detail: `[${pageSpec.label}] ${kf.detail}`,
        fixHint: 'Ensure all keyboard navigation rules and Input Guard are implemented.'
      });
    }
  }

  // Highlight any visual violations and capture 1080p PNG screenshot (Decision #5)
  if (violations.length > 0) {
    await cdp.send('Runtime.evaluate', {
      expression: `window.NIKKOS_D_CHECK.highlightViolations(${JSON.stringify(violations)})`,
      returnByValue: true
    });
  }

  await captureScreenshot(cdp, `${screenshotSlug}.png`);

  if (violations.length > 0) {
    await cdp.send('Runtime.evaluate', {
      expression: `window.NIKKOS_D_CHECK.clearHighlights()`,
      returnByValue: true
    });
  }
}

async function auditMatrixMainSlideshowStates(cdp, moduleName, pageSpec) {
  // Pause automatic slide timer so we can deterministically step through slides
  const queueRes = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      if (!window.MATRIX || !window.MATRIX.STATE) return [];
      window.MATRIX.STATE.isPaused = true;
      if (window.MATRIX.STATE.timer) clearTimeout(window.MATRIX.STATE.timer);
      return (window.MATRIX.STATE.slides || []).map((s, idx) => ({
        idx,
        id: s.id || s.type || ('slide-' + idx),
        type: s.type || 'unknown',
        slotKey: s.slotKey || s.id || ('slide-' + idx)
      }));
    })()`,
    returnByValue: true
  });

  const slides = queueRes?.result?.value || [];
  // Audit keyboard navigation contract once on the main display
  const kbRes = await cdp.send('Runtime.evaluate', {
    expression: `window.NIKKOS_D_CHECK.runKeyboardContractAudit()`,
    returnByValue: true
  });
  for (const kf of kbRes?.result?.value?.findings || []) {
    addFinding({
      pillar: kf.pillar || 'RULES',
      severity: kf.severity || 'WARNING',
      moduleName,
      type: kf.type,
      file: pageSpec.relUrl,
      selector: kf.selector,
      detail: `[Main Display] ${kf.detail}`,
      fixHint: 'Check handleKeyboardShortcuts in matrix-core.js.'
    });
  }

  // Select representative slides (all unique slide types/IDs up to 10 slides)
  const seenSlideTypes = new Set();
  const slidesToInspect = [];
  for (const s of slides) {
    const key = `${s.type}:${s.id}`;
    if (!seenSlideTypes.has(key) && slidesToInspect.length < 10) {
      seenSlideTypes.add(key);
      slidesToInspect.push(s);
    }
  }

  if (slidesToInspect.length === 0) {
    await auditSinglePageState(cdp, moduleName, pageSpec, '_ct-MATRIX_index');
    return;
  }

  for (const slide of slidesToInspect) {
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        window.MATRIX.STATE.currentIndex = ${slide.idx};
        if (typeof window.renderActiveSlide === 'function') {
          window.renderActiveSlide(true);
        } else if (typeof window.renderSlide === 'function') {
          window.renderSlide(${slide.idx});
        }
      })()`,
      returnByValue: true
    });
    await sleep(950);
    await cdp.send('Runtime.evaluate', {
      expression: `Promise.race([
        Promise.all(Array.from(document.images).filter(img => !img.complete).map(img => new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }))),
        new Promise(res => setTimeout(res, 2000))
      ])`,
      awaitPromise: true,
      returnByValue: true
    });

    const evalRes = await cdp.send('Runtime.evaluate', {
      expression: `window.NIKKOS_D_CHECK.runAudit({ viewportWidth: 1920, viewportHeight: 1080, isSignagePage: true })`,
      returnByValue: true
    });
    const violations = evalRes?.result?.value?.violations || [];
    for (const v of violations) {
      addFinding({
        pillar: v.pillar || 'DESIGN',
        severity: v.severity || 'WARNING',
        moduleName,
        type: v.type,
        file: `${pageSpec.relUrl} [slide #${slide.idx}: ${slide.slotKey}]`,
        selector: v.selector,
        detail: `[Slide ${slide.slotKey}] ${v.detail}`,
        fixHint: 'Adjust slide card layout or typography in matrix-core.js / index.html.'
      });
    }

    if (violations.length > 0) {
      await cdp.send('Runtime.evaluate', {
        expression: `window.NIKKOS_D_CHECK.highlightViolations(${JSON.stringify(violations)})`,
        returnByValue: true
      });
    }

    const safeSlug = `_ct-MATRIX_slide_${String(slide.idx).padStart(2, '0')}_${String(slide.slotKey).replace(/[^A-Za-z0-9_-]/g, '_')}`;
    await captureScreenshot(cdp, `${safeSlug}.png`);

    if (violations.length > 0) {
      await cdp.send('Runtime.evaluate', {
        expression: `window.NIKKOS_D_CHECK.clearHighlights()`,
        returnByValue: true
      });
    }
  }
}

async function captureScreenshot(cdp, fileName) {
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
      const outPath = path.join(SCREENSHOTS_DIR, fileName);
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    }
  } catch (err) {
    log(`Screenshot capture failed for ${fileName}: ${err.message}`, 'WARN');
  }
}

// ============================================================================
// 9. OPTIONAL --online CHECKS (Decision #6: Offline by default)
// ============================================================================
async function runOnlineChecks(targets) {
  if (!FLAGS.online) return;
  log('Running optional --online checks (npm audit)...');
  for (const t of targets) {
    const pkgLock = path.join(t.dir, 'package-lock.json');
    if (!fs.existsSync(pkgLock)) continue;
    try {
      const out = execSync('npm audit --json', { cwd: t.dir, stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).toString();
      const parsed = JSON.parse(out);
      const vulns = parsed?.metadata?.vulnerabilities || {};
      const highCrit = (vulns.high || 0) + (vulns.critical || 0);
      if (highCrit > 0) {
        addFinding({
          pillar: 'SECURITY',
          severity: 'WARNING',
          moduleName: t.name,
          type: 'NPM_AUDIT_VULNERABILITIES',
          file: `${t.name}/package-lock.json`,
          detail: `npm audit reported ${vulns.critical || 0} critical and ${vulns.high || 0} high severity dependency vulnerabilities.`,
          fixHint: 'Run "npm audit fix" and review dependency tree.'
        });
      }
    } catch (_) {}
  }
}

// ============================================================================
// 10. REPORT GENERATION (report.md, report.json, latest.md)
// ============================================================================
function buildScorecard(targets) {
  const pillars = ['DESIGN', 'CODE', 'RULES', 'PROBLEMS', 'SECURITY'];
  const byPillar = {};
  for (const p of pillars) {
    const list = ALL_FINDINGS.filter(f => f.pillar === p);
    const crit = list.filter(f => f.severity === 'CRITICAL').length;
    const warn = list.filter(f => f.severity === 'WARNING').length;
    const info = list.filter(f => f.severity === 'INFO').length;
    const score = Math.max(0, 100 - crit * 18 - warn * 4 - info * 1);
    byPillar[p] = {
      total: list.length,
      critical: crit,
      warning: warn,
      info,
      score,
      status: crit > 0 ? 'FAIL' : warn > 0 ? 'WARN' : 'PASS'
    };
  }

  const byModule = {};
  for (const t of targets) {
    const list = ALL_FINDINGS.filter(f => f.module === t.name);
    byModule[t.name] = {
      role: t.role,
      total: list.length,
      critical: list.filter(f => f.severity === 'CRITICAL').length,
      warning: list.filter(f => f.severity === 'WARNING').length,
      info: list.filter(f => f.severity === 'INFO').length
    };
  }

  const totalCrit = ALL_FINDINGS.filter(f => f.severity === 'CRITICAL').length;
  const totalWarn = ALL_FINDINGS.filter(f => f.severity === 'WARNING').length;
  const totalInfo = ALL_FINDINGS.filter(f => f.severity === 'INFO').length;
  const overallScore = Math.round(
    pillars.reduce((acc, p) => acc + byPillar[p].score, 0) / pillars.length
  );

  return {
    timestamp: RUN_TIMESTAMP,
    allowedRoot: ALLOWED_ROOT,
    primaryProject: PRIMARY_PROJECT_NAME,
    mode: FLAGS.quick ? 'QUICK (Static + JSDOM)' : 'FULL (Static + JSDOM + 1080p Headless Chrome)',
    online: FLAGS.online,
    overallScore,
    totals: {
      findings: ALL_FINDINGS.length,
      critical: totalCrit,
      warning: totalWarn,
      info: totalInfo
    },
    byPillar,
    byModule
  };
}

function generateMarkdownReport(scorecard, targets) {
  const lines = [];
  lines.push(`# Nikko's D Check — Diagnostic & Security Report`);
  lines.push('');
  lines.push(`* **Timestamp**: \`${scorecard.timestamp}\``);
  lines.push(`* **Primary Project**: \`${scorecard.primaryProject}\` (\`${PRIMARY_PROJECT_ROOT}\`)`);
  lines.push(`* **Workspace Boundary Lock**: \`${scorecard.allowedRoot}\``);
  lines.push(`* **Scan Mode**: ${scorecard.mode}`);
  lines.push(`* **Overall Health Score**: **${scorecard.overallScore} / 100** (${scorecard.totals.critical} Critical, ${scorecard.totals.warning} Warnings, ${scorecard.totals.info} Info)`);
  lines.push('');

  lines.push(`## 1. Five-Pillar Scorecard`);
  lines.push('');
  lines.push(`| Pillar | Status | Score | Critical | Warning | Info | Total |`);
  lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
  for (const [pillar, stats] of Object.entries(scorecard.byPillar)) {
    lines.push(`| **${pillar}** | **${stats.status}** | ${stats.score}/100 | ${stats.critical} | ${stats.warning} | ${stats.info} | ${stats.total} |`);
  }
  lines.push('');

  lines.push(`## 2. Scanned Project & Modules Summary`);
  lines.push('');
  lines.push(`| Module | Role | Critical | Warning | Info | Total |`);
  lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
  for (const [modName, stats] of Object.entries(scorecard.byModule)) {
    lines.push(`| \`${modName}\` | ${stats.role} | ${stats.critical} | ${stats.warning} | ${stats.info} | ${stats.total} |`);
  }
  lines.push('');

  lines.push(`## 3. Detailed Findings (${ALL_FINDINGS.length})`);
  lines.push('');
  if (ALL_FINDINGS.length === 0) {
    lines.push(`No issues detected across all scanned pillars and modules.`);
  } else {
    const sorted = [...ALL_FINDINGS].sort((a, b) => {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });
    lines.push(`| ID | Severity | Pillar | Module | Type | Location | Detail |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
    for (const f of sorted) {
      const loc = f.line ? `${f.file}:${f.line}` : f.file || f.selector || '-';
      const safeDetail = String(f.detail || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
      lines.push(`| \`${f.id}\` | **${f.severity}** | ${f.pillar} | \`${f.module}\` | \`${f.type}\` | \`${loc}\` | ${safeDetail} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function generateHtmlDashboard(scorecard, findings, screenshotsList = [], screenshotPrefix = 'screenshots/') {
  const payload = JSON.stringify({ scorecard, findings, screenshots: screenshotsList, screenshotPrefix }).replace(/<\//g, '<\\/');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nikko's D Check — Interactive Audit Dashboard (${scorecard.timestamp})</title>
<style>
  :root {
    --bg: #080b11;
    --panel: #101622;
    --panel-alt: #151d2e;
    --border: #23304a;
    --text: #f1f5f9;
    --muted: #94a3b8;
    --accent: #38bdf8;
    --crit: #ff1744;
    --warn: #ffab00;
    --info: #38bdf8;
    --pass: #00e676;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: radial-gradient(circle at top right, #131c31 0%, var(--bg) 65%);
    color: var(--text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
    padding: 20px 28px;
  }
  @keyframes blinkColon {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0.15; }
  }
  .clock-colon {
    display: inline-block;
    animation: blinkColon 1s infinite;
    font-weight: 800;
    color: var(--accent);
    margin: 0 1px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px 24px;
    margin-bottom: 18px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.45);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  .shield {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    background: linear-gradient(135deg, #0284c7, #6366f1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 22px;
    color: #fff;
    flex-shrink: 0;
    box-shadow: 0 0 20px rgba(56,189,248,0.35);
  }
  .brand-text h1 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0.4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .brand-text p {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 3px;
  }
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-shrink: 0;
  }
  .score-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--panel-alt);
    border: 1px solid var(--border);
    padding: 8px 16px;
    border-radius: 12px;
  }
  .score-num {
    font-size: 26px;
    font-weight: 900;
  }
  .clock-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 20px;
    font-weight: 700;
    background: #0a0f18;
    border: 1px solid var(--border);
    padding: 8px 14px;
    border-radius: 10px;
    white-space: nowrap;
  }
  .pillars-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
    margin-bottom: 18px;
  }
  .pillar-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 18px;
    cursor: pointer;
    transition: all 0.18s ease;
    position: relative;
    overflow: hidden;
  }
  .pillar-card:hover, .pillar-card.active {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(56,189,248,0.18);
  }
  .pillar-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .pillar-name {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.6px;
    white-space: nowrap;
  }
  .status-badge {
    font-size: 11px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }
  .status-PASS { background: rgba(0,230,118,0.15); color: var(--pass); border: 1px solid rgba(0,230,118,0.4); }
  .status-WARN { background: rgba(255,171,0,0.15); color: var(--warn); border: 1px solid rgba(255,171,0,0.4); }
  .status-FAIL { background: rgba(255,23,68,0.15); color: var(--crit); border: 1px solid rgba(255,23,68,0.4); }
  .pillar-score {
    font-size: 24px;
    font-weight: 900;
    margin-bottom: 6px;
  }
  .pillar-counts {
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .c-crit { color: var(--crit); font-weight: 700; }
  .c-warn { color: var(--warn); font-weight: 700; }
  .c-info { color: var(--info); font-weight: 700; }

  .controls-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 18px;
    margin-bottom: 14px;
  }
  .pill-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .filter-btn {
    background: var(--panel-alt);
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .filter-btn:hover, .filter-btn.active {
    background: var(--accent);
    color: #06101e;
    border-color: var(--accent);
  }
  .search-input {
    background: #0a0f18;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    min-width: 240px;
  }
  .tabs-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }
  .tab-btn {
    background: var(--panel);
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }
  .tab-btn.active {
    background: linear-gradient(135deg, #0284c7, #4f46e5);
    color: #fff;
    border-color: transparent;
  }
  .table-wrap {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  th, td {
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid rgba(35,48,74,0.6);
    font-size: 13px;
    vertical-align: top;
  }
  th {
    background: var(--panel-alt);
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    white-space: nowrap;
  }
  tr:hover td {
    background: rgba(56,189,248,0.04);
  }
  .sev-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .sev-CRITICAL { background: rgba(255,23,68,0.18); color: var(--crit); border: 1px solid rgba(255,23,68,0.45); }
  .sev-WARNING { background: rgba(255,171,0,0.18); color: var(--warn); border: 1px solid rgba(255,171,0,0.45); }
  .sev-INFO { background: rgba(56,189,248,0.18); color: var(--info); border: 1px solid rgba(56,189,248,0.45); }
  .cell-ellipsis {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .code-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #cbd5e1;
  }
  .fix-hint {
    margin-top: 4px;
    font-size: 11px;
    color: #93c5fd;
  }
  .gallery-grid {
    display: none;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }
  .shot-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.15s;
  }
  .shot-card:hover {
    transform: translateY(-3px);
    border-color: var(--accent);
  }
  .shot-card img {
    width: 100%;
    height: 190px;
    object-fit: cover;
    display: block;
    background: #05070b;
  }
  .shot-label {
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lightbox {
    position: fixed;
    inset: 0;
    background: rgba(4,7,14,0.92);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 30px;
    flex-direction: column;
    gap: 14px;
  }
  .lightbox.open { display: flex; }
  .lightbox img {
    max-width: 95vw;
    max-height: 85vh;
    border: 2px solid var(--accent);
    border-radius: 10px;
  }
  .lightbox-caption {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
  }
</style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <div class="shield">D</div>
      <div class="brand-text">
        <h1>NIKKO'S D CHECK — 5-PILLAR DIAGNOSTIC DASHBOARD</h1>
        <p id="meta-subtitle"></p>
      </div>
    </div>
    <div class="topbar-right">
      <div class="score-pill">
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;">Health Score</div>
          <div id="overall-counts" style="font-size:11px;white-space:nowrap;"></div>
        </div>
        <div class="score-num" id="overall-score"></div>
      </div>
      <div class="clock-box" id="live-clock">00<span class="clock-colon">:</span>00<span class="clock-colon">:</span>00</div>
    </div>
  </header>

  <section class="pillars-grid" id="pillars-grid"></section>

  <div class="tabs-bar">
    <button class="tab-btn active" id="tab-findings" onclick="switchTab('findings')">Findings Table (<span id="filtered-count">0</span>)</button>
    <button class="tab-btn" id="tab-screenshots" onclick="switchTab('screenshots')">1080p Screenshot Gallery (<span id="shot-count">0</span>)</button>
  </div>

  <section class="controls-bar" id="controls-bar">
    <div class="pill-group" id="severity-pills"></div>
    <div class="pill-group" id="module-pills"></div>
    <input type="text" class="search-input" id="search-box" placeholder="Search file, selector, type, or detail...">
  </section>

  <main id="findings-view" class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:72px;">ID</th>
          <th style="width:98px;">Severity</th>
          <th style="width:94px;">Pillar</th>
          <th style="width:120px;">Module</th>
          <th style="width:220px;">Check Type</th>
          <th style="width:270px;">File / Selector</th>
          <th>Finding Detail & Recommended Fix</th>
        </tr>
      </thead>
      <tbody id="findings-tbody"></tbody>
    </table>
  </main>

  <section id="screenshots-view" class="gallery-grid"></section>

  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" src="" alt="Screenshot preview">
    <div class="lightbox-caption" id="lightbox-caption"></div>
  </div>

  <script>
    const DATA = ${payload};
    let state = {
      pillar: 'ALL',
      severity: 'ALL',
      module: 'ALL',
      search: ''
    };

    function updateClock() {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const el = document.getElementById('live-clock');
      if (el) {
        el.innerHTML = pad(now.getHours()) + '<span class="clock-colon">:</span>' + pad(now.getMinutes()) + '<span class="clock-colon">:</span>' + pad(now.getSeconds());
      }
    }
    setInterval(updateClock, 1000);
    updateClock();

    function initDashboard() {
      const sc = DATA.scorecard;
      document.getElementById('meta-subtitle').textContent =
        'Run: ' + sc.timestamp + '  |  Project: ' + sc.primaryProject + '  |  Boundary Root: ' + sc.allowedRoot + '  |  Mode: ' + sc.mode;
      document.getElementById('overall-score').textContent = sc.overallScore + '/100';
      document.getElementById('overall-score').style.color =
        sc.overallScore >= 80 ? 'var(--pass)' : sc.overallScore >= 50 ? 'var(--warn)' : 'var(--crit)';
      document.getElementById('overall-counts').innerHTML =
        '<span class="c-crit">' + sc.totals.critical + ' Crit</span> · <span class="c-warn">' + sc.totals.warning + ' Warn</span> · <span class="c-info">' + sc.totals.info + ' Info</span>';

      renderPillars();
      renderFilterPills();
      renderTable();
      renderScreenshots();

      document.getElementById('search-box').addEventListener('input', e => {
        state.search = e.target.value.trim().toLowerCase();
        renderTable();
      });
    }

    function renderPillars() {
      const grid = document.getElementById('pillars-grid');
      const entries = Object.entries(DATA.scorecard.byPillar);
      grid.innerHTML = entries.map(([name, st]) => {
        const isActive = state.pillar === name ? 'active' : '';
        return '<div class="pillar-card ' + isActive + '" onclick="togglePillar(\\'' + name + '\\')">' +
          '<div class="pillar-top">' +
            '<span class="pillar-name">' + name + '</span>' +
            '<span class="status-badge status-' + st.status + '">' + st.status + '</span>' +
          '</div>' +
          '<div class="pillar-score">' + st.score + '<span style="font-size:13px;color:var(--muted);font-weight:600;">/100</span></div>' +
          '<div class="pillar-counts">' +
            '<span class="c-crit">' + st.critical + ' Crit</span>' +
            '<span class="c-warn">' + st.warning + ' Warn</span>' +
            '<span class="c-info">' + st.info + ' Info</span>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function togglePillar(p) {
      state.pillar = state.pillar === p ? 'ALL' : p;
      renderPillars();
      renderTable();
    }

    function setSeverity(sev) {
      state.severity = sev;
      renderFilterPills();
      renderTable();
    }

    function setModule(mod) {
      state.module = mod;
      renderFilterPills();
      renderTable();
    }

    function renderFilterPills() {
      const sevEl = document.getElementById('severity-pills');
      const sevs = ['ALL', 'CRITICAL', 'WARNING', 'INFO'];
      sevEl.innerHTML = sevs.map(s =>
        '<button class="filter-btn ' + (state.severity === s ? 'active' : '') + '" onclick="setSeverity(\\'' + s + '\\')">' + s + '</button>'
      ).join('');

      const modEl = document.getElementById('module-pills');
      const mods = ['ALL', ...Object.keys(DATA.scorecard.byModule)];
      modEl.innerHTML = mods.map(m => {
        const count = m === 'ALL' ? DATA.findings.length : (DATA.scorecard.byModule[m]?.total || 0);
        return '<button class="filter-btn ' + (state.module === m ? 'active' : '') + '" onclick="setModule(\\'' + m + '\\')">' + m + ' (' + count + ')</button>';
      }).join('');
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderTable() {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      const filtered = DATA.findings.filter(f => {
        if (state.pillar !== 'ALL' && f.pillar !== state.pillar) return false;
        if (state.severity !== 'ALL' && f.severity !== state.severity) return false;
        if (state.module !== 'ALL' && f.module !== state.module) return false;
        if (state.search) {
          const hay = (f.id + ' ' + f.type + ' ' + f.file + ' ' + f.selector + ' ' + f.detail + ' ' + f.module).toLowerCase();
          if (!hay.includes(state.search)) return false;
        }
        return true;
      }).sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

      document.getElementById('filtered-count').textContent = filtered.length;
      const tbody = document.getElementById('findings-tbody');
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted);">No findings match the active filters.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(f => {
        const loc = f.line ? (f.file + ':' + f.line) : (f.file || '-');
        const sel = f.selector ? '<div class="code-tag cell-ellipsis" style="color:#94a3b8;margin-top:2px;" title="' + escapeHtml(f.selector) + '">' + escapeHtml(f.selector) + '</div>' : '';
        const hint = f.fixHint ? '<div class="fix-hint">Fix: ' + escapeHtml(f.fixHint) + '</div>' : '';
        return '<tr>' +
          '<td class="code-tag">' + escapeHtml(f.id) + '</td>' +
          '<td><span class="sev-badge sev-' + escapeHtml(f.severity) + '">' + escapeHtml(f.severity) + '</span></td>' +
          '<td style="font-weight:700;">' + escapeHtml(f.pillar) + '</td>' +
          '<td class="code-tag cell-ellipsis" title="' + escapeHtml(f.module) + '">' + escapeHtml(f.module) + '</td>' +
          '<td class="code-tag cell-ellipsis" title="' + escapeHtml(f.type) + '">' + escapeHtml(f.type) + '</td>' +
          '<td><div class="code-tag cell-ellipsis" title="' + escapeHtml(loc) + '">' + escapeHtml(loc) + '</div>' + sel + '</td>' +
          '<td><div>' + escapeHtml(f.detail) + '</div>' + hint + '</td>' +
        '</tr>';
      }).join('');
    }

    function renderScreenshots() {
      const shots = DATA.screenshots || [];
      document.getElementById('shot-count').textContent = shots.length;
      const grid = document.getElementById('screenshots-view');
      grid.innerHTML = shots.map(file => {
        const src = DATA.screenshotPrefix + file;
        return '<div class="shot-card" onclick="openLightbox(\\'' + src + '\\', \\'' + file + '\\')">' +
          '<img src="' + src + '" loading="lazy" alt="' + file + '">' +
          '<div class="shot-label">' + file + '</div>' +
        '</div>';
      }).join('');
    }

    function switchTab(tab) {
      const isFindings = tab === 'findings';
      document.getElementById('tab-findings').classList.toggle('active', isFindings);
      document.getElementById('tab-screenshots').classList.toggle('active', !isFindings);
      document.getElementById('findings-view').style.display = isFindings ? 'block' : 'none';
      document.getElementById('controls-bar').style.display = isFindings ? 'flex' : 'none';
      document.getElementById('screenshots-view').style.display = isFindings ? 'none' : 'grid';
    }

    function openLightbox(src, caption) {
      document.getElementById('lightbox-img').src = src;
      document.getElementById('lightbox-caption').textContent = caption;
      document.getElementById('lightbox').classList.add('open');
    }

    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('open');
    }

    initDashboard();
  </script>
</body>
</html>`;
}

function writeReports(scorecard, targets) {
  const md = generateMarkdownReport(scorecard, targets);
  const reportMdPath = path.join(RUN_REPORT_DIR, 'report.md');
  const reportJsonPath = path.join(RUN_REPORT_DIR, 'report.json');
  const latestMdPath = path.join(REPORTS_BASE_DIR, 'latest.md');
  const runDashboardPath = path.join(RUN_REPORT_DIR, 'dashboard.html');
  const latestDashboardPath = path.join(REPORTS_BASE_DIR, 'dashboard.html');
  const rootDashboardPath = path.join(PRIMARY_PROJECT_ROOT, 'd-check-dashboard.html');

  let screenshotsList = [];
  try {
    if (fs.existsSync(SCREENSHOTS_DIR)) {
      screenshotsList = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png')).sort();
    }
  } catch (_) {}

  fs.writeFileSync(reportMdPath, md, 'utf8');
  fs.writeFileSync(
    reportJsonPath,
    JSON.stringify({ scorecard, findings: ALL_FINDINGS }, null, 2),
    'utf8'
  );
  fs.writeFileSync(latestMdPath, md, 'utf8');
  fs.writeFileSync(
    runDashboardPath,
    generateHtmlDashboard(scorecard, ALL_FINDINGS, screenshotsList, 'screenshots/'),
    'utf8'
  );
  fs.writeFileSync(
    latestDashboardPath,
    generateHtmlDashboard(scorecard, ALL_FINDINGS, screenshotsList, `${RUN_TIMESTAMP}/screenshots/`),
    'utf8'
  );
  fs.writeFileSync(
    rootDashboardPath,
    generateHtmlDashboard(scorecard, ALL_FINDINGS, screenshotsList, `nikkos-d-check-reports/${RUN_TIMESTAMP}/screenshots/`),
    'utf8'
  );

  return { reportMdPath, reportJsonPath, latestMdPath, runDashboardPath, latestDashboardPath, rootDashboardPath };
}

// ============================================================================
// 11. INTERACTIVE POST-SCAN MENU
// ============================================================================
function generateFixPlanFile(scorecard) {
  const fixPlanPath = path.join(RUN_REPORT_DIR, 'fix-plan.md');
  const sorted = [...ALL_FINDINGS].sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const lines = [
    `# Nikko's D Check — Prioritized Action & Fix Plan`,
    `* **Generated**: \`${new Date().toISOString()}\``,
    `* **Source Run**: \`${scorecard.timestamp}\``,
    '',
    `## Action Items (${sorted.length})`
  ];

  sorted.forEach((f, idx) => {
    const loc = f.line ? `${f.file}:${f.line}` : f.file || f.selector || '-';
    lines.push(`### ${idx + 1}. [${f.severity}] [${f.pillar}] \`${f.type}\` in \`${f.module}\``);
    lines.push(`* **Location**: \`${loc}\``);
    lines.push(`* **Finding**: ${f.detail}`);
    if (f.fixHint) lines.push(`* **Recommended Fix**: ${f.fixHint}`);
    lines.push('');
  });

  fs.writeFileSync(fixPlanPath, lines.join('\n'), 'utf8');
  return fixPlanPath;
}

function compareWithPreviousRun() {
  const runDirs = fs.readdirSync(REPORTS_BASE_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(e.name))
    .map(e => e.name)
    .sort()
    .reverse();

  const prevRun = runDirs.find(d => d !== RUN_TIMESTAMP);
  if (!prevRun) {
    console.log('\n[Compare] No previous run found in nikkos-d-check-reports/.');
    return;
  }

  const prevJsonPath = path.join(REPORTS_BASE_DIR, prevRun, 'report.json');
  if (!fs.existsSync(prevJsonPath)) {
    console.log(`\n[Compare] Previous run (${prevRun}) is missing report.json.`);
    return;
  }

  const prevData = JSON.parse(fs.readFileSync(prevJsonPath, 'utf8'));
  const prevKeys = new Set((prevData.findings || []).map(f => `${f.pillar}|${f.module}|${f.type}|${f.file}|${f.detail}`));
  const currKeys = new Set(ALL_FINDINGS.map(f => `${f.pillar}|${f.module}|${f.type}|${f.file}|${f.detail}`));

  const newIssues = [...currKeys].filter(k => !prevKeys.has(k));
  const resolvedIssues = [...prevKeys].filter(k => !currKeys.has(k));

  console.log(`\n=== Comparison vs Previous Run (${prevRun}) ===`);
  console.log(`* Previous Total: ${(prevData.findings || []).length} | Current Total: ${ALL_FINDINGS.length}`);
  console.log(`* Resolved Issues: ${resolvedIssues.length}`);
  console.log(`* New Issues:      ${newIssues.length}`);
}

async function showInteractiveMenu(scorecard, paths) {
  if (FLAGS.noMenu) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = q => new Promise(resolve => rl.question(q, resolve));

  while (true) {
    console.log('\n====================================================================');
    console.log(" NIKKO'S D CHECK — POST-SCAN OPTIONS MENU");
    console.log('====================================================================');
    console.log(' [1] Filter & view findings by Pillar (DESIGN, CODE, RULES, PROBLEMS, SECURITY)');
    console.log(' [2] Filter & view findings by Module (_ct-MATRIX, ct-ACE2, _ct-MMR, etc.)');
    console.log(' [3] Generate prioritized fix-plan.md inside this run folder');
    console.log(' [4] Compare this scan with the previous scan run');
    console.log(' [5] Save this scan as baseline.json');
    console.log(' [0] Exit');
    console.log('--------------------------------------------------------------------');

    const choice = (await ask('Select option [0-5]: ')).trim();
    if (choice === '0' || choice === '') {
      break;
    } else if (choice === '1') {
      const p = (await ask('Enter Pillar (DESIGN / CODE / RULES / PROBLEMS / SECURITY): ')).trim().toUpperCase();
      const matches = ALL_FINDINGS.filter(f => f.pillar === p);
      console.log(`\n--- ${matches.length} Findings for Pillar: ${p} ---`);
      matches.forEach(f => console.log(` [${f.severity}] [${f.module}] ${f.type} (${f.file}): ${f.detail}`));
    } else if (choice === '2') {
      const m = (await ask('Enter Module name (e.g. _ct-MATRIX, ct-ACE2): ')).trim().toLowerCase();
      const matches = ALL_FINDINGS.filter(f => f.module.toLowerCase() === m);
      console.log(`\n--- ${matches.length} Findings for Module: ${m} ---`);
      matches.forEach(f => console.log(` [${f.severity}] [${f.pillar}] ${f.type} (${f.file}): ${f.detail}`));
    } else if (choice === '3') {
      const planFile = generateFixPlanFile(scorecard);
      console.log(`\n[Fix Plan] Generated at: ${planFile}`);
    } else if (choice === '4') {
      compareWithPreviousRun();
    } else if (choice === '5') {
      const baselinePath = path.join(REPORTS_BASE_DIR, 'baseline.json');
      fs.copyFileSync(paths.reportJsonPath, baselinePath);
      console.log(`\n[Baseline] Saved baseline to: ${baselinePath}`);
    }
  }

  rl.close();
}

// ============================================================================
// 12. MAIN EXECUTION ENTRY POINT
// ============================================================================
async function main() {
  ensureGitignoreHasReports(PRIMARY_PROJECT_ROOT);

  const targets = discoverScanTargets(PRIMARY_PROJECT_ROOT);
  log('====================================================================');
  log(` NIKKO'S D CHECK v1.0.0 — Starting Audit`);
  log(` Boundary Root   : ${ALLOWED_ROOT}`);
  log(` Primary Project : ${PRIMARY_PROJECT_NAME} (${PRIMARY_PROJECT_ROOT})`);
  log(` Modules Scanned : ${targets.map(t => t.name).join(', ')}`);
  log(` Report Folder   : ${RUN_REPORT_DIR}`);
  log('====================================================================');

  // Step 1: Static Code, Problems & Security checks across all target folders
  for (const target of targets) {
    log(`Scanning static CODE / PROBLEMS / SECURITY in [${target.name}]...`);
    runStaticCodeProblemsSecurityChecks(target);
  }

  // Step 2: JSDOM Full-Queue Loop & Time-Window Stress Suite (if _ct-MATRIX is in scope)
  const matrixTarget = targets.find(t => t.name === '_ct-MATRIX');
  if (matrixTarget) {
    await runMatrixJsdomStressSuite(matrixTarget.dir);
  }

  // Step 3: Headless Chrome 1080p DESIGN, RULES & RUNTIME Audit (unless --quick)
  if (!FLAGS.quick) {
    await runHeadlessBrowserAudit(targets);
  } else {
    log('Skipping Headless Chrome 1080p checks (--quick mode enabled).');
  }

  // Step 4: Optional --online checks
  await runOnlineChecks(targets);

  // Step 5: Write timestamped reports & prune >20 old runs
  const scorecard = buildScorecard(targets);
  const reportPaths = writeReports(scorecard, targets);
  pruneOldReports(REPORTS_BASE_DIR, 20);

  log('====================================================================');
  log(` NIKKO'S D CHECK COMPLETE — Overall Score: ${scorecard.overallScore}/100`);
  log(` Findings : ${scorecard.totals.critical} Critical | ${scorecard.totals.warning} Warning | ${scorecard.totals.info} Info`);
  log(` Markdown : ${reportPaths.reportMdPath}`);
  log(` Latest   : ${reportPaths.latestMdPath}`);
  log(` JSON     : ${reportPaths.reportJsonPath}`);
  log(` Log      : ${SCAN_LOG_PATH}`);
  log('====================================================================');

  await showInteractiveMenu(scorecard, reportPaths);

  if (scorecard.totals.critical > 0) process.exitCode = 2;
  else if (scorecard.totals.warning > 0) process.exitCode = 1;
  else process.exitCode = 0;
}

main().catch(err => {
  console.error(`\n[FATAL] Nikko's D Check crashed: ${err.stack || err.message}`);
  process.exit(2);
});
