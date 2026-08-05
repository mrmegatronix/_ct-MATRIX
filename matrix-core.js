/**
 * MATRIX Core - Central Advertising Logic (v2.0.0)
 * Premium TV slide engine with cycling wallpapers,
 * GSheets integration, and modular project embedding.
 */

window.MATRIX = {
  VERSION: '2.0.0',
  CONFIG: {
    SWAP_DELAY: 30000,
    MODULE_DELAY: 60000,
    SYNC_CHANNEL: 'ct_matrix_sync',
    WEEKS_LOOKAHEAD: 2,
    SHOW_BANNER: true,
    ADMIN_PIN: '1234',
    GSHEETS_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTjplY4qgdlDPmFO4sKUoWHnBPoeqf-rY3Tc0Y50wgDbDutbTn4j_hXhW3aXhYVjvfbIlwcIOF07250/pub?gid=1948723750&single=true&output=csv',
    disabledModules: []
  },
  STATE: {
    slides: [],
    currentIndex: -1,
    isPaused: false,
    timer: null,
    manualSlides: [] // Local edits saved here
  },
  // Background wallpapers (copied from _ct-tv-slides)
  BACKGROUNDS: [
    'images/bg1.jpg',
    'images/bg2.jpg',
    'images/bg3.jpg',
    'images/bg4.jpg'
  ]
};

const bc = new BroadcastChannel(window.MATRIX.CONFIG.SYNC_CHANNEL);

/**
 * Initialization
 */
async function initMatrix() {
  console.log('[MATRIX v2] Booting premium display engine...');
  
  try {
  loadPersistedState();
  
  // 1. Load Data Sources in Parallel
  const data = await loadAllDataSources();
  
  // 2. Build Slide Queue
  buildSlideQueue(data);
  } catch (bootErr) {
    console.error('[MATRIX] Boot error during data load/queue build:', bootErr);
    // Even if data loading failed, buildSlideQueue with empty data still adds modules
    if (window.MATRIX.STATE.slides.length === 0) {
      try { buildSlideQueue([]); } catch(e) { /* last resort */ }
    }
  }
  
  // 3. Start Rotation or Preview
  const urlParams = new URLSearchParams(window.location.search);
  const previewId = urlParams.get('preview');
  
  if (previewId) {
    const pIdx = window.MATRIX.STATE.slides.findIndex(s => s.id === previewId);
    if (pIdx !== -1) {
      window.MATRIX.STATE.currentIndex = pIdx;
      renderActiveSlide();
      return; // Stay on this slide for preview
    }
  }

  if (window.MATRIX.STATE.slides.length > 0) {
    nextSlide();
  } else {
    showStatus('Error: No slides to display');
  }
  
  // 4. Global Broadcast Listeners
  bc.onmessage = (e) => {
    // Deduplicate action commands using commandId
    if (e.data.commandId) {
      if (window.MATRIX.STATE.lastProcessedCommandId === e.data.commandId) {
        console.log('[MATRIX] Ignoring duplicate BC message:', e.data.type, e.data.commandId);
        return;
      }
      window.MATRIX.STATE.lastProcessedCommandId = e.data.commandId;
    }

    switch(e.data.type) {
      case 'NEXT': window.nextSlide(); break;
      case 'PREV': window.prevSlide(); break;
      case 'TOGGLE': window.togglePause(); break;
      case 'JUMP': window.jumpToProject(e.data.id); break;
      case 'PROJECT': window.jumpToProject(e.data.id); break;
      case 'SETTINGS_UPDATE': updateConfig(e.data.payload); break;
      case 'SCHEDULE_UPDATE': 
        if (e.data.moduleSchedules) {
          window.MATRIX.CONFIG.moduleSchedules = e.data.moduleSchedules;
          saveConfig();
          window.initMatrix();
        }
        break;
      case 'CURRENT_SLIDE_BROADCAST':
        // Telemetry tracking only - do not interrupt autonomous playback loop
        if (e.data.senderTabId === (window.matrixTabId || 'iframe')) return;
        window.MATRIX.STATE.remoteSlideTelemetry = e.data;
        break;
      case 'SYNC_DATA': window.initMatrix(); break; 
      case 'SYNC_JUMP': 
        if (window.parent && window.parent.IS_MASTER_DASHBOARD) return; // Master ignores incoming syncs to prevent loop
        window.jumpToProject(e.data.id, true); 
        break;
      case 'REFRESH': window.location.reload(); break;
      case 'LIVE_SLIDE': handleLiveSlide(e.data.payload); break;
      case 'MODULE_FILTER': handleModuleFilter(e.data.id, e.data.active); break;
      case 'GET_SLIDES_DUMP': 
        bc.postMessage({ 
          type: 'SLIDES_DUMP', 
          slides: window.MATRIX.STATE.slides, 
          currentIndex: window.MATRIX.STATE.currentIndex,
          startTime: window.MATRIX.STATE.currentSlideStartTime,
          delay: window.MATRIX.STATE.currentSlideDelay,
          lastSync: new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false }),
          senderTabId: window.matrixTabId || 'iframe'
        }); 
        break;
      case 'CONFETTI': if (window.triggerConfetti) window.triggerConfetti(); break;
      case 'SYNC_STATE': handleCloudState(e.data.state); break;
    }
  };

  function handleCloudState(state) {
    console.log('[MATRIX] Cloud State Applied:', state);
    if (state.LIVE_SLIDE) handleLiveSlide(state.LIVE_SLIDE.payload);
    if (state.MODULE_FILTER) handleModuleFilter(state.MODULE_FILTER.id, state.MODULE_FILTER.active);
    if (state.SETTINGS_UPDATE && state.SETTINGS_UPDATE.payload) updateConfig(state.SETTINGS_UPDATE.payload);
  }

  applyUISettings();

  // 5. Auto Data Sync every 15 minutes (failsafe)
  if (!window.MATRIX.STATE.syncInterval) {
    window.MATRIX.STATE.syncInterval = setInterval(async () => {
      console.log('[MATRIX v2] Failsafe auto-syncing data...');
      const freshData = await loadAllDataSources();
      buildSlideQueue(freshData);
    }, 15 * 60 * 1000);
  }

  // 2 AM Auto Reset Watchdog — UNCONDITIONAL full playlist restart
  if (!window.MATRIX.STATE.dailyResetTimer) {
    window.MATRIX.STATE.dailyResetTimer = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        const todayStr = now.toDateString();
        if (window.MATRIX.STATE.last2amResetDate !== todayStr) {
          window.MATRIX.STATE.last2amResetDate = todayStr;
          console.log('[MATRIX] 2 AM Auto-Reset: Full playlist restart.');
          // Clear any active live slide override
          handleLiveSlide({ active: false });
          // Clear the current slide timer to prevent stuck loops
          clearTimeout(window.MATRIX.STATE.timer);
          window.MATRIX.STATE.timer = null;
          // Reset to default disabled modules (all enabled)
          window.MATRIX.CONFIG.disabledModules = [];
          localStorage.setItem('matrix_config', JSON.stringify(window.MATRIX.CONFIG));
          if (bc) {
            bc.postMessage({ type: 'LIVE_SLIDE', payload: { active: false } });
            bc.postMessage({ type: 'SETTINGS_UPDATE', payload: { disabledModules: [] } });
            bc.postMessage({ type: 'SYNC_DATA' });
          }
          // Reset slide index to start from beginning
          window.MATRIX.STATE.currentIndex = -1;
          window.initMatrix();
        }
      }
    }, 30000);
  }


  // 6. Hard-lock all active slide durations to 30s (override any internal module timers if needed)
  window.MATRIX.CONFIG.SWAP_DELAY = 30000;
  window.MATRIX.CONFIG.MODULE_DELAY = 60000;

  // 7. Stuck-Slide Safety Watchdog — force advance if a slide has been active too long
  if (!window.MATRIX.STATE.stuckSlideWatchdog) {
    window.MATRIX.STATE.stuckSlideWatchdog = setInterval(() => {
      const s = window.MATRIX.STATE;
      if (s.isPaused || s.isClosedSlideActive || s.slides.length <= 1) return;
      if (!s.currentSlideStartTime) return;

      const elapsed = Date.now() - s.currentSlideStartTime;
      const slide = s.slides[s.currentIndex];
      if (!slide) return;

      // Max allowed time: configured duration + 60s buffer, minimum 120s
      const configuredDuration = slide.duration ? slide.duration * 1000 : (slide.type === 'MODULE' ? window.MATRIX.CONFIG.MODULE_DELAY : window.MATRIX.CONFIG.SWAP_DELAY);
      const maxAllowed = Math.max(configuredDuration + 60000, 120000);

      if (elapsed > maxAllowed) {
        console.warn(`[MATRIX] Stuck-slide watchdog: Slide "${slide.title || slide.id}" stuck for ${Math.round(elapsed/1000)}s (max ${Math.round(maxAllowed/1000)}s). Force advancing.`);
        clearTimeout(s.timer);
        s.timer = null;
        nextSlide();
      }
    }, 15000); // Check every 15 seconds
  }

  // 6. GSheet Watchdog (optional but keeping for consistency)
  if (!window.MATRIX.STATE.watchdog) {
    window.MATRIX.STATE.lastModifiedTags = {};
    window.MATRIX.STATE.watchdog = setInterval(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const url = window.MATRIX.CONFIG.GSHEETS_URL;
        if (!url) {
          clearTimeout(timeoutId);
          return;
        }
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { 
          method: 'HEAD', 
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const fingerprint = (res.headers.get('Content-Length') || '') + (res.headers.get('Last-Modified') || '');
          if (window.MATRIX.STATE.lastModifiedTags['gsheet'] && window.MATRIX.STATE.lastModifiedTags['gsheet'] !== fingerprint) {
              console.log(`[MATRIX Watchdog] Detected changes in GSheet`);
              const freshData = await loadAllDataSources();
              buildSlideQueue(freshData);
              if (bc) bc.postMessage({ type: 'DATA_HOT_RELOADED' });
          }
          window.MATRIX.STATE.lastModifiedTags['gsheet'] = fingerprint;
        }
      } catch (e) {
        // Ignore error
      } finally {
        clearTimeout(timeoutId);
      }
    }, 60000); // Check GSheet every minute instead of every 3 seconds
  }

  // 7. Reactive Module Scaling (1080p Force)
  function resizeModules() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty('--module-scale', scale);
  }
  window.addEventListener('resize', () => {
    resizeModules();
    if (typeof adjustActiveSlideText === 'function') {
      adjustActiveSlideText();
    }
  });
  resizeModules();
}

