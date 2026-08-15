import { getUser, handleAuthCallback, login, logout, signup } from "@netlify/identity";

const byId = id => document.getElementById(id);
const dialog = byId("authDialog");
const dashboard = byId("dashboardDialog");
const form = byId("authForm");
let mode = "login";
let currentUser = null;
let syncTimer = null;

function message(text, success = false) {
  const target = byId("authMessage");
  target.textContent = text;
  target.classList.toggle("success", success);
}

function chooseMode(nextMode) {
  mode = nextMode;
  const creating = mode === "signup";
  byId("loginTab").classList.toggle("active", !creating);
  byId("signupTab").classList.toggle("active", creating);
  byId("nameField").hidden = !creating;
  byId("authName").required = creating;
  byId("authPassword").autocomplete = creating ? "new-password" : "current-password";
  byId("authSubmit").textContent = creating ? "Create account" : "Log in";
  byId("authIntro").textContent = creating ? "Create an account with your email and a secure password." : "Log in to your CareerShield account.";
  message("");
}

function showUser(user) {
  currentUser = user || null;
  const loggedIn = Boolean(user);
  byId("accountButton").textContent = loggedIn ? (user.userMetadata?.full_name || user.email || "My account") : "Log in";
  byId("accountEmail").textContent = loggedIn ? user.email : "";
  byId("savedProgressTitle").textContent = loggedIn ? "Your recent paths are synced to your account" : "Your recent paths are saved on this device";
  byId("accountMenu").hidden = true;
}

function storageStatus(text, error = false) {
  const target = byId("accountStorageStatus");
  target.textContent = text;
  target.style.color = error ? "#b42318" : "";
}

