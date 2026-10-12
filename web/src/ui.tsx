import { useState, type ReactNode } from 'react';
import { getAddress, type Address } from 'viem';
import { useApp } from './context';
import { shortAddress } from './domain';

export function Icon({ name, size = 20 }: { name: 'hex' | 'arrow' | 'shield' | 'swords' | 'clock' | 'chevron' | 'copy' | 'refresh'; size?: number }) {
  const paths = {
    hex: 'M12 2 21 7v10l-9 5-9-5V7Z M12 7l4 2.5v5L12 17l-4-2.5v-5Z',
    arrow: 'M5 12h14m-6-6 6 6-6 6', shield: 'M12 3 21 6v6c0 5-9 10-9 10S3 17 3 12V6Z M8 12l3 3 5-6',
    swords: 'm4 3 17 17m-4 1 4-4M20 3 3 20m0-4 5 5M4 3l4 1-3 3ZM20 3l-4 1 3 3Z',
    clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', chevron: 'm8 5 7 7-7 7',
    copy: 'M9 9h11v11H9Z M15 9V3H3v12h6', refresh: 'M20 7v5h-5 M4 17v-5h5 M20 12a8 8 0 0 0-14-5 M4 12a8 8 0 0 0 14 5',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
export function AddressLink({ address, label }: { address: Address; label?: string }) {
  const { runtime } = useApp(); const [copied, setCopied] = useState(false); const [error, setError] = useState(false);
  const value = getAddress(address);
  return <span className="address-control"><a href={`${runtime.manifest.network.explorer}/address/${value}`} title={value} target="_blank" rel="noreferrer">{label ?? shortAddress(value)} <span aria-hidden="true">↗</span></a><button className="icon-button" aria-label={`Copy ${label ?? 'wallet'} address`} title={value} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setError(false); } catch { setError(true); } }}><Icon name="copy" size={14} /></button>{copied && <span className="sr-only" role="status">Address copied</span>}{error && <span className="small">Copy unavailable: {value}</span>}</span>;
}
export function Action({ id, label, onClick, disabled = false, primary = false }: { id: string; label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  const { ready, wallet, tx } = useApp();
  const active = tx.pending && tx.state?.key === id;
  return <button className={`button ${primary ? 'primary' : ''}`} disabled={disabled || !ready || !wallet.correctChain || tx.pending} onClick={onClick} aria-busy={active}>
    {active && <span className="spinner" aria-hidden="true" />}{active ? tx.state?.phase === 'simulation' ? 'Checking…' : tx.state?.phase === 'wallet' ? 'Confirm in wallet…' : 'Waiting for confirmation…' : label}
  </button>;
}
export function TxFeedback({ ids }: { ids: string[] }) {
  const { tx, runtime } = useApp(); const state = tx.state;
  return <div aria-live="polite" className="tx-feedback">{state && ids.includes(state.key) && <div className={`notice ${state.phase === 'error' ? 'error' : ''}`}>
    <p>{state.message}</p>{state.hash && <a target="_blank" rel="noreferrer" href={`${runtime.manifest.network.explorer}/tx/${state.hash}`}>View transaction ↗</a>}
    {state.phase === 'unknown' && <button className="button" onClick={() => void tx.recheck()}>Check confirmation again</button>}
  </div>}</div>;
}
export function WalletGate() {
  const { wallet, runtime, game } = useApp();
  if (!wallet.account) return <div className="gate"><p>Connect your wallet to command your army.</p><button className="button" disabled={wallet.busy} onClick={() => void wallet.connect()}>Connect wallet <Icon name="arrow" size={16} /></button></div>;
  if (!wallet.correctChain) return <p className="notice">Your wallet is on another network. Use “Switch to {runtime.manifest.network.name}” above to continue.</p>;
  if (game.error || !game.verified) return <p className="small muted">Actions unlock after deployment and live state checks succeed.</p>;
  return null;
}
export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{children}</div>;
}