/**
 * Persistence Logic
 */
function loadPersistedState() {
  try {
    if (localStorage.getItem('matrix_migration_20260804_enable_all_modules') !== 'done') {
      const stored = localStorage.getItem('matrix_config');
      let config = stored ? JSON.parse(stored) : {};
      config.disabledModules = [];
      localStorage.setItem('matrix_config', JSON.stringify(config));
      localStorage.setItem('matrix_migration_20260804_enable_all_modules', 'done');
    }
  } catch(e) {
    console.warn('[MATRIX] Migration failed or storage access denied:', e);
  }

  try {
    const config = localStorage.getItem('matrix_config');
    if (config) window.MATRIX.CONFIG = { ...window.MATRIX.CONFIG, ...JSON.parse(config) };
    if (!window.MATRIX.CONFIG.disabledModules) {
      window.MATRIX.CONFIG.disabledModules = [];
    }

    const manual = localStorage.getItem('matrix_manual_slides');
    if (manual) window.MATRIX.STATE.manualSlides = JSON.parse(manual);
  } catch (e) {
    console.error('[MATRIX] Persistence load failed', e);
  }
}

function updateConfig(newConfig) {
  window.MATRIX.CONFIG = { ...window.MATRIX.CONFIG, ...newConfig };
  localStorage.setItem('matrix_config', JSON.stringify(window.MATRIX.CONFIG));
  applyUISettings();
  if (newConfig.moduleDurations) {
      window.initMatrix();
  }
}

function handleModuleFilter(id, active) {
    if (!window.MATRIX.CONFIG.disabledModules) window.MATRIX.CONFIG.disabledModules = [];
    
    // Normalize ID to match queue IDs (e.g., 'ACE' -> 'ct-ace' or 'ct-ace' -> 'ct-ace')
    const fullId = id.toLowerCase().startsWith('ct-') ? id.toLowerCase() : 'ct-' + id.toLowerCase();
    
    if (active) {
        window.MATRIX.CONFIG.disabledModules = window.MATRIX.CONFIG.disabledModules.filter(m => m !== fullId);
    } else {
        if (!window.MATRIX.CONFIG.disabledModules.includes(fullId)) {
            window.MATRIX.CONFIG.disabledModules.push(fullId);
        }
    }
    localStorage.setItem('matrix_config', JSON.stringify(window.MATRIX.CONFIG));
    
    // Rebuild queue with new filters
    window.initMatrix();
}

function applyUISettings() {
  const header = document.querySelector('.matrix-header');
  const nav = document.querySelector('.nav-hub');
  if (header) {
    if (window.MATRIX.CONFIG.SHOW_BANNER) {
      header.classList.remove('hidden');
      if (nav) nav.classList.remove('hidden');
      setupHeaderAutoHide();
    } else {
      header.classList.add('hidden');
      if (nav) nav.classList.add('hidden');
    }
  }
}

let headerTimer;
function setupHeaderAutoHide() {
  const header = document.querySelector('.matrix-header');
  const nav = document.querySelector('.nav-hub');
  if (!header) return;

  function resetTimer() {
    header.classList.remove('hidden-auto');
    if (nav) nav.classList.remove('hidden-auto');
    
    clearTimeout(headerTimer);
    headerTimer = setTimeout(() => {
      header.classList.add('hidden-auto');
      if (nav) nav.classList.add('hidden-auto');
    }, 3000); // 3 seconds - fast clear for venue displays
  }

  window.addEventListener('mousemove', resetTimer);
  window.addEventListener('touchstart', resetTimer);
  window.addEventListener('keydown', resetTimer);
  resetTimer();
}

/**
 * Data Loading — SINGLE SOURCE OF TRUTH: Google Sheet ONLY
 * No local JSON, no local CSV, no local images.
 * All slide data comes from the published Google Sheet.
 */
async function loadAllDataSources() {
  try {
    const events = await fetchCloudCSV();
    if (events && events.length > 0 && events[0].events && events[0].events.length > 0) {
      console.log(`[MATRIX] Loaded ${events[0].events.length} events from data source.`);
      return events;
    }
  } catch (e) {
    console.error('[MATRIX] Data source fetch failed:', e);
  }
  // Ultimate safety net: always return at least the hardcoded fallback
  console.warn('[MATRIX] All data sources empty — using hardcoded fallback.');
  return getHardcodedFallback('loadAllDataSources-empty');
}



// Hardcoded fallback CSV — used ONLY when GSheet + cache both fail.
// No date field = always passes isEventCurrent(), so this slide is always valid.
const FALLBACK_CSV = `Date,Day,Event Type,Event Name,Details,Billboard Text,Start Time,Price,Location,Slide Footer,Slide Type,Hidden Notes,Accent Hex Colour,Countdown Finish,Feature QR,Footer QR,Footer Hyperlink,Slide Duration,Slide Background,Foreground Image,Bubble Text,Lock Slide,Lock Day,Lock Time,Transition,Zoom
,Everyday,,,,,,,,,,,,,,,,,,images/GOLD-FLAME-LOGO-BLACK-CLEAN.png,,,,,Fade,`;

async function fetchCloudCSV() {
  const url = window.MATRIX.CONFIG.GSHEETS_URL;
  if (!url) return getHardcodedFallback('no-url');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const csv = await res.text();
    if (csv && csv.trim().length > 10) {
      const parsed = parseCSVToEvents(csv);
      if (parsed && parsed.length > 0 && parsed[0].events && parsed[0].events.length > 0) {
        try { localStorage.setItem('matrix_cached_csv', csv); } catch(e) { /* quota */ }
      }
      console.log('[MATRIX] GSheet loaded OK (' + csv.length + ' bytes)');
      if (window.updateSyncStatus) window.updateSyncStatus('online');
      return parsed;
    }
  } catch (e) {
    console.warn('[MATRIX] GSheet fetch failed:', e.message || e);
    if (window.updateSyncStatus) window.updateSyncStatus('sync-error');
  } finally {
    clearTimeout(timeoutId);
  }

  // Fallback 1: localStorage cache
  try {
    const cached = localStorage.getItem('matrix_cached_csv');
    if (cached && cached.trim().length > 10) {
      console.log('[MATRIX] Using cached CSV fallback.');
      return parseCSVToEvents(cached);
    }
  } catch (e) { /* ignore */ }

  // Fallback 2: hardcoded welcome slide (always valid, no date = never filtered)
  return getHardcodedFallback('all-sources-failed');
}

function getHardcodedFallback(reason) {
  console.warn('[MATRIX] Using HARDCODED fallback slide. Reason:', reason);
  return parseCSVToEvents(FALLBACK_CSV);
}

function parseCSVToEvents(text) {
  const result = [];
  let row = [];
  let col = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        col += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        col += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(col.trim());
        col = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        if (char === '\r') i++;
        row.push(col.trim());
        result.push(row);
        row = [];
        col = '';
      } else {
        col += char;
      }
    }
  }
  if (col || row.length > 0) {
    row.push(col.trim());
    result.push(row);
  }

  // Map to events, handle newlines
  // New 22-column schema:
  // 0:Date, 1:Day, 2:Event Type, 3:Event Name, 4:Details, 5:Billboard Text, 6:Start Time,
  // 7:Price, 8:Location, 9:Slide Footer, 10:Slide Type, 11:Hidden Notes,
  // 12:Accent Hex Colour, 13:Countdown Finish, 14:Feature QR, 15:Footer QR,
  // 16:Footer Hyperlink, 17:Slide Duration, 18:Slide Background,
  // 19:Foreground Image, 20:Bubble Text, 21:Lock Slide, 22:Lock Day, 23:Lock Time,
  // 24:Transition, 25:Zoom
  const events = result.slice(1).map(clean => {
    return {
      date: clean[0],
      day: clean[1],
      event_type: clean[2] || 'Event',
      title: (clean[3] || '').replace(/\n/g, '<br>'),
      notes: (clean[4] || '').replace(/\n/g, '<br>'),
      billboardNotes: (clean[5] || '').replace(/\n/g, '<br>'),
      time: (() => {
        let t = (clean[6] || '').trim();
        if (/^\$\d+$/.test(t)) {
          const type = (clean[2] || '').toLowerCase();
          const title = (clean[3] || '').toLowerCase();
          if (type.includes('karaoke') || title.includes('karaoke')) {
            return '8:00 pm';
          }
          return '';
        }
        return t;
      })(), // Start Time
      price: clean[7], // Price
      location: clean[8],
      footer: clean[9],
      slideType: (clean[10] || 'Event').toUpperCase(),
      hiddenNotes: clean[11],
      accentColor: (clean[12] || '').trim(),
      countdownFinish: (clean[13] || '').trim(),
      qr: clean[14] ? clean[14].trim().replace(/\\/g, '/') : '',
      footerQR: clean[15] ? clean[15].trim().replace(/\\/g, '/') : '',
      footerLink: (clean[16] || '').trim(),
      duration: clean[17] ? parseInt(clean[17]) : null,
      bgImage: clean[18] ? clean[18].replace(/\\/g, '/') : clean[18],
      fgImage: clean[19] ? clean[19].replace(/\\/g, '/') : clean[19],
      bubbleText: clean[20],
      lockSlide: clean[21],
      lockDay: clean[22],
      lockTime: clean[23],
      transition: clean[24],
      zoom: clean[25]
    };
  }).filter(e => {
    if (!e.title && !e.date) return false;
    const nameStr = (e.title || '').toLowerCase();
    const timeStr = (e.time || '').toLowerCase();
    const descStr = (e.notes || '').toLowerCase();
    const isAllBlacks = nameStr.includes('all blacks') || (e.event_type || '').toLowerCase().includes('all blacks');
    if (!isAllBlacks && (nameStr.includes('tbc') || timeStr.includes('tbc') || descStr.includes('tbc'))) {
      return false;
    }
    return true;
  });

  return [{ week_starting: 'Cloud Data', events }];
}

