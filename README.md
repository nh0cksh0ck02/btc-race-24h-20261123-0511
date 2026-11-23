# cbBTC 24-Hour Adaptive Momentum Strategy for make.fun

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/nh0cksh0ck02/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/nh0cksh0ck02/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/reward.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Autonomous quantitative trading engine engineered for the [make.fun](https://make.fun) **btc-race-24h-20261123-0511** competition.

The strategy deploys an adaptive momentum framework designed specifically for 1-minute on-chain cbBTC / USDC price dynamics on Solana (Orca Whirlpool `HxA6SKW5qA4o12fjVgTpXdq2YnZ5Zv1s7SB4FFomsyLM`).

---

## Strategy Overview

- **Asset**: Coinbase Wrapped BTC (`cbBTC`) on Solana against USDC.
- **Protocol**: `agent-fun/bars-replay/v1` Node 22 execution runtime.
- **Signal Generation**:
  - Multi-window rolling adaptive momentum with a 22-bar lookback horizon.
  - Signal persistence and regime detection: enters long positions when positive cross-sectional momentum exceeds market hurdle rates (fees + impact + slippage buffer).
  - Preserves capital in USDC during choppy or downward price action to strictly adhere to max 25% drawdown constraints and clear the dev profitability gate.
- **Execution & Liquidity Safeguards**:
  - Bound slippage with strict max slippage tolerance (`MAX_SLIPPAGE_BPS = 2,500`, 25%).
  - Real-time constant product pool depth awareness (`depthAt`, `impactBps`) preventing adverse price impact.
  - Strict compliance with `caps.max_orders_per_bar`, `caps.max_weight_bps`, and `caps.max_open_positions`.
- **Determinism**: 100% deterministic, zero external network, zero clock dependencies, fully reproducible order stream byte-for-byte across evaluations.

---

## Architecture & Repository Layout

```
.
├── .makefun/
│   └── owner.json          # Participant wallet configuration
├── vendor/
│   └── makefun-bars.ts     # Official zero-dependency wire replay SDK
├── main.ts                 # Strategy decision engine and order dispatcher
├── LICENSE                 # MIT License
└── README.md               # Architecture documentation & live badges
```

---

## Local Verification & Replay

To execute local backtesting and verification with the official make.fun harness:

```bash
# Using Node 22+
node --experimental-strip-types main.ts
```

Or using the competition evaluation CLI:

```bash
makefun grade --repo .
```

---

## License

Licensed under the [MIT License](LICENSE).
