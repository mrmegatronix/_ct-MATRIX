/**
 * MATRIX Core - Central Advertising Logic (v2.0.0)
 * Premium TV slide engine with cycling wallpapers,
 * GSheets integration, and modular project embedding.
 */

window.MATRIX = {
  VERSION: '2.0.0',
  CONFIG: {
    SWAP_DELAY: 30000,
    MODULE_DELAY: 30000,
    SYNC_CHANNEL: 'ct_matrix_sync',
    WEEKS_LOOKAHEAD: 2,
    SHOW_BANNER: true,
    ADMIN_PIN: '1234',
    GSHEETS_URL: 'live_headers_check.csv' // Switched from GSheet to Local Live CSV as per user request
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
  
  loadPersistedState();
  
  // 1. Load Data Sources in Parallel
  const data = await loadAllDataSources();
  
  // 2. Build Slide Queue
  buildSlideQueue(data);
  
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
    switch(e.data.type) {
      case 'NEXT': window.nextSlide(); break;
      case 'PREV': window.prevSlide(); break;
      case 'TOGGLE': window.togglePause(); break;
      case 'JUMP': window.jumpToProject(e.data.id); break;
      case 'PROJECT': window.jumpToProject(e.data.id); break;
      case 'SETTINGS_UPDATE': updateConfig(e.data.payload); break;
      case 'SYNC_DATA': window.initMatrix(); break; 
      case 'REFRESH': window.location.reload(); break;
      case 'LIVE_SLIDE': handleLiveSlide(e.data.payload); break;
      case 'GET_SLIDES_DUMP': 
        bc.postMessage({ type: 'SLIDES_DUMP', slides: window.MATRIX.STATE.slides, currentIndex: window.MATRIX.STATE.currentIndex }); 
        break;
      case 'CONFETTI': if (window.triggerConfetti) window.triggerConfetti(); break;
    }
  };

  applyUISettings();

  // 5. Auto Data Sync every 15 minutes (failsafe)
  if (!window.MATRIX.STATE.syncInterval) {
    window.MATRIX.STATE.syncInterval = setInterval(async () => {
      console.log('[MATRIX v2] Failsafe auto-syncing data...');
      const freshData = await loadAllDataSources();
      buildSlideQueue(freshData);
    }, 15 * 60 * 1000);
  }

  // 6. Hard-lock all active slide durations to 30s (override any internal module timers if needed)
  window.MATRIX.CONFIG.SWAP_DELAY = 30000;
  window.MATRIX.CONFIG.MODULE_DELAY = 30000;

  // 6. GSheet Watchdog (optional but keeping for consistency)
  if (!window.MATRIX.STATE.watchdog) {
    window.MATRIX.STATE.lastModifiedTags = {};
    window.MATRIX.STATE.watchdog = setInterval(async () => {
      try {
        const url = window.MATRIX.CONFIG.GSHEETS_URL;
        if (!url) return;
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
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
      } catch (e) {}
    }, 60000); // Check GSheet every minute instead of every 3 seconds
  }
}

/**
 * Persistence Logic
 */
function loadPersistedState() {
  try {
    const config = localStorage.getItem('matrix_config');
    if (config) window.MATRIX.CONFIG = { ...window.MATRIX.CONFIG, ...JSON.parse(config) };

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
    if (events && events.length > 0) {
      console.log(`[MATRIX] Loaded ${events[0].events.length} events from Google Sheet (single source of truth).`);
      return events;
    }
  } catch (e) {
    console.error('[MATRIX] Google Sheet fetch failed:', e);
  }
  console.warn('[MATRIX] No data loaded from Google Sheet.');
  return [];
}