/**
 * Default Background Assignment by Event Type
 * Sheet's 'Slide Background' column takes priority; this is the fallback.
 */
function getDefaultBackground(eventType, title) {
  const t = (eventType || '').toLowerCase();
  const name = (title || '').toLowerCase();
  
  if (t.includes('rugby') || t.includes('nrl') || t.includes('warriors') || t.includes('crusaders') || t.includes('all blacks') || 
      name.includes('warriors') || name.includes('crusaders') || name.includes('nrl') || name.includes('all blacks')) {
    return '_backgrounds/stadium.png';
  }
  
  if (t.includes('karaoke') || t.includes('band') || t.includes('music') || t.includes('🟠') || t.includes('🟣')) {
    return '_backgrounds/music.jpg';
  }
  
  if (t.includes('quiz') || name.includes('quiz') || t.includes('trivia') || name.includes('trivia')) {
    return '_backgrounds/quiz.png';
  }
  
  // User requested: if blank then use a black background instead (removing rotation)
  return '';
}

/**
 * Queue Construction
 */
function buildSlideQueue(data) {
  const queue = [];
  
  const disabledModules = window.MATRIX.CONFIG.disabledModules || [];
  const matrixDisabled = disabledModules.includes('ct-matrix');

  // 1. Add Filtered Events from all sources
  if (!matrixDisabled) {
  data.forEach(week => {
    const events = week.events || [];
    events.forEach(ev => {
          // Handle Recurring Day-based Events
          let daysArray = null;
          let virtualDate = null;
          if (ev.day && !ev.date) {
            const dayMap = { 'sun':0,'mon':1,'tue':2,'wed':3,'thu':4,'fri':5,'sat':6 };
            const dayStr = ev.day.toLowerCase();
            daysArray = [];
            Object.keys(dayMap).forEach(k => {
              if (dayStr.includes(k)) daysArray.push(dayMap[k]);
            });

            // Calculate next occurrence for lookahead/tagging
            if (daysArray.length > 0) {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let next = new Date(today);
                let found = false;
                for(let i=0; i<14; i++) {
                    let check = new Date(today);
                    check.setDate(today.getDate() + i);
                    if (daysArray.includes(check.getDay())) {
                        virtualDate = check;
                        found = true;
                        break;
                    }
                }
            }
          }

          const targetDate = ev.date ? parseMatrixDate(ev.date) : virtualDate;
          const isCurrent = isEventCurrent(targetDate, ev.event_type, ev.title);

          if (isCurrent) {
            // 1. RUTHLESS TBC/TBA filtering - scan ALL text fields (no exceptions)
            const ruthlessString = [
              ev.title, ev.notes, ev.event_type, ev.location, ev.price, ev.time, ev.hiddenNotes, ev.footer
            ].map(x => String(x || '')).join(' ').toLowerCase();

            if (ruthlessString.includes('tbc') || ruthlessString.includes('tba') || 
                ruthlessString.includes('to be confirmed') || ruthlessString.includes('to be announced')) {
              return;
            }

            const isAllBlacks = (ev.event_type || '').toLowerCase().includes('all blacks') || 
                                (ev.title || '').toLowerCase().includes('all blacks');

            // 2. All Blacks games between 11pm and 10am: do not display slide
            if (isAllBlacks && ev.time) {
              const gameTime = parseTimeStringToHours(ev.time);
              if (gameTime !== null && (gameTime < 10.0 || gameTime >= 23.0)) {
                return;
              }
            }

            // 2. 8 PM CURFEW for Today's Specials/Menus
            const now = new Date();
            const isToday = targetDate && 
                            targetDate.getDate() === now.getDate() && 
                            targetDate.getMonth() === now.getMonth() && 
                            targetDate.getFullYear() === now.getFullYear();
            
            if (isToday) {
                const hour = now.getHours();
                const type = (ev.event_type || '').toUpperCase();
                const slideType = (ev.slideType || '').toUpperCase();
                
                // If it's after 8 PM (20:00) and it's a Special or Menu, skip it.
                if (hour >= 20 && (type.includes('SPECIAL') || type.includes('MENU') || slideType === 'MENU')) {
                    return;
                }
            }

            const detId = 'ev-' + (ev.title + (ev.date || ev.day) + ev.time).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
            queue.push({
              id: detId,
              type: 'EVENT',
              subType: ev.event_type || 'Event',
              title: ev.title,
              subtitle: ev.notes,
              billboardSubtitle: ev.billboardNotes,
              price: ev.price, 
              qr: ev.qr || ev.footerLink,
              meta: ev.day || '', 
              date: ev.date || (virtualDate ? virtualDate.toISOString().split('T')[0] : null),
              days: daysArray, 
              time: ev.time,
              location: ev.location,
              footer: ev.footer,
              accentColor: ev.accentColor,
              bgImage: ev.bgImage || getDefaultBackground(ev.event_type, ev.title),
              fgImage: ev.fgImage,
              bubbleText: ev.bubbleText,
              duration: ev.duration || 30, // Default to 30s for all slides
              footerQR: ev.footerQR,
              footerLink: ev.footerLink,
              transition: ev.transition || (ev.slideType === 'MENU' ? 'PanDown' : ''),
              zoom: ev.zoom || (ev.slideType === 'MENU' ? 1.3 : null)
            });
          }
    });
  });
  }

  // 2. Weekly Specials are now in the Google Sheet — no hardcoded injection needed.

  // 3. Project Modules (Base Infrastructure)
  // Durations are defaults — overridden by CONFIG.moduleDurations if set in admin
  const customDurations = window.MATRIX.CONFIG.moduleDurations || {};
  const getModDur = (id, defaultDur) => {
    const val = customDurations[id] !== undefined ? customDurations[id] : 'all';
    if (val === 'all') return defaultDur;
    return val || defaultDur;
  };
  queue.push({ type: 'MODULE', id: 'ct-mmr', url: '../_ct-MMR/index.html', title: "Meat Raffle Display", pinned: true, priority: 5, duration: getModDur('ct-mmr', 600) }); // Play all slides (10min default)
  queue.push({ type: 'MODULE', id: 'ct-wea1', url: '../_ct-wea1/dist/index.html', title: "Christchurch Weather", priority: 80, duration: getModDur('ct-wea1', 90) });
  queue.push({ type: 'MODULE', id: 'ct-ace', url: '../_ct-ACE/index.html', title: "Chase the Ace", pinned: true, priority: 5, duration: getModDur('ct-ace', 180) }); // 6 slides * 30s
  queue.push({ type: 'MODULE', id: 'ct-quiz', url: '../_ct-QUIZ/index.html', title: "Weekly Pub Quiz", priority: 10, duration: getModDur('ct-quiz', 60) });
  queue.push({ type: 'MODULE', id: 'ct-fir', url: '../_ct-FIR/index.html', title: "Fireplace Ambiance", pinned: false, priority: 90, duration: getModDur('ct-fir', 180) }); // 3min default
  queue.push({ type: 'MODULE', id: 'ct-soc', url: 'https://ctsc-app.web.app/#/tv', title: "Social Club TV Slides", pinned: true, priority: 8, duration: getModDur('ct-soc', 120) });
  queue.push({ type: 'MODULE', id: 'ct-tik', url: 'https://mrmegatronix.github.io/_ct-TIK/', title: "Coasters Tavern TikTok", pinned: true, priority: 7, duration: getModDur('ct-tik', 120) });
  queue.push({ type: 'MODULE', id: 'ct-loyalty', url: 'loyalty-slide.html', title: "Coasters Loyalty App", pinned: true, priority: 6, duration: getModDur('ct-loyalty', 60), accentColor: '#89CFF0' });

  // 4. Apply Module Filters
  let filteredQueue = queue.filter(s => {
    if (s.disabled) return false;
    if (s.type === 'MODULE' && disabledModules.includes(s.id)) return false;
    return true;
  });

  // 5. Filter & Sort
  // Sort by Priority (Ascending) then Pinned (Descending).
  filteredQueue.sort((a, b) => {
    const priA = a.priority || 50;
    const priB = b.priority || 50;
    if (priA !== priB) return priA - priB;
    return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
  });

  window.MATRIX.STATE.slides = filteredQueue;
  console.log(`[MATRIX v2] Queue built with ${filteredQueue.length} slides.`);
  
  if (bc) {
    bc.postMessage({ 
      type: 'SLIDES_DUMP', 
      slides: window.MATRIX.STATE.slides, 
      currentIndex: window.MATRIX.STATE.currentIndex,
      startTime: window.MATRIX.STATE.currentSlideStartTime,
      delay: window.MATRIX.STATE.currentSlideDelay,
      lastSync: new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false }),
      senderTabId: window.matrixTabId || 'iframe'
    });
  }
  
  // If we are already running and the queue changed, we might need to re-render
  if (window.MATRIX.STATE.currentIndex === -1 && filteredQueue.length > 0) {
    window.nextSlide();
  }
}

/**
 * Smart Label & Date Logic
 */
function getSmartTag(slide) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = slide.date ? parseMatrixDate(slide.date) : null;
    const typeLabel = (slide.subType || slide.type || 'Event').toUpperCase();
    
    if (slide.type === 'MODULE') return typeLabel;

    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    let dayName = '';
    
    if (eventDate) {
        dayName = days[eventDate.getDay()];
    } else if (slide.meta) {
        const firstWord = String(slide.meta).split(' ')[0].toUpperCase();
        if (days.includes(firstWord)) {
            dayName = firstWord;
        }
    }

    const dayPrefix = dayName ? `${dayName}: ` : '';

    if (!eventDate) return (dayPrefix + typeLabel).toUpperCase();

    const evDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const diffDays = Math.round((evDay - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return (dayPrefix + typeLabel).toUpperCase(); 
    
    if (diffDays === 0) {
      const hasTime = slide.time && slide.time.trim() !== '' && !/all\s*day/i.test(slide.time);
      const todayLabel = hasTime ? 'Tonight' : 'Today';
      return `${todayLabel}: ${dayName}: ${typeLabel}`.toUpperCase();
    }
    if (diffDays === 1) return `Tomorrow: ${dayName}: ${typeLabel}`.toUpperCase();

    const currentDay = today.getDay(); // 0=Sun, 1=Mon...
    const daysToNextMonday = (currentDay === 0) ? 1 : (8 - currentDay);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);
    nextMonday.setHours(0,0,0,0);

    if (evDay < nextMonday) {
        return `This Week: ${dayName}: ${typeLabel}`.toUpperCase();
    } else if (diffDays <= 14) {
        return `Next Week: ${dayName}: ${typeLabel}`.toUpperCase();
    }

    return `${dayName}: ${typeLabel}`.toUpperCase();
}

