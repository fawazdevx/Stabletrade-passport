import React, { useState } from "react";
import { Activity, ChevronRight, Copy, Check, Wallet, Waypoints, FileCode2 } from "lucide-react";
import { useAppState } from "../appState";
import { shortAddress } from "../format";
import { deployedContracts, circleGateway, arcTestnet } from "../contracts";

function StatusDot({ ok }) {
  return (
    <span className={`relative inline-flex h-2 w-2 ${ok ? "text-emerald-400" : "text-amber-400"}`}>
      <span className="live-dot absolute inline-flex h-2 w-2 rounded-full" />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
    </span>
  );
}

function Row({ label, value, mono }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <button
        type="button"
        onClick={copy}
        title="Copy"
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
          mono ? "font-mono" : ""
        } text-slate-300 transition-colors hover:text-teal-300`}
      >
        {value}
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-600" />}
      </button>
    </div>
  );
}

// Sticky, expandable side drawer showing the live status of the underlying
// Circle components powering the app: Programmable Wallets, Gateway routing,
// and the Arc testnet contract registry.
export function CircleTelemetryDrawer() {
  const { isConnected, address, chainId, contractHealth, gatewayStatus } = useAppState();
  const [open, setOpen] = useState(false);

  const walletOk = isConnected;
  const gatewayOk = gatewayStatus?.source === "circle-gateway";
  const arcOk = chainId === arcTestnet.chainId;

  const groups = [
    {
      icon: Wallet,
      title: "Circle Programmable Wallets",
      ok: walletOk,
      rows: [
        ["Instance", walletOk ? "Connected" : "Awaiting connect"],
        ["Signer", address ? shortAddress(address) : "—", true],
        ["Network", arcOk ? "Arc Testnet" : chainId ? `Chain ${chainId}` : "—"]
      ]
    },
    {
      icon: Waypoints,
      title: "Circle Gateway",
      ok: gatewayOk,
      rows: [
        ["Route", gatewayOk ? "Live endpoint" : "Demo fallback"],
        ["Wallet", shortAddress(circleGateway.wallet), true],
        ["Minter", shortAddress(circleGateway.minter), true]
      ]
    },
    {
      icon: FileCode2,
      title: "Arc Testnet Contracts",
      ok: arcOk,
      rows: [
        ["Proxy", shortAddress(deployedContracts.tradeEscrowProxy), true],
        ["USDC", shortAddress(deployedContracts.usdc), true],
        ["Version", contractHealth?.version ? `v${contractHealth.version}` : "reading…"]
      ]
    }
  ];

  return (
    <div className="fixed right-0 top-1/2 z-40 -translate-y-1/2">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-9 flex-col items-center justify-center gap-2 rounded-l-xl border border-r-0 border-slate-800 bg-slate-900/90 py-4 text-slate-300 backdrop-blur-xl transition-colors hover:text-teal-300"
        >
          <Activity size={16} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
            Circle Telemetry
          </span>
          <ChevronRight size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <div
          className={`overflow-hidden border-y border-l border-slate-800 bg-slate-950/95 backdrop-blur-xl transition-all duration-300 ${
            open ? "w-72 opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="w-72 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Infrastructure status
            </p>
            <div className="mt-3 grid gap-3">
              {groups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.title} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-slate-400" />
                      <span className="flex-1 text-xs font-semibold text-white">{group.title}</span>
                      <StatusDot ok={group.ok} />
                    </div>
                    <div className="mt-1 divide-y divide-slate-800/60">
                      {group.rows.map(([label, value, mono]) => (
                        <Row key={label} label={label} value={value} mono={mono} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
              Educational testnet demo. Balances and settlements are non-custodial testnet USDC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CircleTelemetryDrawer;
