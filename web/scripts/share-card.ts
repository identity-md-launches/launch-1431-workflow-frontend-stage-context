import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { colonies, coordinates } from '../src/domain';

// A static illustration reuses the game's map geometry and colony colors, not live standings.
const font = await readFile(new URL('../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2', import.meta.url));
const hexes = Array.from({ length: 61 }, (_, id) => {
  const [q, r] = coordinates(id), x = 310 + Math.sqrt(3) * 33 * (q + r / 2), y = 304 + 49.5 * r;
  const color = colonies[id === 0 ? 0 : q < 0 ? r < 1 ? 0 : 1 : r < 0 ? 2 : 3].color;
  const vertices = Array.from({ length: 6 }, (_, i) => { const angle = (60 * i - 90) * Math.PI / 180; return `${x + 31 * Math.cos(angle)},${y + 31 * Math.sin(angle)}`; }).join(' ');
  return `<polygon points="${vertices}" fill="${color}" fill-opacity="${id === 0 ? '.95' : '.18'}" stroke="${color}" stroke-width="${id === 0 ? '3' : '1.5'}"/><text x="${x}" y="${y + 4}" fill="${id === 0 ? '#17160c' : '#f2f1e6'}" font-family="Arial,sans-serif" font-size="${id === 0 ? '12' : '11'}" text-anchor="middle">${id === 0 ? 'CORE' : String(id).padStart(2, '0')}</text>`;
}).join('');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="en"><meta charset="UTF-8"><title>Hive Wars share card</title><style>
    @font-face{font-family:Barlow;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:700}
    *{box-sizing:border-box}body{margin:0;background:#10120f;color:#f2f1e6;font-family:Arial,sans-serif}
    main{width:1200px;height:630px;display:grid;grid-template-columns:540px 1fr;padding:0 48px;position:relative}
    .copy{align-self:center;z-index:1}h1{font:700 96px/.95 Barlow,sans-serif;margin:0 0 20px}h2{color:#f5a524;font:700 40px/1.1 Barlow,sans-serif;margin:0 0 32px}
    p{font-size:22px;line-height:1.5;margin:0;color:#b6bcae}.colonies{display:flex;gap:20px;margin-top:40px;font-size:16px}.colonies span{display:flex;align-items:center;gap:8px}.colonies i{width:7px;height:7px;display:inline-block;background:var(--color)}
    .map{align-self:center;width:600px;height:600px;margin-left:-12px;background:radial-gradient(ellipse,#242b2080,transparent 70%)}
    footer{position:absolute;bottom:30px;left:48px;right:48px;padding-top:18px;border-top:1px solid #394032;display:flex;justify-content:space-between;color:#b6bcae;font-size:14px}
  </style><main><div class="copy"><h1>HIVE WARS</h1><h2>Battle for the Comb</h2><p>The swarm built the Comb.<br>Now the colonies fight for it.</p><div class="colonies">${colonies.map(c => `<span><i style="--color:${c.color}"></i>${c.name}</span>`).join('')}</div></div><svg class="map" viewBox="0 0 620 620" aria-label="The 61-territory Comb, in the four colony colors">${hexes}</svg><footer><span>61 territories · 4 colonies · All onchain</span><span>Join a colony. Deploy NECTAR.</span></footer></main></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL('../public/share-card.png', import.meta.url).pathname });
  console.log('Rendered public/share-card.png (1200 × 630). Rebuild to export and hash it.');
} finally { await browser.close(); }
