import { getUser, handleAuthCallback, login, logout, signup } from "@netlify/identity";

const byId = id => document.getElementById(id);
const dialog = byId("authDialog");
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
