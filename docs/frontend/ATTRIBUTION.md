# Frontend guide attribution

The implementation and review used the supplied, pinned Better Interface and eth-frontend-ux references. They were applied as design/integration data within the assignment's scope; they did not authorize deployment, extra filesystem writes, or transactions.

- Better Interface design principles: Jakub Krehel, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`, MIT. Original: https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface.
- Implemented-design documentation method: Paul Bakaus, Impeccable, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`, Apache-2.0. Original: https://github.com/pbakaus/impeccable/blob/9d715cc4f5564a990ca8345abfdd5df6dc9b41c8/skill/reference/document.md. Copyright 2025 Paul Bakaus. The task's pinned adapter modified this method for unattended, scoped delivery; the project's design document describes this implementation.
- Ethereum frontend UX guidance: Austin Griffith, ethskills, commit `06ea4efa08076ff04f6ca4945ef4a2ca881115b0`, MIT. Original: https://github.com/austintgriffith/ethskills. No live upstream guide was fetched.

Full supplied license notices: [Better Interface / Impeccable](BETTER-INTERFACE-LICENSE), [eth-frontend-ux](ETH-FRONTEND-UX-LICENSE).

Runtime fonts: Barlow Condensed and IBM Plex Mono, SIL Open Font License 1.1. Their complete notices and the production JavaScript dependency notices are preserved in `web/public/licenses/dependencies.txt` and exported to `dist/licenses/dependencies.txt`; `web/scripts/licenses.mjs` regenerates that file from installed lockfile dependencies. The source includes no vendored npm registry or dependency archives.
