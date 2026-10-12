import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { decodeAbiParameters, parseAbiParameters, parseUnits } from 'viem';
import { MockChain, installMock, manifest } from './mock-chain';

test('static subpath, missing wallet, disconnected actions and deployment failure', async ({ page }) => {
  const fixture = new MockChain(); await installMock(page, fixture, false);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByText('Live onchain', { exact: true })).toBeVisible();
  await expect(page.locator('.hex')).toHaveCount(61);
  await expect(page.getByRole('button', { name: 'Join Amber', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await expect(page.getByText(/No browser wallet found/)).toBeVisible();
  expect(errors).toEqual([]);
  expect(fixture.signed).toHaveLength(0);
  const localFailures = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/preview/')).map(e => e.name));
  expect(localFailures.some(u => u.includes('/preview/abi/'))).toBeTruthy();
});

test('wrong network adds unknown chain and switches, with one recovery action', async ({ page }) => {
  const fixture = new MockChain(); fixture.chainId = 10; fixture.unknownChain = true; await installMock(page, fixture);
  await page.goto('./'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Join Amber', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Switch to Ethereum', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Join Amber', exact: true })).toBeEnabled();
  const calls = fixture.calls.filter(c => /wallet_/.test(c.method));
  expect(calls.map(c => c.method)).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain']);
  expect(calls[1].params).toEqual([manifest.walletAddChain]);
});

test('wallet rejection is recoverable, joining locks the colony through receipt', async ({ page }) => {
  const fixture = new MockChain(); await installMock(page, fixture); await page.goto('./');
  fixture.rejectConnect = true; await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await expect(page.getByText('Request declined in your wallet. You can try again when ready.')).toBeVisible();
  fixture.rejectConnect = false; await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  fixture.rejectSend = true; await page.getByRole('button', { name: 'Join Amber', exact: true }).click();
  await expect(page.locator('#colonies').getByText('Request declined in your wallet. You can try again when ready.')).toBeVisible();
  fixture.rejectSend = false; fixture.receiptPending = true; await page.getByRole('button', { name: 'Join Amber', exact: true }).click();
  await expect(page.locator('#colonies').getByText(/Transaction sent/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join Crimson', exact: true })).toBeDisabled();
  fixture.receiptPending = false; fixture.blockNumber++;
  await expect(page.getByRole('button', { name: 'Your colony · locked', exact: true })).toBeVisible();
  await expect(page.locator('#colonies').getByText(/Confirmed onchain/)).toBeVisible();
  expect(fixture.signed).toHaveLength(1);
});

test('deploy approval, deploy, move, retreat and mature claim use real ABI calldata', async ({ page }) => {
  const f = new MockChain(); f.colony = 0; f.choiceSeason = 2n; await installMock(page, f); await page.goto('./');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByLabel('Amount NECTAR', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Approve NECTAR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Deploy troops', exact: true })).toBeEnabled();
  expect(f.signed[0].args[0]).toEqual(expect.stringMatching(new RegExp(manifest.contracts.find((c: { name: string }) => c.name === 'HiveWars').address, 'i')));
  expect(f.signed[0].args[1]).toBe(parseUnits('100', 18));
  await page.getByRole('button', { name: 'Deploy troops', exact: true }).click();
  await expect(page.locator('#army')).toContainText('100');
  await expect(page.locator('.territory-panel').getByText(/Confirmed onchain/)).toBeVisible();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByLabel('Amount NECTAR', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Move troops', exact: true }).click();
  await expect(page.locator('.territory-panel').getByText(/Confirmed onchain/)).toBeVisible();
  await page.getByRole('button', { name: 'Retreat', exact: true }).click();
  await page.getByRole('button', { name: 'Start retreat', exact: true }).click();
  await expect(page.getByText(/Next unlock in/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim retreat', exact: true })).toBeDisabled();
  f.claimable = f.cooldown; f.nextUnlock = f.timestamp - 1n;
  await expect(page.getByRole('button', { name: 'Claim retreat', exact: true })).toBeEnabled({ timeout: 15000 });
  await page.getByRole('button', { name: 'Claim retreat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Claim retreat', exact: true })).toBeDisabled();
  expect(f.signed.map(t => t.fn)).toEqual(['approve', 'deploy', 'move', 'retreat', 'claimRetreat']);
  expect(f.signed[2].args).toEqual([0, 1, parseUnits('25', 18)]);
});

test('simulation revert blocks wallet signing and invalid values cannot be sent', async ({ page }) => {
  const f = new MockChain(); f.colony = 0; f.gameAllowance = parseUnits('5000', 18); f.rejectSimulation = true; await installMock(page, f); await page.goto('./');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  const field = page.getByLabel('Amount NECTAR', { exact: true });
  await field.fill('1e3'); await expect(page.getByRole('button', { name: 'Deploy troops', exact: true })).toBeDisabled();
  await field.fill('10000'); await expect(field).toHaveAttribute('aria-invalid', 'true');
  await field.fill('100'); await page.getByRole('button', { name: 'Deploy troops', exact: true }).click();
  await expect(page.locator('.territory-panel').getByText(/This territory has less of your stake/)).toBeVisible();
  expect(f.signed).toHaveLength(0);
});

test('buy quote, both explicit approvals and router swap preserve pool key and no ETH value', async ({ page }) => {
  const f = new MockChain(); await installMock(page, f); await page.goto('./'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByLabel('You pay IMD', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Get quote', exact: true }).click();
  await expect(page.getByText('Minimum received:')).toContainText('19.9 NECTAR');
  await page.getByRole('button', { name: 'Approve IMD', exact: true }).click();
  await page.getByRole('button', { name: 'Approve router in Permit2', exact: true }).click();
  await page.getByRole('button', { name: 'Swap tokens', exact: true }).click();
  await expect(page.locator('.swap-panel').getByText(/Confirmed onchain/)).toBeVisible();
  expect(f.signed.map(t => t.fn)).toEqual(['approve', 'approve', 'execute']);
  expect(f.signed[0].to).toBe(manifest.network.pairToken.address);
  expect(String(f.signed[0].args[0]).toLowerCase()).toBe(manifest.network.uniswapV4.permit2);
  expect(f.signed[1].to).toBe(manifest.network.uniswapV4.permit2);
  expect(String(f.signed[1].args[1]).toLowerCase()).toBe(manifest.network.uniswapV4.universalRouter);
  const swap = f.signed[2]; expect(swap.to).toBe(manifest.network.uniswapV4.universalRouter); expect(swap.value).toBe('0x0'); expect(swap.args[0]).toBe('0x10');
  const [actions, params] = decodeAbiParameters(parseAbiParameters('bytes,bytes[]'), (swap.args[1] as readonly `0x${string}`[])[0]);
  expect(actions).toBe('0x060c0f');
  const [input] = decodeAbiParameters(parseAbiParameters('((address,address,uint24,int24,address),bool,uint128,uint128,bytes)'), params[0]);
  expect(input[0][4].toLowerCase()).toBe(manifest.poolKey.hooks); expect(input[1]).toBe(false); expect(input[3]).toBe(parseUnits('19.9', 18));
  await page.getByRole('button', { name: 'Sell NECTAR', exact: true }).click();
  await expect(page.getByLabel('You pay NECTAR', { exact: true })).toBeVisible();
  await expect(page.locator('.swap-panel > .button.primary')).toBeDisabled();
  await page.getByRole('button', { name: 'Get quote', exact: true }).click();
  await page.getByRole('button', { name: 'Swap tokens', exact: true }).click();
  await expect(page.locator('.swap-panel').getByText(/Confirmed onchain/)).toBeVisible();
  const [, sellParams] = decodeAbiParameters(parseAbiParameters('bytes,bytes[]'), (f.signed[3].args[1] as readonly `0x${string}`[])[0]);
  const [sellInput] = decodeAbiParameters(parseAbiParameters('((address,address,uint24,int24,address),bool,uint128,uint128,bytes)'), sellParams[0]);
  expect(sellInput[1]).toBe(true);
});

test('settle, real event decoding, keeper ranking and badge claim/metadata', async ({ page }) => {
  const f = new MockChain(); await installMock(page, f); await page.goto('./'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await expect(page.getByText('Crimson seized The Core')).toBeVisible();
  await page.getByRole('button', { name: 'Settle epoch', exact: true }).click();
  await expect(page.locator('.keeper-panel').getByText(/Confirmed onchain/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim badge', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Claim badge', exact: true }).click();
  await expect(page.getByRole('img', { name: 'SEASON 1 CONQUEROR', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claim badge', exact: true })).toBeDisabled();
  expect(f.signed.map(t => t.fn)).toEqual(['settleEpoch', 'claim']);
});

test('manifest ABI tampering and empty deployed code fail closed', async ({ page }) => {
  const f = new MockChain(); await installMock(page, f);
  await page.route('**/abi/HiveWars.json', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.goto('./'); await expect(page.getByText(/ABI does not match the deployment/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deploy troops', exact: true })).toHaveCount(0);
  await page.unroute('**/abi/HiveWars.json'); f.noCode = true; await page.reload();
  await expect(page.getByText(/A deployed contract has no code/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join Amber', exact: true })).toBeDisabled();
});

test('responsive render, accessibility, keyboard map and reduced motion', async ({ page }) => {
  const f = new MockChain(); f.colony = 0; f.choiceSeason = 2n; f.deployments[0] = parseUnits('1500', 18); f.pending[7] = parseUnits('200', 18); await installMock(page, f);
  const errors: string[] = [], failures: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.url().includes('/preview/') && r.status() >= 400) failures.push(`${r.status()} ${r.url()}`); });
  await page.goto('./'); await expect(page.getByText('Live onchain', { exact: true })).toBeVisible();
  await page.keyboard.press('Tab'); await expect(page.locator('.skip-link')).toBeFocused();
  expect(await page.locator('.skip-link').evaluate(el => getComputedStyle(el).clipPath)).toBe('none');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Your colony · locked', exact: true })).toBeVisible();
  await page.locator('.hex').nth(12).focus(); await page.keyboard.press('Enter'); await expect(page.locator('.territory-panel h3')).toHaveText('Territory 12');
  await expect(page.locator('.hex').nth(12)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Home'); await expect(page.locator('.territory-panel h3')).toHaveText('The Core');
  await page.keyboard.press('ArrowRight'); await expect(page.locator('.hex.selected')).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.hex.contested polygon').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.locator('.hex').first().click(); await page.evaluate(() => window.scrollTo(0, 0));
  await mkdir('../docs/frontend/screenshots', { recursive: true });
  const renders = [];
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 800]]) {
    await page.setViewportSize({ width, height }); await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `../docs/frontend/screenshots/mock-${width}.png`, fullPage: width === 1440 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    renders.push({ width, height, overflow });
    if (width === 390 || width === 320) {
      await page.locator('#comb').scrollIntoViewIfNeeded();
      await page.locator('#comb').screenshot({ path: `../docs/frontend/screenshots/mock-map-${width}.png` });
      await page.getByLabel('Select territory', { exact: true }).selectOption('3');
      await expect(page.locator('.territory-panel h3')).toHaveText('Territory 03');
      await page.getByLabel('Amount NECTAR', { exact: true }).fill('10');
      await expect(page.locator('.territory-panel > .button.primary')).toBeEnabled();
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const computed = await page.evaluate(() => {
    function pair(selector: string, background: string) {
      const foreground = getComputedStyle(document.querySelector(selector)!).color;
      const ctx = document.createElement('canvas').getContext('2d')!;
      function rgb(color: string) { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3); }
      function luminance(color: string) { const [r,g,b] = rgb(color).map(c => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126*r + .7152*g + .0722*b; }
      const a = luminance(foreground), b = luminance(background);
      return { selector, foreground, background, ratio: Math.round((Math.max(a,b)+.05)/(Math.min(a,b)+.05)*100)/100 };
    }
    const surface = getComputedStyle(document.querySelector('.season-panel')!).backgroundColor;
    const bg = getComputedStyle(document.documentElement).backgroundColor;
    const selectedFill = getComputedStyle(document.querySelector('.hex.selected polygon')!).fill;
    return { fonts: ['Barlow Condensed', 'IBM Plex Mono'].map(font => ({ font, loaded: document.fonts.check(`16px "${font}"`) })), contrast: [pair('.hero-story', bg), pair('.hero-description', bg), pair('.season-panel .eyebrow', surface), pair('.hero-actions .primary', getComputedStyle(document.querySelector('.hero-actions .primary')!).backgroundColor), pair('.hex.selected .hex-id', selectedFill), ...Array.from(document.querySelectorAll('.hex:not(.selected)')).slice(0, 6).map(el => pair(`.hex[aria-label="${el.getAttribute('aria-label')}"] .hex-id`, getComputedStyle(el.querySelector('polygon')!).fill))] };
  });
  await writeFile('../docs/frontend/accessibility-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), fixture: 'mocked chain, connected wallet', violations: axe.violations, incomplete: axe.incomplete.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodeCount: v.nodes.length, examples: v.nodes.slice(0, 4).map(n => ({ target: n.target, failureSummary: n.failureSummary })) })), passes: axe.passes.length, renders, computed }, null, 2));
  expect(computed.fonts.every(f => f.loaded)).toBe(true);
  expect(computed.contrast.every(p => p.ratio >= 4.5)).toBe(true);
  expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test('RPC fallback, account/network changes and expired quotes disable unsafe actions', async ({ page }) => {
  const f = new MockChain(); f.colony = 0; f.choiceSeason = 2n; await installMock(page, f);
  await page.route('https://ethereum-rpc.publicnode.com', route => route.abort('failed'));
  await page.goto('./'); await expect(page.getByText('Live onchain', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByLabel('You pay IMD', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Get quote', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve IMD', exact: true })).toBeEnabled();
  await page.clock.install(); await page.clock.fastForward(61000);
  await expect(page.getByText('Quote expired. Refresh before continuing.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve IMD', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { emitFixture: (e: string, args: unknown) => void }).emitFixture('chainChanged', '0xa'));
  await expect(page.getByRole('button', { name: 'Switch to Ethereum', exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { emitFixture: (e: string, args: unknown) => void }).emitFixture('accountsChanged', []));
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true }).first()).toBeVisible();
  expect(f.signed).toHaveLength(0);
});

test('live public RPC reads render deployed state without a wallet', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('./'); await expect(page.getByText('Live onchain', { exact: true })).toBeVisible({ timeout: 45000 });
  await expect(page.locator('.hex')).toHaveCount(61); await expect(page.getByRole('button', { name: 'Join Amber', exact: true })).toBeDisabled();
  await page.screenshot({ path: '../docs/frontend/screenshots/live-desktop.png', fullPage: false });
});

test('router nested revert is explained before signing; direct NECTAR transfer validates recipient', async ({ page }) => {
  const f = new MockChain(); f.tokenAllowance = parseUnits('100', 18); f.permitAllowance = parseUnits('100', 18); f.permitExpiration = Number(f.timestamp) + 3600; f.swapRevert = true;
  await installMock(page, f); await page.goto('./'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByLabel('You pay IMD', { exact: true }).fill('10'); await page.getByRole('button', { name: 'Get quote', exact: true }).click();
  await page.getByRole('button', { name: 'Swap tokens', exact: true }).click();
  await expect(page.getByText('The pool cannot meet your minimum output. Refresh your quote or choose a smaller amount.')).toBeVisible();
  expect(f.signed).toHaveLength(0);
  await page.getByText('Send NECTAR to another wallet', { exact: true }).click();
  await page.getByLabel('Recipient address', { exact: true }).fill('not-an-address');
  await page.getByLabel('Amount (NECTAR)', { exact: true }).fill('5');
  await expect(page.getByRole('button', { name: 'Send NECTAR', exact: true })).toBeDisabled();
  await page.getByLabel('Recipient address', { exact: true }).fill(manifest.contracts[1].address);
  await page.getByRole('button', { name: 'Send NECTAR', exact: true }).click();
  await expect(page.locator('.transfer').getByText(/Confirmed onchain/)).toBeVisible();
  expect(f.signed[0].fn).toBe('transfer'); expect(f.signed[0].args[1]).toBe(parseUnits('5', 18));
});
