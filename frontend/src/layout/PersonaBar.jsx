import React from "react";
import { Building2, Landmark, Ship } from "lucide-react";
import { personas } from "../appState";

// Persistent context bar. Switching persona sets the global active role, which
// drives which action items are highlighted across every workspace.
const ICONS = {
  importer: Building2,
  financier: Landmark,
  exporter: Ship
};

export function PersonaBar({ persona, onChange }) {
  const active = personas.find((item) => item.key === persona) || personas[0];

  return (
    <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Viewing as
          </span>
          <span className="hidden truncate text-sm text-slate-400 sm:inline">
            {active.entity} · {active.blurb}
          </span>
        </div>

        <div
          className="inline-flex rounded-xl border border-slate-800 bg-slate-900/70 p-1"
          role="tablist"
          aria-label="Persona"
        >
          {personas.map((item) => {
            const Icon = ICONS[item.key];
            const selected = item.key === active.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onChange(item.key)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors sm:px-4 ${
                  selected
                    ? "bg-teal-500/15 text-teal-200 shadow-sm shadow-teal-500/10 ring-1 ring-inset ring-teal-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{item.label}</span>
                <span className="sm:hidden">{item.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PersonaBar;
