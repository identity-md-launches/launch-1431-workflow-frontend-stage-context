import { encodeAbiParameters, parseAbi, parseAbiParameters, zeroAddress, type Address } from 'viem';
import type { PoolKey, Runtime } from './config';

// Protocol interfaces contain no deployment addresses. All targets come from the runtime manifest.
export const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)']);
export const permit2Abi = parseAbi(['function allowance(address,address,address) view returns (uint160 amount, uint48 expiration, uint48 nonce)', 'function approve(address token,address spender,uint160 amount,uint48 expiration)']);
// Error signatures cross-checked against @uniswap/universal-router 2.1.0's UniversalRouter artifact.
export const routerAbi = parseAbi(['function execute(bytes commands,bytes[] inputs,uint256 deadline) payable',
  'error ExecutionFailed(uint256 commandIndex,bytes message)', 'error TransactionDeadlinePassed()',
  'error V4TooLittleReceived(uint256 minAmountOutReceived,uint256 amountReceived)',
  'error V4TooMuchRequested(uint256 maxAmountInRequested,uint256 amountRequested)',
  'error InsufficientBalance()', 'error InsufficientETH()', 'error InsufficientToken()',
]);
export const quoterAbi = parseAbi(['function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)']);
export function swapCurrencies(runtime: Runtime, buy: boolean) {
  const pool = runtime.manifest.poolKey;
  if (!pool) throw Error('This deployment has no attested pool.');
  const token = runtime.contracts.LaunchToken.address;
  const same = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();
  if (!same(pool.currency0, token) && !same(pool.currency1, token)) throw Error('The pool does not contain NECTAR.');
  const pair = same(pool.currency0, token) ? pool.currency1 : pool.currency0;
  const details = [runtime.manifest.network.pairToken, ...(runtime.manifest.network.otherPairTokens ?? [])].find(t => t && same(t.address, pair));
  if (pair !== zeroAddress && !details) throw Error('The paired token is not in the network configuration.');
  const paired = details ?? { address: zeroAddress, ...runtime.manifest.network.nativeCurrency };
  const nectar = { address: token, symbol: 'NECTAR', decimals: 18, name: 'Nectar' };
  const input = buy ? paired : nectar, output = buy ? nectar : paired;
  return { input, output, pool, zeroForOne: same(input.address, pool.currency0) };
}
export function encodeSwap(pool: PoolKey, input: Address, output: Address, amount: bigint, minOut: bigint, extended = false) {
  const tuple = extended
    ? parseAbiParameters('((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)')
    : parseAbiParameters('((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)');
  const swap = { poolKey: pool, zeroForOne: input.toLowerCase() === pool.currency0.toLowerCase(), amountIn: amount, amountOutMinimum: minOut, ...(extended ? { minHopPriceX36: 0n } : {}), hookData: '0x' as const };
  const params = [encodeAbiParameters(tuple, [swap] as never), encodeAbiParameters(parseAbiParameters('address,uint256'), [input, amount]), encodeAbiParameters(parseAbiParameters('address,uint256'), [output, minOut])];
  return { commands: '0x10' as const, inputs: [encodeAbiParameters(parseAbiParameters('bytes,bytes[]'), ['0x060c0f', params])], value: input === zeroAddress ? amount : 0n };
}
export function minimumOutput(quote: bigint, bps: number) {
  if (!Number.isInteger(bps) || bps < 10 || bps > 500) throw Error('Choose slippage between 0.1% and 5%.');
  return quote * BigInt(10000 - bps) / 10000n;
}
