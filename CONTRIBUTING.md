# Contributing to Warrant

Thanks for your interest. Warrant is a monorepo with three independent packages —
`contracts/` (Foundry), `agent/` (Node/TS daemon), and `app/` (Next.js). See the
[README](README.md) for the full architecture and setup.

## Getting started

```bash
git clone --recursive https://github.com/winsznx/warrant.git
cd warrant
```

If you cloned without `--recursive`, fetch the Foundry submodules:

```bash
git submodule update --init --recursive
```

Then set up the package you're working on (each has its own `.env.example`):

| Package | Install | Test / verify |
| --- | --- | --- |
| `contracts/` | `forge install` | `forge test` · `forge fmt` |
| `agent/` | `pnpm install` | `pnpm typecheck` |
| `app/` | `npm install` | `npm run lint` · `npm run build` |

## Ground rules

- **Match the existing style.** No `as any`, `@ts-ignore`, or `@ts-expect-error`.
  Code should read like the surrounding code.
- **Keep changes focused.** One concern per pull request; fix bugs minimally.
- **Verify before you push.** Contracts: `forge test`. Agent/app: typecheck and
  build cleanly. Never commit secrets — only `.env.example` templates.
- **Conventional, terse commit messages** (e.g. `feat(app): ...`, `fix(agent): ...`,
  `chore(contracts): ...`).

## Pull requests

1. Branch from `main`.
2. Make your change with accompanying tests where it touches `contracts/` or
   verifier logic.
3. Ensure the relevant package builds/tests pass.
4. Open a PR describing the change and its rationale.

## Security

Please report vulnerabilities privately — see [SECURITY.md](SECURITY.md). Do not
open public issues for security problems.
