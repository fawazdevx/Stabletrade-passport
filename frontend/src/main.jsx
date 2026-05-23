import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "@rainbow-me/rainbowkit/styles.css";
import { ConnectButton, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient, WagmiProvider } from "wagmi";
import { encodePacked, formatUnits, isAddress, keccak256, parseUnits } from "viem";
import {
  ArrowRightLeft,
  BadgeCheck,
  Banknote,
  CircleDollarSign,
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
  WalletCards
} from "lucide-react";
import { arcTestnet, deployedContracts, tradeEscrowAbi, usdcAbi } from "./contracts";
import { arcChain, wagmiConfig } from "./wallet";
import "./styles.css";

const queryClient = new QueryClient();

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const statusNames = ["draft", "escrowed", "advanced", "settled", "disputed"];
const documentKindNames = ["Purchase order", "Invoice", "Delivery proof", "Compliance", "Other"];
const workflowSteps = [
  ["1", "Buyer creates and funds", "The importer creates an invoice for the seller and locks USDC in escrow."],
  ["2", "Financiers compete", "Financiers inspect the invoice and submit advance offers from the marketplace."],
  ["3", "Seller accepts capital", "The exporter accepts a bid and receives working capital before final settlement."],
  ["4", "Delivery settles", "Proof is anchored, buyer releases escrow, financier is repaid, and fees are collected."]
];

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