function fitText(el, minSize = 40) {
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    if (parent.offsetWidth === 0) return;
    
    // Disable transitions temporarily so scrollWidth updates synchronously
    const oldTransition = el.style.transition;
    el.style.transition = 'none';
    
    // Reset to base size first to measure correctly
    el.style.fontSize = '';
    el.style.whiteSpace = 'nowrap';
    
    let fontSize = parseInt(window.getComputedStyle(el).fontSize);
    const maxWidth = Math.min(parent.offsetWidth || window.innerWidth, window.innerWidth * 0.90);

    // Fast reduction loop — shrink until it fits, never wrap
    while (el.scrollWidth > maxWidth && fontSize > minSize) {
        fontSize -= 2;
        el.style.fontSize = fontSize + 'px';
    }
    
    // Force reflow and restore transition
    void el.offsetWidth;
    el.style.transition = oldTransition;
}

function adjustActiveSlideText() {
  const slideEl = document.getElementById('slide-target');
  if (!slideEl) return;

  const titleEl = slideEl.querySelector('.premium-title, .special-title, .social-title, .band-gig-title');
  const handleEl = slideEl.querySelector('.social-handle');
  const descFontEl = slideEl.querySelector('.premium-desc, .special-desc, .band-gig-subtitle');
  
  // Rule 1: Fit title text, keep floor readable (45px instead of 70px)
  if (titleEl) {
    fitText(titleEl, 45);
  }
  if (handleEl) {
    fitText(handleEl, 24);
  }

  // Overspill check
  const cardEl = slideEl.querySelector('.premium-card, .special-event-card, .social-card, .band-gig-overlay');
  const FOOTER_TEXT_SIZE = 20; // Lowered from 35 to guarantee no vertical overflow

  if (cardEl && descFontEl) {
    // Reset description font-size to stylesheet default first so we can measure clean
    descFontEl.style.fontSize = '';
    
    const cardWidth = cardEl.offsetWidth;
    const footerEl = slideEl.querySelector('.premium-footer-row');
    const maxBottom = footerEl ? footerEl.getBoundingClientRect().top - 20 : window.innerHeight - 50;

    const contentChildren = cardEl.querySelectorAll('.premium-tag-wrapper, .premium-title-wrapper, .premium-accent-wrapper, .premium-desc-wrapper, .special-badge, .special-title, .special-desc, .band-gig-title, .band-gig-subtitle');
    const lastContent = contentChildren.length > 0 ? contentChildren[contentChildren.length - 1] : null;

    let descFontSize = parseInt(window.getComputedStyle(descFontEl).fontSize);
    let titleFontSize = titleEl ? parseInt(window.getComputedStyle(titleEl).fontSize) : null;

    // If cardWidth > 0, we can run the overspill shrink logic
    if (cardWidth > 0) {
      let loopCount = 0;
      
      const getLowestBottom = () => {
        let bottom = 0;
        if (descFontEl) bottom = Math.max(bottom, descFontEl.getBoundingClientRect().bottom);
        if (titleEl) bottom = Math.max(bottom, titleEl.getBoundingClientRect().bottom);
        return bottom;
      };

      while (getLowestBottom() > maxBottom && loopCount < 100) {
        let shrunk = false;
        
        // Try shrinking description first
        if (descFontSize > FOOTER_TEXT_SIZE) {
          descFontSize -= 2;
          descFontEl.style.fontSize = descFontSize + 'px';
          shrunk = true;
        } 
        
        // If description can't shrink more, start shrinking the title!
        if (!shrunk && titleEl && titleFontSize > 30) {
          titleFontSize -= 2;
          titleEl.style.fontSize = titleFontSize + 'px';
          shrunk = true;
        }

        if (!shrunk) break; // Cannot shrink anything anymore
        loopCount++;
      }
    }

    // Rule 2 enforcement: title must always be bigger than description
    if (titleEl) {
      if (descFontSize >= titleFontSize) {
        descFontEl.style.fontSize = Math.max(titleFontSize - 4, FOOTER_TEXT_SIZE) + 'px';
      }
    }
  }
}
window.adjustActiveSlideText = adjustActiveSlideText;

function isEventCurrent(dateOrStr, subType, title = '') {
    if (!dateOrStr) return true;
    const evDate = (dateOrStr instanceof Date) ? dateOrStr : parseMatrixDate(dateOrStr);
    if (!evDate) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
    
    // 1. Past events are always hidden (before today)
    if (evDay < today) return false;
    
    const diffDays = Math.round((evDay - today) / (1000 * 60 * 60 * 24));
    
    // Bypass lookahead limit for All Blacks matches (show them up to 45 days in advance)
    const isAllBlacks = (subType || '').toLowerCase().includes('all blacks') || 
                        (title || '').toLowerCase().includes('all blacks');
    if (isAllBlacks) return diffDays <= 45;
    
    // 2. 14 Day lookahead for ALL events, 7 days for Weekly Specials
    const limit = (subType || '').toLowerCase().includes('weekly special') ? 7 : 14;
    return diffDays <= limit;
}

function isWeekInRange(weekStr) {
  const start = parseMatrixDate(weekStr);
  if (!start) return true;
  const today = new Date();
  today.setHours(0,0,0,0);
  const diffDays = (start - today) / (1000 * 60 * 60 * 24);
  return diffDays >= -7 && diffDays <= (window.MATRIX.CONFIG.WEEKS_LOOKAHEAD * 7);
}

/**
 * Background Wallpaper Selection
 * Maps event types to specific backgrounds for visual variety.
 */

/**
 * Get the highlight color for event type badges
 */
function getHighlightColor(slide) {
  if (slide.accentColor) return slide.accentColor;
  
  const subType = (slide.subType || '').toLowerCase();
  const title = (slide.title || '').toLowerCase();

  if (title.includes('crusaders')) return '#ef4444'; // Red
  if (title.includes('warriors')) return '#10b981'; // Green
  if (title.includes('all blacks') || subType.includes('all blacks')) return '#ffffff'; // White/Silver

  const map = {
    'super rugby': '#ef4444',
    'rugby': '#ef4444',
    'nrl': '#10b981',
    'league': '#10b981',
    'karaoke': '#8b5cf6', // Purple
    'live music': '#f59e0b', // Orange
    'band': '#f59e0b', // Orange
    'food': '#1013b9ff', 
    'dining': '#1013b9ff',
    'quiz': '#3b82f6', // Blue
    'trivia': '#3b82f6', // Blue
    'entertainment': '#06b6d4',
    'event': '#ffffff'
  };
  return map[subType] || '#f59e0b';
}

/**
 * Slide Scheduling Logic
 */
function isSlideActive(slide) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const time = h + m / 60;
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 3=Wed

  // Advanced Scheduling Logic
  if (slide.date && !slide.isManual) {
    const slideDate = parseMatrixDate(slide.date);
    if (slideDate) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const evDay = new Date(slideDate.getFullYear(), slideDate.getMonth(), slideDate.getDate());
      
      const diffDays = Math.round((evDay - today) / (1000 * 3600 * 24));

      const subType = (slide.subType || '').toLowerCase();
      const title = (slide.title || '').toLowerCase();
      const isAllBlacks = subType.includes('all blacks') || title.includes('all blacks');
      
      const limit = isAllBlacks ? 45 : (subType.includes('weekly special') ? 7 : 14);

      if (diffDays < 0) return false; // Past event
      if (diffDays > limit) return false; 
    }
  }

  // Universal TBC / TBA filtering across ALL slides (no exceptions)
  const slideText = [
    slide.title, slide.subtitle, slide.description, slide.notes, 
    slide.location, slide.time, slide.footer, slide.subType, slide.category
  ].map(x => String(x || '')).join(' ').toLowerCase();

  if (slideText.includes('tbc') || slideText.includes('tba') || 
      slideText.includes('to be confirmed') || slideText.includes('to be announced')) {
    return false;
  }

  // Filter out events/games occurring outside of venue opening hours (between 11:00 PM and 10:00 AM)
  if (slide.time) {
    const gameTime = parseTimeStringToHours(slide.time);
    if (gameTime !== null) {
      if (gameTime < 10.0 || gameTime >= 23.0) {
        return false; // Skip events between 11pm and 10am
      }
    }
  }

  

  // Module-Specific Scheduling Logic
  if (slide.type === 'MODULE') {
    const schedules = (window.MATRIX.CONFIG && window.MATRIX.CONFIG.moduleSchedules) || {};
    const modSched = schedules[slide.id];
    if (modSched && modSched.enabled) {
      if (modSched.days && modSched.days.length > 0 && !modSched.days.includes(day)) {
        return false;
      }
      if (modSched.startTime !== undefined && modSched.endTime !== undefined) {
        if (time < modSched.startTime || time >= modSched.endTime) {
          return false;
        }
      }
    } else if (slide.id === 'ct-quiz') {
      // Default hardcoded time window restriction for ct-quiz: Wednesdays 18:00 to 19:10
      if (day !== 3) return false; // 3 = Wednesday
      if (time < 18.0 || time > 19.167) return false; // 18:00 to 19:10
    }
  }

  // Generic custom scheduling if properties exist
  if (slide.startTime !== undefined && slide.endTime !== undefined) {
     if (time < slide.startTime || time >= slide.endTime) return false;
  }
  if (slide.days && slide.days.length && !slide.days.includes(day)) {
     return false;
  }

  return true;
}