function safe(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function dashboardMessage(text, error = false) {
  const target = byId("dashboardMessage");
  target.textContent = text;
  target.style.color = error ? "#b42318" : "";
}

function renderDashboard() {
  const plans = window.CareerShieldPlans?.get?.() || [];
  byId("dashboardEmail").textContent = currentUser?.email || "";
  byId("dashboardPlanCount").textContent = `${plans.length} of 4`;
  byId("dashboardPlans").innerHTML = plans.length ? plans.map((plan, index) => `
    <article class="dashboard-plan">
      <div><strong>${safe(plan.savedLabel || plan.name || "Saved path")}</strong><small>${safe(plan.pathLabel || plan.path || "Career path")} · ${safe(plan.career?.name || "Career not available")} · Score ${Number(plan.score) || 0}/100</small></div>
      <div class="dashboard-plan-actions"><button type="button" data-dashboard-action="open" data-index="${index}">Open</button><button type="button" data-dashboard-action="rename" data-index="${index}">Rename</button><button type="button" data-dashboard-action="duplicate" data-index="${index}">Duplicate</button><button type="button" data-dashboard-action="delete" data-index="${index}">Delete</button></div>
    </article>`).join("") : '<div class="dashboard-empty">No paths saved yet. Build a comparison and it will appear here automatically.</div>';
}

function formatOrderAmount(amount, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(Number(amount || 0) / 100);
}

async function loadReportOrders() {
  const target = byId("dashboardOrders");
  target.innerHTML = '<div class="dashboard-empty">Loading verified purchases…</div>';
  try {
    const response = await fetch("/api/report-orders", { credentials: "same-origin", headers: { accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Purchases could not be loaded.");
    const orders = Array.isArray(data.orders) ? data.orders : [];
    target.innerHTML = orders.length ? orders.map(order => {
      const date = order.purchasedAt ? new Date(order.purchasedAt).toLocaleDateString() : "Date unavailable";
      const statusLabel = order.status === "purchased" ? "Purchased" : order.status === "processing" ? "Processing" : "Payment issue";
      const statusClass = order.status === "processing" ? "processing" : order.status === "purchased" ? "" : "issue";
      return `<article class="dashboard-order"><div><strong>Personalized Decision Report · ${safe(formatOrderAmount(order.amountTotal, order.currency))}</strong><small>${safe(date)} · Stripe order ${safe(String(order.sessionId || "").slice(-10))}</small></div><span class="order-status ${statusClass}">${statusLabel}</span></article>`;
    }).join("") : '<div class="dashboard-empty">No verified report purchases yet. Purchases made while logged in will appear here.</div>';
  } catch (error) {
    target.innerHTML = `<div class="dashboard-empty">${safe(error.message)}</div>`;
  }
}

function openDashboard() {
  if (!currentUser) return;
  byId("accountMenu").hidden = true;
  dashboardMessage("");
  renderDashboard();
  dashboard.showModal();
  loadReportOrders();
}

async function plansRequest(method = "GET", plans) {
  const options = { method, credentials: "same-origin", headers: { accept: "application/json" } };
  if (method === "PUT") {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify({ plans });
  }
  const response = await fetch("/api/plans", options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Your plans could not be synchronized.");
  return data;
}

async function syncPlans(plans = window.CareerShieldPlans?.get?.() || []) {
  if (!currentUser) return;
  storageStatus("Saving your comparisons…");
  try {
    await plansRequest("PUT", plans);
    storageStatus("Your comparisons are saved securely to your account.");
  } catch (error) {
    storageStatus(error.message, true);
    throw error;
  }
}

async function loadAccountPlans() {
  if (!currentUser || !window.CareerShieldPlans) return;
  storageStatus("Loading your saved comparisons…");
  try {
    const cloud = await plansRequest();
    if (Array.isArray(cloud.plans)) {
      window.CareerShieldPlans.replace(cloud.plans);
      storageStatus("Your comparisons are synced across your devices.");
    } else {
      await syncPlans(window.CareerShieldPlans.get());
    }
  } catch (error) {
    storageStatus(`${error.message} Device copy remains available.`, true);
  }
}

async function refreshUser() {
  try { showUser(await getUser()); }
  catch { showUser(null); }
}

byId("accountButton").addEventListener("click", async () => {
  const user = await getUser().catch(() => null);
  if (user) byId("accountMenu").hidden = !byId("accountMenu").hidden;
  else { chooseMode("login"); dialog.showModal(); }
});
byId("authClose").addEventListener("click", () => dialog.close());
byId("dashboardClose").addEventListener("click", () => dashboard.close());
byId("dashboardButton").addEventListener("click", openDashboard);
byId("loginTab").addEventListener("click", () => chooseMode("login"));
byId("signupTab").addEventListener("click", () => chooseMode("signup"));
byId("logoutButton").addEventListener("click", async () => {
  await logout();
  showUser(null);
});

window.addEventListener("careershield:plans-changed", event => {
  if (!currentUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncPlans(event.detail?.plans || []).catch(() => {}), 350);
});
window.CareerShieldAccount = { syncPlans };

byId("dashboardPlans").addEventListener("click", event => {
  const button = event.target.closest("[data-dashboard-action]");
  if (!button) return;
  const plans = window.CareerShieldPlans?.get?.() || [];
  const index = Number(button.dataset.index);
  const plan = plans[index];
  if (!plan) return;
  const action = button.dataset.dashboardAction;
  if (action === "open") {
    dashboard.close();
    document.querySelector(".comparison")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "rename") {
    const label = window.prompt("Name this saved path:", plan.savedLabel || plan.name || "");
    if (label === null) return;
    plan.savedLabel = label.trim().slice(0, 80);
    plans[index] = plan;
  }
  if (action === "duplicate") {
    if (plans.length >= 4) return dashboardMessage("You can save up to four paths. Delete one before duplicating.", true);
    const copy = JSON.parse(JSON.stringify(plan));
    copy.id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    copy.savedLabel = `${plan.savedLabel || plan.name || "Saved path"} copy`.slice(0, 80);
    plans.push(copy);
  }
  if (action === "delete") {
    if (!window.confirm(`Delete ${plan.savedLabel || plan.name || "this saved path"}?`)) return;
    plans.splice(index, 1);
  }
  window.CareerShieldPlans.set(plans);
  renderDashboard();
  dashboardMessage(action === "delete" ? "Path deleted and syncing." : action === "duplicate" ? "Path duplicated and syncing." : "Name updated and syncing.");
});

byId("erasePlanData").addEventListener("click", async () => {
  if (!window.confirm("Permanently erase every saved comparison from this account and this device?")) return;
  byId("erasePlanData").disabled = true;
  try {
    window.CareerShieldPlans.set([]);
    await syncPlans([]);
    renderDashboard();
    dashboardMessage("All saved plan data has been erased.");
  } catch (error) {
    dashboardMessage(`${error.message} Please try again.`, true);
  } finally {
    byId("erasePlanData").disabled = false;
  }
});

document.querySelectorAll(".report-checkout-link").forEach(link => link.addEventListener("click", async event => {
  event.preventDefault();
  if (!currentUser) {
    if (dashboard.open) dashboard.close();
    chooseMode("login");
    dialog.showModal();
    message("Log in first so Stripe can attach the purchase to your CareerShield account.");
    return;
  }
  const plans = window.CareerShieldPlans?.get?.() || [];
  if (!plans.length) {
    if (dashboard.open) dashboard.close();
    window.alert("Build and save at least one comparison path before purchasing a report.");
    document.getElementById("builder-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const original = link.textContent;
  link.setAttribute("aria-disabled", "true");
  link.textContent = "Opening secure checkout…";
  try {
    await syncPlans(plans);
    const response = await fetch("/api/report-checkout", { method: "POST", credentials: "same-origin", headers: { accept: "application/json" } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || "Checkout could not be opened.");
    window.location.assign(data.url);
  } catch (error) {
    dashboardMessage(error.message, true);
    window.alert(error.message);
  } finally {
    link.removeAttribute("aria-disabled");
    link.textContent = original;
  }
}));

form.addEventListener("submit", async event => {
  event.preventDefault();
  const email = byId("authEmail").value.trim();
  const password = byId("authPassword").value;
  const submit = byId("authSubmit");
  submit.disabled = true;
  message(mode === "signup" ? "Creating your account…" : "Logging you in…", true);
  try {
    if (mode === "signup") {
      await signup(email, password, { full_name: byId("authName").value.trim() });
      message("Account created. Check your email and confirm your address, then return here to log in.", true);
      form.reset();
    } else {
      const user = await login(email, password);
      showUser(user);
      await loadAccountPlans();
      dialog.close();
      form.reset();
    }
  } catch (error) {
    message(error?.message || "We could not complete that request. Please try again.");
  } finally {
    submit.disabled = false;
  }
});

document.addEventListener("click", event => {
  if (!event.target.closest(".nav-actions")) byId("accountMenu").hidden = true;
});

async function initializeIdentity() {
  try {
    const result = await handleAuthCallback();
    if (result?.user) showUser(result.user);
  } catch (error) {
    chooseMode("login");
    dialog.showModal();
    message(error?.message || "The account link could not be completed.");
  }
  await refreshUser();
  if (currentUser) await loadAccountPlans();
}
initializeIdentity();
