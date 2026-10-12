import { useCallback, useEffect, useState } from 'react';
import { getAddress, isAddress, numberToHex, type Address } from 'viem';
import type { Runtime } from './config';
import { errorMessage } from './domain';

export interface Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}
declare global { interface Window { ethereum?: Provider } }
export type WalletOption = { id: string; name: string; provider: Provider };
export async function switchChain(provider: Provider, runtime: Runtime) {
  const chainId = numberToHex(runtime.manifest.chainId);
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] }); }
  catch (error) {
    const e = error as { code?: number; message?: string; data?: { originalError?: { code?: number } } };
    if ((e.code === 4902 || e.data?.originalError?.code === 4902 || /unknown chain|unrecognized chain|not added/i.test(e.message ?? '')) && runtime.manifest.walletAddChain) {
      await provider.request({ method: 'wallet_addEthereumChain', params: [runtime.manifest.walletAddChain] });
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
    } else throw error;
  }
}
export function useWallet(runtime: Runtime) {
  const [options, setOptions] = useState<WalletOption[]>([]);
  const [provider, setProvider] = useState<Provider>();
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const discovered = (event: Event) => {
      const { info, provider } = (event as CustomEvent<{ info: { uuid: string; name: string }; provider: Provider }>).detail;
      setOptions(old => old.some(o => o.provider === provider) ? old : [...old.filter(o => o.id !== 'injected'), { id: info.uuid, name: info.name, provider }]);
    };
    window.addEventListener('eip6963:announceProvider', discovered);
    if (window.ethereum) setOptions([{ id: 'injected', name: 'Browser wallet', provider: window.ethereum }]);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', discovered);
  }, []);
  useEffect(() => {
    if (!provider) return;
    const accounts = (...args: unknown[]) => { const a = (args[0] as string[])[0]; setAccount(a && isAddress(a) ? getAddress(a) : undefined); };
    const chain = (...args: unknown[]) => setChainId(Number(args[0]));
    const disconnect = () => { setAccount(undefined); setChainId(undefined); };
    provider.on?.('accountsChanged', accounts); provider.on?.('chainChanged', chain); provider.on?.('disconnect', disconnect);
    return () => { provider.removeListener?.('accountsChanged', accounts); provider.removeListener?.('chainChanged', chain); provider.removeListener?.('disconnect', disconnect); };
  }, [provider]);
  const connect = useCallback(async (selected?: Provider) => {
    const p = selected ?? options[0]?.provider;
    if (!p) { setError('No browser wallet found. Open this site in an Ethereum wallet browser or install a browser wallet, then reload.'); return; }
    setBusy(true); setError('');
    try {
      const addresses = await p.request({ method: 'eth_requestAccounts' }) as Address[];
      const chain = Number(await p.request({ method: 'eth_chainId' }));
      if (!addresses[0]) throw Error('No account was shared. Unlock your wallet and try again.');
      setProvider(p); setAccount(getAddress(addresses[0])); setChainId(chain);
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }, [options]);
  const switchNetwork = async () => {
    if (!provider) return;
    setBusy(true); setError('');
    try { await switchChain(provider, runtime); setChainId(Number(await provider.request({ method: 'eth_chainId' }))); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  };
  return { options, provider, account, chainId, busy, error, connect, switchNetwork, disconnect: () => { setProvider(undefined); setAccount(undefined); setChainId(undefined); }, correctChain: chainId === runtime.manifest.chainId };
}
export type Wallet = ReturnType<typeof useWallet>;
