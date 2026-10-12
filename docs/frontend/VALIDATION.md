# Frontend validation and Better Interface review

**Revision:** The report below records the accepted initial round. See [REVISION.md](REVISION.md) for the current revision, findings, final export sizes and checks. Shared screenshots and machine-readable reports have been refreshed against the revised export.

Worker date: 2026-10-12. Scope: frontend source under `web/`, static export under `dist/`, and documentation/evidence under `docs/`. Deployed Solidity, libraries, Foundry settings, root build files and existing contract tests are unchanged. This is worker evidence, not an independent certification or a publication result.

## Result

Complete implementation and validation within the authorized write scope. Production build/typecheck, seven logic tests, twelve browser scenarios, runtime manifest/ABI/assets verification, and live read-only RPC checks passed. **No real transaction was broadcast.** The site was not published and contracts were not redeployed.

The explicit overriding path budget conflicts with the later request for repository-root `DESIGN.md`. The implemented design is documented at **[`docs/DESIGN.md`](../DESIGN.md)** instead. No root file was added to bypass that budget. `web/.gitignore` is the only added ignore file and uses the assignment's explicit allowance.

Git limitation: the worker checkout mounts `.git` read-only. `git add` failed with `Unable to create .git/index.lock: Read-only file system`; the original checkout's index and HEAD therefore cannot be updated here. The source/export/evidence files remain in the allowed workspace paths for submission collection. A temporary Git metadata copy and committed bundle under `/tmp` are used for full-tree path/integrity/size validation without modifying the protected checkout metadata. This does not claim that the workspace HEAD changed.

## Commands and actual outcomes

Run commands from `web/` unless stated otherwise.

