# Hive Wars frontend

A static React + TypeScript war room for the deployed HiveWars game. The production site is the **committed repository-root `dist/` directory**. It needs no backend, wallet service key, or build step at publication time.

## Install, build, preview

Use Node 22.12+ (worker: Node 24.9.0) and npm. Start from a full Git checkout that includes the handoff's deployed source commit.

```sh
cd web
npm ci --cache /tmp/hive-wars-npm-cache
npm run build
npm run preview
```

Open the URL printed by Vite. To test a gateway-style subpath, run `node scripts/serve.mjs` and open `http://127.0.0.1:4173/preview/`. Stop with Ctrl+C. `npm run dev` provides hot reload after the first build; its development middleware serves the **same** manifest and ABI files from `dist/`.

Build runs strict TypeScript checking, gathers dependency licenses, exports with Vite `base: './'`, and finally regenerates `dist/imd-deployment.json`. All UI assets and fonts are local. Navigation uses document anchors, so static hosting needs no route rewrites. Host `dist/` as a directory with a trailing-slash entrypoint. Do not upload `web/node_modules/`.

## Configuration and ABI provenance

`src/config.ts` loads `./imd-deployment.json` at runtime and loads each ABI via its relative `abiPath`. It checks the ABI's recursively key-sorted JSON Keccak-256 against the manifest, verifies the RPC chain ID and deployed code, and reads both immutable contract bindings. There is no separately bundled deployment address, chain, RPC, or application ABI map.

The build inputs in `docs/frontend/deployment-handoff.json` and `network-handoff.json` are exact preserved copies of the supplied handoffs, retained because worker `.imd/reads/` files are removed at submission. When the pinned reads are present, export validation compares the preserved copies to them. Application ABIs are obtained using `git show <sourceCommit>:docs/abi/<Contract>.json`; the build fails if their canonical Keccak hashes differ. A shallow checkout must obtain that source commit before building.

The manifest copies the exact contract set, launch identifiers, deployed source commit, attestation hash, pool key, network, and add-chain parameters. Every other exported file, including ABI JSON and license notices, is inventoried with its final SHA-256. `npm run verify` independently recomputes the inventory and compares the current manifest, handoffs, and pinned ABI bytes. Never hand-edit files under `dist/`; rebuild after source changes.

Protocol **interfaces**, without addresses, are centralized in `src/protocol.ts`. All quote, approval, Permit2 and Universal Router targets come from `manifest.network.uniswapV4`. The exact handoff pool key, including its nonzero hook, is used for both swap directions. Protocol router error signatures were cross-checked against the `@uniswap/universal-router` 2.1.0 `UniversalRouter` artifact; this package is not required at runtime or vendored.

## Wallets and transaction behavior

- Browser wallets use EIP-6963 discovery with injected EIP-1193 fallback. The header offers a chooser when several wallets announce themselves. No WalletConnect project ID was supplied, so no WalletConnect relay connector is configured. Adding one later requires an actual public project ID and connector integration, never a placeholder.
- Addresses have checksum display, explorer links and copy controls. Transfers accept full Ethereum addresses, not ENS input. ENS reverse lookup is not configured because the handoff supplies no resolver configuration. Disconnect clears the local app session; permission revocation belongs to the wallet.
- A wrong chain disables actions and offers one switch button. Error 4902/unknown-chain responses trigger the exact `wallet_addEthereumChain` parameters and a second switch attempt.
- Public reads use the supplied RPCs in order, with HTTP batching and fallback. Game state is read at one block every 5 seconds while connected or 30 seconds while disconnected; hidden tabs do not poll. Reads older than 45 seconds and failed reads disable transaction controls. A transaction also checks the wallet account and chain immediately before signing.
- Every write is simulated, then signed by the visitor, then held pending through one successful receipt and state refresh. The originating action has its own status label; a shared signing lock prevents competing requests. Rejection/revert feedback remains inline. Uncertain confirmations retain the lock and offer a receipt recheck plus explorer link. A full page reload does not persist pending transaction tracking; check the wallet/explorer before resubmitting.
- Deploy requires an explicit exact-amount NECTAR approval to HiveWars. Move/retreat consume the selected territory's stake. Retreats unlock individually after 24 hours; one claim pays at most 64 mature entries. Joining locks the season choice. The deployed implementation has immutable NECTAR/game bindings and no owner/setter, so there is no fictitious binding panel.
- Buy spends **IMD**, not ETH. Sell spends NECTAR. Non-native inputs explicitly approve the token to Permit2, then Permit2 to the configured router; each step reads current allowances and waits for confirmation. Router approval lasts 30 minutes and covers only the entered amount. No unlimited approval is requested.
- Quotes are `simulateContract` reads, expire after 60 seconds, and invalidate when amount, direction, account or slippage changes. Slippage is 0.1%–5%. The router transaction uses commands `0x10`, actions `0x060c0f`, exact pool key, minimum output, and a five-minute deadline. `extendedSwapParams` is supported when the network declares it. ERC-20 pairs send zero ETH value. Native input support sends only its input amount and skips approvals. Gas is separate; USD prices are explicitly unavailable.

## Observability and bounded history

The app displays live season/epoch countdowns, colony members/active stake/scores, all 61 territories, pending control changes, wallet deployments/cooldowns, badge progress and finalized winners. Map geometry mirrors the pinned `territoryCoordinates` implementation and is tested for all ring sizes; no invented control or stake data appears before RPC responses.

War Log reads 2,000-block pages from the configured public RPC, displays up to 150 events per page, and allows older pages and further disclosure. Refresh returns to the newest page. Keeper ranking is explicitly **discovered keepers**, using transaction senders from up to 20 loaded settlement transactions and their `keeperSettlements` counts. It is not a complete historical index, and forwarded/smart-account calls can have a different game caller than the transaction sender. Your own keeper count is read directly.

Badge history paginates six finalized seasons at a time; a season field checks any finalized season directly. Minted images are decoded from the contract's base64 JSON and rendered as isolated `img` data URLs, never injected HTML. The badge is soulbound; transfer/approval methods that always revert have no transaction control.

## Validation

```sh
cd web
npm run typecheck
npm test
PLAYWRIGHT_BROWSERS_PATH=/tmp/hive-wars-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/hive-wars-browsers npm run test:browser
npm run verify
node --import tsx scripts/live-check.mjs
```

Browser tests serve the actual production export under `/preview/`, start and stop their own preview, and mock wallet/RPC behavior for writes. One test reads live public state with **no wallet**. Tests never broadcast transactions. Browser traces/results go under `/tmp`; durable screenshots and review results are under `docs/frontend/`. The live-check script only reads code/state and simulates quotes, then writes `docs/frontend/live-rpc-check.json`.

See [validation evidence](../docs/frontend/VALIDATION.md), [design documentation](../docs/DESIGN.md), and [guide attribution](../docs/frontend/ATTRIBUTION.md). Root `DESIGN.md` is intentionally not created: the assignment's overriding write budget permits documentation only under `docs/` or `web/`. No contracts or root build settings are modified. Publishing, site naming and IPFS pinning remain downstream operations.
