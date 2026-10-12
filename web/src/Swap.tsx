import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits, isAddress, getAddress, zeroAddress } from 'viem';
import { useApp } from './context';
import { amountInput, errorMessage, units } from './domain';
import { encodeSwap, erc20Abi, minimumOutput, permit2Abi, quoterAbi, routerAbi, swapCurrencies } from './protocol';
import { Action, AddressLink, Icon, SectionTitle, TxFeedback, WalletGate } from './ui';

export function Supply() {
  const { runtime } = useApp();
  return <section id="supply"><SectionTitle eyebrow="Keep your colony supplied" title="Supply lines"><span className="tag">Uniswap v4</span></SectionTitle><div className="supply-grid"><div className="supply-copy"><Icon name="hex" size={48} /><h3>NECTAR fuels the front.</h3><p>Trade through the launch pool, then deploy your NECTAR where it makes a difference.</p><p className="small muted">Swaps exchange tokens. Game deposits remain yours, with a 24-hour retreat cooldown. You need ETH for network fees.</p><p className="small muted">USD values are unavailable: no price feed was supplied for this launch.</p><dl className="pool-details"><div><dt>Pool fee</dt><dd>{runtime.manifest.poolKey ? runtime.manifest.poolKey.fee / 10000 : '—'}%</dd></div><div><dt>Settlement</dt><dd>{runtime.manifest.network.name}</dd></div><div><dt>Route</dt><dd>Attested launch pool</dd></div></dl><details><summary>Pool and router details</summary><p className="small">The exact pool key is loaded from the deployment manifest. Quotes and transactions use the network’s configured Uniswap addresses.</p>{runtime.manifest.poolKey && <p className="small">Pool hook: <AddressLink address={runtime.manifest.poolKey.hooks} /></p>}<p className="small">Router: <AddressLink address={runtime.manifest.network.uniswapV4.universalRouter} /></p><p className="small">Permit2: <AddressLink address={runtime.manifest.network.uniswapV4.permit2} /></p></details><Transfer /></div><Swap /></div></section>;
}
type Allowances = { account: string; token: string; balance: bigint; erc20: bigint; permit: bigint; expiration: number };
type Quote = { output: bigint; minimum: bigint; at: number; key: string };
export function Swap() {
  const { runtime, wallet, game, tx, now } = useApp();
  const [buy, setBuy] = useState(true), [amount, setAmount] = useState(''), [slippage, setSlippage] = useState('0.5');
  const [quote, setQuote] = useState<Quote>(), [quoting, setQuoting] = useState(false), [error, setError] = useState('');
  const [allowances, setAllowances] = useState<Allowances>(), [checked, setChecked] = useState(false), [checkingError, setCheckingError] = useState('');
  const requestId = useRef(0);
  let currencies: ReturnType<typeof swapCurrencies> | undefined, configError = '';
  try { currencies = swapCurrencies(runtime, buy); } catch (e) { configError = errorMessage(e); }
  const input = currencies?.input, output = currencies?.output;
  const parsed = amountInput(amount, input?.decimals), bps = Math.round(Number(slippage) * 100);
  const validSlippage = /^\d+(\.\d{1,2})?$/.test(slippage) && bps >= 10 && bps <= 500;
  const quoteKey = `${buy}-${amount}-${bps}-${wallet.account}`;
  const freshQuote = quote?.key === quoteKey && now - quote.at < 60000;
  const matchedAllowances = allowances?.account === wallet.account && allowances?.token === input?.address ? allowances : undefined;
  const native = input?.address === zeroAddress;
  const needToken = !native && parsed !== undefined && (matchedAllowances?.erc20 ?? 0n) < parsed;
  const chainTime = game.data ? Number(game.data.timestamp) + Math.floor((now - game.data.receivedAt) / 1000) : Math.floor(now / 1000);
  const needPermit = !native && parsed !== undefined && ((matchedAllowances?.permit ?? 0n) < parsed || (matchedAllowances?.expiration ?? 0) <= chainTime + 60);
  const insufficient = parsed !== undefined && matchedAllowances !== undefined && parsed > matchedAllowances.balance;
  const refreshAllowance = useCallback(async () => {
    if (!wallet.account || !input || !game.verified) { setAllowances(undefined); return; }
    const account = wallet.account, token = input.address;
    if (token === zeroAddress) { const balance = await runtime.client.getBalance({ address: account }); setAllowances({ account, token, balance, erc20: 0n, permit: 0n, expiration: 0 }); return; }
    const { permit2, universalRouter } = runtime.manifest.network.uniswapV4;
    const [balance, erc20, permit] = await Promise.all([
      runtime.client.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account] }),
      runtime.client.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [account, permit2] }),
      runtime.client.readContract({ address: permit2, abi: permit2Abi, functionName: 'allowance', args: [account, token, universalRouter] }),
    ]);
    setAllowances({ account, token, balance, erc20, permit: permit[0], expiration: Number(permit[1]) });
  }, [wallet.account, input?.address, game.verified, runtime]);
  useEffect(() => {
    let active = true;
    setChecked(false); setCheckingError('');
    if (!game.verified || !input) return;
    const verify = async () => {
      const u = runtime.manifest.network.uniswapV4;
      const targets = [u.quoter, u.universalRouter, u.permit2, u.poolManager, currencies!.pool.hooks, input.address, output!.address].filter(a => a !== zeroAddress);
      const codes = await Promise.all([...new Set(targets)].map(address => runtime.client.getCode({ address })));
      if (codes.some(c => !c || c === '0x')) throw Error('A swap contract has no deployed code. Trading is unavailable.');
      const metadata = await Promise.all([input, output!].filter(t => t.address !== zeroAddress).map(async t => {
        const [symbol, decimals] = await Promise.all([runtime.client.readContract({ address: t.address, abi: erc20Abi, functionName: 'symbol' }), runtime.client.readContract({ address: t.address, abi: erc20Abi, functionName: 'decimals' })]);
        if (symbol !== t.symbol || decimals !== t.decimals) throw Error('Pool token metadata differs from the handoff. Trading is unavailable.');
      }));
      return metadata;
    };
    verify().then(() => { if (active) setChecked(true); }).catch(e => { if (active) setCheckingError(errorMessage(e)); });
    return () => { active = false; };
  }, [game.verified, runtime]);
  useEffect(() => {
    setAllowances(undefined);
    const run = () => { void refreshAllowance().catch(e => { setAllowances(undefined); setError(errorMessage(e)); }); };
    run(); const timer = window.setInterval(() => { if (!document.hidden && !tx.pending) run(); }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshAllowance, tx.pending]);
  useEffect(() => { requestId.current++; setQuote(undefined); setError(''); setQuoting(false); }, [quoteKey]);
  const getQuote = async () => {
    if (!currencies || !parsed || !validSlippage || !checked) return;
    const id = ++requestId.current; setQuoting(true); setError(''); setQuote(undefined);
    try {
      const { result } = await runtime.client.simulateContract({ address: runtime.manifest.network.uniswapV4.quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle', args: [{ poolKey: currencies.pool, zeroForOne: currencies.zeroForOne, exactAmount: parsed, hookData: '0x' }], ...(wallet.account ? { account: wallet.account } : {}) });
      const minimum = minimumOutput(result[0], bps);
      if (result[0] <= 0n || minimum <= 0n || result[0] >= 2n ** 128n) throw Error('This pool returned no usable output. Try a different amount after liquidity is available.');
      if (id === requestId.current) setQuote({ output: result[0], minimum, at: Date.now(), key: quoteKey });
    } catch (e) { if (id === requestId.current) setError(errorMessage(e)); } finally { if (id === requestId.current) setQuoting(false); }
  };
  const execute = () => {
    if (!input || !output || !parsed || !quote || !freshQuote || !currencies || !matchedAllowances) return;
    const u = runtime.manifest.network.uniswapV4;
    if (needToken) void tx.send('swap-token-approve', { address: input.address, abi: erc20Abi, functionName: 'approve', args: [u.permit2, parsed] }, refreshAllowance);
    else if (needPermit) void tx.send('swap-permit-approve', { address: u.permit2, abi: permit2Abi, functionName: 'approve', args: [input.address, u.universalRouter, parsed, chainTime + 1800] }, refreshAllowance);
    else {
      const call = encodeSwap(currencies.pool, input.address, output.address, parsed, quote.minimum, !!u.extendedSwapParams);
      void tx.send('swap', { address: u.universalRouter, abi: routerAbi, functionName: 'execute', args: [call.commands, call.inputs, BigInt(chainTime + 300)], value: call.value }, refreshAllowance);
    }
  };
  return <article className="panel swap-panel" aria-label="Swap tokens"><div className="swap-heading"><h3>Get battle-ready</h3><span className="small muted">{input?.symbol} / {output?.symbol}</span></div>
    <div className="segmented"><button aria-pressed={buy} onClick={() => setBuy(true)}>Buy NECTAR</button><button aria-pressed={!buy} onClick={() => setBuy(false)}>Sell NECTAR</button></div>
    <label className="field" htmlFor="swap-amount">You pay <span>{input?.symbol}</span></label><input id="swap-amount" inputMode="decimal" name="swap-amount" autoComplete="off" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={!!amount && !parsed || insufficient} aria-describedby="swap-hint" />
    <p className="small muted" id="swap-hint">{amount && !parsed ? `Enter a positive amount with up to ${input?.decimals} decimal places.` : insufficient ? 'Your balance is too low for this amount.' : `Balance: ${units(matchedAllowances?.balance, input?.decimals)} ${input?.symbol ?? ''}`}</p>
    <div className="quote-output"><span className="tiny-label">Estimated receive</span><strong>{units(quote?.key === quoteKey ? quote.output : undefined, output?.decimals, 6)} <small>{output?.symbol}</small></strong></div>
    <label className="field slippage">Slippage tolerance (%)<input name="slippage" aria-label="Slippage tolerance (%)" inputMode="decimal" value={slippage} onChange={e => setSlippage(e.target.value)} aria-invalid={!validSlippage} /></label>
    {!validSlippage && <p className="small error-text">Choose 0.1%–5%, with up to two decimal places.</p>}
    <button className="button" disabled={!parsed || !validSlippage || quoting || !checked || tx.pending} onClick={() => void getQuote()}>{quoting ? 'Getting quote…' : quote ? 'Refresh quote' : 'Get quote'}</button>
    <div aria-live="polite">{quote?.key === quoteKey && <div className="quote-details"><p>Minimum received: <strong>{units(quote.minimum, output?.decimals, 6)} {output?.symbol}</strong></p><p className="small">Rate: 1 {input?.symbol} ≈ {parsed ? Number(formatUnits(quote.output, output?.decimals ?? 18)) / Number(formatUnits(parsed, input?.decimals ?? 18)) : '—'} {output?.symbol}</p><p className={`small ${freshQuote ? 'muted' : 'error-text'}`}>{freshQuote ? `Quote expires in ${Math.max(0, Math.ceil((60000 - now + quote.at) / 1000))}s. Pool fee is included; gas is extra.` : 'Quote expired. Refresh before continuing.'}</p></div>}</div>
    {(configError || checkingError || error) && <p className="notice error" role="alert">{configError || checkingError || error}</p>}
    {freshQuote && !native && <ol className="approval-steps"><li className={!needToken ? 'done' : ''}>Approve {input?.symbol} for Permit2</li><li className={!needPermit ? 'done' : ''}>Allow the router to spend through Permit2 · 30 min</li><li>Swap with the minimum output above</li></ol>}
    <Action id={needToken ? 'swap-token-approve' : needPermit ? 'swap-permit-approve' : 'swap'} label={needToken ? `Approve ${input?.symbol ?? 'token'}` : needPermit ? 'Approve router in Permit2' : 'Swap tokens'} disabled={!checked || !parsed || !validSlippage || !freshQuote || insufficient || !matchedAllowances} onClick={execute} primary />
    <TxFeedback ids={['swap-token-approve', 'swap-permit-approve', 'swap']} /><WalletGate />
  </article>;
}
function Transfer() {
  const { runtime, game, wallet, tx } = useApp(); const [recipient, setRecipient] = useState(''), [amount, setAmount] = useState('');
  const address = recipient.trim(), parsed = amountInput(amount);
  const valid = isAddress(address) && address.toLowerCase() !== zeroAddress && parsed !== undefined && parsed <= (game.data?.balance ?? 0n);
  return <details className="transfer"><summary>Send NECTAR to another wallet</summary><p className="small muted">A direct token transfer leaves your wallet permanently. Check the full recipient address before signing.</p><label className="field">Recipient address<input name="recipient" autoComplete="off" spellCheck={false} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…" aria-invalid={!!recipient && (!isAddress(address) || address === zeroAddress)} /></label>{isAddress(address) && <p className="small full-address">To: <AddressLink address={getAddress(address)} label={getAddress(address)} /></p>}<label className="field">Amount (NECTAR)<input name="transfer-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></label><p className="small muted">Wallet balance: {units(wallet.account ? game.data?.balance : undefined)} NECTAR</p><Action id="transfer" label="Send NECTAR" disabled={!valid} onClick={() => { if (valid) void tx.send('transfer', { ...runtime.contracts.LaunchToken, functionName: 'transfer', args: [getAddress(address), parsed] }); }} /><TxFeedback ids={['transfer']} /></details>;
}
