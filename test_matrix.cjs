const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('matrix-core.js', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
dom.window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.log("ERROR: " + msg);
  console.log(error);
};
// Provide a mock BroadcastChannel
dom.window.BroadcastChannel = class BroadcastChannel {
  constructor(name) { this.name = name; }
  postMessage(msg) {}
  addEventListener() {}
  removeEventListener() {}
  close() {}
};

const scriptEl = dom.window.document.createElement("script");
scriptEl.textContent = js;
dom.window.document.head.appendChild(scriptEl);

setTimeout(() => {
  dom.window.initMatrix();
  setTimeout(() => {
    console.log("Slides in queue: " + dom.window.MATRIX.STATE.slides.length);
    console.log("Current Index: " + dom.window.MATRIX.STATE.currentIndex);
    console.log("Done");
  }, 2000);
}, 1000);
