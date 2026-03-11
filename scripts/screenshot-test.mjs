import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'public', 'track-debug.html');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  // Load local HTML file
  const htmlContent = readFileSync(htmlPath, 'utf-8');
  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
  
  // Wait for Three.js to render
  await new Promise(r => setTimeout(r, 3000));
  
  const screenshotPath = path.join(__dirname, 'track-debug-screenshot.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);
  
  // Also get info text
  const infoText = await page.$eval('#info', el => el.innerText);
  console.log('Info:', infoText);
  
  await browser.close();
})();
