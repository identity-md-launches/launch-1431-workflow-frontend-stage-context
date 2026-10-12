import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import type { Runtime } from './config';
import { verifyDeployment } from './config';
import { errorMessage, type ColonyState, type Player, type Season, type Territory } from './domain';

export interface GameData {
  map: readonly Territory[]; colonies: ColonyState; season: Season; player?: Player;
  balance?: bigint; allowance?: bigint; decimals: number; block: bigint; timestamp: bigint; receivedAt: number; account?: Address;
}
export function useGame(runtime: Runtime, account?: Address) {
  const [data, setData] = useState<GameData>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const inFlight = useRef<Promise<void> | undefined>(undefined);
  const generation = useRef(0);
  const accountRef = useRef(account); accountRef.current = account;
  const verifiedRef = useRef(false);
  const refresh = useCallback(async (force = false) => {
    if (inFlight.current) { await inFlight.current; if (!force) return; }
    const gen = generation.current, requestedAccount = accountRef.current;
    const task = (async () => {
      setLoading(true);
      try {
        if (!verifiedRef.current) { await verifyDeployment(runtime); verifiedRef.current = true; setVerified(true); }
        const block = await runtime.client.getBlock({ blockTag: 'latest' });
        const read = (name: keyof Runtime['contracts'], functionName: string, args?: readonly unknown[]) => runtime.client.readContract({ ...runtime.contracts[name], functionName, args, blockNumber: block.number });
        const [map, colonies, season, decimals, player, balance, allowance] = await Promise.all([
          read('HiveWars', 'mapState'), read('HiveWars', 'colonyState'), read('HiveWars', 'seasonInfo'), read('LaunchToken', 'decimals'),
          requestedAccount ? read('HiveWars', 'playerState', [requestedAccount]) : undefined,
          requestedAccount ? read('LaunchToken', 'balanceOf', [requestedAccount]) : undefined,
          requestedAccount ? read('LaunchToken', 'allowance', [requestedAccount, runtime.contracts.HiveWars.address]) : undefined,
        ]);
        if (gen !== generation.current || requestedAccount !== accountRef.current) return;
        if (!Array.isArray(map) || map.length !== 61 || Number(decimals) !== 18) throw Error('The game response does not match this implementation. Actions are disabled.');
        setData({ map: map as Territory[], colonies: colonies as ColonyState, season: season as Season, player: player as Player | undefined, balance: balance as bigint | undefined, allowance: allowance as bigint | undefined, decimals: Number(decimals), block: block.number, timestamp: block.timestamp, receivedAt: Date.now(), account: requestedAccount });
        setError('');
      } catch (error) { if (gen === generation.current) setError(errorMessage(error)); }
      finally { if (gen === generation.current) setLoading(false); }
    })();
    inFlight.current = task;
    try { await task; } finally { inFlight.current = undefined; }
  }, [runtime]);
  useEffect(() => {
    generation.current++; setLoading(true);
    const start = async () => { await inFlight.current; await refresh(); };
    void start();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, account ? 5000 : 30000);
    return () => { generation.current++; window.clearInterval(timer); };
  }, [account, refresh]);
  return { data, error, loading, verified, refresh };
}
export type Game = ReturnType<typeof useGame>;
