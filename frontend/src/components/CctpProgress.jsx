import React from "react";
import { Check, Loader2, ShieldCheck, Flame, Coins } from "lucide-react";

// Circle Bridge Kit / CCTP modelled as an explicit, high-visibility 4-step line:
//   Approve -> Burn -> Attestation -> Mint.
// `steps` is the bridgeSteps array from main.jsx: [{ name, state, detail }].
const STEP_META = {
  approve: { label: "Approve", sub: "Spend allowance granted", icon: ShieldCheck },
  burn: { label: "Burn", sub: "Source token destroyed", icon: Flame },
  fetchAttestation: { label: "Attestation", sub: "Circle API signature", icon: ShieldCheck },
  mint: { label: "Mint", sub: "Arc L1 token created", icon: Coins }
};

const ORDER = ["approve", "burn", "fetchAttestation", "mint"];

function isDone(state) {
  return state === "success" || state === "demo-ready";
}

export function CctpProgress({ steps = [] }) {
  const byName = Object.fromEntries(steps.map((step) => [step.name, step]));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Cross-Chain Transfer Protocol
        </p>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          4-stage settlement
        </span>
      </div>

      <div className="mt-5 flex items-start">
        {ORDER.map((name, index) => {
          const meta = STEP_META[name];
          const step = byName[name] || { state: "waiting" };
          const done = isDone(step.state);
          const active = step.state === "active";
          const Icon = meta.icon;

          const ringClass = done
            ? "border-emerald-500 bg-emerald-500 text-slate-950"
            : active
              ? "border-teal-400 bg-teal-400/15 text-teal-300"
              : "border-slate-700 bg-slate-900 text-slate-600";
          const lineDone = isDone((byName[ORDER[index + 1]] || {}).state) || done;

          return (
            <React.Fragment key={name}>
              <div className="flex flex-1 flex-col items-center text-center">
                <span className={`grid h-11 w-11 place-items-center rounded-full border transition-colors ${ringClass}`}>
                  {done ? (
                    <Check size={18} strokeWidth={2.5} />
                  ) : active ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Icon size={17} />
                  )}
                </span>
                <p className={`mt-2 text-xs font-semibold ${done || active ? "text-white" : "text-slate-500"}`}>
                  {index + 1}. {meta.label}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{meta.sub}</p>
                {step.detail && (
                  <p className="mt-1 max-w-[8rem] truncate text-[10px] font-mono text-teal-400/80" title={step.detail}>
                    {step.detail}
                  </p>
                )}
              </div>
              {index < ORDER.length - 1 && (
                <span
                  className={`mt-5 h-0.5 flex-1 rounded-full transition-colors ${
                    lineDone ? "bg-emerald-500/70" : "bg-slate-800"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default CctpProgress;
