// Adaptive Trend-Momentum Strategy for make.fun cbBTC 24-Hour Race (btc-race-24h-20261123-0511)
// Trades cbBTC / USDC on Solana DEX with lookback momentum and risk-managed drawdown exits.

import { BPS, runBars, type BarsState, type BuyInput } from './vendor/makefun-bars.ts';

const LOOKBACK_BARS = 18;
/** Slippage protection cap (500 bps = 5.0%) */
const MAX_SLIPPAGE_BPS = 500;
/** Stop loss threshold: 500 bps (5%) from entry */
const STOP_LOSS_BPS = 500n;
/** Trailing drawdown threshold: 300 bps (3%) from peak */
const TRAILING_STOP_BPS = 300n;

const history = new Map<string, (bigint | null)[]>();
let entryPrice: bigint | null = null;
let peakPrice: bigint | null = null;

function calculateMomentum(state: BarsState, symbol: string, seq: number): bigint | null {
  const closes = history.get(symbol);
  if (!closes) return null;
  const now = closes[seq];
  const then = closes[seq - LOOKBACK_BARS];
  if (now === null || then === null || then === 0n) return null;
  return ((now - then) * BPS) / then;
}

await runBars({
  onHello(state) {
    for (const { symbol } of state.hello.symbols) {
      history.set(symbol, []);
    }
  },

  onBatch(state: BarsState, batch) {
    for (const { symbol } of state.hello.symbols) {
      history.get(symbol)!.push(state.close(symbol));
    }

    if (state.warmingUp || batch.seq < LOOKBACK_BARS) {
      return [];
    }

    const symbol = state.hello.symbols[0].symbol;
    const currentClose = state.close(symbol);
    if (currentClose === null) return [];

    const hasPosition = state.positions.has(symbol) && state.positions.get(symbol)!.qty > 0n;

    if (!hasPosition) {
      const mom = calculateMomentum(state, symbol, batch.seq);
      // Enter on positive momentum (> 10 bps)
      if (mom !== null && mom > 10n) {
        const room = state.weightRoom(symbol);
        const spend = state.cash < room ? state.cash : room;
        if (spend >= BigInt(state.hello.fees.min_notional_quote_units)) {
          entryPrice = currentClose;
          peakPrice = currentClose;
          const buy: BuyInput = {
            side: 'buy',
            symbol,
            notional_quote_units: spend,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          };
          return [buy];
        }
      }
    } else {
      if (peakPrice === null || currentClose > peakPrice) {
        peakPrice = currentClose;
      }

      const pos = state.positions.get(symbol)!;
      const refEntry = entryPrice ?? currentClose;
      const lossBps = refEntry > currentClose ? ((refEntry - currentClose) * BPS) / refEntry : 0n;
      const dropFromPeakBps = peakPrice > currentClose ? ((peakPrice - currentClose) * BPS) / peakPrice : 0n;
      const mom = calculateMomentum(state, symbol, batch.seq);

      // Stop-loss or trailing stop triggered
      if (lossBps > STOP_LOSS_BPS || (dropFromPeakBps > TRAILING_STOP_BPS && mom !== null && mom < -20n)) {
        entryPrice = null;
        peakPrice = null;
        return [
          {
            side: 'sell',
            symbol,
            qty: pos.qty,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
    }

    return [];
  },
});
