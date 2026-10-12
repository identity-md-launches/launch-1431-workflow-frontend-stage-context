import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { decodeFunctionData, encodeFunctionResult, parseUnits, type Hex } from 'viem';
import { MockChain, installMock, manifest } from './mock-chain';

const evidence = '../docs/frontend';
async function record(name: string, value: unknown) {
  await mkdir(`${evidence}/screenshots`, { recursive: true });
  await writeFile(`${evidence}/revision-${name}.json`, JSON.stringify({ checkedAt: new Date().toISOString(), value }, null, 2) + '\n');
}

test('phone entry exposes all 61 territories and the selector before scrolling', async ({ page }) => {
  const fixture = new MockChain(); await installMock(page, fixture, false);
  const renders = [];
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.goto('./');
    await expect(page.getByText('Live onchain', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollY,
      scrollWidth: document.documentElement.scrollWidth,
      boxes: Object.fromEntries(['.hero', '#comb', '.hex-map', '#territory-select'].map(s => [s, document.querySelector(s)!.getBoundingClientRect().toJSON()])),
      visibleCells: [...document.querySelectorAll('.hex')].filter(e => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; }).length,
    }));
    renders.push(metrics); await record('phone', renders);
    await page.screenshot({ path: `${evidence}/screenshots/revision-entry-${width}.png` });
    expect(metrics.scrollY).toBe(0); expect(metrics.scrollWidth).toBe(width);
    expect(metrics.visibleCells).toBe(61);
    expect(metrics.boxes['#territory-select'].bottom).toBeLessThanOrEqual(844);
    await expect(page.locator('.hero-story')).toHaveText('The swarm built the Comb.Now the colonies fight for it.');
    await expect(page.locator('.score-row')).toHaveCount(4);
    await expect(page.locator('.site-header').getByRole('button', { name: 'Connect wallet', exact: true })).toBeInViewport();
    await page.locator('.hex').nth(12).click();
    await expect(page.locator('.territory-panel h3')).toHaveText('Territory 12');
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByLabel('Select territory', { exact: true }).selectOption('3');
    await expect(page.locator('.territory-panel h3')).toHaveText('Territory 03');
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  expect(fixture.signed).toHaveLength(0);
});

test('large valid troop totals stay complete inside the narrow army panel', async ({ page }) => {
  const f = new MockChain(); const amount = parseUnits('100000000.5', 18);
  f.colony = 0; f.choiceSeason = 2n; f.deployments[0] = amount; f.pending[0] = amount;
  const original = f.rpc.bind(f);
  f.rpc = async (method, params = []) => {
    if (method === 'eth_call') {
      const call = params[0] as { to: string; data: Hex }; const abi = f.abi(call.to);
      const { functionName } = decodeFunctionData({ abi, data: call.data });
      if (functionName === 'mapState') return encodeFunctionResult({ abi, functionName, result: Array.from({ length: 61 }, (_, i) => ({ controller: i === 0 ? 0 : 4, active: Array(4).fill(i === 0 ? amount : 0n), pending: Array(4).fill(i === 0 ? amount : 0n) })) });
      if (functionName === 'colonyState') return encodeFunctionResult({ abi, functionName, result: { members: [1n, 1n, 1n, 1n], active: Array(4).fill(amount), score: [5n, 0n, 0n, 0n] } });
    }
    return original(method, params);
  };
  await installMock(page, f); await page.setViewportSize({ width: 320, height: 844 }); await page.goto('./');
  await expect(page.getByText('Live onchain', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await expect(page.locator('.army-summary strong')).toHaveText(['100,000,000.5 NECTAR', '100,000,000.5 NECTAR']);
  const renders = [];
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 }); await page.locator('#army').evaluate(el => el.scrollIntoView({ block: 'start' }));
    const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      panel: document.querySelector('.army-main')!.getBoundingClientRect().toJSON(),
      totals: [...document.querySelectorAll('.army-summary strong')].map(e => ({ text: e.textContent, box: e.getBoundingClientRect().toJSON(), fontSize: getComputedStyle(e).fontSize, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth })),
    }));
    renders.push(metrics); await record('army', renders);
    expect(metrics.scrollWidth).toBe(width);
    for (const total of metrics.totals) {
      expect(total.box.left).toBeGreaterThanOrEqual(metrics.panel.left);
      expect(total.box.right).toBeLessThanOrEqual(metrics.panel.right);
      expect(total.scrollWidth).toBeLessThanOrEqual(total.clientWidth);
      expect(parseFloat(total.fontSize)).toBeGreaterThanOrEqual(29.6);
    }
    if (width === 320) {
      expect(metrics.totals[1].box.top).toBeGreaterThan(metrics.totals[0].box.bottom);
      await page.screenshot({ path: `${evidence}/screenshots/revision-army-320.png` });
    }
  }
});

