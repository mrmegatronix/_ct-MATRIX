import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        const outDir = path.join(process.cwd(), 'snaps');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir);
        }

        console.log("Launching Chrome in A4 Portrait mode (1240x1754)...");
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            defaultViewport: { width: 1240, height: 1754 },
            args: ['--no-sandbox', '--disable-web-security']
        });

        const page = await browser.newPage();
        
        // Wait for page to load
        const fileUrl = 'file://' + path.join(process.cwd(), 'index.html');
        console.log("Navigating to:", fileUrl);
        await page.goto(fileUrl, { waitUntil: 'networkidle0' });

        // Wait for Matrix to initialize and build queue
        console.log("Waiting for slides to load...");
        await page.waitForFunction(() => {
            return window.MATRIX && window.MATRIX.STATE && window.MATRIX.STATE.slides && window.MATRIX.STATE.slides.length > 0;
        }, { timeout: 15000 });

        const slides = await page.evaluate(() => {
            return window.MATRIX.STATE.slides.map((s, idx) => ({ id: s.id, type: s.type, title: s.title, idx: idx }));
        });

        console.log(`Found ${slides.length} slides.`);

        // Hide UI elements that we don't want in screenshots (like progress bars/controls)
        await page.evaluate(() => {
            const bar = document.getElementById('progress-bar');
            if (bar) bar.style.display = 'none';
            const controls = document.querySelector('.slide-controls');
            if (controls) controls.style.display = 'none';
        });

        for (const slide of slides) {
            console.log(`Capturing slide ${slide.idx + 1}/${slides.length}: ${slide.id}`);
            
            // Render the slide
            await page.evaluate((idx) => {
                // Pause it so it doesn't auto-advance while we're capturing
                window.MATRIX.STATE.isPaused = true;
                window.MATRIX.STATE.currentIndex = idx;
                window.renderActiveSlide(true);
            }, slide.idx);

            // Wait for transitions and images to load
            await new Promise(r => setTimeout(r, 2000));

            // Clean filenames
            const cleanTitle = (slide.title || 'slide').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const filename = `${String(slide.idx + 1).padStart(2, '0')}_${cleanTitle}_${slide.id}`;

            const pngPath = path.join(outDir, `${filename}.png`);
            const jpgPath = path.join(outDir, `${filename}.jpg`);

            await page.screenshot({ path: pngPath, type: 'png' });
            await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 90 });
            
            console.log(` Saved snaps/${filename}.png and .jpg`);
        }

        console.log("Closing browser...");
        await browser.close();
        console.log("Done!");
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
})();