| Check | Result |
| --- | --- |
| `npm install --cache /tmp/hive-wars-npm-cache --no-audit --no-fund` | Installed and locked frontend dependencies inside `web/`; dependency/cache directories excluded from Git |
| `npm run build` | Passed strict `tsc --noEmit`, license preservation, Vite production export and post-export manifest generation |
| `npm run typecheck` | Passed; also rerun by every final build, including test source and Vite configuration |
| `npm test` | 7 passed: grid/rings/points, tie/control logic, precision/overflow input validation, standard and extended v4 encoding, native/ ERC-20 value handling, integer slippage, add-chain and rejection behavior |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/hive-wars-browsers npm run test:browser` | 12 passed, 0 failed/skipped/flaky, about 33 seconds; production bytes served at `/preview/` |
| `npm run verify` | Passed: 12 assets totaling 667,647 bytes excluding manifest (672,048 including it); exact ABI bytes/hashes, handoff fields, pool key, network and inventory match |
| `node --import tsx scripts/live-check.mjs` | Passed on the first configured public RPC; no fallback endpoint needed for live evidence |
| Bounded Vite development middleware + Chromium smoke | Same manifest and 3 ABIs as `dist/`; 61 map cells and live state rendered, no page errors |

The final manifest adds only its own small JSON overhead to the export size. Each asset is far below 8 MiB; the asset count is below 128. The export is also far below the HTTP response-body budget. The temporary submission index passes whitespace/path checks: 62 changed files, all under `web/`, `dist/` or `docs/`, no forbidden dotfiles beyond the expressly allowed `web/.gitignore`, no tracked dependency/cache directories or archives, and no submodules or protected-source modifications. Final bundle size is checked against 8,388,608 bytes.

Machine-readable records: [`interaction-results.json`](interaction-results.json), [`accessibility-results.json`](accessibility-results.json), [`live-rpc-check.json`](live-rpc-check.json).

## Browser and interaction evidence

Playwright 1.56.1 used actual Chromium 141.0.7390.37, installed under `/tmp/hive-wars-browsers`. The supplied MCP browser tool could not start because its configured `chrome-for-testing` binary was absent at the tool-owned path. The initial `--with-deps` installation also required unavailable root authentication. A regular Chromium download into the permitted temporary directory worked with the machine's existing libraries; browser validation then ran through local Playwright, with a bounded preview lifecycle.

Every mocked transaction scenario uses real implementation-derived ABI decoding/encoding and EIP-1193 requests. Fixtures exist only in `web/tests/`; they are not runtime fallback data or part of the production JavaScript bundle.

Covered browser behavior:

- Relative static asset, manifest, ABI and font loading from `/preview/`; no local resource failures or uncaught page exceptions in the captured responsive scenario.
- Missing browser wallet, wallet connection rejection/retry, disconnected actions and exact contract-code/ABI verification failures.
- Wrong chain, exactly one switch control, 4902 add-chain using the unchanged handoff object, followed by switching again.
- Join rejection/retry, season lock and disabled competing actions throughout a pending receipt.
- Explicit exact-amount game approval, deploy, move, retreat, immature claim disabled and mature retreat claim.
- Invalid amount/excess balance rejection; custom simulation revert translated before any wallet signing request.
- Buy quote, token-to-Permit2 approval, Permit2-to-router approval, router execute calldata and zero ETH value; sell direction flips `zeroForOne` correctly and clears the old quote.
- Nested Universal Router minimum-output revert translated into a useful retry instruction with zero signed transactions.
- Expired quotes disable execution; amount/direction invalidation; primary-RPC failure falls back to the other configured RPC; account and chain events update prerequisites.
- Recent capture/settlement event decoding, discovered keeper counts, settlement, eligible badge claim, repeat claim disabled and tokenURI image rendering.
- Full-address validation and direct NECTAR transfer calldata.
- Keyboard map selection with Enter, arrows and Home; native selector and amount/action controls at mobile widths; reduced-motion removes the contested animation.
- A separate, unmocked browser scenario renders real public state without a wallet.

Screenshots were captured and inspected:

| Evidence | State |
| --- | --- |
| [`screenshots/mock-1440.png`](screenshots/mock-1440.png) | Full desktop page, deterministic populated game fixture, connected wallet |
| [`screenshots/mock-768.png`](screenshots/mock-768.png) | Intermediate layout, 768×1024 viewport |
| [`screenshots/mock-390.png`](screenshots/mock-390.png) | Mobile hero/status, 390×844 viewport |
| [`screenshots/mock-320.png`](screenshots/mock-320.png) | Minimum supported reflow width, 320×800 viewport |
| [`screenshots/mock-map-390.png`](screenshots/mock-map-390.png) / [`mock-map-320.png`](screenshots/mock-map-320.png) | Full battlefield/detail sections at mobile widths |
| [`screenshots/live-desktop.png`](screenshots/live-desktop.png) | Actual public-chain read state, disconnected wallet |

All four viewport checks found zero horizontal document overflow. These are browser viewport emulations, not physical-device checks. Mock screenshots intentionally show activity that is absent from the initial live game; filenames and this record identify the distinction.

## Six-domain Better Interface coverage

The pinned workflow, core principles of all six domains, and implemented-design documentation section were read and applied. Scope was inferred directly from the approved dark war-room brief; no unrelated theme, admin panel or server was introduced.

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native buttons/inputs, persistent labels, headings/landmarks, skip link, action groups, map roving focus and alternative select, error/status regions, reduced motion; keyboard interaction and Axe scan | No real screen-reader session; no physical touch/device test; not every focus background manually inspected |
| Layout — Checked | Desktop, intermediate and 390/320px production renders; side panel stacking, field/control reachability, zero horizontal overflow | Native 200% browser zoom and text-only enlargement not measured; RTL is not a supported locale and was not mirrored |
| Writing — Checked | Verb-first actions; consistent NECTAR/active/pending/retreat terminology; exact approval steps; explicit no-yield/cooldown/slippage consequences; truthful empty and unavailable states | No localization or editorial user study |
| Typography — Checked | Local font loads verified; numeric stability, heading/body roles, readable enlarged annotations, mobile input size and address wrapping | Tiny redundant map initials/logotype annotations remain dense; native-device font rendering not checked |
| Colors — Checked | Exact requested colony colors, named semantic tokens, textual colony/state cues; browser-computed contrast measured on actual solid surfaces and representative SVG fills | Axe cannot automatically resolve every gradient/SVG background; no claim that every animated/hover pair was measured |
| UI — Checked | Primary/secondary/disabled/checking/signing/receipt/error/success and empty states; low-motion transitions, pulse pause and reduced motion; source review plus real browser interactions | Animation timeline at 10% speed and all wallet-vendor popup UIs were not inspected |

Axe reported **zero automatic violations**, 33 passing rules and one category of incomplete checks (`color-contrast`) for decorative glyphs and SVG/gradient map regions. Those incomplete checks remain recorded rather than being labeled passes. Representative text/fill measurements ranged from 7.51:1 to 16.59:1. Exact computed colors, ratios, font-load results and incomplete examples are retained in `accessibility-results.json`. This is not a claim of complete WCAG compliance.

## Findings, corrections and rechecks

| Severity | Final source location | Finding, fix and evidence |
| --- | --- | --- |
| High | `web/src/transactions.ts:14`, `web/src/game.ts:20` | Source review found that a receipt refresh could join an older in-flight read and unlock an approval early. Added a forced fresh read after receipt, held the lock through allowance refresh, released it after reverted receipts, and retained uncertainty until a recheck. Browser approval sequences and pending-receipt competing-action checks pass. |
| High | `web/src/domain.ts:64`, `web/src/protocol.ts:8` | A nested router revert could otherwise surface an unhelpful selector. Added known router errors, inner `ExecutionFailed` decoding and a recoverable fallback. Browser test injects `V4TooLittleReceived`, verifies its explanation and confirms no signing request. |
| Medium | `web/src/Map.tsx:68` | Axe flagged a generic div carrying `aria-label` as an incomplete ARIA check. Added the correct action-group role. Recheck removes the ARIA incomplete finding; only contrast interpretation remains. |
| Medium | `web/src/Map.tsx:24` | Source/keyboard review found 61 sequential Tab stops. Added roving Tab entry, arrow movement and Home, retaining a native territory selector. Browser keyboard and 320/390px selector checks pass. |
| Medium | `web/src/style.css:170` | Rendered review found several dense annotations smaller than the preferred reading floor. Raised ordinary labels/table annotations to 12px, increased mobile cell IDs and allowed colony-card labels to stack. Re-rendered all widths; no horizontal overflow. Compact exceptions are documented in DESIGN. |
| Medium | `web/src/Observability.tsx:25` | Older history was appended behind the newest items and could remain hidden. Pages now replace the visible block window, with explicit disclosure beyond 30 events. Source recheck confirms bounded independent windows; live recent logs and mocked event decoding pass. |
| Medium | `web/vite.config.ts:7` | Development Vite initially had no manifest route although the production export did. Added development-only reads of the exact exported manifest/ABI files. Bounded middleware and actual development-browser smoke checks pass. |
| Low | `web/src/style.css:40` | Full element screenshots exposed an unfocused offscreen skip link due to capture behavior. Added clipping while unfocused, verified Tab reveals it, and recaptured mobile map sections. |
| Low | `web/src/style.css:2`, `web/scripts/licenses.mjs:1` | Default font CSS emitted unused WOFF fallbacks. Switched to only required WOFF2 faces and preserved full dependency licenses in one exported notice file. Final font/resource and asset-inventory checks pass. |

During test development, the swap direction-change assertion initially expected an approval even when the mock already reported an allowance; it was corrected to check quote invalidation and verify reverse-direction calldata. A pending-receipt test also held its mocked block number fixed, preventing the receipt watcher from seeing a new block; advancing the fixture block when releasing the receipt removed that timing flaw. Final recorded run: 12 passes, zero retries/flakes. A TypeScript mismatch from two installed Playwright-core versions was fixed by pinning a single core version with a `web/package.json` override. These were repaired; they are not hidden successful-check substitutions.

## Live-chain observations and limits

At block **26,177,495**, the primary `https://ethereum-rpc.publicnode.com` endpoint reported chain ID **1**, nonempty code at every application contract and every configured Uniswap address, matching immutable NECTAR/HiveWars bindings, NECTAR decimals 18 and symbol `NECTAR`. `mapState()` returned 61 cells. Season 1/epoch 1 was active, all colony counters/scores were zero, and no season was finalized. The exact timestamp, addresses, code lengths/hashes and returned reads are in `live-rpc-check.json`.

