const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  filePath = filePath.split('?')[0];
  let extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
      case '.js': contentType = 'text/javascript'; break;
      case '.css': contentType = 'text/css'; break;
  }
  fs.readFile(filePath, (err, content) => {
      if (err) { res.writeHead(404); res.end('Not found'); }
      else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content, 'utf-8'); }
  });
}).listen(8081);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('[BROWSER]', msg.text());
  });

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle0' });
  
  // Wait for matrix boot
  await new Promise(r => setTimeout(r, 2000));
  
  // Inject a huge slide to force adjustActiveSlideText
  await page.evaluate(() => {
    const hugeSlide = {
        id: 'test-huge',
        type: 'PREMIUM',
        title: 'Free Pool Thursdays',
        subtitle: 'Our Pool Table is Free all day and night on Thursdays! Grab a cue and challenge your mates. This is extra text to force it to wrap multiple lines and see if the shrink logic works correctly!',
        fgImage: '',
        meta1: 'Thursday, 4 June',
        meta1Icon: 'calendar-days',
        meta2: 'FREE',
        meta2Icon: 'ticket',
        themeColor: '#FFD700',
        transition: 'slide-up'
    };
    
    // Inject custom log into adjustActiveSlideText
    const orig = window.adjustActiveSlideText;
    window.adjustActiveSlideText = function() {
        console.log("adjustActiveSlideText started!");
        const slideEl = document.getElementById('slide-target');
        const descFontEl = slideEl.querySelector('.premium-desc');
        const cardEl = slideEl.querySelector('.premium-card');
        const footerEl = slideEl.querySelector('.premium-footer-row');
        
        console.log("Before loop: desc fontSize =", window.getComputedStyle(descFontEl).fontSize);
        orig();
        console.log("After loop: desc fontSize =", window.getComputedStyle(descFontEl).fontSize);
    };

    window.nextSlide = function() {}; // prevent auto rotation
    window.renderActiveSlide(hugeSlide);
  });
  
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
  server.close();
  process.exit(0);
})();