async function fetchCloudCSV() {
  const url = window.MATRIX.CONFIG.GSHEETS_URL;
  if (!url) return [];
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now());
    const csv = await res.text();
    return parseCSVToEvents(csv);
  } catch (e) {
    console.error('[MATRIX] Cloud GSheet failed', e);
    return [];
  }
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
  // 0:Date, 1:Day, 2:Event Type, 3:Event Name, 4:Details, 5:Time/Price,
  // 0:Date, 1:Day, 2:Event Type, 3:Event Name, 4:Details, 5:Start Time,
  // 6:Price, 7:Location, 8:Slide Footer, 9:Slide Type, 10:Hidden Notes,
  // 11:Accent Hex Colour, 12:Countdown Finish, 13:Feature QR, 14:Footer QR,
  // 15:Footer Hyperlink, 16:Slide Duration, 17:Slide Background,
  // 18:Foreground Image, 19:Bubble Text, 20:Lock Slide, 21:Lock Day, 22:Lock Time,
  // 23:Transition, 24:Zoom
  const events = result.slice(1).map(clean => {
    return {
      date: clean[0],
      day: clean[1],
      event_type: clean[2] || 'Event',
      title: (clean[3] || '').replace(/\n/g, '<br>'),
      notes: (clean[4] || '').replace(/\n/g, '<br>'),
      time: clean[5], // Start Time
      price: clean[6], // Price
      location: clean[7],
      footer: clean[8],
      slideType: clean[9],
      hiddenNotes: clean[10],
      accentColor: clean[11],
      countdownFinish: clean[12],
      qr: clean[13],
      footerQR: clean[14],
      footerLink: clean[15],
      duration: clean[16] ? parseInt(clean[16]) : null,
      bgImage: clean[17],
      fgImage: clean[18],
      bubbleText: clean[19],
      lockSlide: clean[20],
      lockDay: clean[21],
      lockTime: clean[22],
      transition: clean[23],
      zoom: clean[24]
    };
  }).filter(e => e.title || e.date);

  return [{ week_starting: 'Cloud Data', events }];
}

/**
 * Default Background Assignment by Event Type
 * Sheet's 'Slide Background' column takes priority; this is the fallback.
 */
function getDefaultBackground(eventType, title) {
  const t = (eventType || '').toLowerCase();
  const name = (title || '').toLowerCase();
  
  // Specific branding matches
  if (t.includes('rugby') || t.includes('nrl') || t.includes('warriors') || t.includes('crusaders') || 
      name.includes('warriors') || name.includes('crusaders') || name.includes('nrl')) {
    return '_backgrounds/stadium.png';
  }
  
  if (t.includes('karaoke') || t.includes('band') || t.includes('music') || t.includes('🟠') || t.includes('🟣')) {
    return '_backgrounds/music.jpg';
  }
  
  if (t.includes('quiz') || name.includes('quiz') || t.includes('trivia') || name.includes('trivia')) {
    return '_backgrounds/quiz.png';
  }
  
  // Fallback to rotation
  const bgs = window.MATRIX.BACKGROUNDS || [];
  if (bgs.length > 0) {
    const hash = (t + name).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return bgs[hash % bgs.length];
  }
  
  return '';
}

/**
 * Queue Construction
 */
