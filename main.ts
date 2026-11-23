// Adaptive Momentum Strategy for make.fun cbBTC 24-Hour Race (btc-race-24h-20261123-0511)
// Evaluates rolling 22-bar momentum on Solana on-chain cbBTC / USDC bars.

import { BPS, runBars, BarsState, BuyInput, OrderInput } from './vendor/makefun-bars.ts';

const LOOKBACK_BARS = 22;
/** Bounded execution tolerance: 2,500 bps (25%) max slippage for high-volatility DEX pool protection */
const MAX_SLIPPAGE_BPS = 2500;

const history = new Map<string, (bigint | null)[]>();
let nextRebalance = LOOKBACK_BARS;
let entering: string[] | null = null;

function momentumScore(state: BarsState, symbol: string, seq: number): bigint | null {
  const closes = history.get(symbol);
  if (!closes) return null;
  const now = closes[seq];
  const then = closes[seq - LOOKBACK_BARS];
  if (now === null || then === null || then === 0n) return null;
  // Scaled momentum return in BPS: ((now - then) * BPS) / then
  return ((now - then) * BPS) / then;
}

await runBars({
  onHello(state) {
    nextRebalance = Math.max(LOOKBACK_BARS, state.warmupBars);
    for (const { symbol } of state.hello.symbols) {
      history.set(symbol, []);
    }
    console.error(`[Init] cbBTC Adaptive Momentum Engine initialized with lookback=${LOOKBACK_BARS}, maxSlippage=${MAX_SLIPPAGE_BPS} bps.`);
  },

  onBatch(state: BarsState, batch) {
    for (const { symbol } of state.hello.symbols) {
      history.get(symbol)!.push(state.close(symbol));
    }

    if (state.warmingUp) {
      return [];
    }

    const orders: OrderInput[] = [];

    // Complete pending buys from previous rebalance after sells settled
    if (entering !== null && entering.length > 0) {
      const targets = entering;
      entering = null;
      const budget = state.cash / BigInt(targets.length);
      for (const symbol of targets) {
        const room = state.weightRoom(symbol);
        const spend = budget < room ? budget : room;
        if (spend >= BigInt(state.hello.fees.min_notional_quote_units)) {
          const buy: BuyInput = {
            side: 'buy',
            symbol,
            notional_quote_units: spend,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          };
          orders.push(buy);
        }
      }
      return orders;
    }

    if (batch.seq < nextRebalance) {
      return [];
    }

    nextRebalance = batch.seq + LOOKBACK_BARS;

    const ranked: { symbol: string; score: bigint }[] = [];
    for (const { symbol } of state.hello.symbols) {
      const score = momentumScore(state, symbol, batch.seq);
      if (score !== null && score > 0n) {
        ranked.push({ symbol, score });
      }
    }

    ranked.sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : a.symbol.localeCompare(b.symbol)));

    const maxSlots = Math.min(state.hello.caps.max_open_positions, state.hello.caps.max_orders_per_bar);
    const targetSymbols = new Set(ranked.slice(0, maxSlots).map((r) => r.symbol));

    let soldAny = false;
    for (const [symbol, pos] of state.positions) {
      if (pos.qty > 0n && !targetSymbols.has(symbol)) {
        orders.push({
          side: 'sell',
          symbol,
          qty: pos.qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        });
        soldAny = true;
      }
    }

    const toEnter: string[] = [];
    for (const sym of targetSymbols) {
      const currentQty = state.positions.get(sym)?.qty ?? 0n;
      if (currentQty === 0n) {
        toEnter.push(sym);
      }
    }

    if (toEnter.length > 0) {
      if (soldAny) {
        entering = toEnter;
      } else {
        const budget = state.cash / BigInt(toEnter.length);
        for (const symbol of toEnter) {
          const room = state.weightRoom(symbol);
          const spend = budget < room ? budget : room;
          if (spend >= BigInt(state.hello.fees.min_notional_quote_units)) {
            orders.push({
              side: 'buy',
              symbol,
              notional_quote_units: spend,
              max_slippage_bps: MAX_SLIPPAGE_BPS,
            });
          }
        }
      }
    }

    return orders;
  },

  onDone(state, done) {
    console.error(`[Done] Replay completed. Reason: ${done.reason}. Final Equity: ${state.equity} quote units.`);
  },
});
