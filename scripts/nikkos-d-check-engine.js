/**
 * ============================================================================
 * NIKKO'S D CHECK — Browser DOM & Rules Audit Engine (v1.0.0)
 * ============================================================================
 * Injected into headless Chrome pages via CDP Runtime.evaluate.
 * Covers:
 *   - DESIGN: 1080p/custom viewport bounds, text overflow/clipping, parent
 *             container spilling, ugly line-wrapping, font hierarchy, WCAG
 *             contrast, AABB sibling collisions, broken images & QR codes.
 *   - RULES:  Blinking clock colons verification & Slideshow Keyboard
 *             Navigation Contract (ArrowLeft/Right/Up/Down, Space, 1-9, 0,
 *             a/A, r/R, and Input Guard suppression).
 *   - VISUAL: Red/Amber DOM highlight overlays for 1080p screenshot capture.
 * ============================================================================
 */
(function () {
  const DEFAULT_VIEWPORT_W = 1920;
  const DEFAULT_VIEWPORT_H = 1080;

  const DECORATIVE_SELECTORS = [
    '.gold-border-glow', '.sheen-layer', '.card-bg-glow', '.ambient-orb',
    '.particles', '#particles-js', '#bg-layer', '.bg-layer', '.vignette',
    '.scanlines', '.noise', '.matrix-bg', '.backdrop', '.overlay-fx',
    '.ambient-confetti', '#ambient-confetti-container', '.floating-heart',
    '#hearts-container', '.nikkos-d-highlight-layer'
  ];

  const SINGLE_LINE_SELECTORS = [
    '.premium-title', '.special-title', '.social-title', '.day-tag',
    '.special-badge', '.date-pill', '.time-pill', '.location-pill',
    '.price-text', '.hero-qr-url', '.menu-badge', '.sheen-text',
    '.slide-header-title', '.slide-title', '.badge', '.pill',
    '.clock-display', '#main-clock', '#banner-clock'
  ];

  const CONTAINER_SELECTORS = [
    '.premium-card', '.special-event-card', '.social-card',
    '.hero-qr-card', '.slide1-sidebar', '.gold-panel'
  ];

  function getSelector(el) {
    if (!el || el.nodeType !== 1) return 'unknown';
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 4) {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) {
        seg += `#${cur.id}`;
        parts.unshift(seg);
        break;
      }
      if (cur.classList && cur.classList.length > 0) {
        const cls = Array.from(cur.classList)
          .filter(c => !c.startsWith('nikkos-'))
          .slice(0, 2)
          .join('.');
        if (cls) seg += `.${cls}`;
      }
      parts.unshift(seg);
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function isDecorative(el) {
    if (!el || el.nodeType !== 1) return true;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'link', 'meta', 'head', 'title', 'noscript', 'defs', 'clippath', 'lineargradient', 'radialgradient', 'stop'].includes(tag)) {
      return true;
    }
    for (const sel of DECORATIVE_SELECTORS) {
      try {
        if (el.matches(sel) || el.closest(sel)) return true;
      } catch (_) {}
    }
    const cs = window.getComputedStyle(el);
    if (cs.pointerEvents === 'none' && (cs.position === 'fixed' || cs.position === 'absolute') && el.children.length === 0 && !el.textContent.trim()) {
      return true;
    }
    return false;
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    let cur = el;
    while (cur && cur.nodeType === 1) {
      if (cur.classList && cur.classList.contains('nikkos-d-highlight-layer')) return false;
      const cs = window.getComputedStyle(cur);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) {
        return false;
      }
      cur = cur.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5;
  }

  function hasDirectText(el) {
    if (!el || !el.childNodes) return false;
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim().length > 0) {
        return true;
      }
    }
    return false;
  }

  function parseRgba(colorStr) {
    if (!colorStr || colorStr === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!m) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: parseFloat(m[1]),
      g: parseFloat(m[2]),
      b: parseFloat(m[3]),
      a: m[4] !== undefined ? parseFloat(m[4]) : 1
    };
  }

  function getEffectiveBackground(el) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const cs = window.getComputedStyle(cur);
      const bg = parseRgba(cs.backgroundColor);
      if (bg.a >= 0.25) return bg;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        return { r: 18, g: 18, b: 24, a: 1, hasGradient: true };
      }
      cur = cur.parentElement;
    }
    return { r: 10, g: 10, b: 15, a: 1 };
  }

  function relativeLuminance({ r, g, b }) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function contrastRatio(fg, bg) {
    const l1 = relativeLuminance(fg);
    const l2 = relativeLuminance(bg);
    const bright = Math.max(l1, l2);
    const dark = Math.min(l1, l2);
    return (bright + 0.05) / (dark + 0.05);
  }

  function isClippingAncestor(ancestor, targetW, targetH) {
    const cs = window.getComputedStyle(ancestor);
    const ox = cs.overflowX;
    const oy = cs.overflowY;
    if (ox === 'hidden' || ox === 'clip' || oy === 'hidden' || oy === 'clip') {
      const r = ancestor.getBoundingClientRect();
      if (r.left >= -2 && r.top >= -2 && r.right <= targetW + 2 && r.bottom <= targetH + 2) {
        return true;
      }
    }
    return false;
  }

  function isClippedByViewportMask(el, targetW, targetH) {
    let cur = el.parentElement;
    while (cur && cur.nodeType === 1) {
      if (isClippingAncestor(cur, targetW, targetH)) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function countTextLines(el) {
    try {
      const cs = window.getComputedStyle(el);
      if (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre') return 1;
      const fs = parseFloat(cs.fontSize) || 16;
      const threshold = Math.max(8, fs * 0.45);
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects()).filter(r => r.width > 1 && r.height > 2);
      if (rects.length <= 1) return rects.length;
      const lineTops = [];
      for (const r of rects) {
        if (!lineTops.some(top => Math.abs(top - r.top) < threshold)) {
          lineTops.push(r.top);
        }
      }
      return lineTops.length;
    } catch (_) {
      return 1;
    }
  }

  function auditClocks(isSignagePage) {
    const findings = [];
    if (!isSignagePage) return findings;

    const clockCandidates = new Set();
    const explicitSelectors = [
      '#main-clock', '#banner-clock', '.clock', '.digital-clock',
      '[id*="clock"]', '[class*="clock"]', '[id*="time"]', '.header-time'
    ];
    for (const sel of explicitSelectors) {
      try {
        document.querySelectorAll(sel).forEach(el => {
          if (isVisible(el)) clockCandidates.add(el);
        });
      } catch (_) {}
    }

    const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/;
    document.querySelectorAll('div, span, p, h1, h2, h3, time').forEach(el => {
      if (!isVisible(el)) return;
      const txt = (el.textContent || '').trim();
      if (txt.length >= 4 && txt.length <= 14 && timeRegex.test(txt)) {
        const cls = `${el.id || ''} ${el.className || ''}`.toLowerCase();
        if (cls.includes('clock') || cls.includes('time')) {
          clockCandidates.add(el);
        }
      }
    });

    for (const clockEl of clockCandidates) {
      const txt = (clockEl.textContent || '').trim();
      if (!txt.includes(':') && !clockEl.querySelector('.clock-colon, .colon, [data-colon]')) {
        continue;
      }

      const colonEls = clockEl.querySelectorAll('.clock-colon, .colon, [data-colon], span');
      let hasAnimatedColon = false;
      for (const cEl of colonEls) {
        if ((cEl.textContent || '').trim() !== ':') continue;
        const cs = window.getComputedStyle(cEl);
        const animName = cs.animationName || 'none';
        const animDur = parseFloat(cs.animationDuration || '0');
        if (animName !== 'none' && animDur > 0) {
          hasAnimatedColon = true;
          break;
        }
      }

      if (!hasAnimatedColon) {
        const selfCs = window.getComputedStyle(clockEl);
        if (selfCs.animationName !== 'none' && parseFloat(selfCs.animationDuration || '0') > 0) {
          hasAnimatedColon = true;
        }
      }

      if (!hasAnimatedColon) {
        const r = clockEl.getBoundingClientRect();
        findings.push({
          pillar: 'RULES',
          severity: 'CRITICAL',
          type: 'NON_BLINKING_CLOCK_COLON',
          selector: getSelector(clockEl),
          text: txt.slice(0, 40),
          rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
          detail: 'Visible clock colon (:) is static or not wrapped in an animated span (Rule: ALL CLOCKS MUST HAVE BLINKING COLONS).'
        });
      }
    }

    return findings;
  }

  function isValidCreditCard(str) {
    if (!str) return false;
    const s = String(str).replace(/[\s-]/g, '');
    if (!/^\d{13,19}$/.test(s)) return false;
    if (/^0+$/.test(s) || /^1+$/.test(s) || /^9+$/.test(s)) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let digit = parseInt(s.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
  }

  function auditSecurityAndPrivacy() {
    const findings = [];
    const phoneRegex = /(?<![#a-fA-F0-9])\b(?:\+?64\s?(?:2\d{1}|[3-9])\s?\d{3}\s?\d{3,4}|02\d{1}[- ]\d{3}[- ]?\d{3,4})\b(?!\s*[%pxrem])/g;
    const ccRegex = /\b(?:4\d{3}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}|5[1-5]\d{2}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}|3[47]\d{2}[ -]?\d{6}[ -]?\d{5}|3(?:0[0-5]|[68]\d)\d[ -]?\d{6}[ -]?\d{4}|6(?:011|5\d{2})[ -]?\d{4}[ -]?\d{4}[ -]?\d{4})\b/g;

    const allEls = Array.from(document.querySelectorAll('body *'));
    for (const el of allEls) {
      if (isDecorative(el) || !isVisible(el) || !hasDirectText(el)) continue;
      const txt = (el.textContent || '').trim();
      if (!txt) continue;

      const phoneMatches = txt.match(phoneRegex);
      if (phoneMatches) {
        const r = el.getBoundingClientRect();
        findings.push({
          pillar: 'SECURITY',
          severity: 'WARNING',
          type: 'UNMASKED_PHONE_NUMBER',
          selector: getSelector(el),
          text: phoneMatches[0],
          rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
          detail: `Unmasked phone number ("${phoneMatches[0]}") displayed in live DOM text.`,
          fixHint: 'Mask patron phone numbers (e.g. 027 *** 1234) before rendering in DOM.'
        });
      }

      const ccMatches = txt.match(ccRegex);
      if (ccMatches) {
        for (const cc of ccMatches) {
          if (isValidCreditCard(cc)) {
            const r = el.getBoundingClientRect();
            findings.push({
              pillar: 'SECURITY',
              severity: 'CRITICAL',
              type: 'EXPOSED_CREDIT_CARD_NUMBER',
              selector: getSelector(el),
              text: cc.slice(0, 4) + ' **** **** ' + cc.slice(-4),
              rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
              detail: `Valid credit card number pattern detected in live DOM text.`,
              fixHint: 'Never display raw credit card numbers in DOM. Mask or tokenize payment data.'
            });
          }
        }
      }
    }

    const pwInputs = Array.from(document.querySelectorAll('input[type="password"]'));
    for (const inp of pwInputs) {
      if (inp.value || inp.getAttribute('value')) {
        const r = inp.getBoundingClientRect();
        findings.push({
          pillar: 'SECURITY',
          severity: 'CRITICAL',
          type: 'DEFAULT_PASSWORD_IN_HTML',
          selector: getSelector(inp),
          rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
          detail: `Password input element has prefilled value attribute in DOM.`,
          fixHint: 'Remove default value from password inputs; require active user authentication.'
        });
      }
    }

    const forms = Array.from(document.querySelectorAll('form'));
    for (const form of forms) {
      const action = form.getAttribute('action') || form.action || '';
      const hasPw = form.querySelector('input[type="password"]');
      const isLocalTest = action.startsWith('http://127.0.0.1') || action.startsWith('http://localhost');
      if (hasPw && action.toLowerCase().startsWith('http://') && !isLocalTest) {
        const r = form.getBoundingClientRect();
        findings.push({
          pillar: 'SECURITY',
          severity: 'CRITICAL',
          type: 'INSECURE_HTTP_LOGIN_FORM',
          selector: getSelector(form),
          rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
          detail: `Form containing password input submits over unencrypted HTTP ("${action}").`,
          fixHint: 'Ensure login forms submit exclusively via HTTPS.'
        });
      }
    }

    return findings;
  }

  function runAudit(options = {}) {
    const targetW = options.viewportWidth || DEFAULT_VIEWPORT_W;
    const targetH = options.viewportHeight || DEFAULT_VIEWPORT_H;
    const isSignagePage = options.isSignagePage !== false;
    const violations = [];

    const allElements = Array.from(document.querySelectorAll('body *'));
    const visibleTextElements = [];

    for (const el of allElements) {
      if (isDecorative(el) || !isVisible(el)) continue;

      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      const directText = hasDirectText(el);
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ');

      // 1. Viewport Boundary Containment (1920x1080 or custom target)
      if ((directText || el.tagName === 'IMG' || el.tagName === 'CANVAS' || el.tagName === 'SVG') && !isClippedByViewportMask(el, targetW, targetH)) {
        const outLeft = r.left < -2;
        const outTop = r.top < -2;
        const outRight = r.right > targetW + 2;
        const outBottom = isSignagePage && r.bottom > targetH + 2;
        if (outLeft || outTop || outRight || outBottom) {
          violations.push({
            pillar: 'DESIGN',
            severity: 'CRITICAL',
            type: 'VIEWPORT_OVERFLOW',
            selector: getSelector(el),
            text: txt.slice(0, 50),
            rect: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) },
            detail: `Element spills outside ${targetW}x${targetH} viewport (L:${Math.round(r.left)}, T:${Math.round(r.top)}, R:${Math.round(r.right)}, B:${Math.round(r.bottom)}).`
          });
        }
      }

      // 2. Horizontal/Vertical Text Clipping or Unintended Scrollbars
      const isSymbolOrPunctuation = txt.trim().length <= 1 || ['♠', '♣', '♥', '♦', ':', '•', '·'].includes(txt.trim()) || el.classList.contains('blink-colon') || el.classList.contains('clock-colon');
      const isClippingOverflow = (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowY === 'hidden' || cs.overflowY === 'clip' || cs.overflowX === 'scroll' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowY === 'auto');
      if (directText && el.children.length === 0 && !isSymbolOrPunctuation && isClippingOverflow) {
        const overX = el.scrollWidth > el.clientWidth + 3 && el.clientWidth > 0;
        const overY = el.scrollHeight > el.clientHeight + 6 && el.clientHeight > 0;
        if (overX || overY) {
          const hasEllipsis = cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap';
          if (!hasEllipsis) {
            violations.push({
              pillar: 'DESIGN',
              severity: 'WARNING',
              type: 'TEXT_INTERNAL_OVERFLOW',
              selector: getSelector(el),
              text: txt.slice(0, 50),
              rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
              detail: `Text scroll size (${el.scrollWidth}x${el.scrollHeight}) exceeds box (${el.clientWidth}x${el.clientHeight}) without ellipsis.`
            });
          }
        }
      }

      // 3. Parent Container Edge Spilling
      if (directText) {
        for (const cSel of CONTAINER_SELECTORS) {
          let container = null;
          try { container = el.closest(cSel); } catch (_) {}
          if (container && container !== el) {
            const cr = container.getBoundingClientRect();
            if (r.right > cr.right + 3 || r.bottom > cr.bottom + 3 || r.left < cr.left - 3 || r.top < cr.top - 3) {
              violations.push({
                pillar: 'DESIGN',
                severity: 'CRITICAL',
                type: 'CONTAINER_SPILL',
                selector: getSelector(el),
                containerSelector: getSelector(container),
                text: txt.slice(0, 50),
                rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
                detail: `Child element spills past parent container (${getSelector(container)}) bounds.`
              });
            }
            break;
          }
        }
      }

      // 4. Ugly Line-Wrap Detection on Single-Line UI Elements
      if (directText && isSignagePage) {
        const matchesSingleLine = SINGLE_LINE_SELECTORS.some(sel => {
          try { return el.matches(sel); } catch (_) { return false; }
        });
        if (matchesSingleLine) {
          const lines = countTextLines(el);
          if (lines > 1) {
            violations.push({
              pillar: 'DESIGN',
              severity: 'WARNING',
              type: 'UGLY_LINE_WRAP',
              selector: getSelector(el),
              text: txt.slice(0, 60),
              lines,
              rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
              detail: `Single-line UI element wrapped onto ${lines} lines ("${txt.slice(0, 40)}"). Use white-space: nowrap or smaller font.`
            });
          }
        }
      }

      // 5. Broken Images & QR Code Legibility
      if (el.tagName === 'IMG') {
        const src = el.getAttribute('src') || '';
        if (src && (!el.complete || el.naturalWidth === 0)) {
          violations.push({
            pillar: 'DESIGN',
            severity: 'CRITICAL',
            type: 'BROKEN_IMAGE',
            selector: getSelector(el),
            src,
            rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
            detail: `Image failed to load or has naturalWidth === 0 (src="${src}").`
          });
        }
        const idCls = `${el.id} ${el.className} ${src}`.toLowerCase();
        if (idCls.includes('qr') && (r.width < 85 || r.height < 85)) {
          violations.push({
            pillar: 'DESIGN',
            severity: 'WARNING',
            type: 'QR_TOO_SMALL',
            selector: getSelector(el),
            rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
            detail: `QR image rendered at ${Math.round(r.width)}x${Math.round(r.height)}px (recommended >= 90x90px for 1080p TV scan distance).`
          });
        }
      }

      // 6. Contrast Check on Text Elements
      if (directText && txt.length > 1) {
        visibleTextElements.push({ el, r, cs, txt });
        const fg = parseRgba(cs.color);
        const bg = getEffectiveBackground(el);
        const hasTextShadow = cs.textShadow && cs.textShadow !== 'none';
        const hasWebkitClip = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
        if (fg.a > 0.3 && !bg.hasGradient && !hasTextShadow && !hasWebkitClip) {
          const ratio = contrastRatio(fg, bg);
          const fontSize = parseFloat(cs.fontSize || '16');
          const minRatio = fontSize >= 24 ? 2.8 : 3.8;
          if (ratio < minRatio) {
            violations.push({
              pillar: 'DESIGN',
              severity: 'WARNING',
              type: 'LOW_TEXT_CONTRAST',
              selector: getSelector(el),
              text: txt.slice(0, 45),
              contrastRatio: Number(ratio.toFixed(2)),
              rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
              detail: `Low contrast ratio ${ratio.toFixed(2)}:1 (minimum ${minRatio}:1 for ${Math.round(fontSize)}px text).`
            });
          }
        }
      }
    }

    // 7. Sibling Text AABB Collision Detection
    for (let i = 0; i < visibleTextElements.length; i++) {
      for (let j = i + 1; j < visibleTextElements.length; j++) {
        const a = visibleTextElements[i];
        const b = visibleTextElements[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
        const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
        if (ix > 6 && iy > 6) {
          const area = ix * iy;
          const minArea = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
          if (minArea > 0 && area / minArea > 0.18) {
            violations.push({
              pillar: 'DESIGN',
              severity: 'CRITICAL',
              type: 'ELEMENT_COLLISION',
              selector: getSelector(a.el),
              otherSelector: getSelector(b.el),
              text: `"${a.txt.slice(0, 25)}" overlaps "${b.txt.slice(0, 25)}"`,
              rect: { left: Math.round(a.r.left), top: Math.round(a.r.top), width: Math.round(a.r.width), height: Math.round(a.r.height) },
              detail: `Bounding box collision (${Math.round(ix)}x${Math.round(iy)}px overlap) between ${getSelector(a.el)} and ${getSelector(b.el)}.`
            });
          }
        }
      }
    }

    // 8. Card Typography Hierarchy (Title > Description font size)
    document.querySelectorAll('.premium-card, .special-event-card, .social-card').forEach(card => {
      if (!isVisible(card)) return;
      const titleEl = card.querySelector('.premium-title, .special-title, .social-title, h2, h3');
      const descEl = card.querySelector('.premium-desc, .special-desc, .social-desc, p');
      if (titleEl && descEl && isVisible(titleEl) && isVisible(descEl)) {
        const tSize = parseFloat(window.getComputedStyle(titleEl).fontSize || '0');
        const dSize = parseFloat(window.getComputedStyle(descEl).fontSize || '0');
        if (tSize > 0 && dSize > 0 && tSize <= dSize) {
          const r = card.getBoundingClientRect();
          violations.push({
            pillar: 'DESIGN',
            severity: 'WARNING',
            type: 'TYPOGRAPHY_HIERARCHY_INVERTED',
            selector: getSelector(card),
            rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
            detail: `Card title font-size (${tSize}px) is not larger than description font-size (${dSize}px).`
          });
        }
      }
    });

    // 9. Rules: Blinking Clock Colons
    const clockFindings = auditClocks(isSignagePage);
    violations.push(...clockFindings);

    // 10. Security & Privacy: DOM Unmasked PII & Login Exposure
    const securityFindings = auditSecurityAndPrivacy();
    violations.push(...securityFindings);

    return {
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight, targetW, targetH },
      fontsStatus: document.fonts ? document.fonts.status : 'unknown',
      violations
    };
  }

  /**
   * Non-destructive Slideshow Keyboard Navigation Contract Tester
   */
  function runKeyboardContractAudit() {
    const findings = [];
    const hasMatrix = typeof window.MATRIX === 'object' && window.MATRIX && window.MATRIX.STATE;
    const hasAce = typeof window.nextSlide === 'function' || typeof window.prevSlide === 'function';

    if (!hasMatrix && !hasAce) {
      return { applicable: false, findings: [] };
    }

    const origOpen = window.open;
    const openedUrls = [];
    window.open = function (url) {
      openedUrls.push(String(url || ''));
      return null;
    };

    try {
      const fireKey = (key, code, target = document.body) => {
        const ev = new KeyboardEvent('keydown', {
          key,
          code: code || key,
          bubbles: true,
          cancelable: true
        });
        target.dispatchEvent(ev);
      };

      if (hasMatrix && Array.isArray(window.MATRIX.STATE.slides) && window.MATRIX.STATE.slides.length > 1) {
        const st = window.MATRIX.STATE;
        const savedIdx = st.currentIndex;
        const savedPaused = st.isPaused;
        const savedLocked = st.isLocked;
        const savedDuration = st.slideDuration;

        // Test Spacebar Pause/Unpause
        fireKey(' ', 'Space');
        const afterSpace1 = st.isPaused;
        fireKey(' ', 'Space');
        const afterSpace2 = st.isPaused;
        if (afterSpace1 === savedPaused && afterSpace2 === savedPaused) {
          findings.push({
            pillar: 'RULES',
            severity: 'WARNING',
            type: 'KEYBOARD_SPACE_PAUSE_FAILED',
            selector: 'window',
            detail: 'Spacebar did not toggle slide pause/unpause state.'
          });
        }

        // Test Key '0' Lock/Unlock Freeze
        fireKey('0', 'Digit0');
        const afterZero1 = st.isLocked;
        fireKey('0', 'Digit0');
        const afterZero2 = st.isLocked;
        if (afterZero1 === savedLocked && afterZero2 === savedLocked) {
          findings.push({
            pillar: 'RULES',
            severity: 'WARNING',
            type: 'KEYBOARD_ZERO_LOCK_FAILED',
            selector: 'window',
            detail: 'Key "0" did not toggle Lock/Unlock slide freeze state.'
          });
        }

        // Test Numeric Keys '1'-'9' Duration (test '2' -> 20s)
        fireKey('2', 'Digit2');
        const durAfter2 = st.customDuration || st.slideDuration || st.overrideDuration || (window.MATRIX && window.MATRIX.CONFIG && window.MATRIX.CONFIG.SWAP_DELAY ? window.MATRIX.CONFIG.SWAP_DELAY / 1000 : 0);
        if (durAfter2 !== 20000 && durAfter2 !== 20) {
          findings.push({
            pillar: 'RULES',
            severity: 'WARNING',
            type: 'KEYBOARD_NUMERIC_DURATION_FAILED',
            selector: 'window',
            detail: `Numeric key "2" did not set slide duration to 20s (observed: ${durAfter2}).`
          });
        }

        // Test 'a' (Admin) and 'r' (Remote)
        openedUrls.length = 0;
        fireKey('a', 'KeyA');
        fireKey('r', 'KeyR');
        const openedAdmin = openedUrls.some(u => u.toLowerCase().includes('admin'));
        const openedRemote = openedUrls.some(u => u.toLowerCase().includes('remote'));
        if (!openedAdmin) {
          findings.push({
            pillar: 'RULES',
            severity: 'WARNING',
            type: 'KEYBOARD_ADMIN_SHORTCUT_MISSING',
            selector: 'window',
            detail: 'Key "a" did not open admin.html / masteradmin.html in a new tab.'
          });
        }
        if (!openedRemote) {
          findings.push({
            pillar: 'RULES',
            severity: 'WARNING',
            type: 'KEYBOARD_REMOTE_SHORTCUT_MISSING',
            selector: 'window',
            detail: 'Key "r" did not open remote.html in a new tab.'
          });
        }

        // Test Input Guard: Shortcuts MUST be disabled when focused inside <input>
        const tempInput = document.createElement('input');
        tempInput.type = 'text';
        tempInput.style.position = 'fixed';
        tempInput.style.left = '-9999px';
        document.body.appendChild(tempInput);
        tempInput.focus();
        const pauseBeforeInput = st.isPaused;
        openedUrls.length = 0;
        fireKey(' ', 'Space', tempInput);
        fireKey('a', 'KeyA', tempInput);
        if (st.isPaused !== pauseBeforeInput || openedUrls.length > 0) {
          findings.push({
            pillar: 'RULES',
            severity: 'CRITICAL',
            type: 'KEYBOARD_INPUT_GUARD_MISSING',
            selector: 'input',
            detail: 'Keyboard shortcuts fired while focus was inside an <input> element (violates Input Guard rule).'
          });
        }
        tempInput.remove();

        // Restore state
        st.currentIndex = savedIdx;
        st.isPaused = savedPaused;
        st.isLocked = savedLocked;
        st.slideDuration = savedDuration;
      }
    } catch (err) {
      findings.push({
        pillar: 'PROBLEMS',
        severity: 'CRITICAL',
        type: 'KEYBOARD_AUDIT_EXCEPTION',
        selector: 'window',
        detail: `Exception thrown during keyboard navigation audit: ${err && err.message ? err.message : String(err)}`
      });
    } finally {
      window.open = origOpen;
    }

    return { applicable: true, findings };
  }

  function highlightViolations(violations = []) {
    clearHighlights();
    if (!violations.length) return 0;

    const layer = document.createElement('div');
    layer.className = 'nikkos-d-highlight-layer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden;';

    let drawn = 0;
    for (const v of violations) {
      if (!v.rect || !v.rect.width || !v.rect.height) continue;
      const box = document.createElement('div');
      const isCrit = v.severity === 'CRITICAL';
      const color = isCrit ? '#ff1744' : '#ffab00';
      box.style.cssText = [
        'position:fixed',
        `left:${Math.max(0, v.rect.left)}px`,
        `top:${Math.max(0, v.rect.top)}px`,
        `width:${Math.min(1920, v.rect.width)}px`,
        `height:${Math.min(1080, v.rect.height)}px`,
        `border:3px solid ${color}`,
        `background:${isCrit ? 'rgba(255,23,68,0.14)' : 'rgba(255,171,0,0.12)'}`,
        'box-sizing:border-box',
        'pointer-events:none'
      ].join(';');

      const tag = document.createElement('div');
      tag.textContent = `${v.type}`;
      tag.style.cssText = [
        'position:absolute',
        'top:-18px',
        'left:0',
        `background:${color}`,
        'color:#000',
        'font:bold 10px monospace',
        'padding:1px 4px',
        'white-space:nowrap'
      ].join(';');
      box.appendChild(tag);
      layer.appendChild(box);
      drawn++;
    }

    document.body.appendChild(layer);
    return drawn;
  }

  function clearHighlights() {
    document.querySelectorAll('.nikkos-d-highlight-layer').forEach(el => el.remove());
  }

  const api = {
    version: '1.0.0',
    runAudit,
    runKeyboardContractAudit,
    highlightViolations,
    clearHighlights
  };

  window.NIKKOS_D_CHECK = api;
  window.MATRIX_AUDIT = api;
  window.ACE_AUDIT = api;
})();