function buildSlideQueue(data) {
  const queue = [];
  
  // 1. Add Filtered Events from all sources
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
          const isCurrent = isEventCurrent(targetDate, ev.event_type);

          if (isCurrent) {
            // RUTHLESS TBC/TBA filtering - scan ALL text fields
            const ruthlessString = [
              ev.title, ev.notes, ev.event_type, ev.location, ev.price, ev.time, ev.hiddenNotes, ev.footer
            ].join(' ').toLowerCase();

            if (ruthlessString.includes('tbc') || ruthlessString.includes('tba') || 
                ruthlessString.includes('to be confirmed') || ruthlessString.includes('to be announced')) {
              return;
            }

            const detId = 'ev-' + (ev.title + (ev.date || ev.day) + ev.time).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
            queue.push({
              id: detId,
              type: 'EVENT',
              subType: ev.event_type || 'Event',
              title: ev.title,
              subtitle: ev.notes,
              price: ev.price, 
              qr: ev.qr,
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
              duration: ev.duration,
              footerQR: ev.footerQR,
              footerLink: ev.footerLink,
              transition: ev.transition,
              zoom: ev.zoom
            });
          }
    });
  });

  // 2. Weekly Specials are now in the Google Sheet — no hardcoded injection needed.

  // 3. Project Modules (Base Infrastructure)
  queue.push({ type: 'MODULE', id: 'ct-mmr', url: '../_ct-MMR/index.html', title: "Meat Raffle Display", pinned: true, priority: 5 });
  queue.push({ type: 'MODULE', id: 'ct-wea', url: '../_ct-WEA/index.html', title: "Christchurch Weather", priority: 80 });
  queue.push({ type: 'MODULE', id: 'ct-ace', url: '../_ct-ACE/index.html', title: "Chase the Ace", pinned: true, priority: 5 });
  queue.push({ type: 'MODULE', id: 'ct-mom', url: '../_ct-MOM/index.html', title: "Mother's Day Celebration", pinned: true, priority: 5 });
  queue.push({ type: 'MODULE', id: 'ct-nim', url: '../_ct-NIM/index.html', title: "Nim Creative Display", priority: 85, disabled: true });
  queue.push({ type: 'MODULE', id: 'ct-fir', url: '../_ct-FIR/index.html', title: "Fireplace Ambiance", pinned: false, priority: 90, disabled: true });

  // 5. Filter & Sort
  // Remove disabled slides
  let filteredQueue = queue.filter(s => !s.disabled);

  // Sort by Priority (Ascending) then Pinned (Descending)
  filteredQueue.sort((a, b) => {
    const priA = a.priority || 50;
    const priB = b.priority || 50;
    if (priA !== priB) return priA - priB;
    return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
  });

  window.MATRIX.STATE.slides = filteredQueue;
  console.log(`[MATRIX v2] Queue built with ${filteredQueue.length} slides.`);
  
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
    
    // Modules and non-dated slides don't get smart tags
    if (!eventDate || slide.type === 'MODULE') return typeLabel;

    const evDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const diffDays = Math.round((evDay - today) / (1000 * 60 * 60 * 24));

    // Filtered out past events already, but safety check
    if (diffDays < 0) return typeLabel; 
    
    // Apply "Tonight" or "Tomorrow"
    if (diffDays === 0) return `Tonight: ${typeLabel}`;
    if (diffDays === 1) return `Tomorrow: ${typeLabel}`;

    // Monday-to-Sunday logic for "This Week" vs "Next Week"
    const currentDay = today.getDay(); // 0=Sun, 1=Mon...
    const daysToNextMonday = (currentDay === 0) ? 1 : (8 - currentDay);
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);
    nextMonday.setHours(0,0,0,0);

    // Apply tags only if within the relevant window
    if (evDay < nextMonday) {
        return `This Week: ${typeLabel}`;
    } else if (diffDays <= 14) {
        return `Next Week: ${typeLabel}`;
    }

    return typeLabel;
}

function fitText(el, minSize = 40) {
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    
    // Reset to base size first to measure correctly
    el.style.fontSize = '';
    el.style.whiteSpace = 'nowrap';
    
    let fontSize = parseInt(window.getComputedStyle(el).fontSize);
    const maxWidth = parent.offsetWidth * 0.95;

    // Fast reduction loop
    while (el.scrollWidth > maxWidth && fontSize > minSize) {
        fontSize -= 2;
        el.style.fontSize = fontSize + 'px';
    }

    // If still too wide, allow wrapping at the minimum size
    if (el.scrollWidth > maxWidth) {
        el.style.whiteSpace = 'normal';
    }
}

