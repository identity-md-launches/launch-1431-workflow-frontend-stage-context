import { useEffect, useState, type CSSProperties } from 'react';
import { formatUnits, type Address } from 'viem';
import { useApp } from './context';
import { colonies, colonyName, duration, errorMessage, territoryName, units } from './domain';
import { Action, AddressLink, Icon, SectionTitle, TxFeedback, WalletGate } from './ui';

export function Colonies() {
  const { game, runtime, tx, wallet } = useApp(); const data = game.data; const player = data?.account === wallet.account ? data?.player : undefined;
  const locked = !!player && player.choiceSeason === data?.season.season;
  return <section id="colonies"><SectionTitle eyebrow="Choose your allegiance" title="Four colonies. Where do you stand?"><p>One choice per season.<br />One shared ambition.</p></SectionTitle>
    <div className="colony-grid">{colonies.map((c, i) => <article className="colony-card" style={{ '--colony': c.color } as CSSProperties} key={c.name}>
      <div className="colony-card-top"><span className="colony-sigil" aria-hidden="true">{c.mark}</span><span className="eyebrow">Colony 0{i + 1}</span></div><h3>{c.name}</h3><p className="small muted">{c.motto}</p>
      <dl><div><dt>Members</dt><dd>{data?.colonies.members[i].toLocaleString() ?? '—'}</dd></div><div><dt>Active NECTAR</dt><dd>{units(data?.colonies.active[i])}</dd></div><div><dt>Season score</dt><dd>{data?.colonies.score[i].toLocaleString() ?? '—'} <small>pts</small></dd></div></dl>
      <Action id={`join-${i}`} label={locked ? player.colony === i ? 'Your colony · locked' : 'Choice locked this season' : `Join ${c.name}`} disabled={locked} onClick={() => void tx.send(`join-${i}`, { ...runtime.contracts.HiveWars, functionName: 'joinColony', args: [i] })} /><TxFeedback ids={[`join-${i}`]} />
    </article>)}</div><p className="small muted">Changing colony in a new season moves all carried troops to the new colony as pending stake. Your first troop action can also confirm your inherited colony for that season.</p><WalletGate />
  </section>;
}
export function Army() {
  const { game, wallet, runtime, tx, now } = useApp(); const data = game.data; const p = data?.account === wallet.account ? data?.player : undefined;
  const onchainNow = data ? Number(data.timestamp) + Math.floor((now - data.receivedAt) / 1000) : 0;
  const positions = p?.deployments.map((active, id) => ({ id, active, pending: p.pending[id] })).filter(t => t.active + t.pending > 0n) ?? [];
  return <section id="army"><SectionTitle eyebrow="Your command center" title="My army">{p && p.colony < 4 && <span className="tag">{colonyName(p.colony)} colony</span>}</SectionTitle><div className="army-grid">
    <article className="panel army-main"><div className="army-summary"><div><span className="tiny-label">Active troops</span><strong>{units(p?.totalActive)} <small>NECTAR</small></strong></div><div><span className="tiny-label">Pending next epoch</span><strong>{units(p?.totalPending)} <small>NECTAR</small></strong></div></div>
      {positions.length ? <div className="table-scroll"><table><caption className="sr-only">Your deployments in NECTAR</caption><thead><tr><th>Territory</th><th>Active</th><th>Pending</th></tr></thead><tbody>{positions.map(pos => <tr key={pos.id}><th scope="row">{territoryName(pos.id)}</th><td title={formatUnits(pos.active, 18)}>{units(pos.active)}</td><td>{units(pos.pending)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><Icon name="swords" size={30} /><h3>{wallet.account ? 'Your front line starts here' : 'Your army awaits'}</h3><p>{wallet.account ? 'Join a colony and deploy NECTAR from the map. Your active and pending troops will appear here.' : 'Connect your wallet to see deployments and manage your troops.'}</p><a className="text-link" href="#comb">Go to the battlefield <span aria-hidden="true">↗</span></a></div>}
      <WalletGate />
    </article><div className="army-side"><article className="panel"><div className="label-with-icon"><Icon name="clock" /><h3>Retreat queue</h3></div><p className="big-number">{units(p?.cooldown)} <small>NECTAR</small></p><p className="small muted">{p?.nextUnlock ? `Next unlock in ${duration(Number(p.nextUnlock) - onchainNow)}` : 'Each retreat has its own 24-hour cooldown.'}</p><p className="small">Ready to claim: {units(p?.claimable)} NECTAR</p><Action id="claim-retreat" label="Claim retreat" disabled={!p || p.claimable === 0n} onClick={() => void tx.send('claim-retreat', { ...runtime.contracts.HiveWars, functionName: 'claimRetreat' })} /><TxFeedback ids={['claim-retreat']} /><p className="small muted">Up to 64 ready retreats per claim.</p></article>
      <article className="panel"><div className="label-with-icon"><Icon name="shield" /><h3>Conqueror progress</h3></div><div className="progress-label"><strong>{p?.eligibleEpochs.toString() ?? '—'} / 7</strong><span className="small muted">qualifying epochs</span></div><progress max="7" value={Number(p?.eligibleEpochs ?? 0)} aria-label="Qualifying epochs toward badge eligibility" /><p className="small muted">Hold at least 1,000 active NECTAR for 7 completed epochs, and finish in the winning colony. No yield or token rewards are emitted.</p></article></div>
    </div></section>;
}
type Badge = { season: number; id: bigint; eligible: boolean; name?: string; image?: string };
export function Hall() {
  const { runtime, wallet, game, tx } = useApp(); const winners = game.data?.season.pastWinners ?? [];
  const [season, setSeason] = useState('1'); const [badge, setBadge] = useState<Badge>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState<Badge[]>([]); const [page, setPage] = useState(0);
  const readBadge = async (s: number): Promise<Badge> => {
    const [id, eligible] = await Promise.all([
      runtime.client.readContract({ ...runtime.contracts.ConquerorBadge, functionName: 'badgeOf', args: [wallet.account, BigInt(s)] }) as Promise<bigint>,
      runtime.client.readContract({ ...runtime.contracts.HiveWars, functionName: 'isEligible', args: [wallet.account, BigInt(s)] }) as Promise<boolean>,
    ]);
    if (id === 0n) return { season: s, id, eligible };
    const uri = await runtime.client.readContract({ ...runtime.contracts.ConquerorBadge, functionName: 'tokenURI', args: [id] }) as string;
    if (!uri.startsWith('data:application/json;base64,')) throw Error('The badge metadata format is unsupported.');
    const metadata = JSON.parse(atob(uri.split(',')[1])) as { name: string; image: string };
    if (!metadata.image.startsWith('data:image/svg+xml;base64,')) throw Error('The badge image format is unsupported.');
    return { season: s, id, eligible, ...metadata };
  };
  useEffect(() => {
    let cancelled = false; setBadge(undefined); setGallery([]); setError(''); setLoading(false);
    if (!wallet.account || !game.verified || !winners.length) return;
    setLoading(true);
    const s = Number(season);
    const start = Math.max(0, winners.length - (page + 1) * 6), end = Math.max(0, winners.length - page * 6);
    Promise.all([Number.isSafeInteger(s) && s > 0 && s <= winners.length ? readBadge(s) : undefined, Promise.all(Array.from({ length: end - start }, (_, i) => readBadge(start + i + 1)))])
      .then(([badge, badges]) => { if (!cancelled) { setBadge(badge); setGallery(badges.filter(b => b.id > 0n).reverse()); } })
      .catch(e => { if (!cancelled) setError(errorMessage(e)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // Reload badges after an onchain receipt or account change, not on every game poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.account, game.verified, winners.length, season, page, tx.state?.phase]);
  return <section id="hall"><SectionTitle eyebrow="Glory stays onchain" title="Hall of Conquerors"><span className="tag">Soulbound · earned, never traded</span></SectionTitle><div className="hall-grid"><article className="panel">
    <h3>Season champions</h3>{winners.length ? <ol className="winner-list">{winners.slice(Math.max(0, winners.length - (page + 1) * 6), Math.max(0, winners.length - page * 6)).map((winner, i) => { const s = Math.max(0, winners.length - (page + 1) * 6) + i + 1; return <li key={s}><span>Season {s}</span><strong>{winner < 4 ? colonyName(winner) : 'Draw · no winner'}</strong><button className="text-button" onClick={() => setSeason(String(s))}>View eligibility</button></li>; })}</ol> : <p className="empty-copy">{game.data ? 'The first crown is still waiting. Winners appear once all 30 epochs of a season are settled.' : 'Season history will appear when the network responds.'}</p>}
    {winners.length > 6 && <div className="button-row"><button className="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer seasons</button><button className="button" disabled={(page + 1) * 6 >= winners.length} onClick={() => setPage(page + 1)}>Older seasons</button></div>}
    </article><article className="panel badge-panel"><span className="badge-outline" aria-hidden="true"><Icon name="shield" size={42} /></span><div><h3>Claim your place in history</h3><p className="small muted">A permanent, fully onchain crest for each qualifying season.</p></div><label className="field">Season<input name="badge-season" inputMode="numeric" autoComplete="off" value={season} onChange={e => setSeason(e.target.value)} aria-describedby="badge-status" /></label>
    <p className="small" id="badge-status">{loading ? 'Checking eligibility…' : !wallet.account ? 'Connect a wallet to check your eligibility.' : error || (badge?.id ? 'You already claimed this season’s badge.' : badge?.eligible ? 'You are eligible. Claim your conqueror badge.' : Number(season) > winners.length ? 'This season has not been finalized yet.' : 'This wallet is not eligible for the selected season.')}</p>
    <Action id="claim-badge" label="Claim badge" disabled={loading || !badge?.eligible || badge.id > 0n || !!error} onClick={() => void tx.send('claim-badge', { ...runtime.contracts.ConquerorBadge, functionName: 'claim', args: [BigInt(season)] })} /><TxFeedback ids={['claim-badge']} />
    </article></div>{gallery.length > 0 && <div className="badge-gallery">{gallery.map(b => <figure key={b.season}><img src={b.image} alt={b.name} width="200" height="200" loading="lazy" /><figcaption>{b.name}</figcaption></figure>)}</div>}
    {badge?.image && !gallery.some(b => b.id === badge.id) && <figure className="single-badge"><img src={badge.image} alt={badge.name} width="200" height="200" /><figcaption>{badge.name}</figcaption></figure>}
  </section>;
}
export function HowToPlay() {
  return <section id="how-to-play"><SectionTitle eyebrow="Field manual" title="A little strategy. A lasting legacy." /><ol className="how-grid">{[
    ['Choose a colony', 'Join Amber, Obsidian, Jade or Crimson. Your choice is fixed for the current season.'],
    ['Deploy your NECTAR', 'Pick a territory and send troops. New stake becomes active at the next 24-hour epoch.'],
    ['Control the Comb', 'The largest active force holds a cell. The Core earns 5 points per epoch. Every ring matters.'],
    ['Move. Hold. Retreat.', 'Move troops to shift the front. Retreats return to your wallet after a 24-hour cooldown and a claim.'],
    ['Earn your crest', 'Help your colony win a 30-epoch season. Seven epochs with 1,000 active NECTAR can earn a soulbound badge.'],
  ].map(([title, text], i) => <li key={title}><span className="step-number">0{i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></section>;
}
export function Footer() {
  const { runtime } = useApp();
  return <footer id="built"><div className="footer-about"><div className="brand"><Icon name="hex" size={34} /><span>HIVE WARS<small>Battle for the Comb</small></span></div><h2>Built by the Swarm.</h2><p>IMD agents built the game and its onchain rules. The deployed source and implementation ABIs are bound to the launch handoff. Every move is yours to verify.</p><a href={`https://github.com/identity-md-launches/launch-1422-workflow-contract-stage-context/tree/${runtime.manifest.sourceCommit}`} target="_blank" rel="noreferrer">Inspect deployed source ↗</a></div><div className="contract-links"><p className="eyebrow">Verify the contracts · {runtime.manifest.network.name}</p>{runtime.manifest.contracts.map(c => <div key={c.name}><span>{c.name === 'LaunchToken' ? 'NECTAR' : c.name}</span><AddressLink address={c.address as Address} /></div>)}<a className="small" href="./imd-deployment.json" target="_blank" rel="noreferrer">View deployment manifest ↗</a><p className="small muted">Immutable token binding. No game admin, upgrades or emitted rewards. NECTAR remains yours to retreat and claim.</p></div><div className="footer-bottom"><span>61 territories. 4 colonies. All onchain.</span><a href="#top">Back to command ↑</a></div></footer>;
}
