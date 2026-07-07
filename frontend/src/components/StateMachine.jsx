import React from "react";
import { Check } from "lucide-react";

// Visual state machine for an invoice: Draft -> Escrowed -> Advanced -> Settled.
// Disputed is surfaced separately (off the happy path) when present.
const STAGES = [
  { key: "draft", label: "Draft" },
  { key: "escrowed", label: "Escrowed" },
  { key: "advanced", label: "Advanced" },
  { key: "settled", label: "Settled" }
];

export function StateMachine({ status = "draft", className = "" }) {
  const disputed = status === "disputed";
  const activeIndex = disputed
    ? STAGES.length
    : Math.max(0, STAGES.findIndex((stage) => stage.key === status));

  return (
    <div className={`flex items-center ${className}`}>
      {STAGES.map((stage, index) => {
        const done = index < activeIndex;
        const current = index === activeIndex && !disputed;
        const dotClass = done
          ? "border-teal-500 bg-teal-500 text-slate-950"
          : current
            ? "border-teal-400 bg-teal-400/15 text-teal-300"
            : "border-slate-700 bg-slate-900 text-slate-600";
        const lineClass = index < activeIndex ? "bg-teal-500/70" : "bg-slate-800";

        return (
          <React.Fragment key={stage.key}>
            <div className="flex flex-col items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-colors ${dotClass}`}
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : index + 1}
              </span>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  current ? "text-teal-300" : done ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {index < STAGES.length - 1 && (
              <span className={`mx-2 h-px flex-1 rounded-full transition-colors ${lineClass}`} />
            )}
          </React.Fragment>
        );
      })}
      {disputed && (
        <span className="ml-3 inline-flex h-7 items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-3 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
          Disputed
        </span>
      )}
    </div>
  );
}

export default StateMachine;
