# The new Portfolio Review application (CR-0006)

The sources of the new application, built beside the legacy `index.html` (which stays the review link until parity).
`scripts/build.mjs` bundles them into one offline HTML file, `app/dist/index.html` (git-ignored), that Pages publishes
at `/next/` with a "Preview, not for client use" banner (D-024).

```
npm ci              # the pinned tooling, from the lockfile
npm run typecheck   # TypeScript, no emit
npm run build       # app/dist/index.html
npm run check       # the built page's invariants (CSP, no network, one allowed link, banner)
npm run serve       # http://127.0.0.1:8100/next/
```

Rules for code here (architecture section 17; checked by `scripts/validation/check-next.mjs`): no network API, no
remote URL (the MF Screener link lives only in `src/config/links.json` and the build writes it into the page), no
`innerHTML`, `eval` or similar, no inline style attribute, no client data in browser storage. A missing value is a
dash with its status, never a zero (D-029; `CLAUDE.md` rule 3).

Toolchain, build design, invariants and the M1.2 spike results: `docs/new-build/toolchain.md`. Architecture:
`docs/new-build/03-architecture.md`.
