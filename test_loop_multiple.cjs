const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = `
<!DOCTYPE html>
<html>
<body>
  <div id="slide-viewport"></div>
  <div id="progress-bar"></div>
</body>
</html>
`;

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

window.requestAnimationFrame = cb => setTimeout(cb, 16);

// Mock BroadcastChannel
class MockBroadcastChannel {
    constructor(name) { this.name = name; }
    postMessage(msg) { /* no-op */ }
}
window.BroadcastChannel = MockBroadcastChannel;

// Mock fetch
window.fetch = async () => ({
    json: async () => ([]) // Mock empty sheet data
});

const code = fs.readFileSync('./matrix-core.js', 'utf8');

try {
    dom.window.eval(code);
    console.log("✅ matrix-core.js loaded successfully.");

    // Setup 3 active slides
    window.MATRIX.STATE.slides = [
        { id: 'slide-1', type: 'EVENT', title: 'Slide 1', duration: 5, active: true },
        { id: 'slide-2', type: 'EVENT', title: 'Slide 2', duration: 5, active: true },
        { id: 'slide-3', type: 'EVENT', title: 'Slide 3', duration: 5, active: true }
    ];
    window.MATRIX.STATE.currentIndex = 0;
    window.MATRIX.STATE.hasInjectedFallbacks = true;
    window.isSlideActive = () => true;

    // Simulate DOM elements
    document.getElementById('slide-viewport').innerHTML = '<div id="slide-target" data-slide-id="slide-1"></div>';

    console.log("🛠️ Testing multiple slides loop sequence...");

    // First transition: slide 1 -> slide 2
    window.nextSlide();
    console.log(`Current Index after 1st nextSlide: ${window.MATRIX.STATE.currentIndex}`);
    if (window.MATRIX.STATE.currentIndex !== 1) {
        throw new Error("Expected index to advance to 1.");
    }

    // Second transition: slide 2 -> slide 3
    document.getElementById('slide-viewport').innerHTML = '<div id="slide-target" data-slide-id="slide-2"></div>';
    window.nextSlide();
    console.log(`Current Index after 2nd nextSlide: ${window.MATRIX.STATE.currentIndex}`);
    if (window.MATRIX.STATE.currentIndex !== 2) {
        throw new Error("Expected index to advance to 2.");
    }

    // Third transition (wrap around): slide 3 -> slide 1
    document.getElementById('slide-viewport').innerHTML = '<div id="slide-target" data-slide-id="slide-3"></div>';
    window.nextSlide();
    console.log(`Current Index after 3rd nextSlide (wrap-around): ${window.MATRIX.STATE.currentIndex}`);
    if (window.MATRIX.STATE.currentIndex !== 0) {
        throw new Error("Expected index to wrap around to 0.");
    }

    console.log("\n🚀 Multiple slides looping verification passed.");
    process.exit(0);
} catch(e) {
    console.error("❌ Multiple slides loop test failed:");
    console.error(e);
    process.exit(1);
}
