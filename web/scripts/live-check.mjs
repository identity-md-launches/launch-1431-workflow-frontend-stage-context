// Read-only verification. This script never requests a wallet or sends transactions.
import { readFile, writeFile } from 'node:fs/promises';
import { createPublicClient, http, keccak256, parseUnits } from 'viem';
import { quoterAbi } from '../src/protocol.ts';
const manifest = JSON.parse(await readFile(new URL('../../dist/imd-deployment.json', import.meta.url), 'utf8'));
const report = { checkedAt: new Date().toISOString(), kind: 'read-only RPC verification', attempts: [], result: undefined };
for (const url of manifest.network.rpcUrls) {
  const client = createPublicClient({ transport: http(url, { timeout: 15000, retryCount: 0, batch: { wait: 20 } }) });
  try {
    const chainId = await client.getChainId();
    if (chainId !== manifest.chainId) throw Error(`Wrong RPC chain: ${chainId}`);
    const block = await client.getBlockNumber();
    const contracts = await Promise.all(manifest.contracts.map(async c => {
      const code = await client.getCode({ address: c.address, blockNumber: block });
      if (!code || code === '0x') throw Error(`${c.name} has no code`);
      return { name: c.name, address: c.address, codeBytes: (code.length - 2) / 2, codeKeccak256: keccak256(code) };
    }));
    const read = async (name, functionName, args = []) => {
      const c = manifest.contracts.find(c => c.name === name);
      const abi = JSON.parse(await readFile(new URL(`../../dist/${c.abiPath}`, import.meta.url), 'utf8'));
      return client.readContract({ address: c.address, abi, functionName, args, blockNumber: block });
    };
    const [nectarToken, hiveWars, decimals, symbol, season, map, colonies] = await Promise.all([
      read('HiveWars', 'nectarToken'), read('ConquerorBadge', 'hiveWars'), read('LaunchToken', 'decimals'), read('LaunchToken', 'symbol'),
      read('HiveWars', 'seasonInfo'), read('HiveWars', 'mapState'), read('HiveWars', 'colonyState'),
    ]);
    if (nectarToken.toLowerCase() !== manifest.contracts.find(c => c.name === 'LaunchToken').address || hiveWars.toLowerCase() !== manifest.contracts.find(c => c.name === 'HiveWars').address) throw Error('Contract binding mismatch');
    report.attempts.push({ url, ok: true });
    const protocolCode = await Promise.all(Object.entries(manifest.network.uniswapV4).filter(([, value]) => typeof value === 'string').map(async ([name, address]) => {
      const code = await client.getCode({ address, blockNumber: block });
      return { name, address, codeBytes: code ? (code.length - 2) / 2 : 0 };
    }));
    const quotes = [];
    for (const zeroForOne of [false, true]) {
      try {
        const quote = await client.simulateContract({ address: manifest.network.uniswapV4.quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle', args: [{ poolKey: manifest.poolKey, zeroForOne, exactAmount: parseUnits('1', 18), hookData: '0x' }], blockNumber: block });
        quotes.push({ direction: zeroForOne ? 'NECTAR to IMD' : 'IMD to NECTAR', inputBaseUnits: parseUnits('1', 18), outputBaseUnits: quote.result[0], ok: true });
      } catch (error) { quotes.push({ direction: zeroForOne ? 'NECTAR to IMD' : 'IMD to NECTAR', ok: false, error: error.shortMessage ?? error.message }); }
    }
    report.result = { chainId, block: block.toString(), contracts, nectarToken, hiveWars, decimals, symbol, season, territories: map.length, colonies, protocolCode, quotes };
    break;
  } catch (error) { report.attempts.push({ url, ok: false, error: error.shortMessage ?? error.message }); }
}
const serialized = JSON.stringify(report, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n';
await writeFile(new URL('../../docs/frontend/live-rpc-check.json', import.meta.url), serialized);
console.log(serialized);
if (!report.result) process.exitCode = 1;