/**
 * Get Module Schedule Status Helper
 */
function getModuleStatus(id) {
  const config = window.MATRIX.CONFIG || {};
  const disabled = config.disabledModules || [];
  if (disabled.includes(id)) {
    return { mode: 'OFF', label: 'OFF', active: false };
  }
  const schedules = config.moduleSchedules || {};
  let sched = schedules[id];
  if (!sched && id === 'ct-quiz') {
    sched = { enabled: true, days: [3], startTime: 18.0, endTime: 19.167 };
  }
  if (sched && sched.enabled) {
    const now = new Date();
    const time = now.getHours() + now.getMinutes() / 60;
    const day = now.getDay();
    const dayMatch = !sched.days || sched.days.length === 0 || sched.days.includes(day);
    const timeMatch = (sched.startTime === undefined || sched.endTime === undefined) || (time >= sched.startTime && time < sched.endTime);
    const isActiveNow = dayMatch && timeMatch;
    return {
      mode: 'SCHEDULED',
      label: isActiveNow ? 'SCHEDULED' : 'SCHEDULED (OFF-HOURS)',
      active: isActiveNow,
      schedule: sched
    };
  }
  return { mode: 'ON', label: 'ON', active: true };
}
window.getModuleStatus = getModuleStatus;

/**
 * Controller & Engine
 */
function nextSlide(skipBroadcast = false) {
  const s = window.MATRIX.STATE;
  let loopCount = 0;
  let nextIdx = s.currentIndex;
  
  // Auto-heal: If we only have 1 or 2 active slides total, dynamically inject default fillers
  const activeSlidesCount = s.slides.filter(slide => isSlideActive(slide)).length;
  if (activeSlidesCount <= 2 && !window.MATRIX.STATE.hasInjectedFallbacks) {
      console.log('[MATRIX] Auto-healing: Not enough active slides. Injecting generic fillers.');
      window.MATRIX.STATE.hasInjectedFallbacks = true;
      s.slides.push(
          {
              id: 'fallback-menu',
              type: 'MENU',
              title: 'Feeling Hungry?',
              subtitle: 'Check out our delicious menu today.',
              bgImage: 'images/bg2.jpg',
              accentColor: '#f59e0b',
              qr: 'https://coasterstavern.co.nz/menu/'
          },
          {
              id: 'fallback-bar',
              type: 'EVENT',
              subType: 'Information',
              title: 'Welcome to Coasters',
              subtitle: 'Relax and enjoy the atmosphere.',
              bgImage: 'images/bg1.jpg',
              accentColor: '#3b82f6'
          }
      );
  }

  do {
    nextIdx = (nextIdx + 1) % s.slides.length;
    loopCount++;
  } while (!isSlideActive(s.slides[nextIdx]) && loopCount < s.slides.length);

  
  if (isSlideActive(s.slides[nextIdx])) {
    s.currentIndex = nextIdx;
    renderActiveSlide(skipBroadcast);
  } else {
    // If all slides in the queue are inactive, stop looping
    s.currentIndex = -1;
    console.warn('[MATRIX] All slides are inactive. Hiding display.');
    const target = document.getElementById('slide-target');
    if (target) target.innerHTML = '';
    // Optional: Could display a logo or "Event Starting Soon" fallback
  }
}

function prevSlide(skipBroadcast = false) {
  const s = window.MATRIX.STATE;
  if (!s.slides.length) return;
  
  let loopCount = 0;
  let prevIdx = s.currentIndex;
  do {
    prevIdx = (prevIdx - 1 + s.slides.length) % s.slides.length;
    loopCount++;
  } while (!isSlideActive(s.slides[prevIdx]) && loopCount < s.slides.length);
  
  if (isSlideActive(s.slides[prevIdx])) {
    s.currentIndex = prevIdx;
    renderActiveSlide(skipBroadcast);
  } else {
    s.currentIndex = -1;
  }
}

function togglePause() {
  const s = window.MATRIX.STATE;
  s.isPaused = !s.isPaused;
  const btn = document.getElementById('play-pause-btn');
  if (btn) btn.innerText = s.isPaused ? '\u25b6' : '\u23f8';
  
  if (s.isPaused) {
      clearTimeout(s.timer);
      const bar = document.getElementById('progress-bar');
      if (bar) bar.style.transition = 'none'; // stop progress bar
  } else {
      nextSlide();
  }
}

function jumpToProject(id, skipBroadcast = false) {
  const s = window.MATRIX.STATE;
  const idx = s.slides.findIndex(s => s.id === id);
  if (idx !== -1) {
    s.currentIndex = idx;
    renderActiveSlide(skipBroadcast);
  }
}

window.nextSlide = nextSlide;
window.prevSlide = prevSlide;
window.togglePause = togglePause;
window.jumpToProject = jumpToProject;

/**
 * Premium Slide Renderer
 * Generates the premium TV-quality DOM structure for each slide.
 */
