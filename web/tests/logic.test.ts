import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeAbiParameters, parseAbiParameters, parseUnits, zeroAddress, type Address } from 'viem';
import { amountInput, contested, controller, coordinates, points } from '../src/domain';
import { encodeSwap, minimumOutput } from '../src/protocol';
import { switchChain, type Provider } from '../src/wallet';
import type { Runtime } from '../src/config';
const manifest = JSON.parse(readFileSync(new URL('../../dist/imd-deployment.json', import.meta.url), 'utf8'));
test('all 61 hex coordinates match radius-4 ring sizes and point totals', () => {
  const coords = Array.from({ length: 61 }, (_, id) => coordinates(id));
  assert.equal(new Set(coords.map(c => c.join(','))).size, 61);
  const rings = [0, 0, 0, 0, 0]; coords.forEach(([q, r]) => rings[Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))]++);
  assert.deepEqual(rings, [1, 6, 12, 18, 24]);
  assert.equal(Array.from({ length: 61 }, (_, i) => points(i)).reduce((a, b) => a + b, 0), 89);
  assert.deepEqual(coordinates(1), [-1, 1]); assert.deepEqual(coordinates(60), [-4, 3]);
});
test('controller ties retain the incumbent, pending can contest a territory', () => {
  assert.equal(controller([100n, 100n, 0n, 0n], 3), 3);
  assert.equal(controller([0n, 0n, 0n, 0n], 4), 4);
  assert.equal(contested({ controller: 0, active: [100n, 0n, 0n, 0n], pending: [0n, 101n, 0n, 0n] }), true);
  assert.equal(contested({ controller: 0, active: [100n, 0n, 0n, 0n], pending: [0n, 100n, 0n, 0n] }), false);
});
test('amounts reject rounding, exponent notation, negatives, zero and uint128 overflow', () => {
  for (const value of ['0', '-1', '1e18', '1.0000001', '.1', ' 1', '340282366920938463463374607431768211456']) assert.equal(amountInput(value, 6), undefined, value);
  assert.equal(amountInput('1.000001', 6), 1000001n);
  assert.equal(amountInput('0.000000000000000001', 18), 1n);
});
test('swap encoding preserves exact hook, token order, router commands and settlement limits', () => {
  const p = manifest.poolKey, amount = parseUnits('10', 18), minimum = 95n;
  for (const extended of [false, true]) {
    const encoded = encodeSwap(p, p.currency1, p.currency0, amount, minimum, extended);
    assert.equal(encoded.commands, '0x10'); assert.equal(encoded.value, 0n);
    const [actions, params] = decodeAbiParameters(parseAbiParameters('bytes,bytes[]'), encoded.inputs[0]);
    assert.equal(actions, '0x060c0f');
    const tuple = extended ? parseAbiParameters('((address,address,uint24,int24,address),bool,uint128,uint128,uint256,bytes)') : parseAbiParameters('((address,address,uint24,int24,address),bool,uint128,uint128,bytes)');
    const [swap] = decodeAbiParameters(tuple, params[0]);
    assert.equal(swap[0][4].toLowerCase(), p.hooks); assert.equal(swap[1], false); assert.equal(swap[2], amount); assert.equal(swap[3], minimum);
    if (extended) assert.equal(swap[4], 0n);
    assert.deepEqual(decodeAbiParameters(parseAbiParameters('address,uint256'), params[1]).map((v: Address | bigint) => typeof v === 'string' ? v.toLowerCase() : v), [p.currency1, amount]);
    assert.deepEqual(decodeAbiParameters(parseAbiParameters('address,uint256'), params[2]).map((v: Address | bigint) => typeof v === 'string' ? v.toLowerCase() : v), [p.currency0, minimum]);
  }
  assert.equal(encodeSwap({ ...p, currency0: zeroAddress }, zeroAddress, p.currency1, amount, minimum).value, amount);
});
test('slippage uses integer arithmetic and rejects unsafe tolerance', () => {
  assert.equal(minimumOutput(10001n, 50), 9950n);
  assert.throws(() => minimumOutput(100n, 0)); assert.throws(() => minimumOutput(100n, 501));
});
test('unknown chain requests exact add-chain configuration, then switches again', async () => {
  const calls: { method: string; params?: unknown[] | object }[] = [];
  const provider: Provider = { request: async args => { calls.push(args); if (calls.length === 1) throw { code: 4902 }; return null; } };
  await switchChain(provider, { manifest } as Runtime);
  assert.deepEqual(calls.map(c => c.method), ['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain']);
  assert.deepEqual(calls[1].params, [manifest.walletAddChain]);
});
test('rejected network switch never adds a chain', async () => {
  const calls: string[] = [];
  await assert.rejects(() => switchChain({ request: async ({ method }) => { calls.push(method); throw { code: 4001 }; } }, { manifest } as Runtime));
  assert.deepEqual(calls, ['wallet_switchEthereumChain']);
});
