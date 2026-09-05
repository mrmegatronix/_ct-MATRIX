# Master Admin Panel (`masteradmin.html`) Rebuild Specification

This document provides the complete architecture, layout specification, component code, data flows, and communication contracts necessary to rebuild `masteradmin.html` from scratch.

---

## 1. Architecture & Overview

`masteradmin.html` serves as the centralized command center for the **_ct-MATRIX** digital signage ecosystem. It manages:
- **A-Frame (Live Monitor):** Real-time scaled 1920×1080 preview of `index.html`.
- **B-Frame (Billboard Feed):** Real-time scaled 400×200 preview of `billboard.html`.
- **C-Frame (Operator Workspace):** Interactive iframe host for module admin panels, Dashboard Home, Schedule Manager, or Playlist Grid.
- **Footer Monitor Tray:** Mini thumbnail previews of all sub-modules running in real time.
- **Control & Sync Layer:** Dual-channel orchestration via local `BroadcastChannel('ct_matrix_sync')` and direct cloud writes to Firebase Realtime Database.

---

## 2. Dependencies & External Assets

### Fonts
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

### Module Files
- `./firebase-config.js` (Firebase client export: `db`, `ref`, `set`, `update`)
- `./firebase-bridge.js` (Broadcast relay and bridge listener)
- `matrix_login_bg_1778957890247.png` (PIN overlay background asset, fallback to dark radial gradient)

### Window Flag
```javascript
window.IS_MASTER_DASHBOARD = true;
```

---

## 3. CSS Design System & Layout Tokens

### CSS Custom Properties
```css
:root {
  --bg: #020617;
  --surface: rgba(15, 23, 42, 0.6);
  --surface-bright: rgba(30, 41, 59, 0.8);
  --surface-hover: rgba(30, 41, 59, 0.8);
  --accent: #06b6d4;
  --accent-hover: #0891b2;
  --accent-glow: rgba(6, 182, 212, 0.5);
  --success: #10b981;
  --success-glow: rgba(16, 185, 129, 0.5);
  --text: #f8fafc;
  --text-dim: #94a3b8;
  --border: rgba(255, 255, 255, 0.1);
  --glass: rgba(15, 23, 42, 0.85);
  --nav-w: 240px;
  --header-h: 80px;
  --bottom-h: 220px;
  --card-w: 280px;
  --card-scale: 0.1458;
}

@media (max-height: 850px) {
  :root {
    --bottom-h: 170px;
    --card-w: 220px;
    --card-scale: 0.1145;
  }
}

@media (max-height: 700px) {
  :root {
    --bottom-h: 130px;
    --card-w: 160px;
    --card-scale: 0.0833;
  }
}
```

### App Shell Grid
```css
.app-shell {
  display: grid;
  grid-template-columns: var(--nav-w) 1.25fr 0.75fr;
  grid-template-rows: var(--header-h) 1fr var(--bottom-h);
  height: 100vh;
  overflow: hidden;
}

.header-top {
  grid-column: 1 / -1;
}

.nav-side {
  grid-row: 2 / 3;
  grid-column: 1 / 2;
}

.workspace-left {
  grid-row: 2 / 3;
  grid-column: 2 / 3;
}

.workspace-right-stack {
  grid-row: 2 / 3;
  grid-column: 3 / 4;
}

.footer-tray {
  grid-column: 1 / -1;
  grid-row: 3 / 4;
}
```

---

## 4. UI Components & Markup Structure

### 4.1. PIN Authentication Overlay
- **Container:** `#auth-screen.auth-overlay`
- **PIN Box:** `#pin-box.pin-box`
- **Keypad:** Digits `0-9`, `CLR` ('C'), `OK` ('E').
- **Accepted PINs:**
  - Value stored in `localStorage.getItem('matrix_config').ADMIN_PIN`
  - Default PIN: `5551`
  - Master override: `0001`
  - Auto-bypass: When `hostname === '192.168.1.97' || hostname === 'localhost'`, sets `sessionStorage.setItem('matrix_authed', 'true')`.
- **Keydown listener:** Keyboard numeric input `0-9`, `Enter` -> `E`, `Escape`/`Backspace` -> `C`.

