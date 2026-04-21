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
    WEEKS_LOOKAHEAD: 4,
    SHOW_BANNER: true,
    GSHEETS_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vScH_c43zVyW-WEOMQCQWXG_aCjYOg73NFl6Ni1damBOQEEVPSq89wtv4nXyIDmPxvvPTPge3EbQhIg/pub?output=csv'
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
  ],
  // Weekly specials (ported from _ct-slides-logo constants.ts)
  WEEKLY_SPECIALS: [
    {
      id: 'promo-mon',
      day: 'Monday',
      title: "Steak Day Monday's",
      description: 'Start your week off with a 200g Succulent Rump Steak, cooked to your liking, served with golden fries and a green garden salad.',
      price: '$20',
      highlightColor: '#f59e0b',
      bgImage: 'images/bg1.jpg'
    },
    {
      id: 'promo-wed',
      day: 'Wednesday',
      title: 'Quiz Night',
      description: 'Every Wednesday Night from 7.00pm, $190 in prizes up for grabs. Bookings Essential.',
      price: 'FREE ENTRY',
      highlightColor: '#eab308',
      bgImage: 'images/bg2.jpg'
    },
    {
      id: 'promo-thu-burger',
      day: 'Thursday',
      title: 'Burger Day Thursdays',
      description: 'Your choice of Chicken, Beer Battered Fish, Pork Belly or Coasters Beef Burger, all served with Golden Fries & Onion Rings.',
      price: '$19 each or 2 for $35!',
      highlightColor: '#f97316',
      bgImage: 'images/bg3.jpg'
    },
    {
      id: 'promo-thu-fri-happy',
      day: 'Thursday & Friday',
      title: 'Happy Hours!',
      description: 'Enjoy 10% discount on selected beverages between 4.30pm & 6.30pm.',
      price: '10% Off!',
      highlightColor: '#3b82f6',
      bgImage: 'images/bg4.jpg'
    },
    {
      id: 'promo-thu-pool',
      day: 'Thursday',
      title: 'Free Pool Thursdays',
      description: 'Our Pool Table is Free all day and night on Thursdays! Grab a cue and challenge your mates.',
      price: 'FREE',
      highlightColor: '#f97316',
      bgImage: 'images/bg1.jpg'
    },
    {
      id: 'promo-sun',
      day: 'Sunday',
      title: 'Two Course Sunday Roast',
      description: 'Traditional roast of the day with roasted vegetables, seasonal greens and rich gravy, with an Ice Cream Sundae to finish.',
      price: '$28',
      highlightColor: '#84cc16',
      bgImage: 'images/bg2.jpg'
    },
    {
      id: 'promo-loyalty',
      day: 'Membership',
      title: 'Loyalty App',
      description: 'Join our loyalty program! Earn points with every purchase and redeem them for food and drinks.',
      price: 'Join Today',
      highlightColor: '#8b5cf6',
      bgImage: 'images/bg3.jpg'
    },
    {
      id: 'promo-flame',
      day: 'Specials',
      title: 'Flame Lantern',
      description: 'Exclusive specials and atmosphere.',
      price: '',
      highlightColor: '#f59e0b',
      bgImage: 'images/GOLD-FLAME-LOGO-BLACK-CLEAN.png'
    }
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
  
  // 3. Start Rotation
  if (window.MATRIX.STATE.slides.length > 0) {
    nextSlide();
  } else {
    showStatus('Error: No slides to display');
  }
  
  // 4. Global Broadcast Listeners
  bc.onmessage = (e) => {
    switch(e.data.type) {
      case 'NEXT': nextSlide(); break;
      case 'PREV': prevSlide(); break;
      case 'TOGGLE': togglePause(); break;
      case 'PROJECT': jumpToProject(e.data.id); break;
      case 'SETTINGS_UPDATE': updateConfig(e.data.payload); break;
      case 'SYNC_DATA': initMatrix(); break; // Reload everything
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

  // 6. Local File Hot-Reload Watchdog
  if (!window.MATRIX.STATE.watchdog) {
    window.MATRIX.STATE.lastModifiedTags = {};
    window.MATRIX.STATE.watchdog = setInterval(async () => {
      try {
        const files = ['matrix-data.json', 'local-images.json'];
        let changed = false;
        
        for (let file of files) {
           // Use HEAD to save bandwidth
           const res = await fetch(file + '?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
           if (res.ok) {
             const modified = res.headers.get('Last-Modified') || res.headers.get('Content-Length'); // Content-length fallback
             if (window.MATRIX.STATE.lastModifiedTags[file] && window.MATRIX.STATE.lastModifiedTags[file] !== modified) {
                console.log(`[MATRIX Watchdog] Detected changes in ${file}`);
                changed = true;
             }
             window.MATRIX.STATE.lastModifiedTags[file] = modified;
           }
        }

        if (changed) {
           console.log('[MATRIX Watchdog] Hot-Reloading Data...');
           const freshData = await loadAllDataSources();
           buildSlideQueue(freshData);
           
           // Notify UI admin panels if open
           if (bc) bc.postMessage({ type: 'DATA_HOT_RELOADED' });
        }
      } catch (e) {}
    }, 3000);
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
  if (header) {
    if (window.MATRIX.CONFIG.SHOW_BANNER) {
      header.style.display = 'flex';
      header.style.opacity = '1';
      header.style.transition = 'opacity 1s ease';
      setTimeout(() => {
        header.style.opacity = '0';
      }, 10000);
    } else {
      header.style.display = 'none';
    }
  }
}

/**
 * Data Loading (Parallel & Fault-Tolerant)
 */
async function loadAllDataSources() {
  const results = await Promise.allSettled([
    fetchLocalJSON(),
    fetchCloudCSV(),
    fetchLocalImages()
  ]);

  const allDataSets = [];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled' && res.value) {
      allDataSets.push(...res.value);
    } else {
      console.warn(`[MATRIX] Data source failed or was empty.`);
    }
  });

  return allDataSets;
}

async function fetchLocalImages() {
  try {
    const res = await fetch('local-images.json?t=' + Date.now());
    if (!res.ok) return [];
    
    // We wrap it in a pseudo-event structure so buildSlideQueue can process it easily.
    const images = await res.json();
    if (!images || !images.length) return [];
    
    // Convert directly to standard queue items
    window.MATRIX.STATE.manualSlides = [
      ...window.MATRIX.STATE.manualSlides.filter(m => !m.isGenerated),
      ...images.map(img => ({ ...img, isGenerated: true }))
    ];
    
    return []; // Handled via manualSlides injection so it bypasses standard event parsing
  } catch(e) {
    return [];
  }
}

async function fetchLocalJSON() {
  try {
    const res = await fetch('matrix-data.json?t=' + Date.now());
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('[MATRIX] Local JSON failed', e);
    return [];
  }
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
  const rows = text.split(/\r?\n/).filter(line => line.trim());
  if (rows.length < 2) return [];
  
  // Headers: Date, Day, Time, Type, Title, Notes, Price
  const events = rows.slice(1).map(line => {
    // Basic CSV split, ignores commas inside quotes
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (let char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
        else current += char;
    }
    parts.push(current.trim());
    
    const clean = parts.map(p => p.replace(/^"|"$/g, ''));
    
    return {
      date: clean[0],
      day: clean[1],
      time: clean[2],
      event_type: clean[3] || 'Event',
      title: clean[4],
      notes: clean[5],
      price: clean[6]
    };
  }).filter(e => e.title);

  return [{ week_starting: 'Cloud Data', events }];
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
        // More lenient check or Cloud override
        if (week.week_starting === 'Cloud Data' || isEventCurrent(ev.date) || isWeekInRange(week.week_starting)) {
          queue.push({
            id: 'ev-' + Math.random().toString(36).substr(2, 9),
            type: 'EVENT',
            subType: ev.event_type || 'Event',
            title: ev.title,
            subtitle: ev.notes,
            price: ev.price,
            meta: `${ev.day || ''} ${ev.time || ''}`,
            date: ev.date
          });
        }
    });
  });

  // 2. Add Weekly Specials (permanent advertising from _ct-slides-logo)
  window.MATRIX.WEEKLY_SPECIALS.forEach(promo => {
    queue.push({
      id: promo.id,
      type: 'PROMO',
      subType: promo.day,
      title: promo.title,
      subtitle: promo.description,
      price: promo.price,
      highlightColor: promo.highlightColor,
      bgImage: promo.bgImage
    });
  });

  // 3. Add Manual (Local) Slides
  window.MATRIX.STATE.manualSlides.forEach(s => {
    queue.push({ 
        ...s, 
        id: s.id || 'man-' + Math.random().toString(36).substr(2, 9),
        isManual: true 
    });
  });

  // 4. Add Project Modules
  queue.push({ type: 'MODULE', id: 'ct-mom', url: '../_ct-MOM/index.html', title: "Mother's Day Celebration", pinned: true });
  queue.push({ type: 'MODULE', id: 'ct-mmr', url: '../_ct-MMR/index.html', title: "Meat Raffle Display", pinned: true });
  queue.push({ type: 'MODULE', id: 'ct-wea', url: '../_ct-WEA/index.html', title: "Christchurch Weather" });
  queue.push({ type: 'MODULE', id: 'ct-ace', url: '../_ct-ACE/index.html', title: "Chase the Ace", pinned: true });
  queue.push({ type: 'MODULE', id: 'ct-fir', url: '../_ct-FIR/index.html', title: "Fireplace Ambiance", pinned: false });

  // 5. Sort by Priority/Pinned
  queue.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  window.MATRIX.STATE.slides = queue;
  console.log(`[MATRIX v2] Queue built with ${queue.length} slides.`);
}