function renderActiveSlide(skipBroadcast = false, overrideDelay = null) {
  const s = window.MATRIX.STATE;
  if (s.currentIndex < 0 || s.currentIndex >= s.slides.length) return;
  const slide = s.slides[s.currentIndex];
  const container = document.getElementById('slide-viewport');
  
  const delay = slide.duration ? slide.duration * 1000 : (slide.type === 'MODULE' ? window.MATRIX.CONFIG.MODULE_DELAY : window.MATRIX.CONFIG.SWAP_DELAY);
  const startTime = Date.now();

  window.MATRIX.STATE.currentSlideStartTime = startTime;
  window.MATRIX.STATE.currentSlideDelay = delay;

  const isMaster = window.parent && window.parent.IS_MASTER_DASHBOARD;
  const masterIsActive = window.MATRIX.STATE.lastMasterBroadcast && (Date.now() - window.MATRIX.STATE.lastMasterBroadcast) < 30000;
  
  // If we are a slave TV, and a Master is currently broadcasting, do NOT broadcast our own local changes
  if (!isMaster && masterIsActive) {
      skipBroadcast = true;
  }

  if (bc && slide && !skipBroadcast) {
      const broadcastMsg = { 
          type: 'CURRENT_SLIDE_BROADCAST', 
          slide: slide, 
          index: window.MATRIX.STATE.currentIndex,
          startTime: startTime,
          delay: delay,
          senderTabId: window.matrixTabId || 'iframe',
          isMaster: !!isMaster,
          commandId: 'cmd_' + Date.now() + '_bc_' + Math.random().toString(36).substr(2, 5)
      };
      bc.postMessage(broadcastMsg);
      if (window.parent && window.parent.sendToFirebase) {
          window.parent.sendToFirebase(broadcastMsg);
      }

      // If this is the master dashboard, blast a SYNC_JUMP so all billboards follow suit
      if (window.parent && window.parent.IS_MASTER_DASHBOARD) {
          const syncMsg = {
              type: 'SYNC_JUMP',
              id: slide.id,
              senderTabId: window.matrixTabId || 'iframe',
              timestamp: Date.now(),
              commandId: 'cmd_' + Date.now() + '_sync_' + Math.random().toString(36).substr(2, 5)
          };
          bc.postMessage(syncMsg);
          if (window.parent.sendToFirebase) {
              window.parent.sendToFirebase(syncMsg);
          }
      }
  }
  
  if (!container || !slide) return;

  clearTimeout(window.MATRIX.STATE.timer);

  // Prevent fade-to-black loop and Master ping bugs by not recreating DOM for the same slide
  const currentDOM = document.getElementById('slide-target');
  if (currentDOM && currentDOM.dataset.slideId === String(slide.id)) {
      const bar = document.getElementById('progress-bar');
      if (bar) {
          if (slide.type === 'MODULE' || slide.id === 'ct-fir') {
              bar.style.display = 'none';
          } else {
              bar.style.display = '';
              bar.style.transition = 'none';
              bar.style.width = '0%';
              if (!window.MATRIX.STATE.isPaused) {
                  requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                          bar.style.transition = `width ${delay}ms linear`;
                          bar.style.width = '100%';
                      });
                  });
              }
          }
      }
      if (!window.MATRIX.STATE.isPaused) {
          window.MATRIX.STATE.timer = setTimeout(window.nextSlide, delay);
      }
      return;
  }

  // 1. Show interstitial loader transition
  let loader = document.getElementById('transition-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'transition-loader';
    loader.className = 'slide fade-in';
    loader.style.zIndex = '5000'; // above everything
    loader.style.backgroundColor = '#000';
    loader.style.transition = 'opacity 0.6s ease';
    loader.innerHTML = `
      <div class="slide-bg" style="display:flex; justify-content:center; align-items:center; background-color: #000;">
        <div class="logo-wrapper" style="position:relative; height: 90vh; display: flex; justify-content: center; animation: cinematicZoom 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
          <img src="images/GOLD-FLAME-LOGO-BLACK-CLEAN.png" alt="Flame Lantern" style="height: 100%; width: auto; z-index: 2; position:relative;">
          <div class="flame-anchor" style="position: absolute; left: 50%; top: 60%; width: 0; height: 0; z-index: 3; transform: scale(1.5);">
            <div class="flame-container">
                <div class="flame-glow"></div>
                <div class="flame-core"></div>
                <div class="flame-particle" style="width: 30px; height: 50px; animation-delay: 0s"></div>
                <div class="flame-particle" style="width: 25px; height: 45px; animation-delay: 0.3s"></div>
                <div class="flame-particle" style="width: 28px; height: 48px; animation-delay: 0.6s"></div>
                <div class="flame-particle" style="width: 22px; height: 42px; animation-delay: 0.9s"></div>
            </div>
            <!-- Reflection -->
            <div class="flame-container reflection" style="transform: scaleY(-0.6) translateY(-40px); opacity: 0.3; filter: blur(4px);">
                <div class="flame-glow" style="opacity:0.2;"></div>
                <div class="flame-core"></div>
                <div class="flame-particle" style="width: 30px; height: 50px; animation-delay: 0s"></div>
                <div class="flame-particle" style="width: 25px; height: 45px; animation-delay: 0.3s"></div>
                <div class="flame-particle" style="width: 28px; height: 48px; animation-delay: 0.6s"></div>
                <div class="flame-particle" style="width: 22px; height: 42px; animation-delay: 0.9s"></div>
            </div>
          </div>
        </div>
        <div class="slide-bg-overlay" style="background: radial-gradient(circle, transparent 20%, #000 100%); z-index: 1;"></div>
      </div>
    `;
    document.body.appendChild(loader);
  }

  // Show loader sporadically (Disabled as requested - annoying)
  const showLoader = false; 

  if (showLoader) {
    loader.style.opacity = '1';
    loader.style.visibility = 'visible';
    loader.classList.add('active');
  }

  // Wait for fade in before swapping content
  const transitionDelay = showLoader ? 600 : 0;
  setTimeout(() => {
    // Remove old slide
    const existing = document.getElementById('slide-target');
    if (existing) {
      existing.removeAttribute('id');
      existing.classList.remove('active');
      existing.classList.add('exit');
      setTimeout(() => existing.remove(), 800);
    }

    // Create fresh slide element
    const slideEl = document.createElement('div');
    slideEl.id = 'slide-target';
    slideEl.dataset.slideId = slide.id;
    
    // Apply custom transition class
    const transitionClass = (slide.transition || '').toLowerCase().replace(/\s/g, '-');
    slideEl.className = 'slide ' + transitionClass;

    // Apply custom zoom if specified
    if (slide.zoom) {
      slideEl.setAttribute('data-zoom', 'true');
      slideEl.style.setProperty('--zoom-level', slide.zoom);
    }

    // Apply dynamic theme variables - Default to GOLD if not supplied
    const themeColor = slide.accentColor || (slide.type === 'PROMO' ? (slide.highlightColor || '#f59e0b') : getHighlightColor(slide)) || '#f59e0b';
    document.documentElement.style.setProperty('--theme-color', themeColor);
    document.documentElement.style.setProperty('--theme-glow', `${themeColor}60`);

    if (slide.type === 'MODULE') {
      let moduleColor = '#f59e0b';
      if (slide.id === 'ct-mmr') moduleColor = '#ef4444';
      if (slide.id === 'ct-fir') moduleColor = '#f97316';
      if (slide.id === 'ct-quiz') moduleColor = '#3b82f6';
      if (slide.id === 'ct-soc') moduleColor = '#d4af37';
      if (slide.id === 'ct-tik') moduleColor = '#ff0050';
      if (slide.id === 'ct-loyalty') moduleColor = '#89CFF0';
      
      document.documentElement.style.setProperty('--theme-color', moduleColor);
      document.documentElement.style.setProperty('--theme-glow', `${moduleColor}60`);
      slideEl.innerHTML = `<iframe src="${slide.url}" class="module-frame" id="module-${slide.id}"></iframe>`;
    } else {
      const isPromo = slide.type === 'PROMO';
      const isLogo = slide.isLogo || (!slide.title && !slide.subtitle && slide.bgImage && slide.bgImage.includes('LOGO'));
      
      // Process Background (Hex support)
      const rawBg = slide.bgImage ? String(slide.bgImage) : getDefaultBackground(slide.subType, slide.title);
      const isHex = /^#([A-Fa-f0-9]{3,8})$/.test((rawBg || '').trim());
      const bgImg = isHex ? '' : rawBg;
      const bgColor = isHex ? rawBg : '#000000';

      const color = themeColor; // Use the already computed themeColor which respects accentColor
      const smartTag = getSmartTag(slide);
      const typeKey = (slide.subType || slide.type || 'Event').toLowerCase();

      if (isLogo) {
        slideEl.innerHTML = `
          <div class="slide-bg" style="display:flex; justify-content:center; align-items:center; background-color: ${bgColor};">
            <div class="logo-wrapper" style="position:relative; height: 75vh; display: flex; justify-content: center; animation: cinematicZoom 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
              ${bgImg ? `<img src="${bgImg}" alt="Flame Lantern" style="height: 100%; width: auto; z-index: 2; position:relative; opacity: 1; filter: none; animation: none;" />` : ''}
              <div class="flame-anchor" style="position: absolute; left: 50%; top: ${slide.flamePosition || '60%'}; width: 0; height: 0; z-index: 3; transform: scale(1.5);">
                <div class="flame-container">
                    <div class="flame-glow"></div>
                    <div class="flame-core"></div>
                    <div class="flame-particle" style="width: 30px; height: 50px; animation-delay: 0s"></div>
                    <div class="flame-particle" style="width: 25px; height: 45px; animation-delay: 0.3s"></div>
                    <div class="flame-particle" style="width: 28px; height: 48px; animation-delay: 0.6s"></div>
                    <div class="flame-particle" style="width: 22px; height: 42px; animation-delay: 0.9s"></div>
                </div>
                <!-- Reflection -->
                <div class="flame-container reflection" style="transform: scaleY(-0.6) translateY(-40px); opacity: 0.3; filter: blur(4px);">
                    <div class="flame-glow" style="opacity:0.2;"></div>
                    <div class="flame-core"></div>
                    <div class="flame-particle" style="width: 30px; height: 50px; animation-delay: 0s"></div>
                    <div class="flame-particle" style="width: 25px; height: 45px; animation-delay: 0.3s"></div>
                    <div class="flame-particle" style="width: 28px; height: 48px; animation-delay: 0.6s"></div>
                    <div class="flame-particle" style="width: 22px; height: 42px; animation-delay: 0.9s"></div>
                </div>
              </div>
            </div>
            <div class="slide-bg-overlay" style="background: radial-gradient(circle, transparent 20%, #000 100%); z-index: 1;"></div>
          </div>
          ${renderPremiumFooterRow(slide, themeColor)}
        `;
      } else if (slide.type === 'LIVE') {
        const accent = slide.accent || '#06b6d4';
        slideEl.innerHTML = `
            <div class="slide-bg" style="background: #000;">
              <div style="position:absolute; inset:0; background: radial-gradient(circle at center, ${accent}22 0%, #000 70%);"></div>
            </div>
            <div style="position:relative; z-index:10; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding: 5rem;">
              <div class="text-label animate-content-enter" style="animation-delay: 0.1s; font-size: 2rem; letter-spacing: 10px; color: ${accent}; margin-bottom: 2rem; font-weight: 900;">LIVE BROADCAST</div>
              <div class="slide-title animate-content-enter" style="animation-delay: 0.2s; font-size: 8rem; font-weight: 900; line-height: 0.9; margin-bottom: 3rem; color: #fff; text-shadow: 0 0 50px ${accent}44;">${slide.title}</div>
              <div class="slide-subtitle animate-content-enter" style="animation-delay: 0.3s; font-size: 3rem; color: #94a3b8; font-weight: 600; max-width: 1200px;">${slide.detail || ''}</div>
            </div>
            <div style="position: absolute; bottom: 4rem; width: 100%; text-align: center; font-family: 'JetBrains Mono'; font-size: 1.2rem; color: ${accent}; opacity: 0.5;">
              MATRIX LIVE ALERT SYSTEM v1.0
            </div>
        `;
      } else if (slide.type === 'LOYALTY' || (slide.title && slide.title.toLowerCase().includes('loyalty app'))) {
        const appleQr = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=' + encodeURIComponent('https://apps.apple.com/us/app/coasters-tavern/id1592410581');
        const googleQr = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=' + encodeURIComponent('https://play.google.com/store/apps/details?id=com.posbiz.coasters&hl=en');
        slideEl.innerHTML = `
            <div class="slide-bg" style="background: radial-gradient(circle at 50% 15%, #1a150e 0%, #0d0c10 50%, #050406 100%);">
              <div style="position:absolute; inset:0; background: radial-gradient(circle at center, rgba(212, 175, 55, 0.15) 0%, transparent 70%);"></div>
            </div>
            <div class="social-card animate-content-enter" style="gap: 2rem; padding: 3% 5%;">
              <div style="display:inline-flex; align-items:center; gap:8px; border: 1.5px solid #d4af37; background: rgba(212,175,55,0.15); color: #fef08a; padding: 0.6rem 2.2rem; border-radius: 999px; font-weight: 800; font-size: 1.6rem; letter-spacing: 0.2em; text-transform: uppercase; box-shadow: 0 0 25px rgba(212,175,55,0.3);">
                ★ COASTERS REWARDS CLUB ★
              </div>
              <div class="social-title" style="font-size: clamp(4rem, 6vw, 7rem); margin-top: 0.5rem;">DOWNLOAD OUR LOYALTY APP</div>
              <div style="font-size: clamp(1.8rem, 2.4vw, 3rem); color: #e2e8f0; font-weight: 600; max-width: 85%;">
                Earn points on every purchase • Redeem food & drink vouchers • Exclusive VIP specials
              </div>
              <div style="display: flex; gap: 4rem; justify-content: center; align-items: stretch; margin-top: 1rem;">
                <div style="background: rgba(18,18,24,0.85); border: 2px solid rgba(255,255,255,0.3); border-radius: 2rem; padding: 2rem 3.5rem; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
                  <div style="font-weight: 800; font-size: 1.6rem; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.1em;">iOS / Apple</div>
                  <div style="background: #fff; padding: 1rem; border-radius: 1.2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <img src="${appleQr}" style="width: 180px; height: 180px; display: block;" alt="Apple App Store QR">
                  </div>
                  <div style="background: #000; border: 1px solid rgba(255,255,255,0.4); padding: 0.8rem 2rem; border-radius: 1rem; color: #fff; font-weight: 800; font-size: 1.4rem;">
                    App Store
                  </div>
                </div>
                <div style="background: rgba(18,18,24,0.85); border: 2px solid rgba(1,135,95,0.6); border-radius: 2rem; padding: 2rem 3.5rem; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
                  <div style="font-weight: 800; font-size: 1.6rem; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.1em;">Android</div>
                  <div style="background: #fff; padding: 1rem; border-radius: 1.2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <img src="${googleQr}" style="width: 180px; height: 180px; display: block;" alt="Google Play QR">
                  </div>
                  <div style="background: #000; border: 1px solid rgba(1,135,95,0.6); padding: 0.8rem 2rem; border-radius: 1rem; color: #fff; font-weight: 800; font-size: 1.4rem;">
                    Google Play
                  </div>
                </div>
              </div>
            </div>
        `;
      } else if (slide.type === 'SOCIAL LINK') {
        const icon = (slide.title || '').toLowerCase().includes('facebook') ? '📘' : ((slide.title || '').toLowerCase().includes('instagram') ? '📸' : '📱');
        slideEl.innerHTML = `
            <div class="slide-bg" style="background: #000;">
              <div style="position:absolute; inset:0; background: radial-gradient(circle at center, var(--theme-color)22 0%, #000 70%);"></div>
            </div>
            <div class="social-card">
              <div class="social-icon animate-pop-in" style="animation-delay: 0.1s;"><div class="animate-float" style="display:inline-block">${icon}</div></div>
              <div class="social-title animate-pop-in" style="animation-delay: 0.2s;">${slide.title}</div>
              <div class="social-handle animate-pop-in" style="animation-delay: 0.3s;">${slide.subtitle || ''}</div>
              <div class="social-qr-container animate-content-enter" style="animation-delay: 0.4s;">
                <div class="social-cta">Scan to Follow</div>
                <div class="social-qr-wrapper">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(slide.qr || slide.footerLink || '')}" alt="Social QR">
                </div>
              </div>
            </div>
        `;
      } else if (slide.type === 'MENU') {
        slideEl.innerHTML = `
            <div class="slide-bg" style="background-color: ${bgColor};">
              ${bgImg ? `<img src="${bgImg}" alt="" class="menu-panning-img">` : ''}
              <div class="slide-bg-overlay" style="background: linear-gradient(to right, rgba(0,0,0,0.4) 0%, transparent 40%);"></div>
            </div>
            <div class="menu-overlay-ui">
              <div class="menu-sidebar">
                <div class="menu-badge animate-content-enter" style="animation-delay: 0.1s;">MENU</div>
                <h1 class="menu-title animate-content-enter" style="animation-delay: 0.2s;">${slide.title || 'Today\'s Menu'}</h1>
                <div class="menu-accent animate-content-enter" style="animation-delay: 0.3s;" style="background: var(--theme-color);"></div>
                ${slide.subtitle ? `<div class="menu-desc animate-content-enter" style="animation-delay: 0.4s;">${slide.subtitle}</div>` : ''}
                
                <div class="menu-qr-box animate-content-enter" style="animation-delay: 0.5s;">
                  <div class="qr-label">Scan for Full Menu</div>
                  <div class="qr-frame">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(slide.qr || slide.footerLink || window.location.href)}">
                  </div>
                </div>
              </div>
            </div>
        `;
      } else if (slide.type === 'SPECIAL EVENT') {
        slideEl.innerHTML = `
            <div class="slide-bg" style="background-color: ${bgColor};">
              ${bgImg ? `<img src="${bgImg}" alt="">` : ''}
              <div class="slide-bg-overlay" style="background: radial-gradient(circle at center, transparent 0%, #000 90%);"></div>
            </div>
            <div class="special-event-card">
              <div class="premium-tag-wrapper animate-content-enter" style="animation-delay: 0.1s;">
                <div class="special-badge">Special Event</div>
              </div>
              <div class="premium-title-wrapper animate-content-enter" style="animation-delay: 0.2s;">
                <h1 class="special-title">${slide.title}</h1>
              </div>
              <div class="premium-accent-wrapper animate-content-enter" style="animation-delay: 0.2s;">
                <div class="accent-bar" style="background: ${themeColor};"></div>
              </div>
              ${slide.subtitle ? `
              <div class="premium-desc-wrapper animate-content-enter" style="animation-delay: 0.4s;">
                <div class="special-desc">${slide.subtitle}</div>
              </div>` : ''}
            </div>
            ${renderPremiumFooterRow(slide, themeColor)}
        `;
      } else if (slide.fgImage) {
        // FULLSCREEN IMAGE MODE (Col 19 / T)
        // We still show the Footer QR if provided, but keep the rest clean.
        slideEl.innerHTML = `
          <div class="slide-bg" style="background: #000;">
            <img src="${slide.fgImage}" alt="" style="width: 100%; height: 100%; object-fit: contain; animation: none;">
          </div>
          ${renderPremiumFooterRow(slide, themeColor)}
        `;
      } else {
        slideEl.innerHTML = `
          <div class="slide-bg" style="background-color: ${bgColor};">
            ${bgImg ? `<img src="${bgImg}" alt="" loading="eager" style="object-position: ${String(bgImg).includes('crusaders') ? 'left center' : (String(bgImg).includes('warriors') ? 'right center' : 'center center')};" />` : ''}
            <div class="slide-bg-overlay" style="background: rgba(0,0,0,0.85);"></div>
          </div>
          <div class="premium-card">
            <!-- 1. Event Type -->
            <div class="premium-tag-wrapper animate-content-enter" style="animation-delay: 0.1s;">
              <span class="day-tag" data-type="${typeKey}" style="background-color: ${color}40; border-color: ${color};">${smartTag}</span>
            </div>

            <!-- 2. Event Name -->
            <div class="premium-title-wrapper animate-content-enter" style="animation-delay: 0.2s;">
              <h1 class="premium-title">${slide.title}</h1>
            </div>

            <div class="premium-accent-wrapper animate-content-enter" style="animation-delay: 0.2s;">
              <div class="accent-bar" style="background: ${color};"></div>
            </div>

            <!-- 3. Details -->
            ${slide.subtitle ? `
            <div class="premium-desc-wrapper animate-content-enter" style="animation-delay: 0.4s;">
              <div class="premium-desc">${String(slide.subtitle).replace(/\n/g, '<br>')}</div>
            </div>` : ''}
          </div>
          <!-- Consolidated Footer Row (Price, Meta, QR) -->
          ${renderPremiumFooterRow(slide, color)}
        `;
      }
    }

    container.appendChild(slideEl);
    
    adjustActiveSlideText();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        slideEl.classList.add('active');
        adjustActiveSlideText();
      });
    });

    const bar = document.getElementById('progress-bar');
    if (bar) {
      if (slide.type === 'MODULE' || slide.id === 'ct-fir') {
        bar.style.display = 'none';
      } else {
        bar.style.display = '';
      }
    }

    if (!window.MATRIX.STATE.isPaused) {
      const defaultDelay = slide.duration ? slide.duration * 1000 : (slide.type === 'MODULE' ? window.MATRIX.CONFIG.MODULE_DELAY : window.MATRIX.CONFIG.SWAP_DELAY);
      const finalDelay = overrideDelay !== null ? overrideDelay : defaultDelay;
      window.MATRIX.STATE.timer = setTimeout(nextSlide, finalDelay);
      
      if (bar && slide.type !== 'MODULE' && slide.id !== 'ct-fir') {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bar.style.transition = `width ${finalDelay}ms linear`;
            bar.style.width = '100%';
          });
        });
      }
    } else {
      if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '0%';
      }
    }

    // Fade out loader after content has initialized
    if (showLoader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        setTimeout(() => {
          loader.classList.remove('active');
        }, 600); // Wait for CSS transition
      }, 1000); // 1-second hold to ensure modules/images load behind it
    }
    preloadNextSlideImage();
  }, transitionDelay);
}

