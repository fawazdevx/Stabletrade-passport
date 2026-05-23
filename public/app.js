const invoicesEl = document.querySelector("#invoices");
const eventsEl = document.querySelector("#events");
const form = document.querySelector("#invoiceForm");
const refreshButton = document.querySelector("#refresh");
const demoButton = document.querySelector("#seedAdvance");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

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

function statusLabel(status) {
  return status.replace("-", " ");
}

function renderInvoices(invoices) {
  invoicesEl.innerHTML = invoices.map((invoice) => {
    const advance = invoice.amount * invoice.advanceRate;
    return `
      <article class="invoice-card">
        <div class="invoice-top">
          <div>
            <p class="invoice-id">${invoice.id}</p>
            <p class="route">${invoice.buyer} pays ${invoice.seller} · ${invoice.corridor}</p>
          </div>
          <span class="badge ${invoice.status}">${statusLabel(invoice.status)}</span>
        </div>
        <div class="invoice-grid">
          <div class="fact"><span>Invoice</span><strong>${money.format(invoice.amount)} USDC</strong></div>
          <div class="fact"><span>Advance</span><strong>${money.format(advance)} USDC</strong></div>
          <div class="fact"><span>Risk score</span><strong>${invoice.riskScore}/100</strong></div>
          <div class="fact"><span>Wallet</span><strong>${invoice.walletStatus}</strong></div>
        </div>
        <div class="card-actions">
          <button class="secondary" data-action="fund-escrow" data-id="${invoice.id}">Fund escrow</button>
          <button class="secondary" data-action="approve-advance" data-id="${invoice.id}">Advance exporter</button>
          <button class="primary" data-action="release" data-id="${invoice.id}">Release on delivery</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderEvents(events) {
  eventsEl.innerHTML = events.map((event) => `
    <div class="event">
      <strong>${event.title}</strong>
      <span>${event.detail}</span>
    </div>
  `).join("");
}

function renderMetrics(invoices) {
  const total = invoices
    .filter((invoice) => invoice.status !== "draft")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const avgAdvance = invoices.length
    ? invoices.reduce((sum, invoice) => sum + invoice.advanceRate, 0) / invoices.length
    : 0;
  const settled = invoices.filter((invoice) => invoice.status === "settled").length;

  document.querySelector("#volume").textContent = money.format(total);
  document.querySelector("#advanceRate").textContent = `${Math.round(avgAdvance * 100)}%`;
  document.querySelector("#settledCount").textContent = String(settled);
}

async function load() {
  const data = await api("/api/invoices");
  renderInvoices(data.invoices);
  renderEvents(data.events);
  renderMetrics(data.invoices);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(form).entries());
  body.amount = Number(body.amount);
  body.dueDays = Number(body.dueDays);
  await api("/api/invoices", { method: "POST", body: JSON.stringify(body) });
  await load();
});

invoicesEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  button.disabled = true;
  await api(`/api/invoices/${button.dataset.id}/${button.dataset.action}`, { method: "POST" });
  await load();
});

refreshButton.addEventListener("click", load);

demoButton.addEventListener("click", async () => {
  const data = await api("/api/invoices");
  const first = data.invoices[0];
  if (!first) return;
  await api(`/api/invoices/${first.id}/fund-escrow`, { method: "POST" });
  await api(`/api/invoices/${first.id}/approve-advance`, { method: "POST" });
  await api(`/api/invoices/${first.id}/release`, { method: "POST" });
  await load();
});

load().catch((error) => {
  invoicesEl.innerHTML = `<p>${error.message}</p>`;
});
