/**
 * matrix-autofit.js — Universal Signage Font Sizing Engine
 * Scales text to the maximum bounds of its visual container without clipping or reflow jump.
 */
(function(window) {
  function fitElement(el, options = {}) {
    if (!el || !el.parentElement) return;
    const maxRem = options.maxRem || 6.5;
    const minRem = options.minRem || 3.5;
    const step = options.step || 0.2;
    const parent = el.parentElement;
    const maxW = parent.clientWidth * (options.widthRatio || 0.92);
    const maxH = parseFloat(getComputedStyle(el).maxHeight) || (parent.clientHeight * 0.42);

    let currentRem = maxRem;
    el.style.fontSize = `${currentRem}rem`;

    while (currentRem > minRem) {
      if (el.scrollWidth <= maxW && el.scrollHeight <= maxH) break;
      currentRem -= step;
      el.style.fontSize = `${currentRem}rem`;
    }
  }

  function fitContainer(containerEl) {
    if (!containerEl) return;
    const h1s = containerEl.querySelectorAll('.premium-title, .special-title, .social-title, .advert-title, .slide-title, .slide h1, .fit-h1');
    h1s.forEach(el => fitElement(el, { maxRem: 6.5, minRem: 3.5 }));

    const h2s = containerEl.querySelectorAll('.premium-subtitle, .special-subtitle, .social-handle, .advert-subtitle, .slide-subtitle, .slide h2, .fit-h2');
    h2s.forEach(el => fitElement(el, { maxRem: 3.6, minRem: 1.8 }));
  }

  window.MatrixAutoFit = { fitElement, fitContainer };
})(typeof window !== 'undefined' ? window : this);
