import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "@rainbow-me/rainbowkit/styles.css";
import { ConnectButton, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient, WagmiProvider } from "wagmi";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { encodePacked, formatUnits, isAddress, keccak256, parseUnits } from "viem";
import {
  ArrowRightLeft,
  BadgeCheck,
  Banknote,
  Bot,
  CircleDollarSign,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Gavel,
  Landmark,
  LayoutDashboard,
  Network,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  WalletCards,
  Waypoints
} from "lucide-react";
import { arcTestnet, circleGateway, deployedContracts, gatewayChains, gatewayWalletAbi, tradeEscrowAbi, usdcAbi } from "./contracts";
import { arcChain, wagmiConfig } from "./wallet";
import { AppStateContext, personas, personaByKey } from "./appState";
import { usdcWithAed, aedEquivalent, usdCents, bpsToPct } from "./format";
import PersonaBar from "./layout/PersonaBar";
import CircleTelemetryDrawer from "./layout/CircleTelemetryDrawer";
import SettlementWaterfall from "./components/SettlementWaterfall";
import StateMachine from "./components/StateMachine";
import CctpProgress from "./components/CctpProgress";
import ContractRegistry from "./components/ContractRegistry";
import "./styles.css";

const queryClient = new QueryClient();

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const statusNames = ["draft", "escrowed", "advanced", "settled", "disputed"];
const documentKindNames = ["Purchase order", "Invoice", "Delivery proof", "Compliance", "Other"];
const zeroAddress = "0x0000000000000000000000000000000000000000";
const workflowSteps = [
  ["1", "Buyer creates and funds", "The importer creates an invoice for the seller and locks USDC in escrow."],
  ["2", "Financiers compete", "Financiers inspect the invoice and submit advance offers from the marketplace."],
  ["3", "Seller accepts capital", "The exporter accepts a bid and receives working capital before final settlement."],
  ["4", "Delivery settles", "Proof is anchored, buyer releases escrow, financier is repaid, and fees are collected."]
];
const appKit = new AppKit();
const bridgeStepNames = ["approve", "burn", "fetchAttestation", "mint"];

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function Reveal({ children, as: Tag = "div", delay = 0, className = "", ...rest }) {
  const ref = React.useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// Cursor-tracking spotlight wrapper — feeds --mx/--my to the .spotlight CSS glow.
function Spotlight({ as: Tag = "div", className = "", children, ...rest }) {
  const ref = React.useRef(null);

  function handleMove(event) {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    node.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <Tag ref={ref} onMouseMove={handleMove} className={`spotlight ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// Animates a number from 0 → value once it scrolls into view.
function CountUp({ value, duration = 1100, decimals = 0, format, className = "" }) {
  const ref = React.useRef(null);
  const [display, setDisplay] = useState(0);
  const target = Number(value) || 0;

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setDisplay(target);
      return undefined;
    }

    let frame = 0;
    let start = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const tick = (now) => {
            if (!start) start = now;
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(target * eased);
            if (progress < 1) frame = requestAnimationFrame(tick);
          };
          frame = requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  const rounded = decimals > 0 ? Number(display.toFixed(decimals)) : Math.round(display);
  return (
    <span ref={ref} className={className}>
      {format ? format(rounded) : rounded.toLocaleString("en-US")}
    </span>
  );
}

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-white/[0.08] bg-white/[0.04] text-slate-300",
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    active: "border-teal-400/30 bg-teal-400/10 text-teal-200",
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-200"
  };
  return (
    <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <Spotlight className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-xl backdrop-blur-sm transition-all hover:border-teal-500/50 hover:shadow-2xl hover:shadow-teal-500/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
          <Icon size={24} className="text-teal-400" />
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-400">{detail}</p>
    </Spotlight>
  );
}

function shortAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function toUsdcDisplay(value) {
  return Number(formatUnits(value, 6));
}

function txUrl(hash) {
  return `https://explorer.testnet.arc.network/tx/${hash}`;
}

function sameAddress(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function hasAddress(value) {
  return Boolean(value && !sameAddress(value, zeroAddress));
}

function makePassportPayload({ address, passport, contractHealth, onchainInvoices }) {
  const relatedTrades = onchainInvoices.filter((invoice) =>
    sameAddress(address, invoice.importerAddress) ||
    sameAddress(address, invoice.sellerAddress) ||
    sameAddress(address, invoice.financierAddress)
  );

  return {
    type: "stabletrade.passport.v1",
    issuedAt: new Date().toISOString(),
    network: "Arc Testnet",
    chainId: arcTestnet.chainId,
    holder: address || null,
    contract: deployedContracts.tradeEscrowProxy,
    contractVersion: contractHealth.version || "unknown",
    metrics: passport,
    proofs: {
      passportRead: address ? `${deployedContracts.tradeEscrowProxy}.passport(${address})` : null,
      explorer: "https://testnet.arcscan.app",
      settlementAsset: deployedContracts.usdc,
      gatewayDomains: gatewayChains.map(({ name, domain }) => ({ name, domain }))
    },
    relatedTrades: relatedTrades.slice(0, 8).map((invoice) => ({
      invoiceId: invoice.id,
      status: invoice.status,
      amount: invoice.amount,
      role: sameAddress(address, invoice.importerAddress)
        ? "importer"
        : sameAddress(address, invoice.sellerAddress)
          ? "exporter"
          : "financier",
      metadataHash: invoice.metadataHash,
      documents: (invoice.documents || []).map((doc) => doc.hash)
    })),
    verifierUrl: address ? `${window.location.origin}${window.location.pathname}#passport=${address}` : null
  };
}

function makePassportQrData(payload) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload.verifierUrl)}`;
}

function buildRiskProfile(invoice) {
  const documents = invoice.documents || [];
  const bids = invoice.bids || [];
  const advanceRate = invoice.advanceRate || 0;
  const amount = invoice.amount || 0;
  const docScore = Math.min(20, documents.length * 5);
  const sizePenalty = amount > 50000 ? 8 : amount > 20000 ? 4 : 0;
  const advancePenalty = advanceRate > 0.88 ? 15 : advanceRate > 0.82 ? 8 : advanceRate > 0.72 ? 3 : 0;
  const bidSignal = Math.min(8, bids.length * 2);
  const statusBonus = invoice.status === "escrowed" ? 12 : invoice.status === "advanced" ? 8 : invoice.status === "settled" ? 16 : 0;
  const baseScore = invoice.riskScore ?? 74;
  const score = Math.max(35, Math.min(98, baseScore + docScore + bidSignal + statusBonus - sizePenalty - advancePenalty));
  const maxAdvanceRate = score >= 88 ? 0.88 : score >= 78 ? 0.82 : score >= 68 ? 0.72 : 0.62;
  const recommendedAdvance = Math.round(amount * maxAdvanceRate);
  const feeBps = score >= 88 ? 140 : score >= 78 ? 220 : score >= 68 ? 340 : 500;
  const expectedApr = Math.round(((feeBps / 10000) * (365 / Math.max(7, invoice.dueDays || 21))) * 1000) / 10;
  const decision = score >= 78 ? "Auto-bid ready" : score >= 65 ? "Manual review" : "Reduce exposure";
  const tone = score >= 78 ? "good" : score >= 65 ? "warn" : "neutral";

  return {
    score,
    maxAdvanceRate,
    recommendedAdvance,
    feeBps,
    expectedApr,
    decision,
    tone,
    coverage: Math.round(maxAdvanceRate * 100),
    checks: [
      { label: "Escrow funded", ok: ["escrowed", "advanced", "settled"].includes(invoice.status) },
      { label: "Document proofs", ok: documents.length >= 2 },
      { label: "Advance below limit", ok: advanceRate <= maxAdvanceRate },
      { label: "Marketplace signal", ok: bids.length > 0 || invoice.status === "escrowed" }
    ]
  };
}

function buildSettlementWaterfall(invoice, protocolFeeBps = 0) {
  if (invoice.settlementWaterfall) {
    return {
      amount: invoice.settlementWaterfall.importerEscrow ?? invoice.amount ?? 0,
      advanceAmount: invoice.settlementWaterfall.exporterAdvance ?? invoice.advanceAmount ?? 0,
      financeFeeBps: invoice.financeFeeBps ?? 0,
      financierFee: invoice.settlementWaterfall.financierFee ?? 0,
      financierRepayment: invoice.settlementWaterfall.financierRepayment ?? 0,
      exporterGrossPayout: (invoice.settlementWaterfall.exporterFinalPayout ?? 0) + (invoice.settlementWaterfall.protocolFee ?? 0),
      protocolFee: invoice.settlementWaterfall.protocolFee ?? 0,
      exporterFinalPayout: invoice.settlementWaterfall.exporterFinalPayout ?? 0,
      exporterTotalReceived: invoice.settlementWaterfall.exporterTotalReceived ?? 0
    };
  }

  const amount = Number(invoice.amount || 0);
  const advanceAmount = Number(invoice.advanceAmount || invoice.amount * invoice.advanceRate || 0);
  const acceptedBid = (invoice.bids || []).find((bid) => bid.accepted);
  const financeFeeBps = Number(invoice.financeFeeBps ?? acceptedBid?.feeBps ?? 0);
  const hasFinancier = hasAddress(invoice.financierAddress);
  const financierFee = hasFinancier ? (advanceAmount * financeFeeBps) / 10000 : 0;
  const financierRepayment = hasFinancier ? Math.min(amount, advanceAmount + financierFee) : 0;
  const exporterGrossPayout = Math.max(0, amount - financierRepayment);
  const protocolFee = (exporterGrossPayout * Number(protocolFeeBps || 0)) / 10000;
  const exporterFinalPayout = Math.max(0, exporterGrossPayout - protocolFee);
  const exporterTotalReceived = advanceAmount + exporterFinalPayout;

  return {
    amount,
    advanceAmount,
    financeFeeBps,
    financierFee,
    financierRepayment,
    exporterGrossPayout,
    protocolFee,
    exporterFinalPayout,
    exporterTotalReceived
  };
}

function buildAgentRecommendations({ onchainInvoices, gatewaySummary, passport }) {
  const openInvoices = onchainInvoices.filter((invoice) => invoice.status === "escrowed" || invoice.status === "draft");
  const ranked = openInvoices
    .map((invoice) => ({ invoice, risk: buildRiskProfile(invoice) }))
    .sort((a, b) => b.risk.score - a.risk.score);
  const best = ranked[0];

  return [
    best && {
      type: "Bid",
      title: `Bid ${currency.format(best.risk.recommendedAdvance)} on ${best.invoice.id}`,
      detail: `${best.risk.score}/100 risk score, ${best.risk.coverage}% max advance, ${best.risk.feeBps / 100}% fee target.`,
      action: "Prefill bid",
      invoiceId: best.invoice.id,
      advanceAmount: String(best.risk.recommendedAdvance),
      feeBps: String(best.risk.feeBps),
      basis: `Risk model score ${best.risk.score}/100`
    },
    passport.score >= 75 && {
      type: "Passport",
      title: "Attach passport export to financing request",
      detail: `Passport score ${passport.score}/100 supports tighter advance pricing for repeat counterparties.`,
      action: "Open passport",
      basis: `Onchain passport score ${passport.score}/100`
    }
  ].filter(Boolean);
}

function InvoiceCard({ invoice, onAction, txPending, walletAddress, protocolFeeBps = 0 }) {
  const statusTone = invoice.status === "settled" ? "good" : invoice.status === "advanced" ? "active" : "warn";
  const advance = invoice.amount * invoice.advanceRate;
  const waterfall = buildSettlementWaterfall(invoice, protocolFeeBps);
  const risk = buildRiskProfile(invoice);
  const onchain = invoice.source === "onchain";
  const isSample = invoice.source === "demo";
  const demoRich = isSample && invoice.settlementWaterfall;
  const isImporter = sameAddress(walletAddress, invoice.importerAddress);
  const isExporter = sameAddress(walletAddress, invoice.sellerAddress);
  const canFund = onchain && invoice.status === "draft" && isImporter;
  const canAdvance = onchain && invoice.status === "escrowed" && !isExporter && invoice.advanceAmount > 0;
  const canRelease = onchain && (invoice.status === "escrowed" || invoice.status === "advanced") && isImporter;
  const role = isImporter ? "Importer" : isExporter ? "Exporter" : onchain ? "Financier / observer" : "Demo sample";

  return (
    <Spotlight as="article" className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-xl backdrop-blur-sm transition-all hover:border-teal-500/30">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold text-white">{invoice.id}</h3>
            <Pill tone={statusTone}>{invoice.status}</Pill>
            {onchain && <Pill tone="good">onchain</Pill>}
            {isSample && <Pill tone="warn">Sample data</Pill>}
            <Pill>{role}</Pill>
          </div>
          <p className="mt-3 text-sm text-slate-400">{invoice.buyer} pays {invoice.seller}</p>
          <p className="mt-1 text-sm font-bold text-teal-400">{invoice.corridor}</p>
        </div>
        <div className="text-left lg:text-right">
          <p className="text-sm font-bold text-slate-400">Invoice value</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-white">{currency.format(invoice.amount)}</p>
          <p className="text-xs tabular-nums text-slate-500">{aedEquivalent(invoice.amount)}</p>
        </div>
      </div>

      {(onchain || demoRich) && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-4">
          <StateMachine status={invoice.status} />
        </div>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Advance</p>
          <p className="mt-1 text-xl font-semibold text-white">{currency.format(advance)}</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Rate</p>
          <p className="mt-1 text-xl font-semibold text-white">{Math.round(invoice.advanceRate * 100)}%</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Due</p>
          <p className="mt-1 text-xl font-semibold text-white">{invoice.dueDays ? `${invoice.dueDays} days` : "—"}</p>
        </div>
        <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Risk score</p>
          <p className="mt-1 text-xl font-semibold text-white">{risk.score}/100</p>
        </div>
      </div>

      {(onchain || demoRich) && (
        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-white/[0.08] bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-400">Financier bids</p>
            <div className="mt-3 grid gap-3">
              {(invoice.bids || []).length === 0 ? (
                <p className="text-sm text-slate-400">No bids yet.</p>
              ) : invoice.bids.map((bid) => (
                <div className="rounded-lg bg-slate-900/50 p-3 text-sm border border-white/5" key={bid.index}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-white">{shortAddress(bid.financier)}</span>
                    <span className="text-slate-400">{currency.format(bid.advanceAmount)} · {bid.feeBps / 100}% fee</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {onchain && isExporter && invoice.status === "escrowed" && !bid.accepted && !bid.cancelled && (
                      <button className="btn-primary min-h-8 px-3 text-xs" disabled={txPending} onClick={() => onAction(invoice, "accept-bid", bid.index)}>
                        Accept bid
                      </button>
                    )}
                    {bid.accepted && <Pill tone="good">accepted</Pill>}
                    {bid.cancelled && <Pill tone="warn">cancelled</Pill>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.08] bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-400">Document hashes</p>
            <div className="mt-3 grid gap-3">
              {(invoice.documents || []).length === 0 ? (
                <p className="text-sm text-slate-400">No documents anchored yet.</p>
              ) : invoice.documents.map((doc) => (
                <div className="rounded-lg bg-slate-900/50 p-3 text-sm border border-white/5" key={`${doc.hash}-${doc.kind}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{documentKindNames[doc.kind] || "Document"}</span>
                    <span className="text-slate-400">{shortAddress(doc.uploader)}</span>
                  </div>
                  <code className="mt-1 block break-all text-xs text-teal-400">{doc.hash}</code>
                </div>
              ))}
            </div>
          </div>

          <SettlementWaterfall waterfall={waterfall} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn-secondary" disabled={txPending || !canFund} onClick={() => onAction(invoice, "fund-escrow")}>
          <WalletCards size={16} />
          Fund escrow
        </button>
        <button className="btn-secondary" disabled={txPending || !canAdvance} onClick={() => onAction(invoice, "approve-advance")}>
          <Landmark size={16} />
          Advance exporter
        </button>
        <button className="btn-primary" disabled={txPending || !canRelease} onClick={() => onAction(invoice, "release")}>
          <FileCheck2 size={16} />
          Release on delivery
        </button>
      </div>
      {onchain && (
        <p className="mt-3 text-xs font-bold text-slate-400">
          Importer funds and releases escrow. Any financier wallet can advance an escrowed invoice.
        </p>
      )}
    </Spotlight>
  );
}