/**
 * Preload the next active slide's background image to avoid a blank/black flash during transitions.
 */
function preloadNextSlideImage() {
  const s = window.MATRIX.STATE;
  if (!s.slides || s.slides.length <= 1) return;
  
  let nextIdx = s.currentIndex;
  let loopCount = 0;
  do {
    nextIdx = (nextIdx + 1) % s.slides.length;
    loopCount++;
  } while (!isSlideActive(s.slides[nextIdx]) && loopCount < s.slides.length);
  
  const nextSlide = s.slides[nextIdx];
  if (nextSlide && nextSlide.type !== 'MODULE') {
    const rawBg = nextSlide.bgImage || getDefaultBackground(nextSlide.subType, nextSlide.title);
    const isHex = /^#([A-Fa-f0-9]{3,8})$/.test((rawBg || '').trim());
    if (rawBg && !isHex) {
      const img = new Image();
      img.src = rawBg.replace(/\\/g, '/');
    }
  }
}

/**
 * renderPremiumFooterRow - Consolidated UI for Price, QR, and Meta-data
 */
function renderPremiumFooterRow(slide, color) {
  const qrData = slide.qr || slide.qrUrl || slide.footerQR || slide.footerLink;
  const showQR = !!qrData;
  const showPrice = !!slide.price;
  
  // Meta Logic (Time/Date/Location/Days)
  const timeStr = slide.time ? String(slide.time) : '';
  const titleLower = String(slide.title || '').toLowerCase();
  const subtitleLower = String(slide.subtitle || '').toLowerCase();
  const timeRedundant = timeStr && (titleLower.includes(timeStr.toLowerCase()) || subtitleLower.includes(timeStr.toLowerCase()));
  
  const dateStr = slide.date ? formatDate(slide.date, timeStr) : '';
  const dayStr = slide.meta ? 'EVERY ' + String(slide.meta).split(' ')[0].toUpperCase() : '';
  const locStr = slide.location ? '📍 ' + slide.location : '';
  
  let footerText = slide.footer ? String(slide.footer) : '';
  if (/scan\s+to\s+book\s+a\s+table/i.test(footerText)) {
    footerText = 'SCAN TO BOOK\nA TABLE NOW';
  }
  const showFooter = !!footerText;

  const subTypeLower = (slide.subType || slide.type || '').toLowerCase();
  const isTargetEvent = ['band', 'bands', 'live music', 'super rugby', 'rugby', 'nrl', 'league'].some(t => subTypeLower.includes(t));
  const showLoc = isTargetEvent && slide.location;
  
  const showLeftMeta = !!(dateStr || dayStr);

  return `
    <div class="premium-footer-row">
      ${showLeftMeta ? `
        <div class="premium-meta-item date-pill">🗓️ ${dateStr || dayStr}</div>
      ` : ''}
      ${showPrice ? `
        <div class="price-badge">
          <div class="price-badge-inner"><span class="price-text">${slide.price}</span></div>
        </div>
      ` : ''}
      ${timeStr && !timeRedundant ? `<div class="premium-meta-item time-pill">⏰ ${timeStr}</div>` : ''}
      ${showLoc ? `<div class="premium-meta-item location-pill">📍 ${slide.location}</div>` : ''}
      ${(showFooter || showQR) ? `
        <div class="premium-meta-item footer-combined-box">
          ${showFooter ? `<div class="premium-footer">📷 ${String(footerText).replace(/\n/g, '<br>')}</div>` : ''}
          ${showQR ? `
            <div class="footer-qr-img">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=L&data=${encodeURIComponent(qrData)}" alt="QR">
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Robust Date Parser
 * Live CSV uses DD/MM/YYYY (NZ format).
 * Also handles ISO YYYY-MM-DD.
 */
function parseMatrixDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  
  const str = String(dateStr).trim();
  
  // 1. ISO Format: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  
  // 2. Slash format: DD/MM/YYYY (NZ/UK) — confirmed live CSV format
  const parts = str.split('/').map(Number);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (m > 12) {
      return new Date(y, d - 1, m); // Fallback: treat as M/D/YYYY if middle > 12
    }
    return new Date(y, m - 1, d); // Default NZ DD/MM/YYYY
  }
  
  // 3. Fallback to native (with caution)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Robust Time Parser
 * Converts time strings like "7:10 pm", "3:00 am", "~9:30 PM", or "22:00" to decimal hours.
 * Returns null if the format is not recognized.
 */
function parseTimeStringToHours(timeStr) {
  if (!timeStr) return null;
  const clean = String(timeStr).toLowerCase().replace(/[~\s\u202f]/g, '').trim();
  
  // 12-hour format: hh:mmam/pm or hham/pm
  const match12 = clean.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = match12[2] ? parseInt(match12[2]) : 0;
    const ampm = match12[3];
    
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    return hours + minutes / 60;
  }
  
  // 24-hour format: hh:mm or hh
  const match24 = clean.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = parseInt(match24[1]);
    const minutes = match24[2] ? parseInt(match24[2]) : 0;
    if (hours >= 0 && hours < 24) {
      return hours + minutes / 60;
    }
  }
  
  return null;
}

/**
 * Date Formatting Helper
 */
function formatDate(dateStr, timeStr) {
  try {
    const d = parseMatrixDate(dateStr);
    if (!d) return dateStr;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const evDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((evDay - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const hasTime = timeStr && timeStr.trim() !== '' && !/all\s*day/i.test(timeStr);
      return hasTime ? 'Tonight' : 'Today';
    }
    if (diffDays === 1) return 'Tomorrow';
    
    return d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
}

function showStatus(msg) {
    console.log('[MATRIX]', msg);
}

// Initial Sync
loadPersistedState();

function handleLiveSlide(payload) {
    if (window.MATRIX.STATE.liveClearTimer) {
        clearTimeout(window.MATRIX.STATE.liveClearTimer);
        window.MATRIX.STATE.liveClearTimer = null;
    }

    if (!payload || !payload.active) {
        if (window.MATRIX.STATE.liveTimer) {
            clearInterval(window.MATRIX.STATE.liveTimer);
            window.MATRIX.STATE.liveTimer = null;
        }
        const liveOverlay = document.getElementById('live-slide-overlay');
        if (liveOverlay) liveOverlay.remove();
        window.MATRIX.STATE.isClosedSlideActive = false;
        window.MATRIX.STATE.isPaused = false;
        renderActiveSlide(false);
        return;
    }

    if (payload.mode === 'INJECT') {
        const newSlide = {
            id: 'live-' + Date.now(),
            type: 'LIVE',
            subType: 'LIVE BROADCAST',
            title: payload.title,
            detail: payload.detail,
            accent: payload.accent,
            date: new Date().toISOString(),
            isManual: true
        };
        // Inject after current slide
        window.MATRIX.STATE.slides.splice(window.MATRIX.STATE.currentIndex + 1, 0, newSlide);
        showStatus('LIVE SLIDE INJECTED INTO ROTATION');
        return;
    }

    // OVERRIDE logic (Full Screen Overlay)
    let liveOverlay = document.getElementById('live-slide-overlay');
    if (!liveOverlay) {
        liveOverlay = document.createElement('div');
        liveOverlay.id = 'live-slide-overlay';
        liveOverlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: #000; display: flex; flex-direction: column;
            align-items: center; justify-content: center; text-align: center;
            padding: 5rem; font-family: 'Inter', sans-serif;
        `;
        document.body.appendChild(liveOverlay);
    }

    const accent = payload.accent || '#06b6d4';
    liveOverlay.innerHTML = `
        <style>
            @keyframes liveSlideUp { from { opacity: 0; transform: translateY(50px); } to { opacity: 1; transform: translateY(0); } }
        </style>
        <div style="position:absolute; inset:0; background: radial-gradient(circle at center, ${accent}22 0%, #000 70%);"></div>
        <div style="z-index:1; animation: liveSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)">
            <h2 style="font-size: 2rem; text-transform: uppercase; letter-spacing: 10px; color: ${accent}; margin-bottom: 2rem; font-weight: 900;">LIVE BROADCAST</h2>
            ${payload.countdownFinish ? `<div id="live-countdown-text" style="font-size: 12rem; font-weight: 900; font-family: 'JetBrains Mono', monospace; color: #ef4444; line-height: 1; margin-bottom: 2rem; text-shadow: 0 0 50px #ef4444;">--:--</div>` : ''}
            <h1 style="font-size: 8rem; font-weight: 900; line-height: 0.9; margin-bottom: 2rem; color: #fff; text-shadow: 0 0 50px ${accent}44;">${payload.title || ''}</h1>
            <p style="font-size: 4rem; color: #94a3b8; font-weight: 600; max-width: 1400px; line-height: 1.2;">${payload.detail || ''}</p>
        </div>
        <div style="position: absolute; bottom: 4rem; width: 100%; text-align: center; font-family: 'JetBrains Mono'; font-size: 1.2rem; color: ${accent}; opacity: 0.5;">
            MATRIX LIVE ALERT SYSTEM v1.0
        </div>
    `;

    if (payload.mode === 'OVERRIDE') {
        window.MATRIX.STATE.isPaused = true;
        if (window.MATRIX.STATE.timer) clearTimeout(window.MATRIX.STATE.timer);
    }
    
    if (window.MATRIX.STATE.liveTimer) clearInterval(window.MATRIX.STATE.liveTimer);
    if (payload.countdownFinish) {
        const finish = new Date(payload.countdownFinish).getTime();
        window.MATRIX.STATE.liveTimer = setInterval(() => {
            const now = Date.now();
            const diff = finish - now;
            const cdEl = document.getElementById('live-countdown-text');
            if (cdEl) {
                if (diff <= 0) {
                    cdEl.innerHTML = "00:00";
                    clearInterval(window.MATRIX.STATE.liveTimer);
                    
                    if (payload.autoBarClosed) {
                        payload.title = 'BAR IS NOW CLOSED';
                        payload.detail = 'Last drinks has finished. Thank you for visiting, please travel home safely.';
                        payload.accent = '#ef4444';
                        payload.countdownFinish = null;
                        payload.autoBarClosed = false;
                        window.MATRIX.STATE.isClosedSlideActive = true;
                        window.MATRIX.STATE.isPaused = true;
                        if (window.MATRIX.STATE.timer) clearTimeout(window.MATRIX.STATE.timer);
                        
                        if (bc) {
                            bc.postMessage({
                                type: 'LIVE_SLIDE',
                                payload: {
                                    active: true,
                                    title: 'BAR IS NOW CLOSED',
                                    detail: 'Last drinks has finished. Thank you for visiting, please travel home safely.',
                                    accent: '#ef4444',
                                    mode: 'OVERRIDE'
                                }
                            });
                        }
                        
                        // Recursive call to transition locally
                        setTimeout(() => handleLiveSlide(payload), 500);
                    }
                } else {
                    const m = Math.floor(diff / 60000).toString().padStart(2, '0');
                    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                    cdEl.innerHTML = m + ":" + s;
                }
            }
        }, 1000);
    }
    
    // Auto-clear holding pattern (e.g. 2 hours after bar closes)
    if (payload.autoClearAfter) {
        window.MATRIX.STATE.liveClearTimer = setTimeout(() => {
             handleLiveSlide({ active: false });
        }, payload.autoClearAfter);
    }
}

