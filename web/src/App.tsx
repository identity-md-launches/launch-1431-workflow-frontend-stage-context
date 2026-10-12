import { useEffect, useState } from 'react';
import type { Runtime } from './config';
import { Context } from './context';
import { useWallet } from './wallet';
import { useGame } from './game';
import { useTransactions } from './transactions';
import { colonies, duration } from './domain';
import { AddressLink, Icon } from './ui';
import { BattleMap } from './Map';
import { Army, Colonies, Footer, Hall, HowToPlay } from './Sections';
import { Observability } from './Observability';
import { Supply } from './Swap';

export function App({ runtime }: { runtime: Runtime }) {
  const wallet = useWallet(runtime), game = useGame(runtime, wallet.account);
  const [now, setNow] = useState(Date.now()), [providerChoice, setProviderChoice] = useState('');
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const stale = !game.data || now - game.data.receivedAt > 45000;
  const ready = game.verified && !game.error && !stale && !!wallet.account && game.data?.account === wallet.account && wallet.correctChain;
  const tx = useTransactions(runtime, wallet, () => game.refresh(true), ready);
  const data = game.data, elapsed = data ? Math.floor((now - data.receivedAt) / 1000) : 0;
  const epochLeft = data ? Math.max(0, Number(data.season.secondsLeft) - elapsed) : undefined;
  const maxScore = data?.colonies.score.reduce((a, b) => a > b ? a : b, 1n) ?? 1n;
  return <Context.Provider value={{ runtime, wallet, game, tx, ready, now }}>
    <a className="skip-link" href="#main">Skip to main content</a><div id="top" />
    <header className="site-header"><a className="brand" href="#top" aria-label="Hive Wars home"><Icon name="hex" size={36} /><span>HIVE WARS<small>Battle for the Comb</small></span></a>
      <nav aria-label="Main navigation"><a href="#comb">The Comb</a><a href="#colonies">Colonies</a><a href="#army">My army</a><a href="#hall">Conquerors</a></nav>
      <div className="wallet-controls">{wallet.account ? <><AddressLink address={wallet.account} /><button className="text-button small" onClick={wallet.disconnect} disabled={tx.pending}>Disconnect</button></> : <>{wallet.options.length > 1 && <label className="sr-only" htmlFor="wallet-picker">Wallet</label>}{wallet.options.length > 1 && <select id="wallet-picker" value={providerChoice || wallet.options[0].id} onChange={e => setProviderChoice(e.target.value)}>{wallet.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}<button className="button connect-button" disabled={wallet.busy} onClick={() => void wallet.connect(wallet.options.find(o => o.id === providerChoice)?.provider)}><span className="wallet-symbol" aria-hidden="true">▣</span>{wallet.busy ? 'Connecting…' : 'Connect wallet'}</button></>}</div>
    </header>
    <main id="main"><div className="connection-region" aria-live="polite">
      {wallet.error && <p className="notice error">{wallet.error}</p>}
      {wallet.account && !wallet.correctChain && <div className="notice wrong-network"><span>Wallet network differs from {runtime.manifest.network.name}. Transactions are disabled.</span><button className="button primary" disabled={wallet.busy} onClick={() => void wallet.switchNetwork()}>{wallet.busy ? 'Switching…' : `Switch to ${runtime.manifest.network.name}`}</button></div>}
      {(game.error || stale && !!data) && <div className="notice error"><span>{game.error || 'Live state is out of date. Refresh before sending an action.'}{data ? ' Last known values remain visible.' : ''}</span><button className="button compact" disabled={game.loading} onClick={() => void game.refresh()}>{game.loading ? 'Retrying…' : 'Retry connection'}</button></div>}
    </div>
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className={`status-dot ${game.verified && !game.error ? 'live' : ''}`} />{runtime.manifest.network.name} · Onchain strategy</p><h1 id="hero-title">The Comb is<br /><em>yours to take.</em></h1><p className="hero-story">The swarm built the Comb.<br />Now the colonies fight for it.</p><p className="hero-description">Choose your colony. Command your NECTAR.<br className="desktop-break" /> Hold your ground when the season ends.</p><div className="hero-actions"><a className="button primary" href="#colonies">Choose your colony <Icon name="arrow" size={18} /></a><a className="text-link" href="#how-to-play">How to play <span aria-hidden="true">↗</span></a></div></div>
      <div className="season-panel"><div className="season-heading"><span className="eyebrow">Campaign status</span><span className="live-label"><i className={game.verified && !game.error ? 'live' : ''} />{data && !game.error ? 'Live onchain' : game.error ? 'Connection unavailable' : 'Connecting'}</span></div>
        <div className="season-clock"><div><span className="tiny-label">Current season</span><strong>{data ? String(data.season.season).padStart(2, '0') : '—'}</strong></div><div><span className="tiny-label">Epoch {data?.season.epochInSeason.toString() ?? '—'} of 30 ends in</span><strong>{epochLeft !== undefined ? duration(epochLeft) : '—:—:—'}</strong></div></div>
        <div className="score-heading"><span className="tiny-label">Season standings</span><span className="tiny-label">Points</span></div><div className="score-list">{colonies.map((c, i) => <div className="score-row" key={c.name}><span className="score-name"><i style={{ background: c.color }} />{c.name}</span><div className="score-track"><div style={{ width: `${data ? Number(data.colonies.score[i] * 100n / maxScore) : 0}%`, background: c.color }} /></div><strong>{data?.colonies.score[i].toLocaleString() ?? '—'}</strong></div>)}</div>
        <div className="season-bottom"><Icon name="clock" size={14} /><span>{data ? `Last settled: epoch ${data.season.lastSettled}. ${Math.ceil(Math.max(0, Number(data.season.seasonSecondsLeft) - elapsed) / 86400)} days left this season.` : 'Season and scores load from HiveWars.'}</span></div>
      </div>
    </section>
    <div className="mission-strip"><span><strong>61</strong> territories</span><span><strong>4</strong> colonies</span><span><strong>24h</strong> epochs</span><span><strong>30</strong> epochs to glory</span><a href="#war-log"><span className="status-dot" />{data ? `Block ${data.block.toLocaleString()}` : 'Reading the chain'} <span aria-hidden="true">↗</span></a></div>
    <BattleMap /><Colonies /><Army /><Supply /><Observability /><Hall /><HowToPlay />
    </main><Footer />
  </Context.Provider>;
}
