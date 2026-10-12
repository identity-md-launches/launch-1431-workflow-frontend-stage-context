# Frontend revision validation

Worker date: 2026-10-12. Complete for this revision's authorized scope. This is worker evidence, not independent certification or publication verification.

The accepted implementation was retained. Changes address the seven reported findings: mobile entry layout, army totals, swap-check recovery, section labels, typography, task headings and share metadata. Contracts, protocol encoding, runtime addresses, chain/RPC configuration, application ABIs and ownership behavior are unchanged. `.imd-responses.json` answers every finding. Its root location is explicitly authorized by the revision; design documentation remains in `docs/DESIGN.md` because the overriding path budget excludes root `DESIGN.md`.

## Reproduction and fixes

The accepted `dist/` was served with the existing server logic under `/preview/` and tested in Chromium with `web/tests/mock-chain.ts`. The raw before measurements are in [revision-before.json](revision-before.json). No real wallet or funds were used. The independent taste@1 runner was not run; rendered DOM/style measurements and visual inspection reproduced its reported underlying conditions.

| Finding (ID prefix) | Reproduced behavior | Correction and recheck |
| --- | --- | --- |
| High: phone entry (`7232b120`) | At 390×844, hero y=136.59, height=876.23; map y=1285; zero visible cells. | `web/src/App.tsx:35`, `web/src/Map.tsx:12`, `web/src/style.css:172`: compact mobile header/story/status, two-column score summary, no mobile secondary hero description/actions or mission strip, short map heading and inline count. All 61 cells plus selector now fit at scrollY=0 at both tested phone widths; pointer and native-select interaction preserve scrollY=0. Amber emphasis, required story, live scores/countdown and wallet action remain. |
| High: army overflow (`cf463dd5`) | With 100,000,000.5 active and pending troops and consistent Core totals, document width was 342px at a 320px viewport. Pending total ended at x=342. | `web/src/style.css:208`: one `minmax(0, 1fr)` column with 20px gap on mobile. Both complete totals render at 32px within the army panel. Document width equals viewport width at 320, 390 and 1440px. Large deployment tables retain their existing contained horizontal scrolling. |
| Medium: stranded swap (`00118b69`) | After quoter code errors from both configured RPCs, restoring RPCs, changing direction and waiting 32 seconds left verification calls at 2, quoting disabled and no retry. | `web/src/Swap.tsx:18`, `web/src/Swap.tsx:101`: an inline retry reruns the same code/metadata verification effect, clears the old error and disables retry/quote/signing during checks. Tests cover repeated RPC failure, missing code, mismatched metadata, successful recovery, and quotes in both directions with zero signed transactions. |
| Medium: kickers (`a6249fb3`) | Decorative heading labels and computed `.eyebrow` letter spacing of 1.92px appeared across the dashboard. | `web/src/ui.tsx:42`, `web/src/App.tsx:35`, `web/src/Map.tsx:12`: remove decorative paragraphs and their heading margins. Meaningful network, sector, colony and value labels remain in sentence case at normal letter spacing. No `.eyebrow` elements remain in either measured layout. |
| Medium: type scale (`31bd01ff`) | Rendered content had overlapping heading, numeric and label sizes (including 28/28.8/29.6/30.4/32/33.6/40/41.6/56px). | `web/src/style.css:13`: shared 12/14/16/24/32px tokens plus the responsive hero. Panel headings are 24px, section headings 32px, inputs 16px. The final probe finds six content sizes at 390 and 1440px. Redundant map artwork marks have 8/10px exceptions. Three existing font families and weights are retained. |
| Medium: task headings (`2a668cf8`) | All three reported slogan headings and the two-line join subtitle matched the report. | `web/src/Sections.tsx:10`, `web/src/Sections.tsx:71`, `web/src/Observability.tsx:38`: use “Join a colony”, “War log and settlements”, “How to play” and “Your colony is fixed for this season.” The five instructions and required hero story are unchanged. Browser assertions confirm the new headings at both widths. |
| Medium: share image (`2791c644`) | `og:image` was absent from static HTML and no card was exported. | `web/index.html:11`, `web/scripts/share-card.ts:1`: static 1200×630 PNG reuses the actual map coordinates, colors and local font. Static HTML declares image, width, height and alt metadata. A test fetches the declared `/preview/` image, checks its PNG dimensions and inventory entry. The final origin is not supplied; the pinned prepublication exception permits the relative path. The publisher's absolute-URL step is documented in `web/README.md`. |

First-screen measurements after correction:

| Viewport | Map top | Selector bottom | Fully visible cells | Document overflow |
| --- | ---: | ---: | ---: | --- |
| 390×844 | 481.95px | 834.50px | 61 | None |
| 320×844 | 468.89px | 766.75px | 61 | None |

Intermediate iterations were repaired before the final export. The first compact layout exposed 56 cells and left the selector below the fold. Compacting the map count and removing the redundant mobile tactical label made it fit. The typography pass also exposed 1px of overflow with the large map totals; using the 12px data-label step in the narrow stake table removed it. Assertions were kept strict: every cell, complete totals, no document overflow, and selector bottom ≤844px.

