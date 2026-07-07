// Shared presentation formatters for the StableTrade Passport redesign.
//
// Design rule (institutional-fintech identity): every USDC figure the viewer
// sees should be legible as *money*, not as a raw token string. Where space
// allows, USDC is paired with its real-world AED equivalent so a UAE importer
// reads dollar-denominated settlement in their home currency.

// AED is pegged to USD at 3.6725 (UAE central bank peg). USDC ~ 1 USD, so this
// is a fixed, defensible display conversion for the demo corridor.
export const AED_PER_USD = 3.6725;

export const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const aed = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// Back-compat alias: existing code imported a `currency` formatter.
export const currency = usd;

// "$10,000.00 USDC" — precise, asset-labelled amount.
export function usdc(value, { cents = true } = {}) {
  const n = Number(value) || 0;
  const formatted = cents ? usdCents.format(n) : usd.format(n);
  return `${formatted} USDC`;
}

// AED equivalent, e.g. "≈ 36,725.00 AED".
export function aedEquivalent(value) {
  const n = (Number(value) || 0) * AED_PER_USD;
  return `≈ ${aed.format(n)} AED`;
}

// The headline pairing used across the app:
// "$10,000.00 USDC (≈ 36,725.00 AED)".
export function usdcWithAed(value, { cents = true } = {}) {
  return `${usdc(value, { cents })} (${aedEquivalent(value)})`;
}

// Basis points → percent string, e.g. 885 -> "8.85%".
export function bpsToPct(bps, { decimals = 2 } = {}) {
  const pct = (Number(bps) || 0) / 100;
  return `${pct.toFixed(decimals)}%`;
}

// Simple percent with a trailing sign.
export function pct(value, { decimals = 1 } = {}) {
  return `${(Number(value) || 0).toFixed(decimals)}%`;
}

export function shortAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

// Middle-truncate a hash for dense table cells, keeping head + tail.
export function shortHash(value, head = 10, tail = 8) {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
