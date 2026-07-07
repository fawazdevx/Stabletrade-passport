import React from "react";
import { Landmark, Percent, Building2, Wallet } from "lucide-react";
import { usdCents, aedEquivalent, bpsToPct } from "../format";

// Hero Moment 1: the distribution ledger.
// Shows how the importer's escrow pool breaks apart on proof-of-delivery:
//   Principal to Financier -> Yield Fee to Financier -> Protocol Fee -> Exporter.
// Consumes the shape returned by buildSettlementWaterfall() in main.jsx.
export function SettlementWaterfall({ waterfall, className = "" }) {
  const pool = Number(waterfall?.amount) || 0;
  const advance = Number(waterfall?.advanceAmount) || 0;
  const financierFee = Number(waterfall?.financierFee) || 0;
  const protocolFee = Number(waterfall?.protocolFee) || 0;
  const exporterFinal = Number(waterfall?.exporterFinalPayout) || 0;
  const feeBps = Number(waterfall?.financeFeeBps) || 0;

  const rows = [
    {
      key: "principal",
      icon: Landmark,
      label: "Principal to Financier",
      sub: "Working-capital advance returned",
      value: advance,
      tone: "text-slate-100"
    },
    {
      key: "yield",
      icon: Percent,
      label: "Yield Fee to Financier",
      sub: feeBps ? `${bpsToPct(feeBps)} agreed fee` : "Agreed financing fee",
      value: financierFee,
      tone: "text-teal-300"
    },
    {
      key: "protocol",
      icon: Building2,
      label: "Protocol Fee to StableTrade",
      sub: "Platform settlement fee",
      value: protocolFee,
      tone: "text-slate-100"
    },
    {
      key: "exporter",
      icon: Wallet,
      label: "Remaining Balance to Exporter",
      sub: "Net proceeds on delivery",
      value: exporterFinal,
      tone: "text-emerald-300",
      emphasize: true
    }
  ];

  const denom = pool || 1;

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-950/60 ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Distribution ledger
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-300">
            On proof-of-delivery, escrow settles atomically
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-white">{usdCents.format(pool)} USDC</p>
          <p className="text-xs tabular-nums text-slate-500">{aedEquivalent(pool)}</p>
        </div>
      </div>

      <div className="divide-y divide-slate-800/70">
        {rows.map((row) => {
          const share = Math.max(0, Math.min(100, (row.value / denom) * 100));
          const Icon = row.icon;
          return (
            <div
              key={row.key}
              className={`px-5 py-3.5 ${row.emphasize ? "bg-emerald-500/[0.04]" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-lg border ${
                      row.emphasize
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-700 bg-slate-900 text-slate-400"
                    }`}
                  >
                    <Icon size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.sub}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold tabular-nums ${row.tone}`}>
                    {usdCents.format(row.value)}
                  </p>
                  <p className="text-[11px] tabular-nums text-slate-500">{share.toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-1 rounded-full ${
                    row.emphasize
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : "bg-slate-600"
                  }`}
                  style={{ width: `${share}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SettlementWaterfall;
