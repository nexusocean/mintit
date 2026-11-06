# Contributing

Thanks for taking a look at mintit. This is a young project — expect rough edges, and expect scope discussions before large changes.

## Before you start

For anything more than a small fix, open an issue first to discuss the approach. It avoids wasted work if the direction isn't a fit.

## Dev setup

See the [Development](./README.md#development) section of the README for getting a local environment running (`pnpm dev` for hot reload, or [`docker/`](./docker) for a containerized deployment).

## Making a change

1. Fork the repo and create a branch off `main`.
2. Keep changes focused — one concern per PR. Unrelated cleanups make review harder and are easy to split into a follow-up.
3. Before opening a PR:
   - `pnpm lint` — must pass with no new warnings.
   - `pnpm build` — runs `tsc` across all packages; must typecheck cleanly.
   - Manually exercise the change (there's no automated test suite yet for most of the app — say so explicitly in your PR if you couldn't test something end-to-end).
4. Open the PR against `main` and fill out the PR template.

## Code style

- Formatting is enforced by Prettier (`pnpm format`) and a pre-commit hook (Husky) — don't fight it.
- Match the conventions already in the file you're editing over introducing a new pattern.
- No dead code, no commented-out blocks, no speculative abstractions for hypothetical future needs.

## Reporting bugs / requesting features

Use GitHub Issues. For security-sensitive reports (anything touching wallet keys, auth, or payment integrity), see [SECURITY.md](./SECURITY.md) instead of filing a public issue.