function isEventCurrent(dateOrStr, subType) {
    if (!dateOrStr) return true;
    const evDate = (dateOrStr instanceof Date) ? dateOrStr : parseMatrixDate(dateOrStr);
    if (!evDate) return true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
    
    // 1. Past events are always hidden (before today)
    if (evDay < today) return false;
    
    const diffDays = Math.round((evDay - today) / (1000 * 60 * 60 * 24));
    
    // 2. 14 Day lookahead for ALL events as per latest request
    return diffDays <= 14;
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
  const subType = (slide.subType || '').toLowerCase();
  const title = (slide.title || '').toLowerCase();

  if (title.includes('crusaders')) return '#ef4444'; // Red
  if (title.includes('warriors')) return '#10b981'; // Green

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

      if (diffDays < 0) return false; // Past event
      if (diffDays > 14) return false; // All items show up to 14 days ahead
    }
  }

  // Filter out TBC bands and enforce time rule
  if (slide.isBand || slide.type === 'BAND') {
    const t = String(slide.title || '').toLowerCase();
    const s = String(slide.subtitle || '').toLowerCase();
    if (t.includes('tbc') || s.includes('tbc') || t.includes('to be confirmed') || s.includes('to be confirmed')) {
      return false; // Skip unconfirmed bands
    }
    // Only show bands from 8 PM to 11 PM
    if (time < 20 || time >= 23) {
      return false;
    }
  }

  // Karaoke Promo Slide - Only show on days with Karaoke scheduled
  if (slide.id === 'promo-karaoke') {
    const today = new Date();
    today.setHours(0,0,0,0);
    const hasKaraokeToday = window.MATRIX.STATE.slides.some(s => {
       if (s.subType && s.subType.toLowerCase() === 'karaoke' && s.date) {
          const sDate = new Date(s.date);
          sDate.setHours(0,0,0,0);
          return sDate.getTime() === today.getTime();
       }
       return false;
    });
    if (!hasKaraokeToday) return false;
  }

  // Pre-Quiz Buildup: Wed 6:30 PM - 7:00 PM
  if (slide.id === 'promo-wed-prequiz') {
    return day === 3 && time >= 18.5 && time < 19;
  }
  
  // Last Drinks: 11:00 PM - 1:00 AM
  if (slide.id === 'promo-last-drinks') {
    return time >= 23 || time < 1;
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
 * Controller & Engine
 */
function nextSlide() {
  const s = window.MATRIX.STATE;
  if (!s.slides.length) return;
  
  let loopCount = 0;
  do {
    s.currentIndex = (s.currentIndex + 1) % s.slides.length;
    loopCount++;
  } while (!isSlideActive(s.slides[s.currentIndex]) && loopCount < s.slides.length);
  
  renderActiveSlide();
}

function prevSlide() {
  const s = window.MATRIX.STATE;
  if (!s.slides.length) return;
  
  let loopCount = 0;
  do {
    s.currentIndex = (s.currentIndex - 1 + s.slides.length) % s.slides.length;
    loopCount++;
  } while (!isSlideActive(s.slides[s.currentIndex]) && loopCount < s.slides.length);
  
  renderActiveSlide();
}

function togglePause() {
  const s = window.MATRIX.STATE;
  s.isPaused = !s.isPaused;
  const btn = document.getElementById('play-pause-btn');
  if (btn) btn.innerText = s.isPaused ? '\u25b6' : '\u23f8';
  if (!s.isPaused) nextSlide();
}

function jumpToProject(id) {
  const idx = window.MATRIX.STATE.slides.findIndex(s => s.id === id);
  if (idx !== -1) {
    window.MATRIX.STATE.currentIndex = idx;
    renderActiveSlide();
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
function renderActiveSlide() {
  const slide = window.MATRIX.STATE.slides[window.MATRIX.STATE.currentIndex];
  const container = document.getElementById('slide-viewport');
  if (!container || !slide) return;

  clearTimeout(window.MATRIX.STATE.timer);

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
    if (existing) existing.remove();

    // Create fresh slide element
    const slideEl = document.createElement('div');
    slideEl.id = 'slide-target';
    
    // Apply custom transition class
    const transitionClass = (slide.transition || '').toLowerCase().replace(/\s/g, '-');
    slideEl.className = 'slide ' + transitionClass;

    // Apply custom zoom if specified
    if (slide.zoom) {
      slideEl.setAttribute('data-zoom', 'true');
      slideEl.style.setProperty('--zoom-level', slide.zoom);
    }

    // Apply dynamic theme variables
    const themeColor = slide.type === 'PROMO' ? (slide.highlightColor || '#f59e0b') : getHighlightColor(slide);
    document.documentElement.style.setProperty('--theme-color', themeColor);
    document.documentElement.style.setProperty('--theme-glow', `${themeColor}60`);

    if (slide.type === 'MODULE') {
      let moduleColor = '#f59e0b';
      if (slide.id === 'ct-mmr') moduleColor = '#ef4444';
      if (slide.id === 'ct-mom') moduleColor = '#ec4899';
      if (slide.id === 'ct-fir') moduleColor = '#f97316';
      
      document.documentElement.style.setProperty('--theme-color', moduleColor);
      document.documentElement.style.setProperty('--theme-glow', `${moduleColor}60`);
      
      slideEl.innerHTML = `<iframe src="${slide.url}" class="module-frame" id="module-${slide.id}"></iframe>`;
    } else {
      const isPromo = slide.type === 'PROMO';
      const isLogo = slide.isLogo || (!slide.title && !slide.subtitle && slide.bgImage && slide.bgImage.includes('LOGO'));
      const bgImg = slide.bgImage || getDefaultBackground(slide.subType, slide.title);
      const color = isPromo ? (slide.highlightColor || '#f59e0b') : getHighlightColor(slide);
      const smartTag = getSmartTag(slide);
      const typeKey = (slide.subType || slide.type || 'Event').toLowerCase();

      if (isLogo) {
        slideEl.innerHTML = `
          <div class="slide-bg" style="display:flex; justify-content:center; align-items:center; background-color: #000;">
            <div class="logo-wrapper" style="position:relative; height: 90vh; display: flex; justify-content: center; animation: cinematicZoom 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
              <img src="${bgImg}" alt="Flame Lantern" style="height: 100%; width: auto; z-index: 2; position:relative; opacity: 1; filter: none; animation: none;" />
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
        `;
      } else if (slide.type === 'LIVE') {
        const accent = slide.accent || '#06b6d4';
        slideEl.innerHTML = `
            <div class="slide-bg" style="background: #000;">
              <div style="position:absolute; inset:0; background: radial-gradient(circle at center, ${accent}22 0%, #000 70%);"></div>
            </div>
            <div style="position:relative; z-index:10; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; padding: 5rem;">
              <div class="text-label" style="font-size: 2rem; letter-spacing: 10px; color: ${accent}; margin-bottom: 2rem; font-weight: 900;">LIVE BROADCAST</div>
              <div class="slide-title" style="font-size: 8rem; font-weight: 900; line-height: 0.9; margin-bottom: 3rem; color: #fff; text-shadow: 0 0 50px ${accent}44;">${slide.title}</div>
              <div class="slide-subtitle" style="font-size: 3rem; color: #94a3b8; font-weight: 600; max-width: 1200px;">${slide.detail || ''}</div>
            </div>
            <div style="position: absolute; bottom: 4rem; width: 100%; text-align: center; font-family: 'JetBrains Mono'; font-size: 1.2rem; color: ${accent}; opacity: 0.5;">
              MATRIX LIVE ALERT SYSTEM v1.0
            </div>
        `;
      } else {
        slideEl.innerHTML = `
          <div class="slide-bg">
            <img src="${bgImg}" alt="" loading="eager" style="object-position: ${bgImg.includes('crusaders') ? 'left center' : (bgImg.includes('warriors') ? 'right center' : 'center center')};" />
            <div class="slide-bg-overlay" style="background: rgba(0,0,0,0.85);"></div>
          </div>
          <div class="premium-card">
            <!-- 1. Event Type -->
            <div class="animate-tag-enter">
              <span class="day-tag" data-type="${typeKey}" style="background-color: ${color}40; border-color: ${color}; box-shadow: 0 0 40px ${color}60;">${smartTag}</span>
            </div>

            <!-- 2. Event Name -->
            <div class="animate-content-enter" style="animation-delay: 0.1s;">
              <h1 class="premium-title">${slide.title}</h1>
            </div>

            <div class="accent-bar animate-content-enter" style="background: ${color}; box-shadow: 0 0 30px ${color}80; animation-delay: 0.2s;"></div>

            <!-- 3. Details -->
            ${slide.subtitle ? `<div class="premium-desc animate-content-enter" style="animation-delay: 0.3s;">${String(slide.subtitle).replace(/\n/g, '<br>')}</div>` : ''}

            <!-- 4. Price -->
            ${slide.price ? `
              <div class="animate-content-enter" style="animation-delay: 0.4s;">
                <div class="price-badge" style="animation: pulse-glow 3s infinite; box-shadow: 0 0 60px ${color}80;">
                  <div class="price-badge-inner"><span class="price-text">${slide.price}</span></div>
                </div>
              </div>
            ` : ''}

            <!-- 5. Location -->
            ${slide.location ? `
              <div class="animate-content-enter" style="animation-delay: 0.5s;">
                <div class="premium-location">${slide.location}</div>
              </div>
            ` : ''}

            <!-- 6. Day, Date, Time -->
            ${(() => {
              const timeStr = slide.time || '';
              const titleLower = (slide.title || '').toLowerCase();
              const subtitleLower = (slide.subtitle || '').toLowerCase();
              const timeRedundant = timeStr && (titleLower.includes(timeStr.toLowerCase()) || subtitleLower.includes(timeStr.toLowerCase()));
              
              if (slide.date || (slide.time && !timeRedundant) || slide.days) {
                return `
                  <div class="premium-meta animate-content-enter" style="animation-delay: 0.6s;">
                    <div class="premium-meta-item">${(slide.subType || '').toLowerCase().includes('weekly') ? '⏰' : '📅'} ${
                      (slide.date ? formatDate(slide.date) : (slide.days ? 'EVERY ' + (slide.meta || '').split(' ')[0].toUpperCase() : '')) + 
                      (slide.time && !timeRedundant ? ' • ' + slide.time : '')
                    }</div>
                  </div>
                `;
              }
              return '';
            })()}

            <!-- 7. Slide Footer -->
            ${slide.footer ? `
              <div class="animate-content-enter" style="animation-delay: 0.7s;">
                <div class="premium-footer">${slide.footer}</div>
              </div>
            ` : ''}

            ${(slide.qr || slide.qrUrl) ? `
              <div class="animate-content-enter" style="margin-top: 1rem; animation-delay: 0.8s;">
                <div style="background:#fff; padding: 10px; border-radius: 10px; display:inline-block; box-shadow: 0 0 30px var(--theme-glow);">
                   <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(slide.qr || slide.qrUrl)}" style="width: 120px; height: 120px; display:block;">
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    container.appendChild(slideEl);
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        slideEl.classList.add('active');
      });
    });

    if (!window.MATRIX.STATE.isPaused) {
      const delay = slide.type === 'MODULE' ? window.MATRIX.CONFIG.MODULE_DELAY : window.MATRIX.CONFIG.SWAP_DELAY;
      window.MATRIX.STATE.timer = setTimeout(nextSlide, delay);
      
      const bar = document.getElementById('progress-bar');
      if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        requestAnimationFrame(() => {
          bar.style.transition = `width ${delay}ms linear`;
          bar.style.width = '100%';
        });
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
  }, transitionDelay);
}

