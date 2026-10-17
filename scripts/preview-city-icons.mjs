import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root = new URL('../',import.meta.url);
const {CITY_ICONS} = await import('../dist/scripts/city-icons.js');
assert.equal(new Set(CITY_ICONS.map(icon=>icon.id)).size,CITY_ICONS.length);
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:1120,height:900},deviceScaleFactor:1});
  await page.goto(new URL('docs/city-icons.html',root).href);
  // Decode every actual packaged SVG and verify transparency and white tint source.
  for (const icon of CITY_ICONS) {
    const svg = await readFile(new URL(`dist/assets/city-icons/${icon.id}.svg`,root),'utf8');
    const valid = await page.evaluate(async svg => {
      const image = new Image();
      image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image,0,0,64,64);
      const pixels = ctx.getImageData(0,0,64,64).data;
      let ink = 0;
      for(let i=0;i<pixels.length;i+=4) {
        if(pixels[i+3]>0) {
          ink++;
          if(pixels[i]!==255 || pixels[i+1]!==255 || pixels[i+2]!==255) return false;
        }
      }
      return ink>100 && ink<3000 && pixels[3]===0;
    },svg);
    assert.ok(valid,`White transparent artwork: ${icon.id}`);
  }
  await page.screenshot({path:fileURLToPath(new URL('docs/city-icons-preview.png',root)),fullPage:true});
  await page.locator('input').fill('#43d9df');
  await page.locator('input').dispatchEvent('input');
  await page.screenshot({path:fileURLToPath(new URL('docs/city-icons-tinted-preview.png',root)),fullPage:true});
  console.log(`Verified ${CITY_ICONS.length} packaged icons, white pixels/transparency, unique icon IDs. Rendered white/cyan previews.`);
} finally {await browser.close();}