function App() {
  const { address, connector, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [showLanding, setShowLanding] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [events, setEvents] = useState([]);
  const [onchainInvoices, setOnchainInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState("optional");
  const [usdcBalance, setUsdcBalance] = useState(null);
  const [contractHealth, setContractHealth] = useState({
    version: "",
    paused: false,
    nextInvoiceId: 0,
    feeRecipient: "",
    protocolFeeBps: 0,
    protocolFeesAccrued: 0
  });
  const [activeRole, setActiveRole] = useState("buyer");
  const [persona, setPersonaState] = useState("importer");
  const [activePage, setActivePage] = useState("dashboard");

  // Persona bar drives the global role: switching persona re-points the onchain
  // role filters and the highlighted action across every workspace.
  function setPersona(key) {
    const next = personaByKey(key);
    setPersonaState(next.key);
    setActiveRole(next.roleKey);
  }
  const [passport, setPassport] = useState({
    created: 0,
    settled: 0,
    disputed: 0,
    volume: 0,
    score: 50
  });
  const [txPending, setTxPending] = useState(false);
  const [form, setForm] = useState({
    buyer: "Dubai Equipment Mart",
    seller: "Lagos Parts Cooperative",
    exporterAddress: "",
    corridor: "UAE -> Nigeria",
    amount: "12400",
    advanceRate: "80",
    dueDays: "21"
  });
  const [bidForm, setBidForm] = useState({
    invoiceId: "",
    advanceAmount: "1000",
    feeBps: "250"
  });
  const [docForm, setDocForm] = useState({
    invoiceId: "",
    kind: "1",
    hashInput: "",
    fileName: "",
    ipfsCid: ""
  });
  const [gatewayBalances, setGatewayBalances] = useState([]);
  const [gatewayStatus, setGatewayStatus] = useState({
    source: "demo",
    loading: false,
    warning: ""
  });
  const [gatewayForm, setGatewayForm] = useState({
    depositAmount: "25",
    routeAmount: "2500",
    routeInvoiceId: ""
  });
  const [bridgeForm, setBridgeForm] = useState({
    sourceKey: "base",
    destinationKey: "arc",
    amount: "100",
    invoiceId: "",
    useForwarder: true
  });
  const [bridgeSteps, setBridgeSteps] = useState(bridgeStepNames.map((name) => ({ name, state: "waiting" })));
  const [bridgeReceipt, setBridgeReceipt] = useState(null);
  const [passportCopied, setPassportCopied] = useState(false);

  const allInvoices = useMemo(() => [...onchainInvoices, ...invoices], [onchainInvoices, invoices]);

  // Headline KPIs reflect real onchain trades only — sample/demo invoices never
  // inflate them. Empty is shown as an honest zero state, not fabricated.
  const metrics = useMemo(() => {
    const funded = onchainInvoices.filter((invoice) => invoice.status !== "draft");
    const activeVolume = funded.reduce((sum, invoice) => sum + invoice.amount, 0);
    const avgAdvance = funded.length
      ? funded.reduce((sum, invoice) => sum + invoice.advanceRate, 0) / funded.length
      : 0;
    const settled = onchainInvoices.filter((invoice) => invoice.status === "settled").length;
    return { activeVolume, avgAdvance, settled };
  }, [onchainInvoices]);

  const contractSnapshot = [
    ["Proxy", deployedContracts.tradeEscrowProxy],
    ["Factory", deployedContracts.stableTradeFactory],
    ["Implementation", deployedContracts.tradeEscrowImplementation],
    ["USDC", deployedContracts.usdc]
  ];

  const supportsMarketplace = ["2.0.0", "3.0.0"].includes(contractHealth.version);

  const gatewayRows = useMemo(() => {
    return gatewayChains.map((chain) => {
      const live = gatewayBalances.find((item) => Number(item.domain) === chain.domain);
      const balance = live ? Number(live.balance) : null;
      return { ...chain, balance: Number.isFinite(balance) ? balance : null, hasBalance: Number.isFinite(balance) };
    });
  }, [gatewayBalances]);

  const gatewaySummary = useMemo(() => {
    const total = gatewayRows.reduce((sum, row) => sum + (row.balance || 0), 0);
    const arc = gatewayRows.find((row) => row.key === "arc")?.balance || 0;
    const external = total - arc;
    const openNeeds = onchainInvoices
      .filter((invoice) => invoice.status === "draft" || invoice.status === "escrowed")
      .reduce((sum, invoice) => sum + Math.max(0, invoice.amount - invoice.advanceAmount), 0);
    return { total, arc, external, openNeeds };
  }, [gatewayRows, onchainInvoices]);

  const selectedBridgeSource = gatewayChains.find((chain) => chain.key === bridgeForm.sourceKey) || gatewayChains[1];
  const selectedBridgeDestination = gatewayChains.find((chain) => chain.key === bridgeForm.destinationKey) || gatewayChains[0];

  const passportPayload = useMemo(
    () => makePassportPayload({ address, passport, contractHealth, onchainInvoices }),
    [address, passport, contractHealth, onchainInvoices]
  );
  const passportJson = useMemo(() => JSON.stringify(passportPayload, null, 2), [passportPayload]);
  const passportQrUrl = useMemo(() => makePassportQrData(passportPayload), [passportPayload]);
  const riskProfiles = useMemo(() => {
    return Object.fromEntries(onchainInvoices.map((invoice) => [invoice.id, buildRiskProfile(invoice)]));
  }, [onchainInvoices]);
  const marketplaceInvoices = useMemo(() => {
    return onchainInvoices
      .filter((invoice) => invoice.status === "escrowed" || invoice.status === "advanced")
      .map((invoice) => ({ invoice, risk: riskProfiles[invoice.id] || buildRiskProfile(invoice) }))
      .sort((a, b) => b.risk.score - a.risk.score);
  }, [onchainInvoices, riskProfiles]);
  const agentRecommendations = useMemo(
    () => buildAgentRecommendations({ onchainInvoices, gatewaySummary, passport }),
    [onchainInvoices, gatewaySummary, passport]
  );
  const appPages = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["trades", FileText, "Trades"],
    ["treasury", Waypoints, "Treasury"],
    ["funding", ArrowRightLeft, "CCTP Funding"],
    ["marketplace", Gavel, "Marketplace"],
    ["assistant", Bot, "Assistant"],
    ["passport", Trophy, "Passport"],
    ["system", ShieldCheck, "System"]
  ];
  const activePageConfig = appPages.find(([page]) => page === activePage) || appPages[0];
  const ActivePageIcon = activePageConfig[1];
  const activePageLabel = activePageConfig[2];

  const roleInvoices = useMemo(() => {
    if (!address) return onchainInvoices;
    return onchainInvoices.filter((invoice) => {
      if (activeRole === "buyer") return sameAddress(address, invoice.importerAddress);
      if (activeRole === "seller") return sameAddress(address, invoice.sellerAddress);
      if (activeRole === "financier") return !sameAddress(address, invoice.importerAddress) && !sameAddress(address, invoice.sellerAddress);
      return true;
    });
  }, [activeRole, address, onchainInvoices]);

  async function ensureArcChain() {
    if (!isConnected) throw new Error("Connect your wallet first.");
    if (!walletClient) throw new Error("Wallet client is not ready yet.");
    if (chainId !== arcTestnet.chainId) {
      await switchChainAsync({ chainId: arcTestnet.chainId });
    }
  }

  async function waitForTx(hash, title, detail) {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    setEvents((current) => [
      {
        time: new Date().toISOString(),
        title,
        detail,
        hash
      },
      ...current
    ]);
    return receipt;
  }

  function updateBridgeStep(name, state, detail = "") {
    setBridgeSteps((current) => current.map((step) => (
      step.name === name ? { ...step, state, detail } : step
    )));
  }

  async function loadGatewayBalances() {
    setGatewayStatus((current) => ({ ...current, loading: true, warning: "" }));
    try {
      const depositor = address || deployedContracts.owner;
      const data = await api("/api/gateway/balances", {
        method: "POST",
        body: JSON.stringify({
          sources: gatewayChains.map((chain) => ({ domain: chain.domain, depositor }))
        })
      });
      setGatewayBalances(data.balances || []);
      setGatewayStatus({
        source: data.source || "circle-gateway",
        loading: false,
        warning: data.warning || ""
      });
    } catch (err) {
      setGatewayStatus({
        source: "unavailable",
        loading: false,
        warning: err.message
      });
    }
  }

  async function depositToGateway(event) {
    event.preventDefault();
    setError("");
    setTxPending(true);
    try {
      await ensureArcChain();
      const amount = parseUnits(String(gatewayForm.depositAmount), 6);
      const approveHash = await walletClient.writeContract({
        address: deployedContracts.usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [circleGateway.wallet, amount],
        chain: arcChain,
        account: address
      });
      await waitForTx(approveHash, "Gateway allowance confirmed", `${gatewayForm.depositAmount} USDC approved for Gateway Wallet.`);

      const hash = await walletClient.writeContract({
        address: circleGateway.wallet,
        abi: gatewayWalletAbi,
        functionName: "deposit",
        args: [deployedContracts.usdc, amount],
        chain: arcChain,
        account: address
      });
      await waitForTx(hash, "Gateway deposit confirmed", `${gatewayForm.depositAmount} USDC added to unified Gateway balance.`);
      await loadGatewayBalances();
      await loadWalletState();
    } catch (err) {
      setError(err.message);
    } finally {
      setTxPending(false);
    }
  }

  async function runCctpFunding(event) {
    event.preventDefault();
    setError("");
    setTxPending(true);
    setBridgeReceipt(null);
    setBridgeSteps(bridgeStepNames.map((name) => ({ name, state: "waiting" })));

    try {
      if (!isConnected || !connector) throw new Error("Connect a browser wallet before bridging.");
      if (!selectedBridgeSource || !selectedBridgeDestination) throw new Error("Select source and destination chains.");
      if (selectedBridgeSource.key === selectedBridgeDestination.key) throw new Error("Choose different source and destination chains.");
      const amount = Number(bridgeForm.amount || 0);
      if (!amount || amount <= 0) throw new Error("Enter a valid USDC amount.");
      if (amount > 100) {
        throw new Error("This demo blocks bridge attempts above 100 USDC. Lower the amount for a testnet run.");
      }

      if (chainId !== selectedBridgeSource.chainId) {
        await switchChainAsync({ chainId: selectedBridgeSource.chainId });
      }

      const provider = await connector.getProvider();
      const adapter = await createViemAdapterFromProvider({ provider });

      updateBridgeStep("approve", "active", "Waiting for source-chain approval.");
      const result = await appKit.bridge({
        from: { adapter, chain: selectedBridgeSource.kitName },
        to: {
          adapter,
          chain: selectedBridgeDestination.kitName,
          useForwarder: Boolean(bridgeForm.useForwarder)
        },
        amount: String(bridgeForm.amount)
      });

      const sdkSteps = result?.steps || [];
      bridgeStepNames.forEach((name) => {
        const sdkStep = sdkSteps.find((step) => step.name === name || step.action === name || step.type === name);
        updateBridgeStep(name, sdkStep?.state || "success", sdkStep?.txHash || sdkStep?.error || "");
      });

      setBridgeReceipt({
        id: `LIVE-${Date.now().toString(36).toUpperCase()}`,
        provider: result?.provider || "Circle App Kit / CCTP",
        state: result?.state || "submitted",
        amount: bridgeForm.amount,
        token: "USDC",
        sourceChain: selectedBridgeSource.name,
        destinationChain: selectedBridgeDestination.name,
        forwardingService: Boolean(bridgeForm.useForwarder),
        steps: sdkSteps
      });
      setEvents((current) => [
        {
          time: new Date().toISOString(),
          title: "CCTP funding submitted",
          detail: `${bridgeForm.amount} USDC moved from ${selectedBridgeSource.name} to ${selectedBridgeDestination.name}.`
        },
        ...current
      ]);
      await loadWalletState();
    } catch (err) {
      try {
        const fallback = await api("/api/cctp/demo-receipt", {
          method: "POST",
          body: JSON.stringify({
            amount: bridgeForm.amount,
            sourceChain: selectedBridgeSource.name,
            destinationChain: selectedBridgeDestination.name,
            recipient: address,
            forwardingService: bridgeForm.useForwarder
          })
        });
        setBridgeReceipt({ ...fallback.receipt, liveError: err.message });
        setBridgeSteps(fallback.receipt.steps.map((step) => ({
          name: step.name,
          state: "demo-ready",
          detail: step.hash || step.attestation
        })));
        setError(`Live CCTP run did not complete: ${err.message}. Demo receipt generated for the presentation flow.`);
      } catch {
        setError(err.message);
      }
    } finally {
      setTxPending(false);
    }
  }

  async function copyPassportJson() {
    await navigator.clipboard.writeText(passportJson);
    setPassportCopied(true);
    setTimeout(() => setPassportCopied(false), 2000);
  }

  function downloadPassportJson() {
    const blob = new Blob([passportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stabletrade-passport-${address || "demo"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyAgentRecommendation(recommendation) {
    if (recommendation.type === "Bid") {
      setBidForm((current) => ({
        ...current,
        invoiceId: recommendation.invoiceId,
        advanceAmount: recommendation.advanceAmount,
        feeBps: recommendation.feeBps
      }));
      setActivePage("marketplace");
    } else if (recommendation.type === "Passport") {
      setActivePage("passport");
    }

    setEvents((current) => [
      {
        time: new Date().toISOString(),
        title: `Agent recommendation applied: ${recommendation.type}`,
        detail: recommendation.title
      },
      ...current
    ]);
  }

  async function loadOnchainInvoices() {
    if (!publicClient) return;
    const [nextId, version, paused] = await Promise.all([
      publicClient.readContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName: "nextInvoiceId"
      }),
      publicClient.readContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName: "version"
      }),
      publicClient.readContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName: "paused"
      })
    ]);

    setContractHealth({
      version,
      paused,
      nextInvoiceId: Number(nextId),
      feeRecipient: "",
      protocolFeeBps: 0,
      protocolFeesAccrued: 0
    });

    if (version === "3.0.0") {
      const [feeRecipient, protocolFeeBps, protocolFeesAccrued] = await Promise.all([
        publicClient.readContract({
          address: deployedContracts.tradeEscrowProxy,
          abi: tradeEscrowAbi,
          functionName: "feeRecipient"
        }),
        publicClient.readContract({
          address: deployedContracts.tradeEscrowProxy,
          abi: tradeEscrowAbi,
          functionName: "protocolFeeBps"
        }),
        publicClient.readContract({
          address: deployedContracts.tradeEscrowProxy,
          abi: tradeEscrowAbi,
          functionName: "protocolFeesAccrued"
        })
      ]);
      setContractHealth({
        version,
        paused,
        nextInvoiceId: Number(nextId),
        feeRecipient,
        protocolFeeBps: Number(protocolFeeBps),
        protocolFeesAccrued: toUsdcDisplay(protocolFeesAccrued)
      });
    }

    const reads = [];
    for (let id = 1n; id < nextId; id += 1n) {
      reads.push(
        publicClient.readContract({
          address: deployedContracts.tradeEscrowProxy,
          abi: tradeEscrowAbi,
          functionName: "invoices",
          args: [id]
        }).then((invoice) => ({ id, invoice }))
      );
    }

    const records = await Promise.all(reads);
    setOnchainInvoices(records.map(({ id, invoice }) => {
      const amount = toUsdcDisplay(invoice[3]);
      const advanceAmount = toUsdcDisplay(invoice[4]);
      return {
        id: `ARC-${id.toString()}`,
        contractId: id,
        buyer: shortAddress(invoice[0]),
        seller: shortAddress(invoice[1]),
        importerAddress: invoice[0],
        sellerAddress: invoice[1],
        financierAddress: invoice[2],
        corridor: "Arc Testnet",
        amount,
        advanceRate: amount > 0 ? advanceAmount / amount : 0,
        advanceAmount,
        dueDays: null,
        status: statusNames[Number(invoice[5])] || "unknown",
        source: "onchain",
        metadataHash: invoice[6],
        bids: [],
        documents: [],
        walletStatus: "Proxy contract"
      };
    }).reverse());

    if (["2.0.0", "3.0.0"].includes(version)) {
      const enriched = await Promise.all(records.map(async ({ id, invoice }) => {
        const amount = toUsdcDisplay(invoice[3]);
        const advanceAmount = toUsdcDisplay(invoice[4]);
        const [bidCount, docCount] = await Promise.all([
          publicClient.readContract({
            address: deployedContracts.tradeEscrowProxy,
            abi: tradeEscrowAbi,
            functionName: "financeBidCount",
            args: [id]
          }),
          publicClient.readContract({
            address: deployedContracts.tradeEscrowProxy,
            abi: tradeEscrowAbi,
            functionName: "tradeDocumentCount",
            args: [id]
          })
        ]);

        const bids = await Promise.all(Array.from({ length: Number(bidCount) }, (_, index) =>
          publicClient.readContract({
            address: deployedContracts.tradeEscrowProxy,
            abi: tradeEscrowAbi,
            functionName: "financeBid",
            args: [id, BigInt(index)]
          }).then((bid) => ({
            index,
            financier: bid.financier,
            advanceAmount: toUsdcDisplay(bid.advanceAmount),
            feeBps: Number(bid.feeBps),
            accepted: bid.accepted,
            cancelled: bid.cancelled
          }))
        ));
        const acceptedBid = bids.find((bid) => bid.accepted);

        const documents = await Promise.all(Array.from({ length: Number(docCount) }, (_, index) =>
          publicClient.readContract({
            address: deployedContracts.tradeEscrowProxy,
            abi: tradeEscrowAbi,
            functionName: "tradeDocument",
            args: [id, BigInt(index)]
          }).then((doc) => ({
            uploader: doc.uploader,
            kind: Number(doc.kind),
            hash: doc.documentHash,
            timestamp: Number(doc.timestamp)
          }))
        ));
        const acceptedFinanceFeeBps = await publicClient.readContract({
          address: deployedContracts.tradeEscrowProxy,
          abi: tradeEscrowAbi,
          functionName: "acceptedFinanceFeeBps",
          args: [id]
        }).then((value) => Number(value)).catch(() => acceptedBid?.feeBps || 0);

        return {
          id: `ARC-${id.toString()}`,
          contractId: id,
          buyer: shortAddress(invoice[0]),
          seller: shortAddress(invoice[1]),
          importerAddress: invoice[0],
          sellerAddress: invoice[1],
          financierAddress: invoice[2],
          corridor: "Arc Testnet",
          amount,
          advanceRate: amount > 0 ? advanceAmount / amount : 0,
          advanceAmount,
          dueDays: null,
          status: statusNames[Number(invoice[5])] || "unknown",
          source: "onchain",
          metadataHash: invoice[6],
          bids,
          documents,
          financeFeeBps: acceptedFinanceFeeBps,
          walletStatus: "Proxy contract"
        };
      }));
      setOnchainInvoices(enriched.reverse());
    }
  }

  async function loadWalletState() {
    if (!publicClient || !address) {
      setUsdcBalance(null);
      return;
    }
    const balance = await publicClient.readContract({
      address: deployedContracts.usdc,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [address]
    });
    setUsdcBalance(toUsdcDisplay(balance));

    try {
      const data = await publicClient.readContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName: "passport",
        args: [address]
      });
      setPassport({
        created: Number(data[0]),
        settled: Number(data[1]),
        disputed: Number(data[2]),
        volume: toUsdcDisplay(data[3]),
        score: Number(data[4])
      });
    } catch {
      const related = onchainInvoices.filter((invoice) =>
        sameAddress(address, invoice.importerAddress) ||
        sameAddress(address, invoice.sellerAddress) ||
        sameAddress(address, invoice.financierAddress)
      );
      const settled = related.filter((invoice) => invoice.status === "settled").length;
      const disputed = related.filter((invoice) => invoice.status === "disputed").length;
      const volume = related.filter((invoice) => invoice.status === "settled").reduce((sum, invoice) => sum + invoice.amount, 0);
      setPassport({
        created: related.filter((invoice) => sameAddress(address, invoice.importerAddress)).length,
        settled,
        disputed,
        volume,
        score: Math.max(40, Math.min(95, 55 + settled * 12 - disputed * 8 + Math.floor(volume / 10000) * 5))
      });
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      await loadOnchainInvoices();
      await loadWalletState();
      try {
        const data = await api("/api/invoices");
        setInvoices(data.invoices.map((invoice) => ({ ...invoice, source: "demo" })));
        setEvents((current) => [...current, ...data.events]);
        setBackendStatus("available");
      } catch {
        setInvoices([]);
        setBackendStatus("offline");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function act(invoice, action, bidIndex = 0) {
    setError("");
    setTxPending(true);
    try {
      if (invoice.source !== "onchain") {
        throw new Error("Demo invoices are read-only in onchain mode. Create an Arc invoice to execute contract actions.");
      }

      await ensureArcChain();
      if (action === "fund-escrow" || action === "approve-advance") {
        const amount = parseUnits(String(action === "fund-escrow" ? invoice.amount : invoice.advanceAmount), 6);
        const approveHash = await walletClient.writeContract({
          address: deployedContracts.usdc,
          abi: usdcAbi,
          functionName: "approve",
          args: [deployedContracts.tradeEscrowProxy, amount],
          chain: arcChain,
          account: address
        });
        await waitForTx(approveHash, "USDC approval confirmed", `${action === "fund-escrow" ? "Importer escrow" : "Financier advance"} allowance set.`);
      }

      const functionName = {
        "fund-escrow": "fundEscrow",
        "approve-advance": "payAdvance",
        release: "releaseOnDelivery",
        "accept-bid": "acceptFinanceBid"
      }[action];

      const hash = await walletClient.writeContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName,
        args: action === "accept-bid" ? [invoice.contractId, BigInt(bidIndex)] : [invoice.contractId],
        chain: arcChain,
        account: address
      });
      await waitForTx(hash, "Arc transaction confirmed", `${functionName} executed on TradeEscrow proxy.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setTxPending(false);
    }
  }

  async function createInvoice(event) {
    event.preventDefault();
    setError("");
    setTxPending(true);
    try {
      if (!isConnected) throw new Error("Connect your wallet to create an Arc testnet invoice.");
      if (!isAddress(form.exporterAddress)) {
        throw new Error("Enter a valid exporter wallet address.");
      }
      await ensureArcChain();
      const amount = parseUnits(String(form.amount), 6);
      const advanceRate = BigInt(Math.max(0, Math.min(100, Number(form.advanceRate || 0))));
      const advanceAmount = (amount * advanceRate) / 100n;
      const metadataHash = keccak256(
        encodePacked(
          ["string", "string", "string", "string"],
          [form.buyer, form.seller, form.corridor, String(Date.now())]
        )
      );
      const hash = await walletClient.writeContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName: "createInvoice",
        args: [form.exporterAddress, amount, advanceAmount, metadataHash],
        chain: arcChain,
        account: address
      });
      await waitForTx(hash, "Invoice created on Arc", `Metadata hash: ${metadataHash.slice(0, 14)}...`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setTxPending(false);
    }
  }

  async function submitBid(event) {
    event.preventDefault();
    setError("");
    setTxPending(true);
    try {
      if (!supportsMarketplace) throw new Error("Upgrade the proxy to TradeEscrowUpgradeableV2 or V3 before using marketplace bids.");
      await ensureArcChain();
      if (!bidForm.invoiceId) throw new Error("Select an escrowed invoice to bid on.");
      const invoiceId = BigInt(bidForm.invoiceId.replace("ARC-", ""));
      const amount = parseUnits(String(bidForm.advanceAmount), 6);
      const approveHash = await walletClient.writeContract({
        address: deployedContracts.usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [deployedContracts.tradeEscrowProxy, amount],
        chain: arcChain,
        account: address
      });
      await waitForTx(approveHash, "Bid allowance confirmed", "Financier USDC allowance set for the proxy.");
      const hash = await walletClient.writeContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName: "submitFinanceBid",
        args: [invoiceId, amount, BigInt(Number(bidForm.feeBps || 0))],
        chain: arcChain,
        account: address
      });
      await waitForTx(hash, "Finance bid submitted", `Bid placed for invoice ${invoiceId.toString()}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setTxPending(false);
    }
  }

  async function addDocument(event) {
    event.preventDefault();
    setError("");
    setTxPending(true);
    try {
      if (!supportsMarketplace) throw new Error("Upgrade the proxy to TradeEscrowUpgradeableV2 or V3 before anchoring document hashes.");
      await ensureArcChain();
      if (!docForm.invoiceId) throw new Error("Select an invoice before anchoring a document.");
      if (!docForm.hashInput) throw new Error("Upload a file or enter a hash.");
      const invoiceId = BigInt(docForm.invoiceId.replace("ARC-", ""));
      const documentHash = docForm.hashInput.startsWith("0x") && docForm.hashInput.length === 66
        ? docForm.hashInput
        : keccak256(encodePacked(["string"], [docForm.hashInput]));
      const hash = await walletClient.writeContract({
        address: deployedContracts.tradeEscrowProxy,
        abi: tradeEscrowAbi,
        functionName: "addTradeDocument",
        args: [invoiceId, Number(docForm.kind), documentHash],
        chain: arcChain,
        account: address
      });
      await waitForTx(hash, "Document hash anchored", `${documentKindNames[Number(docForm.kind)]} attached to invoice ${invoiceId.toString()}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setTxPending(false);
    }
  }

  async function handleDocumentFile(file) {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hash = `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    let ipfsStatus = "Pinata upload not configured in this local build";
    try {
      const upload = await api("/api/ipfs/upload", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: arrayBufferToBase64(buffer)
        })
      });
      ipfsStatus = upload.uploaded ? `Uploaded to ${upload.uri}` : upload.message;
    } catch {
      ipfsStatus = "Backend upload endpoint unavailable; anchoring local file hash";
    }
    setDocForm((current) => ({
      ...current,
      hashInput: hash,
      fileName: file.name,
      ipfsCid: ipfsStatus
    }));
  }

  useEffect(() => {
    load();
  }, [address]);

  useEffect(() => {
    loadGatewayBalances();
  }, [address]);

  // State + handlers exposed to layout/workspace presentational components.
  const appStateValue = useMemo(() => ({
    isConnected,
    address,
    chainId,
    contractHealth,
    gatewayStatus,
    persona,
    activeRole
  }), [isConnected, address, chainId, contractHealth, gatewayStatus, persona, activeRole]);

  if (showLanding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white">
        {/* Navigation */}
        <nav className="fixed top-0 z-50 w-full border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent"></div>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/30">
                <Shield size={22} className="text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">StableTrade</span>
            </div>
            <div className="flex items-center gap-4">
              <ConnectButton />
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-20">
          {/* Grid texture with radial fade mask */}
          <div
            className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          ></div>
          {/* Ambient glow blobs */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-teal-500/20 blur-3xl"></div>
          <div className="pointer-events-none absolute top-10 right-0 h-[24rem] w-[24rem] rounded-full bg-indigo-500/15 blur-3xl"></div>

          <div className="relative mx-auto max-w-7xl px-6">
            <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 items-center">
              {/* Left Content */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 backdrop-blur-sm">
                  <Sparkles size={16} className="text-teal-400" />
                  <span className="text-sm font-medium text-teal-300">Powered by Circle USDC &amp; Arc Network</span>
                </div>

                <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-white md:text-7xl">
                  StableTrade Passport
                  <span className="block bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                    for SME trade
                  </span>
                </h1>

                <p className="max-w-2xl text-lg font-normal leading-relaxed text-slate-300 md:text-xl">
                  A working Arc testnet DApp where buyers lock USDC, sellers prove delivery, financiers bid on invoices, and every settled trade builds an onchain credit passport.
                </p>

                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => setShowLanding(false)}
                    className="group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-teal-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-teal-500/60"
                  >
                    Launch App
                    <ArrowRightLeft size={20} className="transition-transform group-hover:translate-x-1" />
                  </button>
                  <button
                    onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400/40 hover:bg-white/10"
                  >
                    Learn More
                  </button>
                </div>

                <div className="flex flex-wrap gap-8 pt-4">
                  <div>
                    <div className="text-4xl font-semibold tracking-tight text-white">USDC</div>
                    <div className="mt-1 text-sm font-medium text-slate-400">Escrow settlement</div>
                  </div>
                  <div>
                    <div className="text-4xl font-semibold tracking-tight text-white">3 roles</div>
                    <div className="mt-1 text-sm font-medium text-slate-400">Buyer seller financier</div>
                  </div>
                  <div>
                    <div className="text-4xl font-semibold tracking-tight text-white">UUPS</div>
                    <div className="mt-1 text-sm font-medium text-slate-400">Upgradeable proxy</div>
                  </div>
                </div>
              </div>

              {/* Right Hero Card */}
              <div className="relative animate-fade-up">
                <Spotlight className="hero-terminal relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Example trade flow</p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">UAE buyer to global supplier</h2>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">
                      Illustrative
                    </span>
                  </div>
                  <div className="mt-6 grid gap-4">
                    {[
                      ["Buyer", "Funds invoice escrow", "$12,400 USDC", ShieldCheck],
                      ["Financier", "Bids 80% advance", "$9,920 USDC", Gavel],
                      ["Seller", "Uploads delivery proof", "SHA-256 anchored", FileCheck2]
                    ].map(([role, text, value, Icon]) => (
                      <div key={role} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 transition-colors hover:border-teal-400/30 hover:bg-white/[0.05]">
                        <div className="flex items-start justify-between gap-5">
                          <div>
                            <p className="text-sm font-bold text-teal-300">{role}</p>
                            <p className="mt-1 text-lg font-semibold text-white">{text}</p>
                            <p className="mt-2 text-sm font-normal text-slate-400">{value}</p>
                          </div>
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-400/10">
                            <Icon size={22} className="text-teal-300" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Spotlight>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative py-24 px-6 scroll-mt-24">
          <div className="mx-auto max-w-7xl">
            <Reveal className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Complete Trade Finance Stack
              </h2>
              <p className="mt-4 text-xl font-normal text-slate-400">
                Everything you need for secure, efficient cross-border trade
              </p>
            </Reveal>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: ShieldCheck, title: "Onchain Escrow", desc: "USDC locked in an Arc escrow smart contract" },
                { icon: Landmark, title: "Working Capital", desc: "Instant financing from marketplace bids" },
                { icon: FileCheck2, title: "Document Proofs", desc: "Immutable trade document anchoring" },
                { icon: Trophy, title: "Credit Passport", desc: "Build reputation with every transaction" }
              ].map((feature, i) => (
                <Reveal key={i} delay={i * 90} className="group rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/50 to-slate-800/50 p-8 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-teal-500/50 hover:shadow-2xl hover:shadow-teal-500/20">
                  <div className="mb-6 grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 transition-transform group-hover:scale-110">
                    <feature.icon size={28} className="text-teal-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                  <p className="mt-3 text-base font-normal text-slate-400">{feature.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="relative py-24 px-6 bg-slate-950/50">
          <div className="mx-auto max-w-7xl">
            <Reveal className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                How It Works
              </h2>
              <p className="mt-4 text-xl font-normal text-slate-400">
                Four simple steps to transform your trade finance
              </p>
            </Reveal>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map(([step, title, detail], i) => (
                <Reveal key={step} delay={i * 90} className="relative">
                  {i < workflowSteps.length - 1 && (
                    <div className="absolute top-12 left-[calc(50%+2rem)] hidden h-0.5 w-[calc(100%-4rem)] bg-gradient-to-r from-teal-500/50 to-transparent lg:block"></div>
                  )}
                  <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 to-slate-800 p-8">
                    <div className="mb-6 grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-2xl font-semibold tracking-tight text-white shadow-lg shadow-teal-500/50">
                      {step}
                    </div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <p className="mt-3 text-sm font-normal leading-relaxed text-slate-400">{detail}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 px-6">
          <Reveal className="mx-auto max-w-4xl text-center">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-teal-900/30 to-emerald-900/30 p-12 backdrop-blur-xl md:p-16">
              <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-teal-500/20 blur-3xl"></div>
              <h2 className="relative text-4xl font-bold tracking-tight text-white md:text-5xl">
                Ready to Transform Your Trade Finance?
              </h2>
              <p className="relative mt-6 text-xl font-normal text-slate-300">
                Join the future of programmable trade finance on Arc Network
              </p>
              <button
                onClick={() => setShowLanding(false)}
                className="relative mt-8 inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-10 py-5 text-xl font-bold text-white shadow-xl shadow-teal-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-teal-500/60"
              >
                Launch Application
                <ArrowRightLeft size={24} />
              </button>
            </div>
          </Reveal>
        </section>

        {/* Footer */}
        <footer className="relative border-t border-white/[0.06] bg-slate-950/80 px-6 pt-14 pb-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent"></div>
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/30">
                    <Shield size={22} className="text-white" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-white">StableTrade Passport</span>
                </div>
                <p className="mt-4 max-w-xs text-sm font-normal leading-relaxed text-slate-400">
                  Programmable trade finance on Arc — escrow, invoice financing, and an onchain credit passport for SMEs.
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Product</p>
                <ul className="mt-4 space-y-3 text-sm font-medium text-slate-400">
                  <li><button onClick={() => setShowLanding(false)} className="transition-colors hover:text-teal-300">Launch App</button></li>
                  <li><button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })} className="transition-colors hover:text-teal-300">Features</button></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Resources</p>
                <ul className="mt-4 space-y-3 text-sm font-medium text-slate-400">
                  <li><a href="https://www.circle.com/usdc" target="_blank" rel="noreferrer" className="transition-colors hover:text-teal-300">Circle USDC</a></li>
                  <li><a href="https://github.com" target="_blank" rel="noreferrer" className="transition-colors hover:text-teal-300">GitHub</a></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Network</p>
                <ul className="mt-4 space-y-3 text-sm font-medium text-slate-400">
                  <li><span className="text-slate-400">Arc testnet</span></li>
                  <li><span className="text-slate-400">UUPS proxy</span></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-6 text-sm font-normal text-slate-500 md:flex-row">
              <span>© 2026 StableTrade Passport</span>
              <div className="flex items-center gap-3">
                <span>Powered by Circle USDC</span>
                <span className="text-slate-700">•</span>
                <span>Built on Arc Network</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <AppStateContext.Provider value={appStateValue}>
    <main className="app-shell min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <CircleTelemetryDrawer />
      <div className="sticky top-0 z-40">
        <PersonaBar persona={persona} onChange={setPersona} />
        <header className="relative border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent"></div>
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowLanding(true)}
                className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/30 transition-transform hover:scale-105"
              >
                <Shield size={22} className="text-white" />
              </button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400/80">StableTrade Passport</p>
                <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                  Trade Finance Console
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                <span className="relative inline-flex h-2 w-2 text-emerald-400">
                  <span className="live-dot absolute inline-flex h-2 w-2 rounded-full"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                </span>
                Arc testnet
              </span>
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                USDC Ready
              </span>
              <ConnectButton />
            </div>
          </div>
        </header>

        <nav className="border-b border-white/[0.08] bg-slate-950/70 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="panel p-3 sm:p-4 lg:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-teal-400/25 bg-teal-400/10 text-teal-300">
                    <ActivePageIcon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="eyebrow">Workspace panel</p>
                    <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">{activePageLabel}</h2>
                    <p className="mt-1 hidden text-sm text-slate-400 sm:block">
                      Switch between trade operations, treasury, funding, underwriting, assistant, passport, and system views.
                    </p>
                  </div>
                </div>

                <label className="grid min-w-0 gap-2 text-sm font-semibold text-slate-400">
                  <span className="sr-only">Choose StableTrade page</span>
                  <select
                    className="page-select"
                    value={activePage}
                    onChange={(event) => setActivePage(event.target.value)}
                  >
                    {appPages.map(([page, , label]) => (
                      <option value={page} key={page}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 hidden grid-cols-4 gap-2 lg:grid">
                {appPages.map(([page, Icon, label]) => (
                  <button
                    key={page}
                    className={activePage === page ? "nav-tab-active justify-start" : "nav-tab justify-start"}
                    onClick={() => setActivePage(page)}
                    title={label}
                    type="button"
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </nav>
      </div>

      <div key={activePage} className="page-enter">
      {activePage === "dashboard" && (
      <>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
                  <Sparkles size={24} className="text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-teal-400">Track 2 MVP</p>
                  <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Real SME Workflows</h2>
                </div>
              </div>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                StableTrade coordinates buyer escrow, seller working capital, financier bids, delivery proofs,
                passport analytics, and protocol fees through the deployed Arc testnet proxy.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="feature-modern"><ShieldCheck size={18} /> Proof-of-delivery release</div>
                <div className="feature-modern"><CircleDollarSign size={18} /> USDC settlement</div>
                <div className="feature-modern"><Network size={18} /> CCTP/Gateway ready</div>
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-slate-900/50 p-5 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Deployed Stack</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">Arc Testnet Proxy</h3>
                </div>
                <Pill tone={chainId === arcTestnet.chainId ? "active" : "warn"}>{arcTestnet.chainName}</Pill>
              </div>
              <ContractRegistry className="mt-5" entries={contractSnapshot} />
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Live proxy on Arc testnet · chain {arcTestnet.chainId}. Copy or open any address on ArcScan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-10">
        <div className="grid gap-4 md:grid-cols-4">
          {workflowSteps.map(([step, title, detail]) => (
            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-900/50 to-slate-800/50 p-5 backdrop-blur-sm" key={step}>
              <div className="mb-5 grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 text-sm font-semibold text-white shadow-lg shadow-teal-500/30">{step}</div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 sm:pb-10">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Banknote} label="Escrowed volume" value={currency.format(metrics.activeVolume)} detail={`${aedEquivalent(metrics.activeVolume)} · importer-funded USDC in active workflows.`} />
          <Metric icon={ArrowRightLeft} label="Average advance" value={`${Math.round(metrics.avgAdvance * 100)}%`} detail="Expected financier advance against verified receivables." />
          <Metric icon={BadgeCheck} label="Settled invoices" value={String(metrics.settled)} detail="Released by proof-of-delivery style trigger." />
          <Metric icon={CircleDollarSign} label="Wallet USDC" value={usdcBalance === null ? "Connect wallet" : currency.format(usdcBalance)} detail="Live balance read from Arc testnet USDC." />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-12">
        <div className="panel p-7 md:p-8">
          <p className="eyebrow">Audit trail</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Recent Arc events</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <div className="rounded-xl border border-white/5 bg-slate-950/50 p-5" key={`${event.time}-${event.title}`}>
                <p className="font-semibold text-white">{event.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{event.detail}</p>
                {event.hash && (
                  <a className="mt-3 inline-flex text-sm font-semibold text-teal-400 transition-colors hover:text-teal-300" href={txUrl(event.hash)} target="_blank" rel="noreferrer">
                    View transaction
                  </a>
                )}
              </div>
            ))}
            {events.length === 0 && <p className="text-sm text-slate-400">No local transaction events yet.</p>}
          </div>
        </div>
      </section>
      </>
      )}

      {activePage === "passport" && !isConnected && (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="panel p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
            <Trophy size={26} className="text-teal-400" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Connect a wallet to build your passport</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
            The SME credit passport is generated from your own settlement history read live from the Arc
            proxy. Connect a wallet to view and export a verifiable credential — no sample scores are shown.
          </p>
          <div className="mt-6 flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </section>
      )}

      {activePage === "passport" && isConnected && (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:py-12 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-7 md:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
              <Trophy size={19} className="text-teal-400" />
            </div>
            <div>
              <p className="eyebrow">Credit passport</p>
              <h2 className="text-xl font-semibold text-white">Score <CountUp value={passport.score} />/100</h2>
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-slate-700/50">
            <div className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/50 transition-all" style={{ width: `${passport.score}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
              <span className="font-bold text-slate-400">Created</span>
              <strong className="block text-2xl text-white"><CountUp value={passport.created} /></strong>
            </div>
            <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
              <span className="font-bold text-slate-400">Settled</span>
              <strong className="block text-2xl text-white"><CountUp value={passport.settled} /></strong>
            </div>
            <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
              <span className="font-bold text-slate-400">Disputes</span>
              <strong className="block text-2xl text-white"><CountUp value={passport.disputed} /></strong>
            </div>
            <div className="rounded-lg bg-slate-950/50 p-4 border border-white/5">
              <span className="font-bold text-slate-400">Volume</span>
              <strong className="block text-2xl text-white"><CountUp value={passport.volume} format={(n) => currency.format(n)} /></strong>
            </div>
          </div>
          <div className="mt-6 grid gap-4 rounded-xl border border-white/[0.08] bg-slate-950/50 p-5 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-xl bg-white p-3">
              <img className="h-full w-full rounded-lg" src={passportQrUrl} alt="StableTrade passport verifier QR" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">Verifiable export</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Portable SME credential</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Exportable JSON links this wallet, the deployed Arc proxy, passport metrics, related invoices,
                document hashes, and the verifier URL.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="btn-primary" onClick={copyPassportJson} type="button">
                  <Copy size={16} />
                  {passportCopied ? "Copied" : "Copy JSON"}
                </button>
                <button className="btn-secondary" onClick={downloadPassportJson} type="button">
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="panel p-7 md:p-8">
          <p className="eyebrow">Passport verifier</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Proof package</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {[
              ["Holder", shortAddress(passportPayload.holder)],
              ["Network", `${passportPayload.network} · ${passportPayload.chainId}`],
              ["Proxy", shortAddress(passportPayload.contract)],
              ["Version", passportPayload.contractVersion],
              ["Settlement asset", shortAddress(passportPayload.proofs.settlementAsset)],
              ["Trade proofs", `${passportPayload.relatedTrades.length} attached`]
            ].map(([title, detail]) => (
              <div className="rounded-xl border border-white/5 bg-slate-950/50 p-5" key={title}>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-2 break-all text-sm leading-6 text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
          <pre className="mt-6 max-h-[420px] overflow-auto rounded-xl border border-white/[0.08] bg-slate-950/70 p-5 text-xs leading-5 text-teal-100">
            {passportJson}
          </pre>
        </div>
      </section>
      )}

      {activePage === "treasury" && (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:gap-8 lg:py-12 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-6">
          <div className="panel p-7 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">Circle Gateway</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">Unified USDC treasury</h2>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                  Gateway lets financiers and importers view USDC liquidity across supported chains as one balance,
                  then route capital into Arc settlement when an invoice needs funding.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone={gatewayStatus.source === "circle-gateway" ? "good" : "warn"}>
                  {gatewayStatus.source === "circle-gateway" ? "Live Gateway API" : "Sample balances"}
                </Pill>
                <button className="btn-secondary" onClick={loadGatewayBalances} disabled={gatewayStatus.loading} type="button">
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>
            {gatewayStatus.warning && (
              <p className="mt-5 alert-warn">
                Gateway API fallback: {gatewayStatus.warning}
              </p>
            )}
            <div className="mt-7 grid gap-4 md:grid-cols-4">
              <Metric icon={CircleDollarSign} label="Unified balance" value={currency.format(gatewaySummary.total)} detail="Total USDC visible across configured Gateway domains." />
              <Metric icon={Network} label="Arc inventory" value={currency.format(gatewaySummary.arc)} detail="Liquidity already positioned on Arc testnet." />
              <Metric icon={ArrowRightLeft} label="External source" value={currency.format(gatewaySummary.external)} detail="USDC available outside Arc for routing." />
              <Metric icon={FileText} label="Open need" value={currency.format(gatewaySummary.openNeeds)} detail="Draft and escrowed invoice settlement demand." />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {gatewayRows.map((row) => (
              <article className="rounded-xl border border-white/[0.08] bg-slate-900/70 p-5 shadow-lg" key={row.key}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Domain {row.domain}</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">{row.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">{row.role}</p>
                  </div>
                  <Pill tone={row.key === "arc" ? "good" : "active"}>{row.key === "arc" ? "destination" : "source"}</Pill>
                </div>
                <p className="mt-5 text-3xl font-semibold tracking-tight text-white">
                  {row.hasBalance ? currency.format(row.balance) : "—"}
                </p>
                {!row.hasBalance && <p className="text-xs text-slate-500">No balance queried yet</p>}
                <div className="mt-4 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
                    style={{ width: `${row.hasBalance ? Math.max(4, Math.min(100, ((row.balance || 0) / Math.max(1, gatewaySummary.total)) * 100)) : 0}%` }}
                  />
                </div>
                <code className="mt-4 block break-all rounded-lg border border-white/5 bg-slate-950/60 p-3 text-xs text-teal-300">
                  USDC {row.usdc}
                </code>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <form className="panel p-7 md:p-8" onSubmit={depositToGateway}>
            <p className="eyebrow">Gateway Wallet</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Deposit Arc USDC</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Calls the testnet Gateway Wallet `deposit(token,value)` method. Do not transfer USDC directly to the Gateway Wallet address.
            </p>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-slate-400">
                Amount
                <input className="field" type="number" min="0" step="0.01" value={gatewayForm.depositAmount} onChange={(event) => setGatewayForm((current) => ({ ...current, depositAmount: event.target.value }))} />
              </label>
              <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gateway Wallet</span>
                <code className="mt-2 block break-all text-xs text-teal-400">{circleGateway.wallet}</code>
              </div>
              <button className="btn-primary justify-center" disabled={txPending || !isConnected} type="submit">
                Approve + deposit
              </button>
            </div>
          </form>

          <div className="panel p-7 md:p-8">
            <p className="eyebrow">Move liquidity to Arc</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Cross-chain funding</h2>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              When USDC is positioned on another chain, move it into Arc with a real Circle CCTP transfer
              (approve → burn → attestation → mint) before funding an invoice escrow.
            </p>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                <span className="font-semibold text-slate-400">On Arc now</span>
                <span className="font-semibold tabular-nums text-white">{gatewayRows.find((r) => r.key === "arc")?.hasBalance ? currency.format(gatewaySummary.arc) : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                <span className="font-semibold text-slate-400">Open invoice need</span>
                <span className="font-semibold tabular-nums text-white">{currency.format(gatewaySummary.openNeeds)}</span>
              </div>
            </div>
            <button className="btn-primary mt-6 w-full justify-center" type="button" onClick={() => setActivePage("funding")}>
              <ArrowRightLeft size={16} />
              Open CCTP funding
            </button>
          </div>
        </div>
      </section>
      )}

      {activePage === "funding" && (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:gap-8 lg:py-12 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="panel p-7 md:p-8" onSubmit={runCctpFunding}>
          <p className="eyebrow">CCTP / Circle App Kit</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">Fund Arc from another chain</h2>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Uses Circle App Kit with the viem provider adapter when a wallet is connected. If the live testnet transfer cannot complete,
            the backend returns a demo receipt with the same approve, burn, attestation, and mint stages for the video walkthrough.
          </p>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-400">
              Source chain
              <select className="field" value={bridgeForm.sourceKey} onChange={(event) => setBridgeForm((current) => ({ ...current, sourceKey: event.target.value }))}>
                {gatewayChains.filter((chain) => chain.key !== "arc").map((chain) => (
                  <option value={chain.key} key={chain.key}>{chain.name} · CCTP domain {chain.domain}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-400">
              Destination
              <select className="field" value={bridgeForm.destinationKey} onChange={(event) => setBridgeForm((current) => ({ ...current, destinationKey: event.target.value }))}>
                {gatewayChains.map((chain) => (
                  <option value={chain.key} key={chain.key}>{chain.name} · {chain.kitName}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-400">
              Amount USDC
              <input className="field" type="number" min="0" max="100" step="0.01" value={bridgeForm.amount} onChange={(event) => setBridgeForm((current) => ({ ...current, amount: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-400">
              Attach to invoice
              <select className="field" value={bridgeForm.invoiceId} onChange={(event) => setBridgeForm((current) => ({ ...current, invoiceId: event.target.value }))}>
                <option value="">No invoice attachment</option>
                {onchainInvoices.map((invoice) => (
                  <option value={invoice.id} key={invoice.id}>{invoice.id} · {invoice.status}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-slate-950/50 p-4 text-sm font-bold text-slate-300">
              <input type="checkbox" checked={bridgeForm.useForwarder} onChange={(event) => setBridgeForm((current) => ({ ...current, useForwarder: event.target.checked }))} />
              Use Circle Forwarding Service when available
            </label>
            <button className="btn-primary justify-center" disabled={txPending || !isConnected} type="submit">
              Run CCTP funding flow
            </button>
          </div>
        </form>

        <div className="grid gap-6">
          <div className="panel p-7 md:p-8">
            <p className="eyebrow">Route preview</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">{selectedBridgeSource.name} to {selectedBridgeDestination.name}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Source domain", `${selectedBridgeSource.domain}`],
                ["Destination domain", `${selectedBridgeDestination.domain}`],
                ["SDK chain", selectedBridgeSource.kitName],
                ["Destination kit", selectedBridgeDestination.kitName],
                ["Amount", `${bridgeForm.amount || 0} USDC`],
                ["Recipient", address ? shortAddress(address) : "Connect wallet"]
              ].map(([label, value]) => (
                <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4" key={label}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                  <p className="mt-2 break-all font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-7 md:p-8">
            <p className="eyebrow">CCTP stages</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Transfer status</h2>
            <div className="mt-6">
              <CctpProgress steps={bridgeSteps} />
            </div>
          </div>

          {bridgeReceipt && (
            <div className="panel p-7 md:p-8">
              <p className="eyebrow">Funding receipt</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">{bridgeReceipt.id}</h2>
              {bridgeReceipt.liveError && (
                <p className="mt-4 alert-warn">
                  Live SDK fallback: {bridgeReceipt.liveError}
                </p>
              )}
              <pre className="mt-5 max-h-[360px] overflow-auto rounded-xl border border-white/[0.08] bg-slate-950/70 p-5 text-xs leading-5 text-teal-100">
                {JSON.stringify(bridgeReceipt, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>
      )}

      {activePage === "marketplace" && (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:gap-8 lg:py-12 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-7 md:p-8">
          <p className="eyebrow">Risk-based marketplace</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">Underwrite receivables</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
            The marketplace prices each invoice from escrow status, document proofs, bid competition, advance ratio, size, and passport context.
            Financiers can use the recommendation to prefill a bid, then approve and submit onchain.
          </p>
          <div className="mt-7 grid gap-5">
            {marketplaceInvoices.map(({ invoice, risk }) => (
              <article className="rounded-xl border border-white/[0.08] bg-slate-950/50 p-5" key={invoice.id}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-white">{invoice.id}</h3>
                      <Pill tone={risk.tone}>{risk.decision}</Pill>
                      <Pill>{invoice.status}</Pill>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {shortAddress(invoice.importerAddress)} pays {shortAddress(invoice.sellerAddress)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Risk score</p>
                    <p className="text-3xl font-semibold tracking-tight text-white">{risk.score}/100</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-white/5 bg-slate-900/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invoice</p>
                    <p className="text-xl font-semibold text-white">{currency.format(invoice.amount)}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-slate-900/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Max advance</p>
                    <p className="text-xl font-semibold text-white">{risk.coverage}%</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-slate-900/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Suggested bid</p>
                    <p className="text-xl font-semibold text-white">{currency.format(risk.recommendedAdvance)}</p>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-slate-900/70 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fee / APR</p>
                    <p className="text-xl font-semibold text-white">{risk.feeBps / 100}% · {risk.expectedApr}%</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  {risk.checks.map((check) => (
                    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900/60 p-3 text-sm font-bold text-slate-300" key={`${invoice.id}-${check.label}`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${check.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {check.label}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => setBidForm((current) => ({
                      ...current,
                      invoiceId: invoice.id,
                      advanceAmount: String(risk.recommendedAdvance),
                      feeBps: String(risk.feeBps)
                    }))}
                  >
                    Prefill bid
                  </button>
                  <button className="btn-secondary" type="button" onClick={() => setActivePage("passport")}>
                    View passport proof
                  </button>
                </div>
              </article>
            ))}
            {marketplaceInvoices.length === 0 && (
              <div className="rounded-xl border border-white/5 bg-slate-950/50 p-5 text-sm text-slate-400">
                No escrowed or advanced invoices are currently available for underwriting.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <form className="panel p-7 md:p-8" onSubmit={submitBid}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
                <Gavel size={20} className="text-teal-400" />
              </div>
              <div>
                <p className="eyebrow">Financier marketplace</p>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Submit bid</h2>
              </div>
            </div>
            {!supportsMarketplace && <p className="mt-4 alert-warn">Upgrade proxy to V2 or V3 to enable live bid writes.</p>}
            <div className="mt-6 grid gap-4">
              <select className="field" value={bidForm.invoiceId} onChange={(e) => setBidForm((v) => ({ ...v, invoiceId: e.target.value }))}>
                <option value="">Select escrowed invoice</option>
                {onchainInvoices.filter((invoice) => invoice.status === "escrowed").map((invoice) => (
                  <option value={invoice.id} key={invoice.id}>{invoice.id} · {currency.format(invoice.amount)}</option>
                ))}
              </select>
              <input className="field" type="number" placeholder="Advance USDC" value={bidForm.advanceAmount} onChange={(e) => setBidForm((v) => ({ ...v, advanceAmount: e.target.value }))} />
              <input className="field" type="number" placeholder="Fee bps" value={bidForm.feeBps} onChange={(e) => setBidForm((v) => ({ ...v, feeBps: e.target.value }))} />
              <button className="btn-primary justify-center" disabled={txPending || !supportsMarketplace}>Approve + bid</button>
            </div>
          </form>

          <form className="panel p-7 md:p-8" onSubmit={addDocument}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20">
                <FileText size={20} className="text-teal-400" />
              </div>
              <div>
                <p className="eyebrow">Document proofs</p>
                <h2 className="text-2xl font-semibold tracking-tight text-white">Upload and anchor</h2>
              </div>
            </div>
            {!supportsMarketplace && <p className="mt-4 alert-warn">Upgrade proxy to V2 or V3 to enable document hashes.</p>}
            <div className="mt-6 grid gap-4">
              <select className="field" value={docForm.invoiceId} onChange={(e) => setDocForm((v) => ({ ...v, invoiceId: e.target.value }))}>
                <option value="">Select invoice</option>
                {onchainInvoices.map((invoice) => (
                  <option value={invoice.id} key={invoice.id}>{invoice.id} · {invoice.status}</option>
                ))}
              </select>
              <select className="field" value={docForm.kind} onChange={(e) => setDocForm((v) => ({ ...v, kind: e.target.value }))}>
                {documentKindNames.map((name, index) => <option value={index} key={name}>{name}</option>)}
              </select>
              <input className="field file:mr-3 file:rounded-md file:border-0 file:bg-gradient-to-r file:from-teal-500 file:to-emerald-500 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white" type="file" onChange={(e) => handleDocumentFile(e.target.files?.[0])} />
              <input className="field" placeholder="Computed file hash or external hash" value={docForm.hashInput} onChange={(e) => setDocForm((v) => ({ ...v, hashInput: e.target.value }))} />
              {docForm.fileName && <p className="text-sm font-bold text-slate-400">{docForm.fileName} · {docForm.ipfsCid}</p>}
              <button className="btn-primary justify-center" disabled={txPending || !supportsMarketplace}>Anchor document</button>
            </div>
          </form>
        </div>
      </section>
      )}

      {activePage === "assistant" && (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:gap-8 lg:py-12 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="panel p-7 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
                <Bot size={13} className="text-indigo-300" />
                Agentic finance assistant
              </span>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">Next best action</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                The assistant watches invoices, Gateway liquidity, CCTP funding state, and passport metrics, then recommends actions.
                It never auto-submits transactions; it prepares forms and leaves final wallet approval to the user.
              </p>
            </div>
            <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-teal-400/30 bg-teal-400/10 px-3.5 text-xs font-semibold text-teal-200">
              <ShieldCheck size={14} />
              Human approval required
            </span>
          </div>

          <div className="mt-7 grid gap-4">
            {agentRecommendations.map((recommendation) => (
              <Spotlight as="article" className="spotlight-iris rounded-xl border border-indigo-400/15 bg-indigo-500/[0.04] p-5 transition-colors hover:border-indigo-400/35" key={`${recommendation.type}-${recommendation.title}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Pill tone="active">{recommendation.type}</Pill>
                      <span className="text-sm font-semibold text-slate-400">{recommendation.basis}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">{recommendation.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{recommendation.detail}</p>
                  </div>
                  <button className="btn-primary shrink-0" type="button" onClick={() => applyAgentRecommendation(recommendation)}>
                    {recommendation.action}
                  </button>
                </div>
              </Spotlight>
            ))}
            {agentRecommendations.length === 0 && (
              <div className="rounded-xl border border-white/5 bg-slate-950/50 p-5 text-sm text-slate-400">
                No recommendations yet. Create and escrow an invoice, then refresh the workspace.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="panel p-7 md:p-8">
            <p className="eyebrow">Agent context</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Observed signals</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ["Open invoices", marketplaceInvoices.length],
                ["Escrowed volume", currency.format(metrics.activeVolume)],
                ["Settled trades", metrics.settled],
                ["Passport score", `${passport.score}/100`],
                ["Protocol version", contractHealth.version || "unknown"],
                ["Wallet", isConnected ? shortAddress(address) : "Not connected"]
              ].map(([label, value]) => (
                <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4" key={label}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                  <p className="mt-2 font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-7 md:p-8">
            <p className="eyebrow">Policy guardrails</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Manual settlement control</h2>
            <div className="mt-6 grid gap-3">
              {[
                "Does not sign wallet transactions.",
                "Caps testnet CCTP transfers at 100 USDC.",
                "Prefills bids using the risk model; the financier approves onchain.",
                "Every recommendation ends at a manual wallet-approval step."
              ].map((item) => (
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/50 p-4 text-sm font-bold text-slate-300" key={item}>
                  <ShieldCheck size={17} className="text-teal-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      )}

      {activePage === "trades" && (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:gap-8 lg:py-12 xl:grid-cols-[440px_minmax(0,1fr)]">
        <div className="grid gap-6">
          <aside className="panel p-7 md:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Create invoice</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Creates a real invoice on the deployed Arc proxy. The connected wallet becomes the importer.
            </p>
            <form className="mt-6 grid gap-4" onSubmit={createInvoice}>
              {[
                ["buyer", "Buyer"],
                ["seller", "Seller"],
                ["exporterAddress", "Exporter wallet"],
                ["corridor", "Corridor"],
                ["amount", "Amount USDC"],
                ["advanceRate", "Advance rate %"],
                ["dueDays", "Due days"]
              ].map(([name, label]) => (
                <label className="grid gap-2 text-sm font-bold text-slate-400" key={name}>
                  {label}
                  <input
                    className="field"
                    name={name}
                    type={name === "amount" || name === "dueDays" ? "number" : "text"}
                    value={form[name]}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                  />
                </label>
              ))}
              <button className="btn-primary h-11 justify-center" type="submit" disabled={txPending || contractHealth.paused}>
                {txPending ? "Waiting for wallet" : "Create on Arc"}
              </button>
            </form>
          </aside>

          <aside className="panel p-7 md:p-8">
            <p className="eyebrow">System status</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">Wallet and revenue</h2>
            <div className="mt-5 rounded-lg border border-white/[0.08] bg-slate-950/50 p-5">
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-400">Status</span><span className="font-semibold text-white">{isConnected ? "Connected" : "Disconnected"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-400">Wallet</span><span className="font-semibold text-white">{address ? shortAddress(address) : "None"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-400">Chain</span><span className="font-semibold text-white">{chainId || "Not connected"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-400">Proxy</span><span className="font-semibold text-white">{contractHealth.version ? `v${contractHealth.version}` : "Ready"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-400">Protocol fee</span><span className="font-semibold text-white">{contractHealth.protocolFeeBps / 100}%</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-400">Fees earned</span><span className="font-semibold text-white">{currency.format(contractHealth.protocolFeesAccrued)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-400">Fee wallet</span><span className="font-semibold text-white">{shortAddress(contractHealth.feeRecipient)}</span></div>
              </div>
            </div>
          </aside>
        </div>

        <section>
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="eyebrow">Role workspace</p>
              <h2 className="text-3xl font-semibold tracking-tight text-white">Invoices</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {["buyer", "seller", "financier", "all"].map((role) => (
                <button className={activeRole === role ? "btn-primary" : "btn-secondary"} key={role} onClick={() => setActiveRole(role)} type="button">
                  {role}
                </button>
              ))}
              <button className="btn-secondary" onClick={load}><RefreshCw size={16} />Refresh</button>
            </div>
          </div>
          {error && <div className="mb-4 alert-error">{error}</div>}
          {loading ? (
            <div className="panel p-8 text-slate-400">Loading Arc testnet invoices...</div>
          ) : (
            <div className="grid gap-4">
              {roleInvoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} onAction={act} txPending={txPending} walletAddress={address} protocolFeeBps={contractHealth.protocolFeeBps} />
              ))}
              {roleInvoices.length === 0 && (
                <div className="panel p-8 text-slate-400">
                  No live invoices in this role view yet. Create a trade on Arc, or switch roles.
                </div>
              )}
              {invoices.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-800" />
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                    Sample invoices · illustrative only
                  </span>
                  <span className="h-px flex-1 bg-slate-800" />
                </div>
              )}
              {invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} onAction={act} txPending={txPending} walletAddress={address} protocolFeeBps={contractHealth.protocolFeeBps} />
              ))}
            </div>
          )}
        </section>
      </section>
      )}

      {activePage === "system" && (
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:gap-8 lg:py-12 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-7 md:p-8">
          <p className="eyebrow">Wallet and revenue</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">Protocol status</h2>
          <div className="mt-6 grid gap-4 text-sm">
            {[
              ["Status", isConnected ? "Connected" : "Disconnected"],
              ["Wallet", address ? shortAddress(address) : "None"],
              ["Chain", chainId || "Not connected"],
              ["Proxy version", contractHealth.version ? `v${contractHealth.version}` : "Ready"],
              ["Protocol fee", `${contractHealth.protocolFeeBps / 100}%`],
              ["Fees earned", currency.format(contractHealth.protocolFeesAccrued)],
              ["Fee wallet", shortAddress(contractHealth.feeRecipient)]
            ].map(([label, value]) => (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-slate-950/50 p-4" key={label}>
                <span className="font-bold text-slate-400">{label}</span>
                <span className="text-right font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-7 md:p-8">
          <p className="eyebrow">Deployed stack</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">Arc testnet contracts</h2>
          <ContractRegistry className="mt-6" entries={contractSnapshot} />
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Infrastructure log</p>
            <div className="mt-3 grid gap-1.5 font-mono text-[11px] leading-relaxed text-slate-400">
              <p><span className="text-emerald-400">✓</span> Proxy resolved · v{contractHealth.version || "—"} · paused={String(contractHealth.paused)}</p>
              <p><span className="text-emerald-400">✓</span> USDC settlement asset bound · {shortAddress(deployedContracts.usdc)}</p>
              <p><span className="text-emerald-400">✓</span> Gateway route {gatewayStatus.source === "circle-gateway" ? "live" : "demo fallback"} · {gatewayRows.length} domains</p>
              <p><span className="text-teal-400">•</span> Protocol fee {contractHealth.protocolFeeBps / 100}% → {shortAddress(contractHealth.feeRecipient) || "unset"}</p>
            </div>
          </div>
        </div>
      </section>
      )}
      </div>
    </main>
    </AppStateContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>
        <App />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