Read-only simulations through the supplied quoter succeeded for 1 IMD → NECTAR and 1 NECTAR → IMD using the exact attested pool key. These historical quote outputs are **not** hardcoded into the site and are not execution guarantees. They do not establish that a funded wallet transaction, approval or swap has completed.

Not performed: real wallet signing, paid deployment/approval/move/retreat/settlement/badge/swap transactions, real time waiting through an epoch/season/cooldown, hardware-wallet tests, reorg or replacement transaction integration tests, screen-reader/native-zoom/physical-mobile checks, publication/IPFS naming or fixed-CID control-plane verification. Uncertain or cancelled transaction paths are implemented, but every receipt replacement variant was not exercised against a live chain.

WalletConnect, ENS reverse lookup and USD price feeds are not configured; the supplied inputs contain no project ID, resolver configuration or price source. Browser wallet connectors, checksummed addresses and explicit token-unit pricing work without them. Absolute social-preview image/canonical URLs await a published domain; title, description and favicon are present. Event/keeper discovery is a bounded scan, not an archival index; smart-account keepers may differ from transaction senders. Badge images are onchain and are isolated `img` resources. Very long historical `seasonInfo` arrays remain subject to RPC limits.

Publishing is a downstream stage. The export, runtime manifest and evidence are the worker deliverable; no published URL or CID is claimed. The collector must commit the allowed working-tree files, or consume the temporary committed bundle, because this worker cannot write the checkout's Git metadata.