### 4.2. Top Header Bar (`.header-top`)
- **Brand Identity:** `MATRIX COMMAND`
- **Persistent Telemetry (`#persistent-telemetry`):**
  - `NOW PLAYING`: Current slide title / subtype.
  - `PLAYLIST LENGTH`: Formatted `Xm Ys`.
  - `ACTIVE SLIDES`: Total active slide count.
  - `ENGINE STATUS`: Live pulsing status badge.
- **Cloud Status (`#cloud-status`):**
  - Dot indicator `#cloud-dot.status-dot`
  - Sync state label (`SYNC LIVE` / `FIREBASE ERROR`)
- **Global Actions:**
  - `DASHBOARD` (`loadWorkspaceView('HOME')`)
  - `REFRESH ALL` (`sendMaster('REFRESH')`)
  - `CONFETTI` (`sendMaster('CONFETTI')`)
  - `LOGOUT` (`logout()`)

### 4.3. Left Navigation Bar (`.nav-side`)
- **Global Views:**
  - Dashboard Home (`loadWorkspaceView('HOME')`)
  - Playlist Grid (`loadWorkspaceView('PLAYLIST')`)
  - Module Schedules (`loadWorkspaceView('SCHEDULES')`)
  - Live Slide Commander (`loadModule('COMMANDER', 'live-commander.html?compact=true')`)
  - A4 Poster Maker (`loadModule('POSTER', 'postermaker.html')`)
  - Online File Browser (`loadModule('FILES', 'files.html')`)
- **Core Infrastructure Tree:**
  - Display Engine (`loadModule('MATRIX', 'index.html')`)
  - Master Admin Panel (active disabled indicator)
- **Live Modules Tree (`#live-modules-tree-container`):**
  - Dynamic module headers with toggle pill (`ON`, `OFF`, `SCHED`, `SCHED OFF`).
  - Expanding tree children containing:
    - Module rotation override input (seconds) + "Play All" checkbox.
    - Module slide link (e.g. `../_ct-ACE/index.html`).
    - Admin panel link (e.g. `../_ct-ACE/admin.html`) when `hasAdmin: true`.

### 4.4. C-Frame Operator Workspace (`#workspace-left`)
- **Panel Header:** Title (`#ctrl-title`), Sub-page context buttons (`#context-links`), URL indicator (`#ctrl-url`).
- **Interactive Container (`#operator-wrap`):** Houses `<iframe id="ctrl-frame">` or dynamic views (`renderDashboardHome`, `renderScheduleManager`).

### 4.5. Right Stack Workspace (`#workspace-right`)
- **Top Panel (A-Frame Live Monitor):**
  - `<iframe id="preview-frame" src="index.html" scrolling="no">`
  - Scaled dynamically from 1920×1080 to container dimensions via `scaleFrames()`.
- **Inter-Control Bar (`.inter-control-bar`):**
  - `PREV` (`sendMaster('PREV')`)
  - `NEXT SLIDE` (`sendMaster('NEXT')`)
  - `PAUSE/PLAY` (`sendMaster('TOGGLE')`)
- **Bottom Panel (B-Frame Billboard Feed):**
  - `<iframe id="billboard-frame" src="billboard.html" scrolling="no">`
  - Scaled dynamically from 400×200 to container dimensions via `scaleFrames()`.

### 4.6. Footer Monitor Tray (`#monitor-tray`)
- Horizontal scrolling container populated by `renderMonitorTray()`.
- Displays 1920×1080 iframe thumbnails for each non-disabled module.
- Clicking a monitor card invokes `loadModule(id, adminUrl)`.

### 4.7. Playlist Grid Overlay (`#full-grid-view`)
- Modal/Overlay view covering columns 2-4.
- Dynamically renders every slide in the active queue with metadata, thumbnail background, and click-to-jump trigger (`sendMaster('JUMP', slide.id)`).

---

## 5. Module Registry & Default Matrix

