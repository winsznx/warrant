# Security Policy

Warrant moves real funds on Celo mainnet (cUSD escrow settled by an autonomous
agent). We take security seriously and welcome responsible disclosure.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Report privately via GitHub's **[Security Advisories](https://github.com/winsznx/warrant/security/advisories/new)**
("Report a vulnerability"). Please include:

- A description of the issue and its impact.
- Steps to reproduce (PoC, transaction hashes, or affected addresses where relevant).
- The component: `contracts/`, `agent/`, or `app/`.

We aim to acknowledge reports within 72 hours and to keep you updated through
remediation. Please give us a reasonable window to fix before public disclosure.

## Scope

In scope:

- **`contracts/WarrantAgent.sol`** — escrow accounting, access control, settlement
  (`agentRelease` / `agentReject`), Mento swap routing, reentrancy.
- **`agent/`** — verifier logic, settlement signing, idempotency, key handling.
- **`app/`** — proof submission, x402 payment gate, SSR wallet state, API routes.

Out of scope:

- Third-party infrastructure (Celo RPC, IPFS gateways, thirdweb facilitator, Groq).
- The upstream `forge-std` / `openzeppelin-contracts` submodules (report upstream).
- Lost or mismanaged private keys held by users.

## Operational notes

- Settlement is gated on the agent **operator key** and, optionally, an ERC-8004
  registry identity. Compromise of the operator key allows arbitrary
  release/reject — keep it in a secret manager, never in committed files.
- The contract uses `SafeERC20`, `ReentrancyGuard`, and custom errors; the Mento
  swap path falls back to cUSD on failure.
- Secrets are never committed. See [`.gitignore`](.gitignore) and the per-package
  `.env.example` templates.
