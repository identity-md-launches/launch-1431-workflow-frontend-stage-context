import { useRef, useState } from 'react';
import { encodeFunctionData, numberToHex, type Abi, type Address, type Hash } from 'viem';
import type { Runtime } from './config';
import type { Wallet } from './wallet';
import { errorMessage } from './domain';

export type TxState = { key: string; phase: 'simulation' | 'wallet' | 'confirmation' | 'success' | 'error' | 'unknown'; message: string; hash?: Hash };
export type Write = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint };
export function useTransactions(runtime: Runtime, wallet: Wallet, refresh: () => Promise<void>, ready: boolean) {
  const [state, setState] = useState<TxState>();
  const lock = useRef(false);
  const afterReceipt = useRef<(() => Promise<void>) | undefined>(undefined);
  const pending = !!state && ['simulation', 'wallet', 'confirmation', 'unknown'].includes(state.phase);
  const finish = async (key: string, hash: Hash) => {
    setState({ key, phase: 'confirmation', message: 'Transaction sent. Waiting for confirmation…', hash });
    let cancelled = false;
    let confirmed = false;
    try {
      const receipt = await runtime.client.waitForTransactionReceipt({ hash, timeout: 180000, confirmations: 1, onReplaced: replacement => { hash = replacement.transaction.hash; cancelled = replacement.reason === 'cancelled'; } });
      if (receipt.status !== 'success') { lock.current = false; setState({ key, phase: 'error', message: 'The transaction reverted. No action was applied. Refresh and try again.', hash }); return; }
      if (cancelled) { lock.current = false; setState({ key, phase: 'error', message: 'The transaction was cancelled in your wallet. The requested action was not applied.', hash }); return; }
      confirmed = true;
      await refresh();
      if (afterReceipt.current) await afterReceipt.current();
      setState({ key, phase: 'success', message: 'Confirmed onchain. The latest game state has been requested.', hash });
    } catch {
      setState({ key, phase: 'unknown', message: confirmed ? 'The transaction confirmed, but updated balances could not be loaded. Check confirmation again to retry the state refresh before sending another transaction.' : 'Confirmation is taking longer than expected. Check the explorer or check confirmation again before sending another transaction.', hash });
      return;
    } finally { /* An uncertain receipt keeps the signing lock until explicitly resolved. */ }
    lock.current = false;
    afterReceipt.current = undefined;
  };
  const send = async (key: string, write: Write, after?: () => Promise<void>) => {
    if (lock.current) return;
    if (!ready || !wallet.account || !wallet.provider || !wallet.correctChain) { setState({ key, phase: 'error', message: 'Connect on the required network and wait for verified, current state before continuing.' }); return; }
    lock.current = true;
    afterReceipt.current = after;
    setState({ key, phase: 'simulation', message: 'Checking this action against current contract state…' });
    let hash: Hash | undefined;
    try {
      await runtime.client.simulateContract({ ...write, account: wallet.account });
      const [chain, accounts] = await Promise.all([wallet.provider.request({ method: 'eth_chainId' }), wallet.provider.request({ method: 'eth_accounts' })]);
      if (Number(chain) !== runtime.manifest.chainId || (accounts as string[])[0]?.toLowerCase() !== wallet.account.toLowerCase()) throw Error('The wallet account or network changed. Refresh state before trying again.');
      setState({ key, phase: 'wallet', message: 'Review this action and the network fee in your wallet.' });
      hash = await wallet.provider.request({ method: 'eth_sendTransaction', params: [{ from: wallet.account, to: write.address,
        data: encodeFunctionData({ abi: write.abi, functionName: write.functionName, args: write.args }),
        value: numberToHex(write.value ?? 0n), chainId: numberToHex(runtime.manifest.chainId) }] }) as Hash;
      await finish(key, hash);
    } catch (error) {
      if (hash) setState({ key, phase: 'unknown', message: 'A transaction was sent, but state could not be refreshed. Check its confirmation before continuing.', hash });
      else { lock.current = false; setState({ key, phase: 'error', message: errorMessage(error) }); }
    }
  };
  return { state, pending, send, recheck: async () => { if (state?.hash) await finish(state.key, state.hash); } };
}
export type Transactions = ReturnType<typeof useTransactions>;
