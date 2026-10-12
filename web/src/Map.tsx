import { useRef, useState, type CSSProperties } from 'react';
import { formatUnits } from 'viem';
import { useApp } from './context';
import { Action, Icon, TxFeedback, WalletGate } from './ui';
import { amountInput, colonies, colonyName, contested, coordinates, points, territoryName, units } from './domain';

export function BattleMap() {
  const { game } = useApp(); const [selected, setSelected] = useState(0); const [motion, setMotion] = useState(true);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const territories = game.data?.map;
  return <section id="comb" className="battle-section" aria-labelledby="map-title">
    <div className="map-top"><div><h2 id="map-title">The Comb</h2></div><div className="map-counter"><span className="tiny-label">Territories held</span><strong>{territories ? territories.filter(t => t.controller < 4).length : '—'}<span> / 61</span></strong></div></div>
    <div className="battle-layout">
      <div className="map-area">
        <div className="map-label"><span><span className="crosshair">⌖</span> Tactical view</span><span>{territories ? 'Last settled control' : 'Awaiting live state'}</span></div>
        <div className={`hex-map ${motion ? '' : 'paused'}`} role="group" aria-label="Territory map. Use arrow keys to explore, Home for the Core, or the territory selector below.">
          <div className="map-orbit orbit-one" aria-hidden="true" /><div className="map-orbit orbit-two" aria-hidden="true" />
          {Array.from({ length: 61 }, (_, id) => {
            const [q, r] = coordinates(id), territory = territories?.[id], owner = territory ? colonies[territory.controller] : undefined;
            const isContested = territory && contested(territory);
            return <button key={id} className={`hex ${selected === id ? 'selected' : ''} ${id === 0 ? 'core' : ''} ${isContested ? 'contested' : ''}`}
              style={{ left: `${50 + (Math.sqrt(3) * 40 * (q + r / 2) / 720) * 100}%`, top: `${50 + (60 * r / 620) * 100}%`, '--colony': owner?.color ?? '#727967' } as CSSProperties}
              ref={element => { cells.current[id] = element; }} tabIndex={selected === id ? 0 : -1}
              onKeyDown={event => {
                const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
                const delta = directions[event.key];
                if (!delta && event.key !== 'Home') return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : Array.from({ length: 61 }, (_, i) => i).find(i => { const [x, y] = coordinates(i); return x === q + delta[0] && y === r + delta[1]; });
                if (next !== undefined) { setSelected(next); cells.current[next]?.focus(); }
              }}
              onClick={() => setSelected(id)} aria-pressed={selected === id} aria-label={`${territoryName(id)}, ${points(id)} points, ${territory ? colonyName(territory.controller) : 'state unavailable'}${isContested ? ', contested' : ''}`}>
              <svg viewBox="0 0 70 80" aria-hidden="true"><polygon points="35,2 68,21 68,59 35,78 2,59 2,21" /></svg>
              <span className="hex-id">{id === 0 ? <Icon name="hex" size={23} /> : String(id).padStart(2, '0')}</span>
              <span className="hex-mark">{id === 0 ? 'CORE' : owner?.mark ?? '·'}</span>
              {isContested && <span className="contested-mark" aria-hidden="true">!</span>}
            </button>;
          })}
        </div>
        <div className="map-bottom"><label className="sr-only" htmlFor="territory-select">Select territory</label><select id="territory-select" value={selected} onChange={e => setSelected(Number(e.target.value))}>{Array.from({ length: 61 }, (_, i) => <option key={i} value={i}>{territoryName(i)} · {points(i)} points</option>)}</select><button className="text-button small" onClick={() => setMotion(!motion)}>{motion ? 'Pause' : 'Resume'} map pulses</button></div>
        <div className="map-legend">{colonies.map(c => <span key={c.name}><i style={{ background: c.color }} />{c.name}</span>)}<span><i className="neutral-dot" />Neutral</span><span className="contested-key">! Contested</span></div>
      </div>
      <TerritoryPanel selected={selected} />
    </div>
    <p className="map-footnote"><Icon name="clock" size={14} /> Active troops determine control at settlement. New and moved troops activate next epoch. A tie keeps the previous controller.</p>
  </section>;
}
function TerritoryPanel({ selected }: { selected: number }) {
  const { runtime, wallet, game, tx } = useApp();
  const [mode, setMode] = useState<'deploy' | 'move' | 'retreat'>('deploy'); const [amount, setAmount] = useState(''); const [destination, setDestination] = useState(1);
  const data = game.data, territory = data?.map[selected], player = data?.account === wallet.account ? data?.player : undefined;
  const parsed = amountInput(amount, data?.decimals); const approved = parsed !== undefined && (data?.allowance ?? 0n) >= parsed;
  const mine = (player?.deployments[selected] ?? 0n) + (player?.pending[selected] ?? 0n);
  const insufficient = parsed !== undefined && parsed > (mode === 'deploy' ? data?.balance ?? 0n : mine);
  const joined = player && player.colony < 4;
  const send = () => {
    if (!parsed || !joined) return;
    if (mode === 'deploy' && !approved) void tx.send('deploy-approve', { ...runtime.contracts.LaunchToken, functionName: 'approve', args: [runtime.contracts.HiveWars.address, parsed] });
    else void tx.send(mode, { ...runtime.contracts.HiveWars, functionName: mode, args: mode === 'move' ? [selected, destination, parsed] : [selected, parsed] });
  };
  const disabled = !joined || !parsed || insufficient || (mode === 'move' && selected === destination);
  const invalid = amount !== '' && !parsed;
  return <aside className="territory-panel" aria-label="Selected territory">
    <div className="territory-heading"><span className="tiny-label">Sector {String(selected).padStart(2, '0')}</span><span className="points-badge">+{points(selected)} pts / epoch</span></div>
    <h3>{territoryName(selected)}</h3><p className="territory-control"><span className="status-dot" style={{ background: territory ? colonies[territory.controller]?.color : undefined }} />{territory ? `${colonyName(territory.controller)} control` : 'Control unavailable'}</p>
    <table className="stake-table"><caption className="sr-only">Stake by colony in NECTAR</caption><thead><tr><th>Colony</th><th>Active</th><th>Pending</th></tr></thead><tbody>{colonies.map((c, i) => <tr key={c.name}><th scope="row"><i style={{ background: c.color }} />{c.name}</th><td title={territory ? `${formatUnits(territory.active[i], 18)} NECTAR` : undefined}>{units(territory?.active[i])}</td><td>{territory ? '+' + units(territory.pending[i]) : '—'}</td></tr>)}</tbody></table>
    <p className="small muted unit-note">All troops in NECTAR</p>
    <div className="segmented" role="group" aria-label="Territory action">{(['deploy', 'move', 'retreat'] as const).map(m => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
    <p className="small action-description">{mode === 'deploy' ? 'Send NECTAR to this territory. It joins the battle next epoch.' : mode === 'move' ? 'Move your troops from this territory. They leave immediately and activate at the destination next epoch.' : 'Withdraw your troops from this territory. Claim them after a 24-hour cooldown.'}</p>
    {mode === 'move' && <label className="field">Destination<select value={destination} onChange={e => setDestination(Number(e.target.value))}>{Array.from({ length: 61 }, (_, i) => <option value={i} key={i} disabled={selected === i}>{territoryName(i)}</option>)}</select></label>}
    <label className="field" htmlFor="troop-amount">Amount <span>NECTAR</span></label><input id="troop-amount" name="troop-amount" autoComplete="off" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={invalid || insufficient} aria-describedby="troop-hint" />
    <p id="troop-hint" className={`small ${invalid || insufficient ? 'error-text' : 'muted'}`}>{invalid ? 'Enter a positive amount with up to 18 decimal places.' : insufficient ? `Enter no more than ${units(mode === 'deploy' ? data?.balance : mine)} NECTAR.` : `${mode === 'deploy' ? 'Wallet balance' : 'Your stake here'}: ${units(mode === 'deploy' ? data?.balance : wallet.account ? mine : undefined)} NECTAR`}</p>
    {wallet.account && !joined && data?.account === wallet.account && <p className="small"><a href="#colonies">Join a colony</a> before sending troops.</p>}
    {mode === 'move' && destination === selected && <p className="small error-text">Choose a different destination.</p>}
    {joined && mode === 'deploy' && parsed && !approved && <p className="small muted">Step 1 of 2: approve {units(parsed)} NECTAR for HiveWars. Deployment follows as a separate transaction.</p>}
    <Action id={mode === 'deploy' && !approved ? 'deploy-approve' : mode} label={mode === 'deploy' && parsed && !approved ? 'Approve NECTAR' : mode === 'deploy' ? 'Deploy troops' : mode === 'move' ? 'Move troops' : 'Start retreat'} onClick={send} disabled={disabled} primary />
    <TxFeedback ids={['deploy-approve', 'deploy', 'move', 'retreat']} /><WalletGate />
  </aside>;
}
