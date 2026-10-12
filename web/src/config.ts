import { createPublicClient, defineChain, fallback, http, isAddress, keccak256, toBytes, type Abi, type Address } from 'viem';

export type ContractName = 'LaunchToken' | 'HiveWars' | 'ConquerorBadge';
export type PoolKey = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };
export type PairToken = { address: Address; symbol: string; name: string; decimals: number };
export interface Deployment {
  version: 1; launchId: string; chainId: number; sourceCommit: string; attestationHash: string;
  contracts: { name: ContractName; address: Address; abiHash: string; abiPath: string }[];
  assets: { path: string; sha256: string }[];
  poolKey?: PoolKey;
  network: {
    chainId: number; name: string; testnet: boolean; rpcUrls: string[]; explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number }; faucets: string[];
    pairToken?: PairToken; otherPairTokens?: PairToken[];
    uniswapV4: { poolManager: Address; universalRouter: Address; quoter: Address; stateView: Address; positionManager: Address; permit2: Address; extendedSwapParams?: boolean };
  };
  walletAddChain?: { chainId: string; chainName: string; rpcUrls: string[]; nativeCurrency: Deployment['network']['nativeCurrency']; blockExplorerUrls: string[] };
}
export function canonical(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v !== null && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(sort(value));
}
export function safePath(path: string) {
  return /^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').includes('..');
}
export async function loadConfig() {
  const response = await fetch(new URL('./imd-deployment.json', document.baseURI), { cache: 'no-cache' });
  if (!response.ok) throw Error('Deployment configuration could not be loaded. Reload this page.');
  const manifest = await response.json() as Deployment;
  const allowed = ['version', 'launchId', 'chainId', 'sourceCommit', 'attestationHash', 'contracts', 'assets', 'poolKey', 'network', 'walletAddChain'];
  if (Object.keys(manifest).some(k => !allowed.includes(k)) || manifest.version !== 1 || manifest.chainId !== manifest.network?.chainId)
    throw Error('Deployment configuration is invalid. Transactions are disabled.');
  if (manifest.contracts.length !== 3 || new Set(manifest.contracts.map(c => c.name)).size !== 3 || !['LaunchToken', 'HiveWars', 'ConquerorBadge'].every(n => manifest.contracts.some(c => c.name === n))) throw Error('The deployment contract set is incomplete.');
  if (!manifest.network.rpcUrls.length || manifest.network.rpcUrls.some(u => !u.startsWith('https://'))) throw Error('Public RPC configuration is invalid.');
  const loaded = await Promise.all(manifest.contracts.map(async c => {
    if (!isAddress(c.address) || !safePath(c.abiPath)) throw Error(`Invalid deployment entry for ${c.name}.`);
    const response = await fetch(new URL(c.abiPath, document.baseURI));
    if (!response.ok) throw Error(`Unable to load ${c.name}'s ABI. Reload this page.`);
    const abi = await response.json() as Abi;
    if (!Array.isArray(abi) || keccak256(toBytes(canonical(abi))).slice(2) !== c.abiHash) throw Error(`${c.name}'s ABI does not match the deployment. Transactions are disabled.`);
    return [c.name, { ...c, abi }] as const;
  }));
  const contracts = Object.fromEntries(loaded) as unknown as Record<ContractName, { address: Address; abi: Abi; abiHash: string; abiPath: string; name: ContractName }>;
  const chain = defineChain({ id: manifest.chainId, name: manifest.network.name, nativeCurrency: manifest.network.nativeCurrency,
    rpcUrls: { default: { http: manifest.network.rpcUrls } }, blockExplorers: { default: { name: 'Explorer', url: manifest.network.explorer } } });
  const client = createPublicClient({ chain, transport: fallback(manifest.network.rpcUrls.map(url => http(url, { batch: { wait: 20 }, timeout: 12000, retryCount: 1 })), { rank: false }) });
  return { manifest, contracts, chain, client };
}
export type Runtime = Awaited<ReturnType<typeof loadConfig>>;
export async function verifyDeployment(runtime: Runtime) {
  const { client, manifest, contracts } = runtime;
  if (await client.getChainId() !== manifest.chainId) throw Error('The public RPC is on the wrong chain. Transactions are disabled.');
  const codes = await Promise.all(Object.values(contracts).map(c => client.getCode({ address: c.address })));
  if (codes.some(c => !c || c === '0x')) throw Error('A deployed contract has no code at the configured address. Transactions are disabled.');
  const [token, game] = await Promise.all([
    client.readContract({ ...contracts.HiveWars, functionName: 'nectarToken' }),
    client.readContract({ ...contracts.ConquerorBadge, functionName: 'hiveWars' }),
  ]);
  if (String(token).toLowerCase() !== contracts.LaunchToken.address.toLowerCase() || String(game).toLowerCase() !== contracts.HiveWars.address.toLowerCase()) throw Error('The deployed contract bindings do not match the handoff. Transactions are disabled.');
}
