import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

const ARCSCAN = "https://testnet.arcscan.app/address";

function RegistryRow({ label, value }) {
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <code className="mt-1 block truncate font-mono text-xs text-teal-300" title={value}>
          {value}
        </code>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={copy}
          title="Copy address"
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-teal-400/50 hover:text-teal-300"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
        <a
          href={`${ARCSCAN}/${value}`}
          target="_blank"
          rel="noreferrer"
          title="View on ArcScan"
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-800 text-slate-400 transition-colors hover:border-teal-400/50 hover:text-teal-300"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

// Clean registry of deployed Arc L1 contract hashes with inline Copy + ArcScan.
export function ContractRegistry({ entries, className = "" }) {
  return (
    <div className={`grid gap-2.5 ${className}`}>
      {entries.map(([label, value]) => (
        <RegistryRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

export default ContractRegistry;