function Pill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-slate-200 bg-white text-slate-700",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    active: "border-blue-200 bg-blue-50 text-blue-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800"
  };
  return (
    <span className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-lg border border-teal-800/70 bg-[#09201d] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-teal-100/70">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500/15 text-teal-100">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-sm text-teal-100/60">{detail}</p>
    </div>
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

function InvoiceCard({ invoice, onAction, txPending, walletAddress }) {
  const statusTone = invoice.status === "settled" ? "good" : invoice.status === "advanced" ? "active" : "warn";
  const advance = invoice.amount * invoice.advanceRate;
  const onchain = invoice.source === "onchain";
  const isImporter = sameAddress(walletAddress, invoice.importerAddress);
  const isExporter = sameAddress(walletAddress, invoice.sellerAddress);
  const canFund = onchain && invoice.status === "draft" && isImporter;
  const canAdvance = onchain && invoice.status === "escrowed" && !isExporter && invoice.advanceAmount > 0;
  const canRelease = onchain && (invoice.status === "escrowed" || invoice.status === "advanced") && isImporter;
  const role = isImporter ? "Importer" : isExporter ? "Exporter" : onchain ? "Financier / observer" : "Demo sample";

  return (
    <article className="rounded-lg border border-teal-800/70 bg-[#09201d] p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black text-white">{invoice.id}</h3>
            <Pill tone={statusTone}>{invoice.status}</Pill>
            {onchain && <Pill tone="good">onchain</Pill>}
            <Pill>{role}</Pill>
          </div>
          <p className="mt-3 text-sm text-teal-100/70">{invoice.buyer} pays {invoice.seller}</p>
          <p className="mt-1 text-sm font-bold text-teal-100">{invoice.corridor}</p>
        </div>
        <div className="text-left lg:text-right">
          <p className="text-sm font-bold text-teal-100/70">Invoice value</p>
          <p className="mt-1 text-3xl font-black text-white">{currency.format(invoice.amount)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-[#0d2b27] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-100/60">Advance</p>
          <p className="mt-1 text-xl font-black text-white">{currency.format(advance)}</p>
        </div>
        <div className="rounded-lg bg-[#0d2b27] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-100/60">Rate</p>
          <p className="mt-1 text-xl font-black text-white">{Math.round(invoice.advanceRate * 100)}%</p>
        </div>
        <div className="rounded-lg bg-[#0d2b27] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-100/60">Due</p>
          <p className="mt-1 text-xl font-black text-white">{invoice.dueDays} days</p>
        </div>
        <div className="rounded-lg bg-[#0d2b27] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-100/60">Risk score</p>
          <p className="mt-1 text-xl font-black text-white">{invoice.riskScore}/100</p>
        </div>
      </div>

      {onchain && (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-teal-800 bg-[#0d2b27] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-teal-100">Financier bids</p>
            <div className="mt-3 grid gap-3">
              {(invoice.bids || []).length === 0 ? (
                <p className="text-sm text-teal-100/60">No bids yet.</p>
              ) : invoice.bids.map((bid) => (
                <div className="rounded-lg bg-[#09201d] p-3 text-sm" key={bid.index}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-white">{shortAddress(bid.financier)}</span>
                    <span className="text-teal-100/60">{currency.format(bid.advanceAmount)} · {bid.feeBps / 100}% fee</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isExporter && invoice.status === "escrowed" && !bid.accepted && !bid.cancelled && (
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

          <div className="rounded-lg border border-teal-800 bg-[#0d2b27] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-teal-100">Document hashes</p>
            <div className="mt-3 grid gap-3">
              {(invoice.documents || []).length === 0 ? (
                <p className="text-sm text-teal-100/60">No documents anchored yet.</p>
              ) : invoice.documents.map((doc) => (
                <div className="rounded-lg bg-[#09201d] p-3 text-sm" key={`${doc.hash}-${doc.kind}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{documentKindNames[doc.kind] || "Document"}</span>
                    <span className="text-teal-100/60">{shortAddress(doc.uploader)}</span>
                  </div>
                  <code className="mt-1 block break-all text-xs text-teal-100/60">{doc.hash}</code>
                </div>
              ))}
            </div>
          </div>
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
        <p className="mt-3 text-xs font-bold text-teal-100/60">
          Importer funds and releases escrow. Any financier wallet can advance an escrowed invoice.
        </p>
      )}
    </article>
  );
}

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
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

  const allInvoices = useMemo(() => [...onchainInvoices, ...invoices], [onchainInvoices, invoices]);

  const metrics = useMemo(() => {
    const activeVolume = allInvoices
      .filter((invoice) => invoice.status !== "draft")
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const avgAdvance = allInvoices.length
      ? allInvoices.reduce((sum, invoice) => sum + invoice.advanceRate, 0) / allInvoices.length
      : 0;
    const settled = allInvoices.filter((invoice) => invoice.status === "settled").length;
    return { activeVolume, avgAdvance, settled };
  }, [allInvoices]);

  const contractSnapshot = [
    ["Proxy", deployedContracts.tradeEscrowProxy],
    ["Factory", deployedContracts.stableTradeFactory],
    ["Implementation", deployedContracts.tradeEscrowImplementation],
    ["USDC", deployedContracts.usdc]
  ];

  const isV2 = contractHealth.version === "2.0.0";

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
        dueDays: 0,
        status: statusNames[Number(invoice[5])] || "unknown",
        riskScore: 90,
        source: "onchain",
        metadataHash: invoice[6],
        bids: [],
        documents: [],
        walletStatus: "Proxy contract"
      };
    }).reverse());

    if (version === "2.0.0") {
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
          dueDays: 0,
          status: statusNames[Number(invoice[5])] || "unknown",
          riskScore: 90,
          source: "onchain",
          metadataHash: invoice[6],
          bids,
          documents,
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
      if (!isV2) throw new Error("Upgrade the proxy to TradeEscrowUpgradeableV2 before using marketplace bids.");
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
      if (!isV2) throw new Error("Upgrade the proxy to TradeEscrowUpgradeableV2 before anchoring document hashes.");
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

  return (
    <main className="min-h-screen bg-[#031816] text-white">
      <header className="border-b border-teal-900 bg-[#061f1c]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">StableTrade Passport</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
              Programmable USDC escrow and invoice financing for UAE trade corridors
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="good">Arc testnet-ready</Pill>
            <Pill tone="active">Circle tools mapped</Pill>
            <ConnectButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="rounded-lg border border-teal-800/70 bg-[#09201d] p-8 shadow-soft md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-teal-500/15 text-teal-100">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-teal-100/70">Track 2 MVP</p>
                  <h2 className="text-3xl font-black text-white md:text-4xl">Trade finance console for real SME workflows.</h2>
                </div>
              </div>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-teal-100/70">
                StableTrade coordinates buyer escrow, seller working capital, financier bids, delivery proofs,
                passport analytics, and protocol fees through the deployed Arc testnet proxy.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="feature"><ShieldCheck size={18} /> KYC-aware workflow shell</div>
                <div className="feature"><CircleDollarSign size={18} /> USDC settlement accounting</div>
                <div className="feature"><Network size={18} /> CCTP/Gateway architecture</div>
              </div>
            </div>
            <div className="rounded-lg border border-teal-800 bg-[#0d2b27] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">Deployed stack</p>
                  <h3 className="mt-1 text-xl font-black text-white">Arc testnet proxy</h3>
                </div>
                <Pill tone={chainId === arcTestnet.chainId ? "active" : "warn"}>{arcTestnet.chainName}</Pill>
              </div>
              <div className="mt-5 grid gap-3 text-sm">
                {contractSnapshot.map(([label, value]) => (
                  <div className="rounded-lg border border-teal-900 bg-[#09201d] p-4" key={label}>
                    <span className="font-bold text-teal-100/60">{label}</span>
                    <code className="mt-2 block break-all text-xs font-mono text-teal-100">{value}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="grid gap-4 md:grid-cols-4">
          {workflowSteps.map(([step, title, detail]) => (
            <div className="rounded-lg border border-teal-800/70 bg-[#09201d] p-5" key={step}>
              <div className="mb-5 grid h-10 w-10 place-items-center rounded-lg bg-teal text-sm font-black text-white">{step}</div>
              <h3 className="text-lg font-black text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-teal-100/65">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Banknote} label="Escrowed volume" value={currency.format(metrics.activeVolume)} detail="Importer-funded invoice value in active workflows." />
          <Metric icon={ArrowRightLeft} label="Average advance" value={`${Math.round(metrics.avgAdvance * 100)}%`} detail="Expected financier advance against verified receivables." />
          <Metric icon={BadgeCheck} label="Settled invoices" value={String(metrics.settled)} detail="Released by proof-of-delivery style trigger." />
          <Metric icon={CircleDollarSign} label="Wallet USDC" value={usdcBalance === null ? "Connect wallet" : currency.format(usdcBalance)} detail="Live balance read from Arc testnet USDC." />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-10 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-teal-800/70 bg-[#09201d] p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500/15 text-teal-100"><Trophy size={19} /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">Credit passport</p>
              <h2 className="text-xl font-black text-white">Score {passport.score}/100</h2>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-teal-100">
            <div className="h-2 rounded-full bg-teal" style={{ width: `${passport.score}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-[#0d2b27] p-4"><span className="font-bold text-teal-100/60">Created</span><strong className="block text-2xl text-white">{passport.created}</strong></div>
            <div className="rounded-lg bg-[#0d2b27] p-4"><span className="font-bold text-teal-100/60">Settled</span><strong className="block text-2xl text-white">{passport.settled}</strong></div>
            <div className="rounded-lg bg-[#0d2b27] p-4"><span className="font-bold text-teal-100/60">Disputes</span><strong className="block text-2xl text-white">{passport.disputed}</strong></div>
            <div className="rounded-lg bg-[#0d2b27] p-4"><span className="font-bold text-teal-100/60">Volume</span><strong className="block text-2xl text-white">{currency.format(passport.volume)}</strong></div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form className="rounded-lg border border-teal-800/70 bg-[#09201d] p-6 shadow-sm" onSubmit={submitBid}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-500/15 text-teal-100"><Gavel size={20} /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">Financier marketplace</p>
                <h2 className="text-2xl font-black text-white">Submit bid</h2>
              </div>
            </div>
            {!isV2 && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Upgrade proxy to V2 to enable live bid writes.</p>}
            <div className="mt-6 grid gap-4">
              <select className="field" value={bidForm.invoiceId} onChange={(e) => setBidForm((v) => ({ ...v, invoiceId: e.target.value }))}>
                <option value="">Select escrowed invoice</option>
                {onchainInvoices.filter((invoice) => invoice.status === "escrowed").map((invoice) => (
                  <option value={invoice.id} key={invoice.id}>{invoice.id} · {currency.format(invoice.amount)}</option>
                ))}
              </select>
              <input className="field" type="number" placeholder="Advance USDC" value={bidForm.advanceAmount} onChange={(e) => setBidForm((v) => ({ ...v, advanceAmount: e.target.value }))} />
              <input className="field" type="number" placeholder="Fee bps" value={bidForm.feeBps} onChange={(e) => setBidForm((v) => ({ ...v, feeBps: e.target.value }))} />
              <button className="btn-primary justify-center" disabled={txPending || !isV2}>Approve + bid</button>
            </div>
          </form>

          <form className="rounded-lg border border-teal-800/70 bg-[#09201d] p-6 shadow-sm" onSubmit={addDocument}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-500/15 text-teal-100"><FileText size={20} /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">Document proofs</p>
                <h2 className="text-2xl font-black text-white">Upload and anchor</h2>
              </div>
            </div>
            {!isV2 && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Upgrade proxy to V2 to enable document hashes.</p>}
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
              <input className="field file:mr-3 file:rounded-md file:border-0 file:bg-teal file:px-3 file:py-1 file:text-sm file:font-black file:text-white" type="file" onChange={(e) => handleDocumentFile(e.target.files?.[0])} />
              <input className="field" placeholder="Computed file hash or external hash" value={docForm.hashInput} onChange={(e) => setDocForm((v) => ({ ...v, hashInput: e.target.value }))} />
              {docForm.fileName && <p className="text-sm font-bold text-teal-100/70">{docForm.fileName} · {docForm.ipfsCid}</p>}
              <button className="btn-primary justify-center" disabled={txPending || !isV2}>Anchor document</button>
            </div>
          </form>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-12 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="grid gap-6">
          <aside className="rounded-lg border border-teal-800/70 bg-[#09201d] p-6 shadow-sm">
            <h2 className="text-2xl font-black text-white">Create invoice</h2>
            <p className="mt-3 text-sm leading-6 text-teal-100/70">
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
                <label className="grid gap-2 text-sm font-bold text-teal-100/70" key={name}>
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

          <aside className="rounded-lg border border-teal-800/70 bg-[#09201d] p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">System status</p>
            <h2 className="mt-1 text-2xl font-black text-white">Wallet and revenue</h2>
            <div className="mt-5 rounded-lg border border-teal-800 bg-[#0d2b27] p-5">
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-teal-100/60">Status</span><span className="font-black text-white">{isConnected ? "Connected" : "Disconnected"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-teal-100/60">Wallet</span><span className="font-black text-white">{address ? shortAddress(address) : "None"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-teal-100/60">Chain</span><span className="font-black text-white">{chainId || "Not connected"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-teal-100/60">Proxy</span><span className="font-black text-white">{contractHealth.version ? `v${contractHealth.version}` : "Ready"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-teal-100/60">Protocol fee</span><span className="font-black text-white">{contractHealth.protocolFeeBps / 100}%</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-teal-100/60">Fees earned</span><span className="font-black text-white">{currency.format(contractHealth.protocolFeesAccrued)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="font-bold text-teal-100/60">Fee wallet</span><span className="font-black text-white">{shortAddress(contractHealth.feeRecipient)}</span></div>
              </div>
            </div>
          </aside>
        </div>

        <section>
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">Role workspace</p>
              <h2 className="text-3xl font-black text-white">Invoices</h2>
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
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
          {loading ? (
            <div className="rounded-lg border border-teal-800/70 bg-[#09201d] p-8 text-teal-100/70">Loading Arc testnet invoices...</div>
          ) : (
            <div className="grid gap-4">
              {roleInvoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} onAction={act} txPending={txPending} walletAddress={address} />
              ))}
              {roleInvoices.length === 0 && (
                <div className="rounded-lg border border-teal-800/70 bg-[#09201d] p-8 text-teal-100/70">
                  No invoices in this role view. Create a trade flow or switch roles.
                </div>
              )}
              {invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} onAction={act} txPending={txPending} walletAddress={address} />
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-lg border border-teal-800/70 bg-[#09201d] p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-100">Audit trail</p>
          <h2 className="mt-1 text-2xl font-black text-white">Recent Arc events</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <div className="rounded-lg border border-teal-900 bg-[#0d2b27] p-4" key={`${event.time}-${event.title}`}>
                <p className="font-black text-white">{event.title}</p>
                <p className="mt-2 text-sm leading-6 text-teal-100/60">{event.detail}</p>
                {event.hash && (
                  <a className="mt-3 inline-flex text-sm font-black text-teal-100" href={txUrl(event.hash)} target="_blank" rel="noreferrer">
                    View transaction
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
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
