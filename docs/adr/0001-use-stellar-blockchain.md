# ADR 0001: Use Stellar Blockchain for Settlement

## Status
Accepted

## Context
MansaPay needs a settlement layer for cross-border USDC transfers. The
options considered were Ethereum, Solana, and Stellar.

## Decision
We chose Stellar because:
- 5-second settlement (Ethereum is 12+ seconds, gas fees volatile)
- Fees under $0.001 per transaction (Ethereum can spike to several dollars)
- Native USDC support via Circle since 2021
- Built-in anchor system for fiat on/off ramps (Flutterwave, Cowrie, etc.)
- Simpler smart contract model reduces attack surface

## Consequences
- We depend on the Stellar Development Foundation continuing to operate
- Anchor availability determines which fiat corridors we can support
- We inherit Stellar's compliance framework (SEP-6, SEP-10, SEP-24, SEP-31)