```javascript
const MODULES = [
  { id: 'ct-matrix',  name: 'MATRIX',   path: '_ct-MATRIX', title: 'Core Slides',          defaultDur: 30,  hasAdmin: false },
  { id: 'ct-ace',     name: 'ACE',      path: '_ct-ACE',    title: 'Chase Ace',            defaultDur: 180, hasAdmin: true,  defaultDays: [4],           defaultStart: '17:00', defaultEnd: '20:00' },
  { id: 'ct-mmr',     name: 'MMR',      path: '_ct-MMR',    title: 'Monster Meat Raffle',  defaultDur: 600, hasAdmin: true,  defaultDays: [5],           defaultStart: '16:00', defaultEnd: '19:00' },
  { id: 'ct-quiz',    name: 'QUIZ',     path: '_ct-QUIZ',   title: 'Pub Quiz',             defaultDur: 60,  hasAdmin: true,  defaultDays: [3],           defaultStart: '18:00', defaultEnd: '19:10' },
  { id: 'ct-wea1',    name: 'WEA1',     path: '_ct-wea1',   title: 'Weather',              defaultDur: 60,  hasAdmin: false, defaultDays: [0,1,2,3,4,5,6], defaultStart: '10:00', defaultEnd: '23:00' },
  { id: 'ct-fir',     name: 'FIR',      path: '_ct-FIR',    title: 'Fireplace',            defaultDur: 180, hasAdmin: false, defaultDays: [0,1,2,3,4,5,6], defaultStart: '17:00', defaultEnd: '23:00' },
  { id: 'ct-soc',     name: 'SOC',      path: '_ct-SOC',    title: 'Social Club',          defaultDur: 120, hasAdmin: true,  defaultDays: [0,1,2,3,4,5,6], defaultStart: '10:00', defaultEnd: '22:00' },
  { id: 'ct-tik',     name: 'TIK',      path: '_ct-TIK',    title: 'TikTok Feed',          defaultDur: 120, hasAdmin: false, defaultDays: [0,1,2,3,4,5,6], defaultStart: '10:00', defaultEnd: '23:00' },
  { id: 'ct-loyalty', name: 'LOYALTY',  path: '_ct-MATRIX', title: 'Loyalty App',          defaultDur: 60,  hasAdmin: false, customUrl: 'loyalty-slide.html', defaultDays: [0,1,2,3,4,5,6], defaultStart: '10:00', defaultEnd: '23:00' },
  { id: 'ct-trip',    name: 'TRIP',     path: '_ct-TRIP',   title: 'Trip Module',          defaultDur: 60,  hasAdmin: false, defaultDays: [0,1,2,3,4,5,6], defaultStart: '10:00', defaultEnd: '23:00' }
];
```

---

## 6. Messaging & State Synchronization Protocols

### 6.1. Dual-Channel Bus
Commands are emitted via:
1. `BroadcastChannel('ct_matrix_sync').postMessage(msg)`
2. Direct Firebase write via `set(ref(db, 'matrix_command'), payload)`

### 6.2. Inbound Message Handlers (`bc.onmessage`)
- **`SLIDES_DUMP`**:
  - Updates `#persistent-telemetry` (Now Playing, Total duration, Active count).
  - Re-renders `#playlist-grid` cards.
- **`CURRENT_SLIDE_BROADCAST`**: Triggers telemetry refresh (`requestTelemetry()`).
- **`DATA_HOT_RELOADED`**: Re-renders playlist grid & monitor tray.
- **`MODULE_FILTER` / `SETTINGS_UPDATE` / `SYNC_STATE`**: Re-renders sidebar toggles and dashboard home.

### 6.3. Outbound Message Payloads

#### General Control Command
```json
{
  "type": "REFRESH | CONFETTI | PREV | NEXT | TOGGLE | JUMP",
  "id": "optional-slide-or-module-id",
  "commandId": "cmd_1788494000000_abc123",
  "timestamp": 1788494000000,
  "senderTabId": "tab_1788494000000_xyz789"
}
```

#### Module Filter (Toggle Module)
```json
{
  "type": "MODULE_FILTER",
  "id": "ACE",
  "active": false,
  "commandId": "cmd_...",
  "timestamp": 1788494000000,
  "senderTabId": "tab_..."
}
```

#### Settings Update (Durations)
```json
{
  "type": "SETTINGS_UPDATE",
  "payload": {
    "moduleDurations": {
      "ct-matrix": 30,
      "ct-ace": 180,
      "ct-mmr": "all"
    }
  },
  "commandId": "cmd_...",
  "timestamp": 1788494000000,
  "senderTabId": "tab_..."
}
```

#### Schedule Update
```json
{
  "type": "SCHEDULE_UPDATE",
  "moduleSchedules": {
    "ct-quiz": {
      "enabled": true,
      "days": [3],
      "startTime": 18.0,
      "endTime": 19.167
    }
  },
  "commandId": "cmd_...",
  "timestamp": 1788494000000,
  "senderTabId": "tab_..."
}
```