test('swap verification retries recover without a reload and fail closed while checking', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const f = new MockChain(); const rpc = f.rpc.bind(f);
  let failure: 'rpc' | 'empty-code' | 'metadata' | undefined = 'rpc', delayed = false, quoterCalls = 0;
  f.rpc = async (method, params = []) => {
    if (method === 'eth_getCode' && String(params[0]).toLowerCase() === manifest.network.uniswapV4.quoter) {
      quoterCalls++;
      if (delayed) await new Promise(resolve => setTimeout(resolve, 500));
      if (failure === 'rpc') throw { code: -32000, message: 'temporary RPC unavailable' };
      if (failure === 'empty-code') return '0x';
    }
    if (failure === 'metadata' && method === 'eth_call') {
      const call = params[0] as { to: string; data: Hex }; const abi = f.abi(call.to);
      const { functionName } = decodeFunctionData({ abi, data: call.data });
      if (call.to.toLowerCase() === manifest.network.pairToken.address && functionName === 'symbol') return encodeFunctionResult({ abi, functionName, result: 'INVALID' });
    }
    return rpc(method, params);
  };
  await installMock(page, f, false); await page.goto('./');
  await expect(page.getByText('Live onchain', { exact: true })).toBeVisible();
  await page.getByLabel('You pay IMD', { exact: true }).fill('10');
  const retry = page.getByRole('button', { name: 'Retry swap check', exact: true }), quote = page.getByRole('button', { name: 'Get quote', exact: true });
  await expect(retry).toBeEnabled(); await expect(quote).toBeDisabled();
  const initialCalls = quoterCalls;
  await retry.click(); await expect(retry).toBeEnabled(); await expect(quote).toBeDisabled();
  expect(quoterCalls).toBeGreaterThan(initialCalls);
  failure = 'empty-code'; await retry.click();
  await expect(page.locator('.swap-verification')).toContainText('A swap contract has no deployed code');
  await expect(quote).toBeDisabled();
  failure = 'metadata'; await retry.click();
  await expect(page.locator('.swap-verification')).toContainText('Pool token metadata differs from the handoff');
  await expect(quote).toBeDisabled();
  failure = undefined; delayed = true; await retry.click();
  await expect(page.getByRole('button', { name: 'Checking swap…', exact: true })).toBeDisabled();
  await expect(page.locator('.swap-verification')).not.toContainText('Pool token metadata differs');
  await expect(quote).toBeDisabled(); await expect(page.locator('.swap-panel > .button.primary')).toBeDisabled();
  await expect(quote).toBeEnabled(); await expect(retry).toHaveCount(0);
  await quote.click(); await expect(page.getByText('Minimum received:')).toContainText('19.9 NECTAR');
  await page.getByRole('button', { name: 'Sell NECTAR', exact: true }).click();
  await page.getByRole('button', { name: 'Get quote', exact: true }).click();
  await expect(page.getByText('Minimum received:')).toContainText('19.9 IMD');
  expect(f.signed).toHaveLength(0);
  await record('swap', { initialCalls, finalCalls: quoterCalls, failuresChecked: ['RPC unavailable twice', 'missing code', 'metadata mismatch'], quoteRecovered: true, signedTransactions: f.signed.length });
});

test('section hierarchy uses task headings and the shared type scale', async ({ page }) => {
  const f = new MockChain(); await installMock(page, f, false); const renders = [];
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('./');
    await expect(page.getByText('Live onchain', { exact: true })).toBeVisible(); await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('#colonies h2')).toHaveText('Join a colony');
    await expect(page.locator('#war-log h2')).toHaveText('War log and settlements');
    await expect(page.locator('#how-to-play h2')).toHaveText('How to play');
    await expect(page.locator('#colonies .section-heading > p')).toHaveText('Your colony is fixed for this season.');
    await expect(page.locator('.eyebrow')).toHaveCount(0);
    const metrics = await page.evaluate(() => {
      const sizes: Record<string, number> = {};
      for (const e of document.querySelectorAll('body *')) {
        if (!(e instanceof HTMLElement) || e.closest('.hex, .sr-only') || !e.checkVisibility() || ![...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) continue;
        const size = getComputedStyle(e).fontSize; sizes[size] = (sizes[size] ?? 0) + 1;
      }
      return { width: innerWidth, sizes, labels: [...document.querySelectorAll('.tiny-label')].map(e => ({ text: e.textContent, tracking: getComputedStyle(e).letterSpacing, textTransform: getComputedStyle(e).textTransform })), headings: [...document.querySelectorAll('h2, h3')].map(e => ({ tag: e.tagName, size: getComputedStyle(e).fontSize })) };
    });
    renders.push(metrics); await record('design', renders);
    expect(Object.keys(metrics.sizes).length).toBeLessThanOrEqual(6);
    for (const label of metrics.labels) { expect(label.tracking).toMatch(/^(normal|0px)$/); expect(label.textTransform).toBe('none'); }
    for (const heading of metrics.headings) expect(heading.size).toBe(heading.tag === 'H2' ? '32px' : '24px');
  }
});

test('static share metadata points to the inventoried 1200 by 630 card', async ({ page, request }) => {
  const f = new MockChain(); await installMock(page, f, false); await page.goto('./');
  const path = await page.locator('meta[property="og:image"]').getAttribute('content'); expect(path).toBe('./share-card.png');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  expect(await page.locator('meta[property="og:image:alt"]').getAttribute('content')).toContain('Comb');
  const response = await request.get(path!); expect(response.ok()).toBe(true);
  const bytes = await response.body(); expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1200); expect(bytes.readUInt32BE(20)).toBe(630);
  expect(manifest.assets.some((a: { path: string }) => a.path === 'share-card.png')).toBe(true);
});
