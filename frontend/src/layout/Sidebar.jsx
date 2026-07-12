import React, { useState } from "react";
import { Shield, X, ChevronDown, Wallet, Waypoints, FileCode2 } from "lucide-react";
import { useAppState } from "../appState";
import { shortAddress } from "../format";
import { deployedContracts, circleGateway, arcTestnet } from "../contracts";

function StatusDot({ ok }) {
  return (
    <span className={`relative inline-flex h-1.5 w-1.5 ${ok ? "text-emerald-400" : "text-amber-400"}`}>
      {ok && <span className="live-dot absolute inline-flex h-1.5 w-1.5 rounded-full" />}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
    </span>
  );
}

// Compact Circle infrastructure status, anchored to the bottom of the rail.
function CircleTelemetry() {
  const { isConnected, address, chainId, contractHealth, gatewayStatus } = useAppState();
  const [open, setOpen] = useState(false);

  const walletOk = isConnected;
  const gatewayOk = gatewayStatus?.source === "circle-gateway";
  const arcOk = chainId === arcTestnet.chainId;

  const groups = [
    {
      icon: Wallet,
      title: "Programmable Wallets",
      ok: walletOk,
      rows: [["Signer", address ? shortAddress(address) : "Not connected"]]
    },
    {
      icon: Waypoints,
      title: "Gateway",
      ok: gatewayOk,
      rows: [["Route", gatewayOk ? "Live API" : "Sample balances"], ["Wallet", shortAddress(circleGateway.wallet)]]
    },
    {
      icon: FileCode2,
      title: "Arc Contracts",
      ok: arcOk,
      rows: [["Proxy", shortAddress(deployedContracts.tradeEscrowProxy)], ["USDC", shortAddress(deployedContracts.usdc)]]
    }
  ];

  return (
    <div className="border-t border-slate-800 p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-md border border-slate-700 bg-slate-900 text-teal-300">
          <Waypoints size={13} />
        </span>
        <span className="flex-1">
          <span className="block text-[11px] font-semibold text-white">Circle telemetry</span>
          <span className="block text-[10px] text-slate-500">
            {[walletOk, gatewayOk, arcOk].filter(Boolean).length}/3 systems live
          </span>
        </span>
        <span className="flex items-center gap-1">
          <StatusDot ok={walletOk} />
          <StatusDot ok={gatewayOk} />
          <StatusDot ok={arcOk} />
        </span>
        <ChevronDown size={14} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 grid gap-2">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                <div className="flex items-center gap-2">
                  <Icon size={12} className="text-slate-400" />
                  <span className="flex-1 text-[11px] font-semibold text-white">{group.title}</span>
                  <StatusDot ok={group.ok} />
                </div>
                <div className="mt-1.5 grid gap-1">
                  {group.rows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-500">{label}</span>
                      <span className="font-mono text-[10px] text-slate-300">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="px-0.5 text-[10px] leading-relaxed text-slate-600">
            Educational testnet demo · non-custodial testnet USDC.
          </p>
        </div>
      )}
    </div>
  );
}

// Fixed left navigation rail. On large screens it is always visible; on small
// screens it slides in as an off-canvas drawer controlled by `open`.
export function Sidebar({ appPages, activePage, setActivePage, onHome, open, onClose }) {
  function go(page) {
    setActivePage(page);
    onClose?.();
  }

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-800 bg-slate-950/85 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
          <button
            onClick={onHome}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/25 transition-transform hover:scale-105"
            title="Back to landing"
          >
            <Shield size={18} className="text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-white">StableTrade</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-400/80">
              Trade Finance
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white lg:hidden"
            title="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Workspaces
          </p>
          <div className="grid gap-1">
            {appPages.map(([page, Icon, label]) => {
              const active = activePage === page;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => go(page)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-teal-500/10 text-teal-200 ring-1 ring-inset ring-teal-500/30"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={17} className={active ? "text-teal-300" : "text-slate-500 group-hover:text-slate-300"} />
                  <span>{label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-400" />}
                </button>
              );
            })}
          </div>
        </nav>

        <CircleTelemetry />
      </aside>
    </>
  );
}

export default Sidebar;