/**
 * Smart Label & Date Logic
 */
function getSmartTag(slide) {
    const now = new Date();
    const eventDate = slide.date ? new Date(slide.date) : null;
    const typeLabel = (slide.subType || slide.type || 'Event').toUpperCase();
    
    if (!eventDate) return typeLabel;

    const diffDays = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
    const isSport = ['nrl', 'super rugby', 'rugby', 'league'].includes((slide.subType || '').toLowerCase());

    if (diffDays >= 0 && diffDays <= 7) {
        if (isSport) return "THIS WEEK'S LIVE SPORT";
        return `THIS WEEK: ${typeLabel}`;
    } else if (diffDays > 7 && diffDays <= 14) {
        return `NEXT WEEK: ${typeLabel}`;
    }

    return typeLabel;
}

function fitText(el) {
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    
    let fontSize = parseInt(window.getComputedStyle(el).fontSize);
    const maxWidth = parent.offsetWidth * 0.95;

    // Fast reduction loop
    while (el.scrollWidth > maxWidth && fontSize > 20) {
        fontSize -= 2;
        el.style.fontSize = fontSize + 'px';
    }
}

function isEventCurrent(dateStr) {
    if (!dateStr) return true;
    const evDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    // Include events that haven't passed today
    return evDate >= today;
}

