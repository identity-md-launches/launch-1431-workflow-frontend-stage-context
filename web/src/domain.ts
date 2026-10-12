import { BaseError, ContractFunctionRevertedError, decodeErrorResult, formatUnits, parseUnits, type Hex } from 'viem';
import { routerAbi } from './protocol';

export const colonies = [
  { name: 'Amber', color: '#F5A524', mark: 'A', motto: 'Strength in numbers.' },
  { name: 'Obsidian', color: '#8B8BA7', mark: 'O', motto: 'Hold. Endure. Outlast.' },
  { name: 'Jade', color: '#2BB673', mark: 'J', motto: 'Grow beyond the borders.' },
  { name: 'Crimson', color: '#E5484D', mark: 'C', motto: 'Take the initiative.' },
] as const;
export const colonyName = (id: number) => colonies[id]?.name ?? 'Neutral';
export const territoryName = (id: number) => id === 0 ? 'The Core' : `Territory ${String(id).padStart(2, '0')}`;
export function coordinates(id: number): [number, number] {
  if (id === 0) return [0, 0];
  let radius = 1;
  while (id > 3 * radius * (radius + 1)) radius++;
  let offset = id - (1 + 3 * radius * (radius - 1));
  let q = -radius, r = radius;
  const dq = [1, 1, 0, -1, -1, 0], dr = [0, -1, -1, 0, 1, 1];
  for (let side = 0; side < 6; side++) {
    const steps = Math.min(offset, radius); q += dq[side] * steps; r += dr[side] * steps; offset -= steps;
    if (!offset) break;
  }
  return [q, r];
}
export const points = (id: number) => id === 0 ? 5 : id <= 6 ? 3 : id <= 18 ? 2 : 1;
export type Territory = { controller: number; active: readonly bigint[]; pending: readonly bigint[] };
export type Season = { season: bigint; epoch: bigint; epochInSeason: bigint; secondsLeft: bigint; seasonSecondsLeft: bigint; lastSettled: bigint; pastWinners: readonly number[] };
export type ColonyState = { members: readonly bigint[]; active: readonly bigint[]; score: readonly bigint[] };
export type Player = { colony: number; choiceSeason: bigint; deployments: readonly bigint[]; pending: readonly bigint[]; totalActive: bigint; totalPending: bigint; cooldown: bigint; nextUnlock: bigint; claimable: bigint; eligibleEpochs: bigint };
export function controller(active: readonly bigint[], previous: number): number {
  const max = active.reduce((a, b) => a > b ? a : b, 0n);
  const leaders = active.map((v, i) => v === max ? i : -1).filter(i => i >= 0);
  return leaders.length === 1 ? leaders[0] : previous;
}
export const contested = (t: Territory) => t.pending.some(v => v > 0n) && controller(t.active.map((v, i) => v + t.pending[i]), t.controller) !== controller(t.active, t.controller);
export function amountInput(value: string, decimals = 18): bigint | undefined {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) || (value.split('.')[1]?.length ?? 0) > decimals) return;
  try { const amount = parseUnits(value, decimals); return amount > 0n && amount < 2n ** 128n ? amount : undefined; } catch { return; }
}
export function units(value: bigint | undefined, decimals = 18, digits = 2) {
  if (value === undefined) return '—';
  const exact = formatUnits(value, decimals);
  const [whole, fraction] = exact.split('.');
  const prefix = BigInt(whole).toLocaleString('en-US');
  if (!fraction) return prefix;
  if (value > 0n && BigInt(whole) === 0n && !fraction.slice(0, digits).replace(/0/g, '')) return `<0.${'0'.repeat(Math.max(digits - 1, 0))}1`;
  return prefix + (fraction.slice(0, digits).replace(/0+$/, '') ? '.' + fraction.slice(0, digits).replace(/0+$/, '') : '');
}
export function duration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export const shortAddress = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;
const errors: Record<string, string> = {
  ColonyLocked: 'Your colony is locked for this season. Choose again when the next season starts.',
  NotJoined: 'Join a colony before deploying troops.', InsufficientStake: 'This territory has less of your stake than requested. Refresh and choose a smaller amount.',
  NothingToClaim: 'No retreat is ready yet. Wait for the cooldown and refresh.', NoEndedEpoch: 'No epoch is ready to settle. Wait for the countdown to end.',
  NotEligible: 'This wallet does not meet the winning-colony and seven-epoch requirements.', AlreadyClaimed: 'This wallet already claimed this season’s badge.',
  SeasonNotEnded: 'All epochs in that season must be settled before claiming.', SeasonNotFinalized: 'Settle the remaining epochs before claiming.',
  ERC20InsufficientBalance: 'Your token balance is too low. Enter a smaller amount.', ERC20InsufficientAllowance: 'Approve the token amount, wait for confirmation, then try again.',
  SameTerritory: 'Choose a different destination territory.', ZeroAmount: 'Enter an amount greater than zero.',
  TransactionDeadlinePassed: 'The swap deadline passed. Refresh your quote and try again.',
  V4TooLittleReceived: 'The pool cannot meet your minimum output. Refresh your quote or choose a smaller amount.',
  V4TooMuchRequested: 'The pool requested more input than allowed. Refresh your quote and try again.',
  InsufficientBalance: 'The router cannot settle this amount. Check your balance and both approvals, then refresh the quote.',
  InsufficientETH: 'There is not enough ETH to settle this swap. Check your balance and try again.',
  InsufficientToken: 'There are not enough tokens to settle this swap. Check your balance and approvals.',
};
export function errorMessage(error: unknown): string {
  const e = error as { code?: number; message?: string; shortMessage?: string; cause?: { code?: number } };
  if (e.code === 4001 || e.cause?.code === 4001 || /rejected|denied/i.test(e.message ?? '')) return 'Request declined in your wallet. You can try again when ready.';
  if (error instanceof BaseError) {
    const cause = error.walk(e => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError;
    if (cause?.data?.errorName && errors[cause.data.errorName]) return errors[cause.data.errorName];
    if (cause?.data?.errorName === 'ExecutionFailed') {
      try {
        const inner = decodeErrorResult({ abi: routerAbi, data: cause.data.args?.[1] as Hex });
        if (errors[inner.errorName]) return errors[inner.errorName];
      } catch { /* Unknown hook errors remain a clear, recoverable swap failure. */ }
      return 'The router or pool hook rejected this swap. Check both approvals, refresh the quote and try a smaller amount.';
    }
  }
  const message = e.shortMessage ?? e.message ?? '';
  const key = Object.keys(errors).find(k => message.includes(k));
  if (key) return errors[key];
  if (/insufficient funds/i.test(message)) return 'You need more ETH to cover network fees. Fund your wallet and try again.';
  if (/fetch|timeout|HTTP|network|RPC|rate limit/i.test(message)) return 'The network could not complete this request. Check your connection and retry.';
  return message.length < 220 && message && !/0x[0-9a-f]{8}/i.test(message) ? message : 'The contract could not complete this action. Refresh state, check the amount and try again.';
}
