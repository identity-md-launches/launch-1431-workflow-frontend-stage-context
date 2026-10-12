import { createContext, useContext } from 'react';
import type { Runtime } from './config';
import type { Wallet } from './wallet';
import type { Game } from './game';
import type { Transactions } from './transactions';
export type AppContext = { runtime: Runtime; wallet: Wallet; game: Game; tx: Transactions; ready: boolean; now: number };
export const Context = createContext<AppContext | undefined>(undefined);
export function useApp() { const context = useContext(Context); if (!context) throw Error('App context missing'); return context; }