#### Live Slide Push (Emergency / Promo Overlay)
```json
{
  "type": "LIVE_SLIDE",
  "payload": {
    "active": true,
    "title": "URGENT ANNOUNCEMENT",
    "detail": "Happy Hour begins in 10 minutes",
    "accent": "#ef4444",
    "mode": "INTERRUPT"
  },
  "commandId": "cmd_...",
  "timestamp": 1788494000000,
  "senderTabId": "tab_..."
}
```

---

## 7. Mathematical Viewport Scaling (`scaleFrames`)

Preview iframes maintain native display aspect ratios without clipping:
```javascript
function scaleFrames() {
  const previewFrame = document.getElementById('preview-frame');
  const billboardFrame = document.getElementById('billboard-frame');
  
  if (previewFrame && previewFrame.parentElement) {
    const wrap = previewFrame.parentElement;
    const w = wrap.clientWidth || wrap.offsetWidth;
    const h = wrap.clientHeight || wrap.offsetHeight;
    if (w > 0 && h > 0) {
      const scale = Math.min(w / 1920, h / 1080);
      previewFrame.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
  }
  
  if (billboardFrame && billboardFrame.parentElement) {
    const wrap = billboardFrame.parentElement;
    const w = wrap.clientWidth || wrap.offsetWidth;
    const h = wrap.clientHeight || wrap.offsetHeight;
    if (w > 0 && h > 0) {
      const scale = Math.min(w / 400, h / 200);
      billboardFrame.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
  }

  document.querySelectorAll('.monitor-thumb').forEach(thumb => {
    const iframe = thumb.querySelector('iframe');
    if (iframe) {
      const w = thumb.clientWidth || thumb.offsetWidth;
      const h = thumb.clientHeight || thumb.offsetHeight;
      if (w > 0 && h > 0) {
        const scale = Math.min(w / 1920, h / 1080);
        iframe.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    }
  });
}
```

---

## 8. Persistence & Configuration Keys

| Storage Location | Key Name | Purpose |
| :--- | :--- | :--- |
| `sessionStorage` | `matrix_authed` | `'true'` when PIN passed or auto-authorized on local network. |
| `localStorage` | `matrix_config` | JSON object storing `disabledModules`, `moduleDurations`, `moduleSchedules`, `ADMIN_PIN`. |
| `localStorage` | `matrix_client_id` | Unique client identifier for telemetry tracking (`client_...`). |
| `localStorage` | `matrix_migration_20260804_enable_all_modules` | Migration sentinel flag to initialize modules. |

---

## 9. Direct Firebase RTDB Bridge Code

```javascript
import { db, ref, set, update } from './firebase-config.js';

const COMMAND_PATH = 'matrix_command';
const STATE_PATH = 'matrix_state';

window.sendToFirebase = function(msg) {
  if (!db) {
    console.error('[MASTERADMIN] Firebase DB not initialized');
    return;
  }
  
  const payload = {
    ...msg,
    source: getClientIdForFirebase(),
    senderTabId: getTabId(),
    isFirebaseBridge: true
  };
  
  set(ref(db, COMMAND_PATH), payload)
    .then(() => {
      const dot = document.getElementById('cloud-dot');
      if (dot) {
        dot.style.background = 'var(--accent)';
        dot.classList.remove('pulse');
        void dot.offsetWidth;
        dot.classList.add('pulse');
        setTimeout(() => { dot.style.background = 'var(--success)'; }, 500);
      }
    })
    .catch((err) => {
      console.error('[MASTERADMIN] Firebase write failed:', err);
      const dot = document.getElementById('cloud-dot');
      if (dot) dot.style.background = '#ef4444';
      const label = document.querySelector('#cloud-status span:last-child');
      if (label) label.textContent = 'FIREBASE ERROR';
    });
  
  const PERSISTENT_TYPES = ['MODULE_FILTER', 'LIVE_SLIDE', 'SETTINGS_UPDATE'];
  if (PERSISTENT_TYPES.includes(msg.type)) {
    update(ref(db, STATE_PATH), { _last_updated_by: getClientIdForFirebase() });
    update(ref(db, `${STATE_PATH}/${msg.type}`), payload);
  }
};
```
