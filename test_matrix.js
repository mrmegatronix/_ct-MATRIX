const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
setTimeout(() => {
  console.log(dom.window.document.body.innerHTML.substring(0, 500));
  console.log("Done");
}, 3000);
