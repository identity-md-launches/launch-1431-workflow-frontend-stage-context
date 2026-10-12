import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { decodeFunctionData, encodeAbiParameters, encodeErrorResult, encodeEventTopics, encodeFunctionResult, parseAbiParameters, parseUnits, toHex, type Abi, type Address, type Hex } from 'viem';
import { erc20Abi, permit2Abi, quoterAbi, routerAbi } from '../src/protocol';

export const manifest = JSON.parse(readFileSync(new URL('../../dist/imd-deployment.json', import.meta.url), 'utf8'));
const contracts = Object.fromEntries(manifest.contracts.map((c: { name: string; address: Address; abiPath: string }) => [c.name, { ...c, abi: JSON.parse(readFileSync(new URL(`../../dist/${c.abiPath}`, import.meta.url), 'utf8')) as Abi }]));
// Deterministic fixture wallet, never a deployment setting or a private key.
export const account = (`0x${'ab'.repeat(20)}`) as Address;
const hash = (n: number) => toHex(n, { size: 32 });
export class MockChain {
  chainId = 1; unknownChain = false; rejectConnect = false; rejectSend = false; rejectSimulation = false; noCode = false; receiptPending = false; callDelay = 0; swapRevert = false;
  signed: { to: Address; data: Hex; value: Hex; fn: string; args: readonly unknown[] }[] = [];
  calls: { method: string; params?: unknown[] }[] = [];
  season = 2n; epoch = 38n; settled = 35n; colony = 4; choiceSeason = 0n;
  balance = parseUnits('5000', 18); gameAllowance = 0n; tokenAllowance = 0n; permitAllowance = 0n; permitExpiration = 0;
  deployments = Array<bigint>(61).fill(0n); pending = Array<bigint>(61).fill(0n); cooldown = 0n; claimable = 0n; nextUnlock = 0n; badgeId = 0n;
  blockNumber = 26177500n; timestamp = BigInt(Math.floor(Date.now() / 1000));
  rpcCalls: string[] = [];
  block() { return { number: toHex(this.blockNumber), hash: hash(200), parentHash: hash(199), timestamp: toHex(this.timestamp), nonce: '0x0000000000000000', sha3Uncles: hash(1), logsBloom: `0x${'00'.repeat(256)}`, transactionsRoot: hash(1), stateRoot: hash(1), receiptsRoot: hash(1), miner: account, difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', size: '0x1', gasLimit: '0x1c9c380', gasUsed: '0x0', transactions: [], uncles: [], baseFeePerGas: '0x1' }; }
  abi(to: string) { const c = Object.values(contracts).find(c => c.address.toLowerCase() === to.toLowerCase()); if (c) return c.abi; const u = manifest.network.uniswapV4; if (to.toLowerCase() === u.permit2) return permit2Abi; if (to.toLowerCase() === u.quoter) return quoterAbi; if (to.toLowerCase() === u.universalRouter) return routerAbi; return erc20Abi; }
  async rpc(method: string, params: unknown[] = []): Promise<unknown> {
    this.rpcCalls.push(method);
    if (this.callDelay) await new Promise(resolve => setTimeout(resolve, this.callDelay));
    if (method === 'eth_chainId') return '0x1';
    if (method === 'eth_blockNumber') return toHex(this.blockNumber);
    if (method === 'eth_getBlockByNumber' || method === 'eth_getBlockByHash') return this.block();
    if (method === 'eth_getCode') return this.noCode ? '0x' : '0x60006000';
    if (method === 'eth_getBalance') return toHex(parseUnits('10', 18));
    if (method === 'eth_getTransactionCount') return '0x1';
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_estimateGas') return '0x100000';
    if (method === 'eth_getTransactionReceipt') return this.receiptPending ? null : { transactionHash: params[0], transactionIndex: '0x0', blockHash: hash(200), blockNumber: toHex(this.blockNumber), from: account, to: this.signed.at(-1)?.to ?? contracts.HiveWars.address, cumulativeGasUsed: '0x5208', gasUsed: '0x5208', contractAddress: null, logs: [], logsBloom: `0x${'00'.repeat(256)}`, status: '0x1', effectiveGasPrice: '0x1', type: '0x2' };
    if (method === 'eth_getTransactionByHash') return { hash: params[0], from: account, to: contracts.HiveWars.address, blockHash: hash(200), blockNumber: toHex(this.blockNumber), transactionIndex: '0x0', input: '0x', value: '0x0', nonce: '0x0', gas: '0x5208', gasPrice: '0x1', type: '0x0', v: '0x1b', r: hash(1), s: hash(1) };
    if (method === 'eth_getLogs') {
      const filter = params[0] as { fromBlock: string; toBlock: string };
      if (BigInt(filter.toBlock) < this.blockNumber - 1n) return [];
      return [
        { address: contracts.HiveWars.address, topics: encodeEventTopics({ abi: contracts.HiveWars.abi, eventName: 'TerritoryCaptured', args: { territory: 0 } }), data: encodeAbiParameters(parseAbiParameters('uint8,uint8'), [4, 3]), logIndex: '0x0' },
        { address: contracts.HiveWars.address, topics: encodeEventTopics({ abi: contracts.HiveWars.abi, eventName: 'Settled', args: { epoch: this.settled } }), data: encodeAbiParameters(parseAbiParameters('uint8[4]'), [[12, 9, 10, 19]]), logIndex: '0x1' },
      ].map(log => ({ ...log, blockHash: hash(199), blockNumber: toHex(this.blockNumber - 1n), transactionHash: hash(90), transactionIndex: '0x0', removed: false }));
    }
    if (method === 'eth_call') {
      const call = params[0] as { to: Address; data: Hex }; const abi = this.abi(call.to); const decoded = decodeFunctionData({ abi, data: call.data });
      const fn = decoded.functionName, args = (decoded.args ?? []) as readonly unknown[];
      const token = call.to.toLowerCase() === contracts.LaunchToken.address;
      let result: unknown;
      switch (fn) {
        case 'nectarToken': result = contracts.LaunchToken.address; break;
        case 'hiveWars': result = contracts.HiveWars.address; break;
        case 'decimals': result = 18; break;
        case 'symbol': result = token ? 'NECTAR' : 'IMD'; break;
        case 'name': result = token ? 'Nectar' : 'Identity.md'; break;
        case 'balanceOf': result = this.balance; break;
        case 'allowance': result = call.to.toLowerCase() === manifest.network.uniswapV4.permit2 ? [this.permitAllowance, this.permitExpiration, 0] : String(args[1]).toLowerCase() === contracts.HiveWars.address ? this.gameAllowance : this.tokenAllowance; break;
        case 'mapState': result = Array.from({ length: 61 }, (_, i) => ({ controller: i === 0 ? 3 : i % 7 < 4 ? i % 4 : 4, active: [parseUnits(String((i % 5 + 1) * 130), 18), parseUnits('70', 18), parseUnits('140', 18), i === 0 ? parseUnits('1200', 18) : parseUnits('90', 18)], pending: i % 11 === 0 ? [0n, parseUnits('2000', 18), 0n, 0n] : [0n, 0n, 0n, 0n] })); break;
        case 'colonyState': result = { members: [32n, 18n, 24n, 41n], active: [parseUnits('24400', 18), parseUnits('17000', 18), parseUnits('20200', 18), parseUnits('31900', 18)], score: [182n, 136n, 155n, 224n] }; break;
        case 'seasonInfo': result = { season: this.season, epoch: this.epoch, epochInSeason: 8n, secondsLeft: 48362n, seasonSecondsLeft: 1949762n, lastSettled: this.settled, pastWinners: [0] }; break;
        case 'playerState': result = { colony: this.colony, choiceSeason: this.choiceSeason, deployments: this.deployments, pending: this.pending, totalActive: this.deployments.reduce((a, b) => a + b, 0n), totalPending: this.pending.reduce((a, b) => a + b, 0n), cooldown: this.cooldown, nextUnlock: this.nextUnlock, claimable: this.claimable, eligibleEpochs: 7n }; break;
        case 'keeperSettlements': result = this.settled; break;
        case 'isEligible': result = args[1] === 1n; break;
        case 'badgeOf': result = this.badgeId; break;
        case 'tokenURI': {
          const image = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#171b15"/><path d="M256 32 450 140v230L256 480 62 370V140Z" fill="#f5a524"/><text x="256" y="245" text-anchor="middle" font-size="25">SEASON 1 CONQUEROR</text></svg>').toString('base64')}`;
          result = `data:application/json;base64,${Buffer.from(JSON.stringify({ name: 'SEASON 1 CONQUEROR', image })).toString('base64')}`; break;
        }
        case 'quoteExactInputSingle': result = [(args[0] as { exactAmount: bigint }).exactAmount * 2n, 120000n]; break;
        case 'approve': result = call.to.toLowerCase() === manifest.network.uniswapV4.permit2 ? undefined : true; break;
        case 'transfer': case 'transferFrom': result = true; break;
        case 'claim': result = 1n; break;
        case 'joinColony': case 'deploy': case 'move': case 'retreat': case 'claimRetreat': case 'settleEpoch': case 'execute': result = undefined; break;
        default: throw Error(`Unhandled fixture contract read ${fn}`);
      }
      if (this.rejectSimulation && ['deploy', 'move', 'retreat', 'execute'].includes(fn)) throw { code: 3, message: 'execution reverted', data: encodeErrorResult({ abi: contracts.HiveWars.abi, errorName: 'InsufficientStake' }) };
      if (this.swapRevert && fn === 'execute') throw { code: 3, message: 'execution reverted', data: encodeErrorResult({ abi: routerAbi, errorName: 'ExecutionFailed', args: [0n, encodeErrorResult({ abi: routerAbi, errorName: 'V4TooLittleReceived', args: [200n, 100n] })] }) };
      return encodeFunctionResult({ abi, functionName: fn, result } as never);
    }
    throw Error(`Unhandled mock RPC ${method}`);
  }
  async wallet(method: string, params: unknown[] = []) {
    this.calls.push({ method, params });
    if (method === 'eth_requestAccounts') { if (this.rejectConnect) throw { code: 4001, message: 'User rejected' }; return [account]; }
    if (method === 'eth_accounts') return [account];
    if (method === 'eth_chainId') return toHex(this.chainId);
    if (method === 'wallet_switchEthereumChain') { if (this.unknownChain) throw { code: 4902, message: 'Unknown chain' }; this.chainId = manifest.chainId; return null; }
    if (method === 'wallet_addEthereumChain') { this.unknownChain = false; return null; }
    if (method === 'eth_sendTransaction') {
      if (this.rejectSend) throw { code: 4001, message: 'User rejected request' };
      const call = params[0] as { to: Address; data: Hex; value: Hex }; const { functionName: fn, args: originalArgs } = decodeFunctionData({ abi: this.abi(call.to), data: call.data });
      const args = (originalArgs ?? []) as readonly unknown[];
      this.signed.push({ ...call, fn, args });
      if (fn === 'joinColony') { this.colony = Number(args[0]); this.choiceSeason = this.season; }
      if (fn === 'approve') {
        if (call.to.toLowerCase() === manifest.network.uniswapV4.permit2) { this.permitAllowance = args[2] as bigint; this.permitExpiration = Number(args[3]); }
        else if (String(args[0]).toLowerCase() === contracts.HiveWars.address) this.gameAllowance = args[1] as bigint;
        else this.tokenAllowance = args[1] as bigint;
      }
      if (fn === 'deploy') { this.pending[Number(args[0])] += args[1] as bigint; this.balance -= args[1] as bigint; this.gameAllowance -= args[1] as bigint; }
      if (fn === 'move') { this.pending[Number(args[0])] -= args[2] as bigint; this.pending[Number(args[1])] += args[2] as bigint; }
      if (fn === 'retreat') { this.pending[Number(args[0])] -= args[1] as bigint; this.cooldown += args[1] as bigint; this.nextUnlock = this.timestamp + 86400n; }
      if (fn === 'claimRetreat') { this.balance += this.claimable; this.cooldown -= this.claimable; this.claimable = 0n; }
      if (fn === 'settleEpoch') this.settled++;
      if (fn === 'claim') this.badgeId = 1n;
      return hash(this.signed.length);
    }
    throw Error(`Unhandled wallet method ${method}`);
  }
}
export async function installMock(page: Page, fixture: MockChain, wallet = true) {
  await page.route(/https:\/\/(ethereum-rpc\.publicnode\.com|eth\.drpc\.org)\/?$/, async route => {
    const body = route.request().postDataJSON();
    const one = async (r: { id: number; method: string; params?: unknown[] }) => {
      try { return { id: r.id, jsonrpc: '2.0', result: await fixture.rpc(r.method, r.params) }; }
      catch (e) { const error = e as { code?: number; message?: string; data?: string }; return { id: r.id, jsonrpc: '2.0', error: { code: error.code ?? -32000, message: error.message ?? 'Fixture error', data: error.data } }; }
    };
    const result = Array.isArray(body) ? await Promise.all(body.map(one)) : await one(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  if (!wallet) return;
  await page.exposeFunction('fixtureWallet', async (method: string, params: unknown[]) => {
    try { return { result: await fixture.wallet(method, params) }; } catch (error) { return { error }; }
  });
  await page.addInitScript(() => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const w = window as unknown as { ethereum: unknown; fixtureWallet: (method: string, params?: unknown[]) => Promise<{ result: unknown; error?: { message?: string; code?: number } }>; emitFixture: (event: string, args: unknown) => void };
    w.ethereum = { request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      const reply = await w.fixtureWallet(method, params);
      if (reply.error) throw Object.assign(new Error(reply.error.message), reply.error);
      return reply.result;
    }, on: (event: string, fn: (...args: unknown[]) => void) => { (listeners[event] ??= []).push(fn); }, removeListener: (event: string, fn: (...args: unknown[]) => void) => { listeners[event] = listeners[event]?.filter(f => f !== fn); } };
    w.emitFixture = (event, args) => listeners[event]?.forEach(fn => fn(args));
  });
}
