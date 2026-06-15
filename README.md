# Warrant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Celo](https://img.shields.io/badge/Celo-Mainnet-FCFF52)](https://celoscan.io/address/0x3c05E7C7865fdA87E4C11cb3fCDEA91882fDd10D)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-agent%209313-7C3AED)](https://8004scan.io/agents/celo/9313)
[![x402](https://img.shields.io/badge/x402-pay--per--verification-22C55E)](X402.md)

> Onchain conditional payment escrow agent on Celo — lock cUSD, define a condition, and let an autonomous agent verify the proof and release (or refund) the funds onchain.

Warrant turns "I'll pay you when X happens" into an onchain escrow that an AI agent settles for you. A payer locks cUSD against a condition. The counterparty submits a proof to IPFS. The Warrant agent watches the chain, runs the matching verifier, and calls `agentRelease` or `agentReject` — moving the cUSD without either party trusting the other.

## 🟡 Live on Celo Mainnet

| | |
| --- | --- |
| **WarrantAgent contract** | [`0x3c05E7C7865fdA87E4C11cb3fCDEA91882fDd10D`](https://celoscan.io/address/0x3c05E7C7865fdA87E4C11cb3fCDEA91882fDd10D) |
| **ERC-8004 agent** | agentId **9313** → [8004scan.io/agents/celo/9313](https://8004scan.io/agents/celo/9313) |
| **Identity registry** | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| **cUSD** | `0x765DE816845861e75A25fCA122bb6898B8B1282a` · **Mento Broker** `0x777A8255cA72412f0d706dc03C9D1987306B4CaD` |

The full lifecycle has been executed on mainnet — lock → claim → autonomous AI verification → onchain release ([example release tx](https://celoscan.io/tx/0xfe9068b9ea7efc1ed43089e0533d891d84e8e4cd845157f8dd75a48a10c6ae31)).

Built for the **Onchain Agents Hackathon on Celo**. Integrates **MiniPay** (gas-in-cUSD), **Mento** (local-currency payouts), **SocialConnect** (phone→wallet), **Self** (proof-of-human), **ERC-8004** (agent identity), and **x402** (per-verification micro-fee).

## Core mechanic

```
lock cUSD  ->  define condition  ->  submit proof (IPFS)  ->  agent verifies  ->  release / reject cUSD
```

- Funds are held by the `WarrantAgent` contract (SafeERC20 + ReentrancyGuard, custom errors).
- Settlement is gated on the agent operator key and, optionally, an ERC-8004 registry identity.
- A small x402 micro-fee is charged per verification and settled onchain by the contract on release/reject.
- cUSD is an 18-decimal token.

## Condition modes

| Mode | What it proves | Verifier |
| --- | --- | --- |
| `RECEIPT` | A payment/receipt matches the agreed terms | OpenAI Vision over the receipt image |
| `DELIVERY` | A package/item was delivered to a location | Geolocation + OpenAI Vision |
| `MILESTONE` | A GitHub PR meeting the milestone was merged | GitHub PR check |
| `MANUAL` | Free-form condition described in text | LLM judgement |

Each verifier falls back to a heuristic check when its API credential (`OPENAI_API_KEY`, `GITHUB_TOKEN`) is absent.

## Celo ecosystem integrations

| Integration | What it adds | Where | Default |
| --- | --- | --- | --- |
| **MiniPay** | Runs as a MiniPay Mini App: auto-connect inside the MiniPay browser, gas paid in cUSD (`feeCurrency` abstraction — no CELO needed), mobile nav, and a web app manifest. | `lib/minipay.ts`, `lib/wagmi.ts`, `components/Header.tsx` | on |
| **Mento** | Sender locks cUSD; on release the contract swaps to the receiver's local stablecoin (cKES, cNGN, cEUR, cREAL, eXOF, cCOP, cGHS, PUSO) via the Mento Broker, with an automatic fallback to cUSD if the swap can't settle. | `WarrantAgent.sol` (`executeSwap`/`findMentoRoute`), `lib/mento.ts`, create-flow currency selector | per-warrant (set `BROKER_ADDRESS` to enable) |
| **SocialConnect / ODIS** | Address a receiver by phone number; resolved to a wallet via ODIS + FederatedAttestations. Falls back to an open claim when no wallet is found. | `lib/socialconnect.ts`, `app/api/resolve-phone` | off (needs a funded issuer key) |
| **Self** | Zero-knowledge proof-of-human gate on the claim flow (anti-sybil), plus an optional Self Agent ID (ERC-8004) for the agent. | `components/SelfVerifyGate.tsx`, `app/api/self/verify` | off (`NEXT_PUBLIC_SELF_REQUIRED`) |
| **x402** | Pay-per-verification: each proof submission pays a 0.01 cUSD micropayment to the agent over x402 (thirdweb facilitator, EIP-2612 permit), auto-paid from the connected wallet — [settled live on mainnet](https://celoscan.io/tx/0xbd66335c90ac0ea85f6e520697bc4e3bb47053b2effc39bb4ec81c7972b69350). See **[X402.md](X402.md)**. | `lib/x402.server.ts`, `lib/x402Client.ts` | off (`X402_ENABLED`) |
| **ERC-8004** | The agent has an on-chain identity (agentId `9313`) in the Celo IdentityRegistry, with an embedded agent card. | `agent/src/erc8004/register.ts` | registered ✓ |

> **Network note:** Self and the Mento SDK have dropped Alfajores — their testnet is now **Celo Sepolia (11142220)**. The Mento contracts still exist on Alfajores (so `findMentoRoute` works there), but Self verification targets Celo Sepolia or mainnet. The escrow itself runs on whichever chain you configure.

## Architecture

```
contracts/  Foundry. WarrantAgent.sol — escrow + settlement. ABI at contracts/abi/WarrantAgent.json.
agent/      Node/TS daemon (ethers v6, ESM). Listens to ProofSubmitted, runs verifiers, settles onchain.
app/        Next.js 15 (App Router, React 19) + wagmi v3 + viem. The onchain UI and proof/IPFS API routes.
```

- **contracts** — `WarrantAgent.sol` holds cUSD, emits `ProofSubmitted`, and exposes `agentRelease` / `agentReject` to the operator (and optionally an ERC-8004 registry). `Deploy.s.sol` is the env-driven production deploy; `DeployLocal.s.sol` spins up mock cUSD + mock registry for local anvil. 32 passing tests.
- **agent** — subscribes to `ProofSubmitted`, fetches the proof from IPFS, dispatches to one of four verifiers (`receipt`, `delivery`, `milestone`, `manual`), then calls `agentRelease` or `agentReject`. Optional ERC-8004 self-registration via `register.ts` and an x402 paid-API client.
- **app** — wallet connect (injected / MiniPay / WalletConnect), the lock + condition flow, proof submission to IPFS via `/api/proof` (Pinata), and the GitHub milestone webhook at `/api/webhook/github`.

## Prerequisites

- Node 24
- pnpm and/or npm
- [Foundry](https://book.getfoundry.sh/) (`forge`, `anvil`, `cast`)

## Environment

Each package has its own `.env.example`. Copy the ones you need and fill in the values:

| Package | Template | Copy to |
| --- | --- | --- |
| App | [`app/.env.example`](app/.env.example) | `app/.env.local` |
| Agent | [`agent/.env.example`](agent/.env.example) | `.env` (repo root — dotenv reads root) |
| Contracts | [`contracts/.env.example`](contracts/.env.example) | `contracts/.env` |

The root [`.env.example`](.env.example) is a pointer that lists the shared values (`CELO_RPC_URL`, `WARRANT_CONTRACT_ADDRESS` / `NEXT_PUBLIC_WARRANT_CONTRACT`, `PINATA_JWT`) you must keep in sync across packages.

cUSD addresses:

| Network | Chain ID | cUSD |
| --- | --- | --- |
| Celo mainnet | 42220 | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| Alfajores testnet | 44787 | `0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1` |

## Contracts (`contracts/`)

```bash
# Install
forge install      # if submodules aren't checked out

# Build & test
forge build
forge test         # 32 passing tests
forge fmt          # format
```

### Deploy

```bash
# Local (anvil) — deploys mock cUSD + mock registry and funds the deployer
anvil   # in a separate terminal
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# Alfajores testnet
CUSD_ADDRESS=0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1 \
  forge script script/Deploy.s.sol --rpc-url alfajores --broadcast

# Celo mainnet
CUSD_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a \
  forge script script/Deploy.s.sol --rpc-url celo --broadcast
```

`Deploy.s.sol` reads `DEPLOYER_PRIVATE_KEY` and `CUSD_ADDRESS` (required) plus the optional `REGISTRY_ADDRESS`, `AGENT_OPERATOR`, and `VERIFICATION_FEE`. The `celo` / `alfajores` RPC aliases resolve from `CELO_RPC_URL` / `ALFAJORES_RPC_URL` in `foundry.toml`. After deploying, copy the emitted `WarrantAgent deployed:` address into the app and agent env files.

To verify on Celoscan, set `CELOSCAN_API_KEY` and add `--verify` to the deploy command.

## Agent daemon (`agent/`)

```bash
# Install
pnpm install        # or: npm install

# Configure: copy agent/.env.example to repo-root .env and fill in
#   CELO_RPC_URL, AGENT_PRIVATE_KEY, WARRANT_CONTRACT_ADDRESS (required)

# Run the verification loop
pnpm start          # or: npm start   (tsx src/index.ts)

# Optional: register the agent identity on the ERC-8004 registry
pnpm register       # or: npm run register   (needs REGISTRY_CONTRACT_ADDRESS)

# Build to dist/
pnpm build          # or: npm run build   (tsc)
```

The daemon must run against the same network and `WARRANT_CONTRACT_ADDRESS` the app and contract use, with an `AGENT_PRIVATE_KEY` authorized as the operator (or registered in the ERC-8004 registry).

## App (`app/`)

```bash
# Install
npm install

# Configure: copy app/.env.example to app/.env.local and fill in at least
#   NEXT_PUBLIC_CELO_CHAIN_ID, NEXT_PUBLIC_WARRANT_CONTRACT
#   PINATA_JWT (server-only, for /api/proof)

# Dev server (http://localhost:3000)
npm run dev

# Production build & serve
npm run build
npm start

# Lint
npm run lint
```

### Deploy (Railway)

This is an **isolated monorepo**: the app (`app/`, npm + Next.js) and the agent
(`agent/`, pnpm + long-running worker) deploy as **two separate services** in one
Railway project. Each has its own [`railway.json`](app/railway.json) (Nixpacks
builder, build/start commands).

1. Push the repo to GitHub, then on Railway create a project from it. Railway
   auto-detects the monorepo and stages a service per package; or add two
   services manually.
2. For **each** service set **Settings → Root Directory**: `app` and `agent`.
   ⚠️ Per Railway's docs the config file does **not** follow the root directory —
   if you add services manually, point each service's config path at
   `/app/railway.json` and `/agent/railway.json` (auto-import handles this for
   you). Otherwise Nixpacks would run the agent's `build` script (`tsc`) instead
   of just installing — the agent runs straight from TypeScript via `tsx`.
3. Set env vars per service (App → `app/.env.example`, Agent → `agent/.env.example`).
   Never commit secrets — they're gitignored.
4. The **app** service is a web server (`next start` binds Railway's `$PORT`):
   generate a domain or attach `trywarrant.xyz`. The **agent** service is a
   worker (no port, `restartPolicy: ALWAYS`) — no domain needed.

> `vercel.json` is retained as an alternative single-service (app-only) target;
> the agent worker requires a Railway/long-running host.

## Project layout

```
warrant/
├── README.md
├── vercel.json                 # Vercel config (builds app/)
├── .env.example                # root pointer to per-package env
├── contracts/                  # Foundry
│   ├── foundry.toml
│   ├── src/
│   │   ├── WarrantAgent.sol
│   │   ├── interfaces/
│   │   └── mocks/
│   ├── script/
│   │   ├── Deploy.s.sol         # prod, env-driven
│   │   └── DeployLocal.s.sol    # local mocks
│   ├── test/
│   │   └── WarrantAgent.t.sol   # 32 tests
│   ├── abi/WarrantAgent.json
│   └── .env.example
├── agent/                      # Node/TS daemon (ethers v6, ESM)
│   ├── src/
│   │   ├── index.ts             # event loop + settlement
│   │   ├── verifiers/           # receipt, delivery, milestone, manual
│   │   ├── erc8004/register.ts
│   │   └── x402/client.ts
│   └── .env.example
└── app/                        # Next.js 15 + wagmi v3 + viem
    ├── app/
    │   ├── page.tsx
    │   └── api/                 # proof (IPFS), webhook/github, og
    ├── components/
    ├── lib/
    └── .env.example
```

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the
monorepo layout, and conventions.

## Security

Warrant moves real funds on mainnet. Please report vulnerabilities privately —
see [SECURITY.md](SECURITY.md). Do not open public issues for security problems.

## License

[MIT](LICENSE) © 2026 Warrant
