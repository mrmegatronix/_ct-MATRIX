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

// Mock BroadcastChannel
class MockBroadcastChannel {
    constructor(name) { this.name = name; }
    postMessage(msg) { /* no-op */ }
}
window.BroadcastChannel = MockBroadcastChannel;

// Mock Date to be 09/07/2026 for consistent testing of future events
dom.window.eval(`
  const RealDate = Date;
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super('2026-07-09T00:00:00');
      } else {
        super(...args);
      }
    }
    static now() {
      return new RealDate('2026-07-09T00:00:00').getTime();
    }
  }
  Date = MockDate;
`);

// Read the matrix-core.js script content
const code = fs.readFileSync('./matrix-core.js', 'utf8');
dom.window.eval(code);

// Mock the spreadsheet response using test.csv content
const csvData = fs.readFileSync('./test.csv', 'utf8');
window.fetch = async () => ({
    text: async () => csvData
});

// Run matrix initialization
async function runTest() {
    console.log("🛠️ Loading and parsing test.csv for All Blacks matches...");
    
    // We mock buildSlideQueue call with parsed CSV content
    const parsedData = window.parseCSVToEvents(csvData);
    
    console.log(`Parsed ${parsedData[0].events.length} events from CSV.`);
    
    // Test isEventCurrent logic
    const allBlacksEvents = parsedData[0].events.filter(ev => 
        (ev.event_type || '').toLowerCase().includes('all blacks') || 
        (ev.title || '').toLowerCase().includes('all blacks')
    );
    
    console.log(`Found ${allBlacksEvents.length} All Blacks events in CSV.`);
    
    // Verify TBC bypass and 45-day lookahead limit
    window.buildSlideQueue(parsedData);
    const queue = window.MATRIX.STATE.slides;
    
    const activeAllBlacks = queue.filter(slide => 
        (slide.subType || '').toLowerCase().includes('all blacks') || 
        (slide.title || '').toLowerCase().includes('all blacks')
    );
    
    console.log(`Active All Blacks slides in queue: ${activeAllBlacks.length}`);
    activeAllBlacks.forEach(s => {
        console.log(`  - [ACTIVE] Title: "${s.title}" | Date: ${s.date} | Time: ${s.time} | SubType: "${s.subType}"`);
    });

    // Check if the match on July 11th is present
    const hasJuly11Match = activeAllBlacks.some(s => s.date === '11/07/2026');
    if (hasJuly11Match) {
        console.log("✅ Verified: All Blacks vs Italy on 11/07/2026 is successfully present in the active queue.");
    } else {
        throw new Error("❌ Fail: All Blacks vs Italy on 11/07/2026 is missing from active queue!");
    }

    // Check if the match with July 18th is present
    const hasJuly18Match = activeAllBlacks.some(s => s.date === '18/07/2026');
    if (hasJuly18Match) {
        console.log("✅ Verified: All Blacks vs Ireland on 18/07/2026 is successfully present in the active queue.");
    } else {
        throw new Error("❌ Fail: All Blacks vs Ireland on 18/07/2026 is missing from active queue!");
    }

    // Check if the match with August 23rd is present (39 days away, so should be active under 45-day bypass but would be filtered under 14-day limit)
    const hasAugust23Match = activeAllBlacks.some(s => s.date === '23/08/2026');
    if (hasAugust23Match) {
        console.log("✅ Verified: All Blacks vs South Africa on 23/08/2026 (39 days away) is successfully present in the active queue.");
    } else {
        throw new Error("❌ Fail: All Blacks vs South Africa on 23/08/2026 is missing from active queue!");
    }

    console.log("\n🚀 All All Blacks scheduling validation tests passed successfully!");
    process.exit(0);
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