## Commands and evidence

Run from `web/`. Dependencies and browser binaries are installed outside the submission; no ignore-file change was necessary. The existing port 4173 was occupied, so the server/test configuration now supports `HIVE_PREVIEW_PORT`; this run used 4183.

| Command | Actual result |
| --- | --- |
| `npm ci --cache /tmp/hive-wars-npm-cache --no-audit --no-fund` | Locked dependencies installed successfully using a writable cache. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/hive-wars-browsers npx playwright install chromium` | Chromium 141.0.7390.37 for Playwright 1.56.1 installed under `/tmp`. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/hive-wars-browsers node --import tsx scripts/share-card.ts` | Rendered and visually inspected the 1200×630 card. Normal builds reuse the committed PNG. |
| `npm run build` | Final strict typecheck, license collection, Vite export and manifest generation passed. |
| `npm test` | Seven logic tests passed. No game/protocol logic changed in this revision. |
| `HIVE_PREVIEW_PORT=4183 PLAYWRIGHT_BROWSERS_PATH=/tmp/hive-wars-browsers npm run test:browser` | 17 browser scenarios passed: the 12 existing scenarios and five revision regressions. Includes actual read-only public RPC rendering. |
| `npm run verify` | 13 assets, 902,934 bytes excluding manifest; 907,463 bytes including it. Every SHA-256, exact handoff field, pool key, network block and pinned ABI byte/hash matches. |
| `node --import tsx scripts/live-check.mjs` | Public RPC chain ID 1, code at all app/protocol contracts, immutable bindings, 61 cells, token metadata and both 1-token quote simulations succeeded at block 26,177,829. No transaction submitted. |
| Final path/pack checks | Full-history temporary Git bundle checked against 8,388,608 bytes. No changes to protected source/configuration, no dependency/cache directories or archives in the index, no submodules, and no whitespace errors. |

The checkout's Git metadata is read-only. The changed source, static export and evidence are left in the authorized working-tree paths for collection; a temporary Git metadata copy under `/tmp` provides the committed bundle and size check. This does not claim the protected checkout's HEAD changed.

Machine-readable evidence: [browser scenarios](interaction-results.json), [accessibility](accessibility-results.json), [live RPC](live-rpc-check.json), [phone geometry](revision-phone.json), [large army totals](revision-army.json), [swap recovery](revision-swap.json), [type/label measurements](revision-design.json). The test code is `web/tests/revision.spec.ts`, supplementing the retained `app.spec.ts` and `logic.test.ts`.

Rendered evidence inspected: [390px entry](screenshots/revision-entry-390.png), [320px entry](screenshots/revision-entry-320.png), [large army totals](screenshots/revision-army-320.png), [desktop](screenshots/mock-1440.png), [intermediate](screenshots/mock-768.png), [mobile territory controls](screenshots/mock-map-390.png), and the exported share card. Other existing responsive screenshots are also refreshed by the test suite. Screenshots with `mock`/`revision` names use deterministic fixtures, not reported live ownership.

## Better Interface coverage

The pinned workflow, six domain cores and implemented-design documentation section informed the scoped revision. `docs/DESIGN.md` describes the final source.

| Domain | Coverage | Findings addressed / limitations |
| --- | --- | --- |
| Accessibility — Checked | Retained native controls, labeled selector, roving map focus, keyboard arrows/Home/Enter, visible focus, reduced motion, retry status region, and Axe scan. | Zero automatic violations, 33 passing rules. Contrast has incomplete checks for SVG/gradient/glyph regions; these are not called passes. No screen-reader session or physical touch test. |
| Layout — Checked | Initial 390×844/320×844 entry, 320/390/1440 large balances, and existing 320/390/768/1440 responsive render/overflow checks. | Both high findings fixed. Native 200% zoom, text-only enlargement and RTL not performed. |
| Writing — Checked | Task headings, concise join constraint, meaningful data labels and contextual retry wording. | Requested copy fixed; five instructions and story preserved. No localization/user study. |
| Typography — Checked | Computed six-step content scale, heading hierarchy, normal label tracking, local font-load checks, complete troop totals. | Font-size fragmentation fixed. Small map artwork is redundant with the readable selector/detail panel; physical-device font rendering not tested. |
| Colors — Checked | Existing palette retained; actual solid-surface and representative map text/fill pairs measured by the browser test. | All measured pairs ≥4.5:1; detailed values are in `accessibility-results.json`. This is not a claim about every composited/animated pair. |
| UI — Checked | Pending/error/retry/success and disabled swap states; existing transaction scenarios; map pause/reduced motion; static share-card retrieval. | Retry and share-image findings addressed. Wallet-vendor dialogs, motion at 10% speed and social-crawler ingestion not tested. |

No real signing, approval, swap, deployment, staking, settlement or badge-claim transaction was broadcast. Epoch/season/cooldown behavior uses mocked state instead of real-time waits. Native-device/WebKit/Firefox rendering, hardware wallets and reorg/replacement integration were not tested in this revision. The absolute share-image URL awaits the publisher's final origin. Publication, IPFS pinning, site naming and fixed-CID control-plane checks remain downstream and are not claimed as worker results.
