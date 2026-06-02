const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; }
    .slide-viewport { width: 1920px; height: 1080px; position: relative; }
    .premium-card { padding: 14vh 6rem 200px 6rem; height: 100%; display: flex; flex-direction: column; justify-content: center; }
    .premium-desc { font-size: 88px; line-height: 1.4; }
    .premium-title { font-size: 152px; line-height: 1.1; }
    .premium-footer-row { position: absolute; bottom: 30px; top: 1000px; height: 50px; }
  </style>
</head>
<body>
  <div id="slide-target" class="slide-viewport">
    <div class="premium-card">
      <div class="premium-title-wrapper"><h1 class="premium-title">Two Course Sunday Roast</h1></div>
      <div class="premium-desc-wrapper"><div class="premium-desc">Traditional roast of the day with roasted vegetables, seasonal greens and rich gravy, with an Ice Cream Sundae to finish.</div></div>
    </div>
    <div class="premium-footer-row"></div>
  </div>
</body>
</html>
`, { runScripts: "dangerously" });

const window = dom.window;
const document = window.document;

// Polyfill getBoundingClientRect for jsdom
document.querySelector('.premium-footer-row').getBoundingClientRect = () => ({ top: 1000, bottom: 1050 });
let descFontSize = 88;
let titleFontSize = 152;
// Mock text height scaling (roughly 1.4 * font size * 3 lines for desc, 1.1 * font size * 1 line for title)
document.querySelector('.premium-desc').getBoundingClientRect = () => {
    const height = descFontSize * 1.4 * 3;
    // Assuming flexbox centering: total content height
    const totalHeight = (titleFontSize * 1.1) + height;
    const top = (1080 - 200 - totalHeight) / 2; // rough estimation
    const bottom = top + totalHeight; // desc is at the bottom
    return { bottom: bottom };
};
document.querySelector('.premium-title').getBoundingClientRect = () => {
    const totalHeight = (titleFontSize * 1.1) + (descFontSize * 1.4 * 3);
    const top = (1080 - 200 - totalHeight) / 2;
    const bottom = top + (titleFontSize * 1.1); // title is above desc
    return { bottom: bottom };
};

const slideEl = document.getElementById('slide-target');
const descFontEl = slideEl.querySelector('.premium-desc');
const titleEl = slideEl.querySelector('.premium-title');
const footerEl = slideEl.querySelector('.premium-footer-row');

const maxBottom = footerEl.getBoundingClientRect().top - 20;

let loopCount = 0;
const FOOTER_TEXT_SIZE = 20;

const getLowestBottom = () => {
  let bottom = 0;
  if (descFontEl) bottom = Math.max(bottom, descFontEl.getBoundingClientRect().bottom);
  if (titleEl) bottom = Math.max(bottom, titleEl.getBoundingClientRect().bottom);
  return bottom;
};

console.log("Initial lowest bottom:", getLowestBottom(), "maxBottom:", maxBottom);
console.log("Initial descFontSize:", descFontSize, "titleFontSize:", titleFontSize);

while (getLowestBottom() > maxBottom && loopCount < 100) {
  let shrunk = false;
  
  if (descFontSize > FOOTER_TEXT_SIZE) {
    descFontSize -= 2;
    shrunk = true;
  } 
  
  if (!shrunk && titleEl && titleFontSize > 30) {
    titleFontSize -= 2;
    shrunk = true;
  }

  if (!shrunk) break;
  loopCount++;
}

console.log("Final loopCount:", loopCount);
console.log("Final descFontSize:", descFontSize, "titleFontSize:", titleFontSize);
