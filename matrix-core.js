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
      day: '',
      title: '',
      description: '',
      price: '',
      highlightColor: '#f59e0b',
      bgImage: 'images/GOLD-FLAME-LOGO-BLACK-CLEAN.png',
      isLogo: true,
      flamePosition: '35%'
    },
    {
      id: 'promo-karaoke',
      day: 'Karaoke',
      title: 'Karaoke Night',
      description: 'Grab the mic and sing your heart out! Join us for a fun-filled night of music and entertainment.',
      price: 'FREE ENTRY',
      highlightColor: '#8b5cf6',
      bgImage: '_backgrounds/music.jpg'
    },
    {
      id: 'promo-band',
      day: 'Live Music',
      title: 'Live Band',
      description: 'Enjoy the best live local bands right here. Great music and great vibes.',
      price: '8 PM - 11 PM',
      highlightColor: '#f59e0b',
      bgImage: '_backgrounds/music.jpg',
      isBand: true
    },
    {
      id: 'promo-wed-prequiz',
      day: 'Starting Soon!',
      title: 'Quiz Night Buildup',
      description: 'Get your teams ready! The quiz is about to begin. Grab a drink and settle in.',
      price: 'Starts at 7 PM',
      highlightColor: '#eab308',
      bgImage: 'images/bg2.jpg'
    },
    {
      id: 'promo-last-drinks',
      day: 'Closing Time',
      title: 'Last Drinks!',
      description: 'The bar will be closing shortly. Please make your final orders now.',
      price: 'Final Call',
      highlightColor: '#ef4444',
      bgImage: 'images/bg4.jpg'
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
      case 'NEXT': window.nextSlide(); break;
      case 'PREV': window.prevSlide(); break;
      case 'TOGGLE': window.togglePause(); break;
      case 'PROJECT': window.jumpToProject(e.data.id); break;
      case 'SETTINGS_UPDATE': updateConfig(e.data.payload); break;
      case 'SYNC_DATA': window.initMatrix(); break; // Reload everything
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
        const files = ['matrix-data.json', 'local-images.json', 'local-backup.csv'];
        let changed = false;
        
        for (let file of files) {
           const res = await fetch(file + '?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
           if (res.ok) {
             // Combine Length and Date for a robust fingerprint
             const fingerprint = (res.headers.get('Content-Length') || '') + (res.headers.get('Last-Modified') || '');
             if (window.MATRIX.STATE.lastModifiedTags[file] && window.MATRIX.STATE.lastModifiedTags[file] !== fingerprint) {
                console.log(`[MATRIX Watchdog] Detected changes in ${file}`);
                changed = true;
             }
             window.MATRIX.STATE.lastModifiedTags[file] = fingerprint;
           }
        }

        if (changed) {
           console.log('[MATRIX Watchdog] Hot-Reloading All Data Sources...');
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
    fetchLocalCSV(),
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

async function fetchLocalCSV() {
  try {
    const res = await fetch('local-backup.csv?t=' + Date.now());
    if (!res.ok) return [];
    const csv = await res.text();
    return parseCSVToEvents(csv);
  } catch (e) {
    console.error('[MATRIX] Local CSV backup failed', e);
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
  const events = result.slice(1).map(clean => {
    return {
      date: clean[0],
      day: clean[1],
      time: clean[2],
      event_type: clean[3] || 'Event',
      title: (clean[4] || '').replace(/\n/g, '<br>'),
      notes: (clean[5] || '').replace(/\n/g, '<br>'),
      price: clean[6],
      qr: clean[7] // New QR Code column
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
            qr: ev.qr,
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
        isManual: true,
        priority: s.priority || 10 // Manual slides default higher
    });
  });

  // 4. Add Project Modules
  queue.push({ type: 'MODULE', id: 'ct-mom', url: '../_ct-MOM/index.html', title: "Mother's Day Celebration", pinned: true, priority: 5 });
  queue.push({ type: 'MODULE', id: 'ct-mmr', url: '../_ct-MMR/index.html', title: "Meat Raffle Display", pinned: true, priority: 5 });
  queue.push({ type: 'MODULE', id: 'ct-wea', url: '../_ct-WEA/index.html', title: "Christchurch Weather", priority: 80 });
  queue.push({ type: 'MODULE', id: 'ct-ace', url: '../_ct-ACE/index.html', title: "Chase the Ace", pinned: true, priority: 5 });
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
    const eventDate = slide.date ? new Date(slide.date) : null;
    const typeLabel = (slide.subType || slide.type || 'Event').toUpperCase();
    
    if (!eventDate) return typeLabel;

    // Compare dates (day-level, not time-level)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const evDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const diffDays = Math.round((evDay - today) / (1000 * 60 * 60 * 24));

    const isSport = ['nrl', 'super rugby', 'rugby', 'league'].includes((slide.subType || '').toLowerCase());
    const isMusic = ['live music', 'karaoke', 'entertainment'].includes((slide.subType || '').toLowerCase());

    if (diffDays === 0) {
        if (isMusic) return 'TONIGHT: LIVE MUSIC';
        if (isSport) return 'TONIGHT: LIVE SPORT';
        return `TONIGHT: ${typeLabel}`;
    } else if (diffDays === 1) {
        if (isMusic) return 'TOMORROW: LIVE MUSIC';
        if (isSport) return 'TOMORROW: LIVE SPORT';
        return `TOMORROW: ${typeLabel}`;
    } else if (diffDays >= 2 && diffDays <= 7) {
        if (isSport) return "THIS WEEK'S LIVE SPORT";
        return `THIS WEEK: ${typeLabel}`;
    } else if (diffDays > 7 && diffDays <= 14) {
        return `NEXT WEEK: ${typeLabel}`;
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
  const title = (slide.title || '').toLowerCase();
  if (title.includes('crusaders')) return '_backgrounds/stadium.png';
  if (title.includes('warriors')) return '_backgrounds/stadium.png';

  const bgs = window.MATRIX.BACKGROUNDS;
  if (!bgs.length) return bgs[0] || '';
  
  const typeMap = {
    'super rugby': 0,
    'rugby': 0,
    'nrl': 1,
    'league': 1,
    'karaoke': '_backgrounds/music.jpg',
    'live music': '_backgrounds/music.jpg',
    'entertainment': '_backgrounds/music.jpg'
  };

  const typeKey = (slide.subType || '').toLowerCase();
  if (typeof typeMap[typeKey] === 'string') {
    return typeMap[typeKey];
  }
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
 * Slide Scheduling Logic
 */
function isSlideActive(slide) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const time = h + m / 60;
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 3=Wed

  // 14-day lookahead filter
  if (slide.date && !slide.isManual && slide.type !== 'PROMO') {
    const slideDate = new Date(slide.date);
    if (!isNaN(slideDate)) {
      const diffDays = (slideDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (diffDays > 14) return false; // More than 2 weeks away
      if (diffDays < -1) return false; // Past event
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
        <div class="logo-wrapper" style="position:relative; height: 60vh; display: flex; justify-content: center;">
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

  // Fade in loader
  loader.style.opacity = '1';
  loader.style.visibility = 'visible';
  loader.classList.add('active');

  // Wait for fade in before swapping content
  setTimeout(() => {
    // Remove old slide
    const existing = document.getElementById('slide-target');
    if (existing) existing.remove();

    // Create fresh slide element
    const slideEl = document.createElement('div');
    slideEl.id = 'slide-target';
    slideEl.className = 'slide';

    // Apply dynamic theme variables
    const themeColor = slide.type === 'PROMO' ? (slide.highlightColor || '#f59e0b') : getHighlightColor(slide.subType);
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
      const bgImg = isPromo ? (slide.bgImage || getBackgroundForSlide(slide)) : getBackgroundForSlide(slide);
      const color = isPromo ? (slide.highlightColor || '#f59e0b') : getHighlightColor(slide.subType);
      const smartTag = getSmartTag(slide);
      const typeKey = (slide.subType || slide.type || 'Event').toLowerCase();

      if (isLogo) {
        slideEl.innerHTML = `
          <div class="slide-bg" style="display:flex; justify-content:center; align-items:center; background-color: #000;">
            <div class="logo-wrapper" style="position:relative; height: 60vh; display: flex; justify-content: center;">
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
      } else if (slide.isBand) {
        slideEl.innerHTML = `
          <div class="slide-bg">
            <img src="${bgImg}" alt="" loading="eager" style="object-position: ${bgImg.includes('crusaders') ? 'left center' : (bgImg.includes('warriors') ? 'right center' : 'center center')};" />
            <div class="slide-bg-overlay" style="background: rgba(0,0,0,0.85);"></div>
          </div>
          <div class="band-gig-overlay animate-band">
            <div class="band-gig-title">${slide.title}</div>
            ${slide.subtitle ? `<div class="band-gig-subtitle">${slide.subtitle}</div>` : ''}
            <div class="band-gig-time">PLAYING TONIGHT: 8PM - 11PM</div>
          </div>
        `;
      } else {
        slideEl.innerHTML = `
          <div class="slide-bg">
            <img src="${bgImg}" alt="" loading="eager" style="object-position: ${bgImg.includes('crusaders') ? 'left center' : (bgImg.includes('warriors') ? 'right center' : 'center center')};" />
            <div class="slide-bg-overlay" style="background: rgba(0,0,0,0.85);"></div>
          </div>
          <div class="premium-card">
            <div class="animate-tag-enter">
              <span class="day-tag" data-type="${typeKey}" style="background-color: ${color}40; border-color: ${color}; box-shadow: 0 0 40px ${color}60;">${smartTag}</span>
            </div>
            <div class="animate-content-enter">
              <h1 class="premium-title">${slide.title}</h1>
            </div>
            <div class="accent-bar animate-content-enter" style="background: ${color}; box-shadow: 0 0 30px ${color}80;"></div>
            ${slide.subtitle ? `<div class="premium-desc animate-content-enter">${String(slide.subtitle).replace(/\n/g, '<br>')}</div>` : ''}
            ${(slide.qr || slide.qrUrl) ? `
              <div class="animate-content-enter" style="margin-top: 2rem;">
                <div style="background:#fff; padding: 10px; border-radius: 10px; display:inline-block; box-shadow: 0 0 30px var(--theme-glow);">
                   <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(slide.qr || slide.qrUrl)}" style="width: 150px; height: 150px; display:block;">
                </div>
              </div>
            ` : ''}
            ${slide.price ? `
              <div class="animate-content-enter" style="animation-delay: 0.5s;">
                <div class="price-badge" style="animation: pulse-glow 3s infinite; box-shadow: 0 0 60px ${color}80;">
                  <div class="price-badge-inner"><span class="price-text">${slide.price}</span></div>
                </div>
              </div>
            ` : ''}
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
    }

    container.appendChild(slideEl);
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        slideEl.classList.add('active');
        // Auto-fit the title to the viewport width
        const titleEl = slideEl.querySelector('.premium-title');
        if (titleEl) fitText(titleEl, 28);
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
    setTimeout(() => {
      loader.style.opacity = '0';
      loader.style.visibility = 'hidden';
      setTimeout(() => {
        loader.classList.remove('active');
      }, 600); // Wait for CSS transition
    }, 1000); // 1-second hold to ensure modules/images load behind it
  }, 600); // 600ms transition-in delay
}

/**
 * Date Formatting Helper
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    
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

window.initMatrix = initMatrix;
