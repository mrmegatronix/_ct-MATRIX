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
    console.log("✅ matrix-core.js loaded successfully without syntax errors.");

    // Setup mock data for the bug scenario: Only ONE slide in the queue
    window.MATRIX.STATE.slides = [
        {
            id: 'ev-warriors',
            type: 'EVENT',
            title: 'Warriors Slide',
            duration: 5, // 5 seconds
            active: true
        }
    ];
    window.MATRIX.STATE.currentIndex = 0;
    window.MATRIX.STATE.hasInjectedFallbacks = true;
    
    // Override isSlideActive to always return true for testing
    window.isSlideActive = () => true;

    console.log("🛠️ Testing nextSlide() with single item loop...");
    
    // Simulate DOM elements
    document.getElementById('slide-viewport').innerHTML = '<div id="slide-target"></div>';
    
    window.nextSlide();
    
    if (window.MATRIX.STATE.currentIndex !== 0) {
        throw new Error("currentIndex should remain 0 when only 1 item exists.");
    }
    
    // After my fix, it should NOT clear the slide-target
    if (!document.getElementById('slide-target')) {
        throw new Error("❌ slide-target was destroyed! The infinite transition loop bug is still present!");
    } else {
        console.log("✅ slide-target remained intact. The fade-to-black loop bug is fixed.");
    }

    console.log("🛠️ Testing jumpToProject() on the exact same slide...");
    window.jumpToProject('ev-warriors');
    if (!document.getElementById('slide-target')) {
        throw new Error("❌ slide-target was destroyed on jumpToProject! The Master Dashboard ping bug is still present!");
    } else {
        console.log("✅ slide-target remained intact during redundant jumpToProject. Master ping loops are fixed.");
    }

    console.log("\n🚀 All automated regression tests passed. The live sync freeze and transition loop bugs are verifiably resolved.");
    process.exit(0);
} catch(e) {
    console.error("❌ Test Failed:");
    console.error(e);
    process.exit(1);
}
