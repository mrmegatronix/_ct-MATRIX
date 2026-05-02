/**
 * MATRIX Core - TEST ENVIRONMENT (v2.0.0)
 * COMPLETE MIRROR OF PRODUCTION ENGINE FOR SANDBOX TESTING
 */

window.MATRIX = {
  VERSION: '2.0.0-TEST',
  CONFIG: {
    SWAP_DELAY: 30000,
    MODULE_DELAY: 30000,
    SYNC_CHANNEL: 'ct_matrix_sync_test',
    WEEKS_LOOKAHEAD: 2,
    SHOW_BANNER: true,
    ADMIN_PIN: '1234',
    CSV_URL: 'matrix_test_data.csv'
  },
  STATE: {
    slides: [],
    currentIndex: -1,
    isPaused: false,
    timer: null,
    manualSlides: []
  },
  BACKGROUNDS: [
    '../images/bg1.jpg',
    '../images/bg2.jpg',
    '../images/bg3.jpg',
    '../images/bg4.jpg'
  ]
};

const bc = new BroadcastChannel(window.MATRIX.CONFIG.SYNC_CHANNEL);

async function initMatrix() {
  console.log('[MATRIX TEST] Booting test engine...');
  const data = await loadAllDataSources();
  buildSlideQueue(data);
  if (window.MATRIX.STATE.slides.length > 0) {
    nextSlide();
  }
}

async function loadAllDataSources() {
  try {
    const res = await fetch(window.MATRIX.CONFIG.CSV_URL + '?t=' + Date.now());
    const csv = await res.text();
    return parseCSVToEvents(csv);
  } catch (e) {
    console.error('[MATRIX TEST] CSV fetch failed:', e);
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
      if (char === '"' && nextChar === '"') { col += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else col += char;
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ',') { row.push(col.trim()); col = ''; }
      else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        if (char === '\r') i++;
        row.push(col.trim());
        result.push(row);
        row = [];
        col = '';
      } else col += char;
    }
  }
  if (col || row.length > 0) { row.push(col.trim()); result.push(row); }

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
      accentColor: clean[11],
      qr: clean[13],
      footerQR: clean[14],
      footerLink: clean[15],
      duration: clean[16] ? parseInt(clean[16]) : null,
      bgImage: clean[17],
      fgImage: clean[18],
      bubbleText: clean[19],
      transition: clean[23],
      zoom: clean[24]
    };
  }).filter(e => e.title || e.date);
  return [{ week_starting: 'Test Data', events }];
}

function buildSlideQueue(data) {
  const queue = [];
  data.forEach(week => {
    week.events.forEach(ev => {
      queue.push({
        id: 'test-' + Math.random().toString(36).substr(2, 9),
        type: 'EVENT',
        subType: ev.event_type,
        title: ev.title,
        subtitle: ev.notes,
        price: ev.price || ev.time,
        qr: ev.qr,
        date: ev.date,
        accentColor: ev.accentColor,
        bgImage: ev.bgImage || '../images/bg1.jpg',
        fgImage: ev.fgImage,
        bubbleText: ev.bubbleText,
        duration: ev.duration,
        footerQR: ev.footerQR,
        footerLink: ev.footerLink,
        transition: ev.transition,
        zoom: ev.zoom
      });
    });
  });
  window.MATRIX.STATE.slides = queue;
  console.log(`[MATRIX TEST] Queue built with ${queue.length} slides.`);
}

function nextSlide() {
  const s = window.MATRIX.STATE;
  if (!s.slides.length) return;
  s.currentIndex = (s.currentIndex + 1) % s.slides.length;
  renderActiveSlide();
}

function renderActiveSlide() {
  const slide = window.MATRIX.STATE.slides[window.MATRIX.STATE.currentIndex];
  const container = document.getElementById('slide-viewport');
  if (!container || !slide) return;
  
  clearTimeout(window.MATRIX.STATE.timer);
  const oldSlide = document.getElementById('slide-target');
  if (oldSlide) oldSlide.remove();

  const slideEl = document.createElement('div');
  slideEl.id = 'slide-target';
  const transitionClass = (slide.transition || 'fade-in').toLowerCase().replace(/\s/g, '-');
  slideEl.className = 'slide ' + transitionClass;

  if (slide.zoom) {
    slideEl.setAttribute('data-zoom', 'true');
    slideEl.style.setProperty('--zoom-level', slide.zoom);
  }

  const themeColor = slide.accentColor || '#f59e0b';
  document.documentElement.style.setProperty('--theme-color', themeColor);

  slideEl.innerHTML = `
    <div class="slide-bg">
      <img src="${slide.bgImage}" style="object-fit: cover; width:100%; height:100%;" onerror="this.src='../images/bg1.jpg'">
      <div class="slide-bg-overlay" style="background: rgba(0,0,0,0.85);"></div>
    </div>
    <div class="premium-card">
      <div class="day-tag" style="background: ${themeColor}40; border-color: ${themeColor};">${slide.subType || 'TEST'}</div>
      <h1 class="premium-title">${slide.title}</h1>
      <div class="accent-bar" style="background: ${themeColor};"></div>
      ${slide.subtitle ? `<div class="premium-desc">${slide.subtitle}</div>` : ''}
      ${slide.price ? `<div class="price-badge"><div class="price-badge-inner">${slide.price}</div></div>` : ''}
      ${slide.qr ? `<div style="margin-top:2rem; background:#fff; padding:10px; border-radius:10px; display:inline-block;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(slide.qr)}" style="width:150px; height:150px; display:block;"></div>` : ''}
    </div>
  `;
  
  container.appendChild(slideEl);
  requestAnimationFrame(() => { slideEl.classList.add('active'); });
  
  const delay = slide.duration || window.MATRIX.CONFIG.SWAP_DELAY;
  window.MATRIX.STATE.timer = setTimeout(nextSlide, delay);
}

window.initMatrix = initMatrix;
window.nextSlide = nextSlide;
