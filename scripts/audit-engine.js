/**
 * _ct-MATRIX UI/UX Automated Audit Engine
 * Evaluates 1080p viewport containment, text wrapping, font rendering,
 * spacing collisions, and mandatory UI protocol rules (blinking colons, etc.).
 */

(function (global) {
  'use strict';

  const VIEWPORT_WIDTH = 1920;
  const VIEWPORT_HEIGHT = 1080;

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function getElementSelector(el) {
    if (!el || !(el instanceof Element)) return '';
    if (el.id) return '#' + el.id;
    let path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector = '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sibling = el;
        let nth = 1;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.nodeName.toLowerCase() === selector) nth++;
        }
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('active')).slice(0, 2);
          if (classes.length) selector += '.' + classes.join('.');
        }
        if (nth > 1) selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      el = el.parentElement;
      if (path.length >= 4) break;
    }
    return path.join(' > ');
  }

  function getTextSummary(el) {
    return (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  }

  // Check 1: 1080p Viewport Boundary Containment
  function checkViewportBounds(container, contextName, options = {}) {
    const violations = [];
    if (!container) return violations;
    const isDocScroll = options.allowVerticalScroll || false;
    const targetWidth = options.targetWidth || VIEWPORT_WIDTH;
    const targetHeight = options.targetHeight || VIEWPORT_HEIGHT;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (!isVisible(node)) return NodeFilter.FILTER_REJECT;
        if (node === document.documentElement || node === document.body || node.id === 'slide-viewport' || node.classList.contains('matrix-bg')) {
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let current;
    while ((current = walker.nextNode())) {
      const rect = current.getBoundingClientRect();

      // Ignore decorative layers designed to bleed
      if (current.classList.contains('matrix-bg') || current.classList.contains('slide-bg') || current.classList.contains('slide-bg-overlay') || current.classList.contains('ambient-glow') || current.tagName === 'CANVAS') {
        continue;
      }

      const horizontallyExceeded = rect.left < -2 || rect.right > targetWidth + 2;
      const verticallyExceeded = !isDocScroll && (rect.top < -2 || rect.bottom > targetHeight + 2);

      if (horizontallyExceeded || verticallyExceeded) {
        violations.push({
          severity: 'CRITICAL',
          category: 'VIEWPORT_BOUNDARY',
          context: contextName,
          selector: getElementSelector(current),
          elementText: getTextSummary(current),
          message: `Element overflows viewport [left: ${Math.round(rect.left)}, top: ${Math.round(rect.top)}, right: ${Math.round(rect.right)}, bottom: ${Math.round(rect.bottom)}]`,
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          suggestedFix: 'Clamp width/height or adjust margin/padding to remain strictly within screen boundaries.'
        });
      }
    }
    return violations;
  }

  // Check 2: Container Overflow & Silent Clipping
  function checkContainerOverflow(container, contextName) {
    const violations = [];
    if (!container) return violations;

    const elements = container.querySelectorAll('*');
    for (const el of elements) {
      if (!isVisible(el)) continue;
      if (el.classList.contains('scrollable') || el.classList.contains('admin-scroll') || el.classList.contains('table-responsive')) continue;

      const style = window.getComputedStyle(el);
      const isOverflowHidden = style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden';

      // Check scrollWidth > clientWidth
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        violations.push({
          severity: isOverflowHidden ? 'WARNING' : 'CRITICAL',
          category: 'HORIZONTAL_OVERFLOW',
          context: contextName,
          selector: getElementSelector(el),
          elementText: getTextSummary(el),
          message: `Horizontal content overflow: scrollWidth (${el.scrollWidth}px) > clientWidth (${el.clientWidth}px)${isOverflowHidden ? ' [CLIPPED SILENTLY]' : ''}`,
          suggestedFix: 'Add white-space: nowrap with reduced font-size or expand container clientWidth.'
        });
      }

      // Check scrollHeight > clientHeight
      if (style.height !== 'auto' && style.maxHeight !== 'none' && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
        violations.push({
          severity: isOverflowHidden ? 'WARNING' : 'CRITICAL',
          category: 'VERTICAL_OVERFLOW',
          context: contextName,
          selector: getElementSelector(el),
          elementText: getTextSummary(el),
          message: `Vertical content overflow: scrollHeight (${el.scrollHeight}px) > clientHeight (${el.clientHeight}px)${isOverflowHidden ? ' [CLIPPED SILENTLY]' : ''}`,
          suggestedFix: 'Reduce internal padding or child font-size/height.'
        });
      }
    }
    return violations;
  }

  // Check 3: Text Wrapping Heuristics
  function checkTextWrapping(container, contextName) {
    const violations = [];
    if (!container) return violations;

    const noWrapSelectors = [
      '.sheen-text',
      '.slide-title',
      '.slide-subtitle',
      '.headline',
      '.hero-title',
      '.badge',
      '.pill',
      '.status-badge',
      '.date-badge',
      '.meta-pill'
    ];

    const targets = container.querySelectorAll(noWrapSelectors.join(', '));
    for (const el of targets) {
      if (!isVisible(el)) continue;
      if (el.querySelector('p, div, table, ul, ol')) continue;

      const text = (el.textContent || '').trim();
      if (!text) continue;

      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = range.getClientRects();

      if (rects.length > 1) {
        const style = window.getComputedStyle(el);
        if (style.whiteSpace !== 'nowrap') {
          violations.push({
            severity: 'CRITICAL',
            category: 'TEXT_WRAPPING',
            context: contextName,
            selector: getElementSelector(el),
            elementText: getTextSummary(el),
            message: `Text unintentionally wrapped across ${rects.length} lines: "${getTextSummary(el)}"`,
            suggestedFix: 'Apply white-space: nowrap and reduce font-size or letter-spacing.'
          });
        }
      }
    }

    return violations;
  }

  // Check 4: Font Loading
  function checkFontsLoaded() {
    const violations = [];
    const requiredFonts = ['Inter', 'Playfair Display', 'JetBrains Mono'];

    const loadedFamilies = new Set();
    try {
      document.fonts.forEach(face => {
        loadedFamilies.add(face.family.replace(/['"]/g, '').trim().toLowerCase());
      });
    } catch (_) {}

    for (const font of requiredFonts) {
      const isLoaded = loadedFamilies.has(font.toLowerCase()) || 
        document.fonts.check(`16px "${font}"`) || 
        document.fonts.check(`700 16px "${font}"`);

      if (!isLoaded) {
        violations.push({
          severity: 'WARNING',
          category: 'FONT_LOADING',
          context: 'DOCUMENT',
          selector: 'document.fonts',
          elementText: font,
          message: `Required font "${font}" is not verified as loaded in document.fonts.`,
          suggestedFix: 'Check Google Fonts <link> tags or font-family fallback declarations.'
        });
      }
    }
    return violations;
  }

  // Check 5: Mandatory Clock Blinking Colons Protocol
  function checkClockBlinkingColons(container, contextName) {
    const violations = [];
    if (!container) return violations;

    const clockContainers = container.querySelectorAll(
      '.clock, .time, .clock-digits, #main-clock, .live-clock, [data-clock]'
    );

    for (const clock of clockContainers) {
      if (!isVisible(clock)) continue;

      const colons = clock.querySelectorAll('.clock-colon, .colon, [data-colon]');
      if (colons.length === 0) {
        if (clock.textContent.includes(':')) {
          violations.push({
            severity: 'CRITICAL',
            category: 'BLINKING_COLON_RULE',
            context: contextName,
            selector: getElementSelector(clock),
            elementText: getTextSummary(clock),
            message: 'Clock contains colon character without dedicated blinking colon element.',
            suggestedFix: 'Wrap colon in <span class="clock-colon">:</span> with opacity blink animation.'
          });
        }
      } else {
        for (const colon of colons) {
          const style = window.getComputedStyle(colon);
          const animName = style.animationName;
          const animDur = parseFloat(style.animationDuration);
          if (!animName || animName === 'none' || animDur <= 0) {
            violations.push({
              severity: 'CRITICAL',
              category: 'BLINKING_COLON_RULE',
              context: contextName,
              selector: getElementSelector(colon),
              elementText: colon.textContent,
              message: `Clock colon lacks active CSS animation (animation-name: "${animName}", duration: ${animDur}s).`,
              suggestedFix: 'Add CSS animation: blink-colon 1s infinite steps(1, start);'
            });
          }
        }
      }
    }
    return violations;
  }

  // Check 6: Sibling Element Collision (AABB)
  function checkSiblingCollisions(container, contextName) {
    const violations = [];
    if (!container) return violations;

    const panels = container.querySelectorAll('.panel, .card, .slide-content, .widget-container');
    for (const parent of panels) {
      if (!isVisible(parent)) continue;
      const children = Array.from(parent.children).filter(isVisible);
      for (let i = 0; i < children.length; i++) {
        for (let j = i + 1; j < children.length; j++) {
          const a = children[i];
          const b = children[j];
          const styleA = window.getComputedStyle(a);
          const styleB = window.getComputedStyle(b);
          if (styleA.position === 'absolute' || styleB.position === 'absolute') continue;

          const rectA = a.getBoundingClientRect();
          const rectB = b.getBoundingClientRect();

          const collides = !(
            rectA.right <= rectB.left + 1 ||
            rectA.left >= rectB.right - 1 ||
            rectA.bottom <= rectB.top + 1 ||
            rectA.top >= rectB.bottom - 1
          );

          if (collides && rectA.width > 0 && rectB.width > 0 && rectA.height > 0 && rectB.height > 0) {
            violations.push({
              severity: 'WARNING',
              category: 'SIBLING_COLLISION',
              context: contextName,
              selector: `${getElementSelector(a)} <-> ${getElementSelector(b)}`,
              elementText: `${getTextSummary(a)} | ${getTextSummary(b)}`,
              message: `In-flow siblings overlap each other: A[${Math.round(rectA.left)},${Math.round(rectA.top)},${Math.round(rectA.width)}x${Math.round(rectA.height)}] vs B[${Math.round(rectB.left)},${Math.round(rectB.top)},${Math.round(rectB.width)}x${Math.round(rectB.height)}]`,
              suggestedFix: 'Adjust flex gap, margin, or layout flow to prevent collision.'
            });
          }
        }
      }
    }
    return violations;
  }

  // Audit Single Slide in Matrix
  function auditCurrentSlide(contextName) {
    const target = document.getElementById('slide-viewport') || document.body;
    const violations = [];
    violations.push(...checkViewportBounds(target, contextName));
    violations.push(...checkContainerOverflow(target, contextName));
    violations.push(...checkTextWrapping(target, contextName));
    violations.push(...checkClockBlinkingColons(target, contextName));
    violations.push(...checkSiblingCollisions(target, contextName));
    return violations;
  }

  // Audit Static / Non-slide Page
  function auditPage(pageName) {
    const contextName = pageName || document.title || 'Page';
    const violations = [];
    violations.push(...checkFontsLoaded());
    violations.push(...checkViewportBounds(document.body, contextName, { allowVerticalScroll: true, targetWidth: window.innerWidth }));
    violations.push(...checkContainerOverflow(document.body, contextName));
    violations.push(...checkTextWrapping(document.body, contextName));
    violations.push(...checkClockBlinkingColons(document.body, contextName));
    violations.push(...checkSiblingCollisions(document.body, contextName));

    return {
      timestamp: new Date().toISOString(),
      pageName,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      violations,
      summary: {
        totalViolations: violations.length,
        critical: violations.filter(v => v.severity === 'CRITICAL').length,
        warning: violations.filter(v => v.severity === 'WARNING').length
      }
    };
  }

  // Audit All Slides Iteratively in Matrix
  async function auditAllSlides(options = {}) {
    const delay = options.delayMs || 300;
    const slides = (window.MATRIX && window.MATRIX.STATE && window.MATRIX.STATE.slides) || [];
    const totalSlides = slides.length || 1;

    const report = {
      timestamp: new Date().toISOString(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      totalSlides,
      fontStatus: checkFontsLoaded(),
      slideReports: [],
      summary: { totalViolations: 0, critical: 0, warning: 0 }
    };

    if (slides.length > 0) {
      for (let i = 0; i < slides.length; i++) {
        if (typeof window.nextSlide === 'function') {
          window.MATRIX.STATE.currentIndex = i;
          if (typeof window.renderActiveSlide === 'function') {
            window.renderActiveSlide(true);
          }
          await new Promise(r => setTimeout(r, delay));
        }
        const slideId = slides[i].id || `slide-${i}`;
        const violations = auditCurrentSlide(`Slide ${i} (${slideId})`);
        report.slideReports.push({
          slideIndex: i,
          slideId,
          violations
        });
        for (const v of violations) {
          report.summary.totalViolations++;
          if (v.severity === 'CRITICAL') report.summary.critical++;
          else if (v.severity === 'WARNING') report.summary.warning++;
        }
      }
    } else {
      // Audit whatever is currently rendered
      const violations = auditCurrentSlide('Initial View');
      report.slideReports.push({
        slideIndex: 0,
        slideId: 'initial-view',
        violations
      });
      for (const v of violations) {
        report.summary.totalViolations++;
        if (v.severity === 'CRITICAL') report.summary.critical++;
        else if (v.severity === 'WARNING') report.summary.warning++;
      }
    }

    return report;
  }

  const MATRIX_AUDIT = {
    auditCurrentSlide,
    auditPage,
    auditAllSlides,
    checkFontsLoaded,
    checkViewportBounds,
    checkContainerOverflow,
    checkTextWrapping,
    checkClockBlinkingColons,
    checkSiblingCollisions
  };

  global.MATRIX_AUDIT = MATRIX_AUDIT;
  global.ACE_AUDIT = MATRIX_AUDIT; // Alias compatibility

})(typeof window !== 'undefined' ? window : globalThis);
