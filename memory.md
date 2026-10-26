# Memory Bank: _ct-MATRIX

## System Architecture
- **Project Name**: `_ct-MATRIX` (Coasters Tavern Advertising & Digital Signage Display Hub)
- **Tech Stack**: Vanilla HTML5, CSS3, ES6+ JavaScript, Firebase Realtime Database (`ct-mmr-default-rtdb.firebaseio.com`), Google Sheets CSV feed, `BroadcastChannel('ct_matrix_sync')`.
- **Key Files**:
  - `index.html`: Main 1080p digital signage display (`#slide-viewport`, `#slide-target`, `#progress-bar`).
  - `matrix-core.js`: Core state machine (`window.MATRIX`), Google Sheet CSV parser, module queue builder (`buildSlideQueue`), slide renderer (`renderActiveSlide`), rotation timers (`nextSlide`, `prevSlide`, `stuckSlideWatchdog`), keyboard navigation (`setupSlideshowKeyboardNav`), and cross-tab/Firebase sync (`setupBroadcastListener`, `handleCloudState`).
  - `firebase-bridge.js`: Connects `index.html` and `remote.html` to Firebase RTDB paths `matrix_command` and `matrix_state` and relays updates to `BroadcastChannel('ct_matrix_sync')`.
  - `masteradmin.html`: Master control dashboard with `#preview-frame`, `#billboard-frame`, `#monitor-tray`, and sidebar module toggles/durations.
  - `remote.html`: Mobile/remote controller for module toggles, live slide injection, and manual slide jumps.
  - `preview.html`: Multi-slide preview monitor grid.
  - `scripts/nikkos-d-check.mjs`: Nikko's D Check project & module scanner + HTML dashboard generator.

## Key Decisions & Root-Cause Reference
- **Module ID Normalization (`normalizeModuleId`)**: Admin/Remote UI labels like `"ACE 2"` must always normalize by stripping whitespace (`"ct-ace2"`) before filtering `CONFIG.disabledModules`.
- **Master Dashboard Preview vs Monitor Tray Iframes (`isMasterPreviewFrame`)**: Only `#preview-frame` inside `masteradmin.html` acts as Master broadcaster. `.monitor-thumb` iframes in `#monitor-tray` must load with `?noBroadcast=1&hideControls=1` so they never emit competing `SYNC_JUMP` or `CURRENT_SLIDE_BROADCAST` events.
- **Module & Event Interleaving (`buildSlideQueue`)**: Active modules (`ct-mmr`, `ct-ace2`, `ct-quiz`, `ct-fir`, `ct-soc`, `ct-tik`, `ct-faceb`, `ct-insta`, `ct-loyalty`, `ct-west`, `ct-hallo`) are interleaved evenly with Google Sheet event slides (and default to `30s` hold when set to `"all"` outside draw windows) so displays never stall for 10+ minutes on front-loaded modules.
- **Boot & Sync Resilience (`initMatrix` / `handleCloudState` / `handleLiveSlide`)**:
  - `setupSlideshowKeyboardNav()` and `setupBroadcastListener()` attach before `await loadAllDataSources()`.
  - `handleCloudState` ignores `LIVE_SLIDE: { active: false }` unless a live overlay is actually active, preventing `SYNC_STATE` from resetting the active slide timer.
  - `CURRENT_SLIDE_BROADCAST` in `masteradmin.html` requests local-only telemetry (`requestTelemetry(true)`) so it never overwrites `SYNC_JUMP` in Firebase `matrix_command`.

## Active Context
- **Current Focus**: Verified automatic slide progression, module interleaving, and Firebase/BroadcastChannel sync across `index.html`, `masteradmin.html`, `remote.html`, and `preview.html`.

## Episodic Change Log
- **[2026-10-27]**: Fixed slide progression stall in `matrix-core.js`, `masteradmin.html`, and `remote.html` (normalized module IDs, isolated master preview iframe from monitor thumbnails, interleaved modules with event slides, capped default module hold to 30s, guarded timers against `SYNC_STATE` resets, and populated `memory.md`).