function isWeekInRange(weekStr) {
  const start = new Date(weekStr);
  if (isNaN(start)) return true;
  const diffDays = (start - new Date()) / (1000 * 60 * 60 * 24);
  return diffDays >= -7 && diffDays <= (window.MATRIX.CONFIG.WEEKS_LOOKAHEAD * 7);
}

/**
 * Background Wallpaper Selection
 * Maps event types to specific backgrounds for visual variety.
 */
function getBackgroundForSlide(slide) {
  const bgs = window.MATRIX.BACKGROUNDS;
  if (!bgs.length) return bgs[0] || '';
  
  const typeMap = {
    'super rugby': 0,
    'rugby': 0,
    'nrl': 1,
    'league': 1,
    'karaoke': 2,
    'live music': 3,
    'entertainment': 2
  };

  const typeKey = (slide.subType || '').toLowerCase();
  if (typeMap[typeKey] !== undefined) {
    return bgs[typeMap[typeKey] % bgs.length];
  }
  
  // Fallback: hash-based rotation for variety
  const hash = (slide.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return bgs[hash % bgs.length];
}

/**
 * Get the highlight color for event type badges
 */
function getHighlightColor(subType) {
  const map = {
    'super rugby': '#ef4444',
    'rugby': '#ef4444',
    'nrl': '#10b981',
    'league': '#10b981',
    'karaoke': '#8b5cf6',
    'live music': '#f59e0b',
    'entertainment': '#06b6d4',
    'event': '#ffffff'
  };
  return map[(subType || '').toLowerCase()] || '#f59e0b';
}

/**
 * Controller & Engine
 */
function nextSlide() {
  const s = window.MATRIX.STATE;
  if (!s.slides.length) return;
  s.currentIndex = (s.currentIndex + 1) % s.slides.length;
  renderActiveSlide();
}

function prevSlide() {
  const s = window.MATRIX.STATE;
  if (!s.slides.length) return;
  s.currentIndex = (s.currentIndex - 1 + s.slides.length) % s.slides.length;
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

/**
 * Premium Slide Renderer
 * Generates the premium TV-quality DOM structure for each slide.
 */
function renderActiveSlide() {
  const slide = window.MATRIX.STATE.slides[window.MATRIX.STATE.currentIndex];
  const container = document.getElementById('slide-viewport');
  if (!container || !slide) return;

  clearTimeout(window.MATRIX.STATE.timer);

  // Remove old slide
  const existing = document.getElementById('slide-target');
  if (existing) existing.remove();

  // Create fresh slide element
  const slideEl = document.createElement('div');
  slideEl.id = 'slide-target';
  slideEl.className = 'slide';

  if (slide.type === 'MODULE') {
    // Module slides (MOM, MMR, WEA) get a full iframe
    slideEl.innerHTML = `<iframe src="${slide.url}" class="module-frame"></iframe>`;
  } else {
    // Premium event/promo slide with cycling wallpaper background
    const isPromo = slide.type === 'PROMO';
    const bgImg = isPromo ? (slide.bgImage || getBackgroundForSlide(slide)) : getBackgroundForSlide(slide);
    const color = isPromo ? (slide.highlightColor || '#f59e0b') : getHighlightColor(slide.subType);
    const smartTag = getSmartTag(slide);

    slideEl.innerHTML = `
      <!-- Cycling Background Wallpaper -->
      <div class="slide-bg">
        <img src="${bgImg}" alt="" loading="eager" />
        <div class="slide-bg-overlay"></div>
        <div class="slide-bg-gradient"></div>
      </div>

      <!-- Premium Content Card -->
      <div class="premium-card">
        <!-- Day / Event Type Tag -->
        <div class="animate-tag-enter">
          <span class="day-tag" data-type="${typeKey}" style="
            background-color: ${color}40;
            border-color: ${color};
            box-shadow: 0 0 40px ${color}60;
            font-size: 1.2rem;
            letter-spacing: 2px;
          ">
            ${smartTag}
          </span>
        </div>

        <!-- Main Event Title -->
        <div class="animate-content-enter">
          <h1 class="premium-title">${slide.title}</h1>
        </div>

        <!-- Accent Divider -->
        <div class="accent-bar animate-content-enter" style="background: ${color}; box-shadow: 0 0 30px ${color}80;"></div>

        <!-- Description / Notes -->
        ${slide.subtitle ? `
          <p class="premium-desc animate-content-enter">${slide.subtitle}</p>
        ` : ''}

        <!-- Price Badge (PROMO slides only) -->
        ${slide.price ? `
          <div class="animate-content-enter" style="animation-delay: 0.5s;">
            <div class="price-badge" style="
              animation: pulse-glow 3s infinite;
              box-shadow: 0 0 60px ${color}80;
            ">
              <div class="price-badge-inner">
                <span class="price-text">${slide.price}</span>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Unified Meta Information (Date / Time Combined) -->
        ${(slide.meta || slide.date) ? `
          <div class="premium-meta animate-content-enter" style="animation-delay: 0.4s;">
            <div class="premium-meta-item">📅 ${
              (slide.date ? formatDate(slide.date) : '') + 
              (slide.meta && slide.date ? ' • ' : '') + 
              (slide.meta ? slide.meta.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/i, '') : '')
            }</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  container.appendChild(slideEl);
  
  // Apply dynamic font scaling to ensure the title fits perfectly without truncation or wrapping
  setTimeout(() => {
    fitText(slideEl.querySelector('.premium-title'));
  }, 50);
  // Trigger the active class after a frame to allow CSS transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      slideEl.classList.add('active');
    });
  });

  if (!window.MATRIX.STATE.isPaused) {
    const delay = slide.type === 'MODULE' ? window.MATRIX.CONFIG.MODULE_DELAY : window.MATRIX.CONFIG.SWAP_DELAY;
    window.MATRIX.STATE.timer = setTimeout(nextSlide, delay);
    
    // Progress Bar
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
}

/**
 * Date Formatting Helper
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
}

function showStatus(msg) {
    console.log('[MATRIX]', msg);
}

window.initMatrix = initMatrix;
