import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, Building2, Landmark, Ship } from "lucide-react";
import { useAppState } from "../appState";
import { personas } from "../appState";
import { arcTestnet } from "../contracts";

const PERSONA_ICONS = { importer: Building2, financier: Landmark, exporter: Ship };

function NetworkChip() {
  const { isConnected, chainId } = useAppState();
  const onArc = chainId === arcTestnet.chainId;
  const label = !isConnected ? "Not connected" : onArc ? "Arc testnet" : "Wrong network";
  const dot = !isConnected ? "bg-slate-500" : onArc ? "bg-emerald-400" : "bg-amber-400";
  return (
    <span className="hidden h-9 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300 sm:inline-flex">
      <span className={`relative inline-flex h-2 w-2 ${isConnected && onArc ? "text-emerald-400" : ""}`}>
        {isConnected && onArc && <span className="live-dot absolute inline-flex h-2 w-2 rounded-full" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}

// Slim top bar for the console: mobile menu button + persona segmented control
// on the left, network status + wallet on the right.
export function TopBar({ persona, onPersonaChange, activePageLabel, onMenu }) {
  const active = personas.find((item) => item.key === persona) || personas[0];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onMenu}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-800 text-slate-300 hover:text-white lg:hidden"
          title="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="mr-1 hidden min-w-0 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-400/80">Workspace</p>
          <h1 className="truncate text-2xl font-bold tracking-tight text-white">{activePageLabel}</h1>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Persona segmented control */}
          <div
            className="inline-flex rounded-lg border border-slate-800 bg-slate-900/70 p-1"
            role="tablist"
            aria-label="Persona"
          >
            {personas.map((item) => {
              const Icon = PERSONA_ICONS[item.key];
              const selected = item.key === active.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onPersonaChange(item.key)}
                  title={item.label}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-md px-2.5 text-xs font-semibold transition-colors sm:px-3 ${
                    selected
                      ? "bg-teal-500/15 text-teal-200 ring-1 ring-inset ring-teal-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  <span className="hidden md:inline">{item.short}</span>
                </button>
              );
            })}
          </div>

          <NetworkChip />
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
        </div>
      </div>

      {/* Persona context line */}
      <div className="hidden border-t border-slate-800/60 px-6 py-1.5 text-xs text-slate-500 lg:block">
        Viewing as <span className="font-semibold text-slate-300">{active.entity}</span> · {active.blurb}
      </div>
    </header>
  );
}

export default TopBar;
