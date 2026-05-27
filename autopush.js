import { watch, readdirSync, statSync } from 'fs';
import { exec } from 'child_process';
import { resolve, join } from 'path';

const WATCH_DIR = resolve('.');
const DEBOUNCE_MS = 2000;
let timeoutId = null;

const EXCLUDE_DIRS = ['.git', 'node_modules', 'dist'];

// Track active watchers
const watchers = new Map();

function runGit() {
  console.log(`\n[Auto-Push] [${new Date().toLocaleTimeString()}] Detecting file saves...`);
  
  exec('git add -A', (err) => {
    if (err) {
      console.error(`[Auto-Push] Error during git add:`, err);
      return;
    }
    
    exec('git diff --cached --quiet', (diffErr) => {
      if (diffErr) { // exit code !== 0 means there are staged changes
        const dateStr = new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const commitMsg = `Auto-save on ${dateStr}`;
        
        exec(`git commit -m "${commitMsg}"`, (commitErr, stdout) => {
          if (commitErr) {
            console.error(`[Auto-Push] Commit failed:`, commitErr);
            return;
          }
          console.log(stdout.trim());
          
          console.log(`[Auto-Push] Pushing changes to GitHub...`);
          exec('git push', (pushErr, pushStdout, pushStderr) => {
            if (pushErr) {
              console.error(`[Auto-Push] Push failed:\n`, pushStderr || pushErr);
              return;
            }
            console.log(`[Auto-Push] Push successful!`);
          });
        });
      } else {
        console.log(`[Auto-Push] No new changes to commit.`);
      }
    });
  });
}

function triggerSync() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(runGit, DEBOUNCE_MS);
}

function watchDirectory(dirPath) {
  if (watchers.has(dirPath)) return;

  try {
    const watcher = watch(dirPath, (eventType, filename) => {
      // If a new directory is created, watch it
      if (filename) {
        const fullPath = join(dirPath, filename);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            const base = filename;
            if (!EXCLUDE_DIRS.includes(base)) {
              watchDirectory(fullPath);
            }
          }
        } catch (e) {
          // File might have been deleted/moved
        }
      }
      triggerSync();
    });

    watchers.set(dirPath, watcher);

    // Recursively read subdirectories
    const files = readdirSync(dirPath);
    for (const file of files) {
      if (EXCLUDE_DIRS.includes(file)) continue;
      
      const fullPath = join(dirPath, file);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          watchDirectory(fullPath);
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error(`[Auto-Push] Error watching ${dirPath}:`, err);
  }
}

console.log(`[Auto-Push] Starting watcher in ${WATCH_DIR}...`);
watchDirectory(WATCH_DIR);
console.log(`[Auto-Push] Watching ${watchers.size} directories. Ready and listening for saves!`);