/**
 * Robust Date Parser
 * Google Sheets CSV export ALWAYS uses M/D/YYYY (US format) regardless of locale.
 * Also handles ISO YYYY-MM-DD and explicit NZ DD/MM/YYYY (manual input).
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
  
    // 2. Slash format: Default to DD/MM/YYYY (NZ/UK) as per live CSV data
    const parts = str.split('/').map(Number);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      // If month > 12, it's likely M/D/YYYY (US), but we prioritize D/M/YYYY
      if (m > 12) {
        return new Date(y, d - 1, m); // Treat as US if middle is > 12
      }
      return new Date(y, m - 1, d); // Default NZ
    }
  
  // 3. Fallback to native (with caution)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Date Formatting Helper
 */
function formatDate(dateStr) {
  try {
    const d = parseMatrixDate(dateStr);
    if (!d) return dateStr;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const evDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((evDay - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Tonight';
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
    if (!payload || !payload.active) {
        const liveOverlay = document.getElementById('live-slide-overlay');
        if (liveOverlay) liveOverlay.remove();
        window.MATRIX.STATE.isPaused = false;
        renderActiveSlide();
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
            <h1 style="font-size: 8rem; font-weight: 900; line-height: 0.9; margin-bottom: 3rem; color: #fff; text-shadow: 0 0 50px ${accent}44;">${payload.title || ''}</h1>
            <p style="font-size: 3rem; color: #94a3b8; font-weight: 600; max-width: 1200px;">${payload.detail || ''}</p>
        </div>
        <div style="position: absolute; bottom: 4rem; width: 100%; text-align: center; font-family: 'JetBrains Mono'; font-size: 1.2rem; color: ${accent}; opacity: 0.5;">
            MATRIX LIVE ALERT SYSTEM v1.0
        </div>
    `;

    if (payload.mode === 'OVERRIDE') {
        window.MATRIX.STATE.isPaused = true;
        if (window.MATRIX.STATE.timer) clearTimeout(window.MATRIX.STATE.timer);
    }
}

window.initMatrix = initMatrix;