window.initMatrix = initMatrix;

if (document.fonts) {
  document.fonts.ready.then(() => {
    if (typeof adjustActiveSlideText === 'function') {
      adjustActiveSlideText();
    }
  });
}

// Sync Status Dot initialization
(function() {
    function createSyncStatusDot() {
        let dot = document.getElementById('sync-status-dot');
        if (!dot) {
            dot = document.createElement('div');
            dot.id = 'sync-status-dot';
            dot.style.cssText = `
                position: fixed; bottom: 25px; right: 25px;
                width: 12px; height: 12px; border-radius: 50%;
                background-color: #10b981; box-shadow: 0 0 10px #10b981;
                z-index: 10000; transition: all 0.5s ease;
                pointer-events: none; opacity: 0.7;
            `;
            document.body.appendChild(dot);
        }
    }

    window.updateSyncStatus = function(status) {
        createSyncStatusDot();
        const dot = document.getElementById('sync-status-dot');
        if (!dot) return;
        if (status === 'online') {
            dot.style.backgroundColor = '#10b981';
            dot.style.boxShadow = '0 0 10px #10b981';
        } else if (status === 'offline') {
            dot.style.backgroundColor = '#ef4444';
            dot.style.boxShadow = '0 0 10px #ef4444';
        } else if (status === 'sync-error') {
            dot.style.backgroundColor = '#f59e0b';
            dot.style.boxShadow = '0 0 10px #f59e0b';
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.updateSyncStatus(navigator.onLine ? 'online' : 'offline'));
    } else {
        window.updateSyncStatus(navigator.onLine ? 'online' : 'offline');
    }

    window.addEventListener('online', () => window.updateSyncStatus('online'));
    window.addEventListener('offline', () => window.updateSyncStatus('offline'));
})();
