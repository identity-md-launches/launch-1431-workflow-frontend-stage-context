import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address, Hash } from 'viem';
import { useApp } from './context';
import { colonyName, errorMessage, territoryName } from './domain';
import { Action, AddressLink, Icon, SectionTitle, TxFeedback } from './ui';

type WarEvent = { id: string; name: string; args: Record<string, unknown>; block: bigint; hash: Hash; index: number };
export function Observability() {
  const { runtime, game, wallet, tx } = useApp();
  const [events, setEvents] = useState<WarEvent[]>([]), [keepers, setKeepers] = useState<{ address: Address; count: bigint }[]>([]);
  const [range, setRange] = useState<{ from: bigint; to: bigint }>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [ownCount, setOwnCount] = useState<bigint>();
  const [visibleCount, setVisibleCount] = useState(30);
  const fetching = useRef(false);
  const load = useCallback(async (older = false) => {
    if (fetching.current || !game.verified) return;
    fetching.current = true; setBusy(true); setError('');
    try {
      const to = older && range ? range.from > 0n ? range.from - 1n : 0n : await runtime.client.getBlockNumber();
      const from = to > 1999n ? to - 1999n : 0n;
      const logs = await runtime.client.getContractEvents({ ...runtime.contracts.HiveWars, fromBlock: from, toBlock: to, strict: true });
      const recent: WarEvent[] = logs.filter(l => ['TerritoryCaptured', 'Settled', 'SeasonEnded'].includes(l.eventName ?? '')).map(l => ({
        id: `${l.transactionHash}-${l.logIndex}`, name: l.eventName!, args: l.args as Record<string, unknown>, block: l.blockNumber!, hash: l.transactionHash!, index: l.logIndex!,
      }));
      const unique = [...new Map(recent.map(l => [l.id, l])).values()].sort((a, b) => a.block === b.block ? b.index - a.index : a.block > b.block ? -1 : 1).slice(0, 150);
      setEvents(unique); setVisibleCount(30); setRange({ from, to });
      const hashes = [...new Set(unique.filter(l => l.name === 'Settled').map(l => l.hash))].slice(0, 20);
      const transactions = await Promise.all(hashes.map(hash => runtime.client.getTransaction({ hash })));
      const callers = [...new Set(transactions.map(t => t.from))];
      const counts = await Promise.all(callers.map(async address => ({ address, count: await runtime.client.readContract({ ...runtime.contracts.HiveWars, functionName: 'keeperSettlements', args: [address] }) as bigint })));
      setKeepers(counts.sort((a, b) => a.count > b.count ? -1 : a.count < b.count ? 1 : 0));
    } catch (e) { setError(errorMessage(e)); } finally { fetching.current = false; setBusy(false); }
  }, [runtime, game.verified, range]);
  useEffect(() => { if (game.verified) void load(); }, [game.verified, tx.state?.phase === 'success']);
  useEffect(() => {
    let active = true; setOwnCount(undefined);
    if (wallet.account && game.verified) runtime.client.readContract({ ...runtime.contracts.HiveWars, functionName: 'keeperSettlements', args: [wallet.account] }).then(v => { if (active) setOwnCount(v as bigint); }).catch(() => {});
    return () => { active = false; };
  }, [wallet.account, game.verified, game.data?.season.lastSettled]);
  const backlog = game.data ? game.data.season.epoch - game.data.season.lastSettled - 1n : 0n;
  return <section id="war-log"><SectionTitle eyebrow="From the front lines" title="The war is written in blocks."><button className="button compact" disabled={busy || !game.verified} onClick={() => void load()}><Icon name="refresh" size={16} />{busy ? 'Loading events…' : 'Refresh log'}</button></SectionTitle><div className="log-grid">
    <article className="panel war-log"><h3>War log</h3><p className="small muted">{range ? `Blocks ${range.from.toLocaleString()}–${range.to.toLocaleString()}. Up to 150 recent events.` : 'Recent captures and epoch settlements from HiveWars.'}</p>{error && <p role="alert" className="notice error">{error} Use Refresh log to retry.</p>}
    {events.length ? <ol className="event-list">{events.slice(0, visibleCount).map(event => <li key={event.id}><span className="event-symbol" aria-hidden="true">{event.name === 'TerritoryCaptured' ? '⌖' : '◇'}</span><div><p>{event.name === 'TerritoryCaptured' ? `${colonyName(Number(event.args.to))} seized ${territoryName(Number(event.args.territory))}` : event.name === 'Settled' ? `Epoch ${String(event.args.epoch)} settled` : `Season ${String(event.args.season)} ended · ${colonyName(Number(event.args.winner))}`}</p><a className="small muted" href={`${runtime.manifest.network.explorer}/tx/${event.hash}`} target="_blank" rel="noreferrer">Block {event.block.toLocaleString()} ↗</a></div>{event.name === 'Settled' && <span className="small muted">{(event.args.territoriesPerColony as readonly number[])?.join(' / ')} <span className="sr-only">territories in Amber, Obsidian, Jade, Crimson order</span></span>}</li>)}</ol> : <div className="empty-copy"><p>{busy ? 'Reading the latest onchain events…' : error ? 'Events are unavailable. No activity is being inferred.' : 'No captures or settlements in the loaded window.'}</p><p className="small muted">Older history can be loaded in 2,000-block pages.</p></div>}
    {visibleCount < events.length && <button className="button compact" onClick={() => setVisibleCount(visibleCount + 30)}>Show more events in this window</button>}
    <button className="text-button" disabled={busy || !range || range.from === 0n} onClick={() => void load(true)}>Load older history ↓</button></article>
    <article className="panel keeper-panel"><div className="label-with-icon"><Icon name="clock" /><h3>Keep the battle moving</h3></div><p>Anyone can settle an ended epoch. Each call resolves one epoch, in order.</p><div className="keeper-count"><strong>{game.data ? backlog.toString() : '—'}</strong><span>epochs ready<br />to settle</span></div><Action id="settle" label="Settle epoch" disabled={!game.data || backlog <= 0n} onClick={() => void tx.send('settle', { ...runtime.contracts.HiveWars, functionName: 'settleEpoch' })} /><TxFeedback ids={['settle']} /><p className="small muted">Network fee applies. Keeper glory has no token reward.</p><div className="keeper-leaderboard"><h4>Top discovered keepers</h4><p className="small muted">Callers of up to 20 settlements in the loaded window, ranked by onchain lifetime count. This is not a complete leaderboard.</p>{keepers.length ? <ol>{keepers.slice(0, 5).map(k => <li key={k.address}><AddressLink address={k.address} /><strong>{k.count.toLocaleString()}</strong></li>)}</ol> : <p className="small muted">No keepers discovered in this window.</p>}{wallet.account && <p className="small">Your settlements: {ownCount?.toLocaleString() ?? '—'}</p>}</div></article>
    </div></section>;
}
