(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // node_modules/.pnpm/gotrue-js@1.0.1/node_modules/gotrue-js/lib/index.js
  var HTTPError = class extends Error {
    constructor(response) {
      super(response.statusText);
      this.name = "HTTPError";
      this.status = response.status;
    }
  };
  var TextHTTPError = class extends HTTPError {
    constructor(response, data) {
      super(response);
      this.name = "TextHTTPError";
      this.data = data;
    }
  };
  var JSONHTTPError = class extends HTTPError {
    constructor(response, json) {
      super(response);
      this.name = "JSONHTTPError";
      this.json = json;
    }
  };
  var API = class _API {
    constructor(apiURL, options) {
      this.apiURL = apiURL || "";
      this._sameOrigin = /^\/(?!\/)/.test(this.apiURL);
      this.defaultHeaders = options?.defaultHeaders || {};
    }
    headers(headers = {}) {
      return {
        ...this.defaultHeaders,
        "Content-Type": "application/json",
        ...headers
      };
    }
    static async parseJsonResponse(response) {
      const json = await response.json();
      if (!response.ok) {
        throw new JSONHTTPError(response, json);
      }
      return json;
    }
    async request(path, options = {}) {
      const headers = this.headers(options.headers || {});
      if (!options.body) {
        delete headers["Content-Type"];
      }
      const fetchOptions = {
        ...options,
        headers
      };
      if (this._sameOrigin) {
        fetchOptions.credentials = options.credentials || "same-origin";
      }
      const response = await fetch(this.apiURL + path, fetchOptions);
      const contentType = response.headers.get("Content-Type");
      if (contentType?.includes("json")) {
        return _API.parseJsonResponse(response);
      }
      const data = await response.text();
      if (!response.ok) {
        throw new TextHTTPError(response, data);
      }
      return data;
    }
  };
  var Admin = class {
    constructor(user) {
      this.user = user;
    }
    listUsers(aud) {
      return this.user._request("/admin/users", {
        method: "GET",
        audience: aud
      });
    }
    getUser(user) {
      return this.user._request(`/admin/users/${user.id}`);
    }
    updateUser(user, attributes = {}) {
      return this.user._request(`/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(attributes)
      });
    }
    createUser(email, password, attributes = {}) {
      attributes.email = email;
      attributes.password = password;
      return this.user._request("/admin/users", {
        method: "POST",
        body: JSON.stringify(attributes)
      });
    }
    deleteUser(user) {
      return this.user._request(`/admin/users/${user.id}`, {
        method: "DELETE"
      });
    }
  };
  var ExpiryMargin = 60 * 1e3;
  var storageKey = "gotrue.user";
  var refreshPromises = {};
  var currentUser = null;
  var forbiddenUpdateAttributes = { api: 1, token: 1, audience: 1, url: 1 };
  var forbiddenSaveAttributes = { api: 1 };
  var isBrowser = () => typeof window !== "undefined";
  var storageListenerActive = false;
  function ensureStorageListener() {
    if (!storageListenerActive && isBrowser()) {
      storageListenerActive = true;
      window.addEventListener("storage", (event) => {
        if (event.key === storageKey) {
          currentUser = null;
        }
      });
    }
  }
  var User = class _User {
    constructor(api, tokenResponse, audience) {
      this.token = null;
      this.api = api;
      this.url = api.apiURL;
      this.audience = audience;
      this._processTokenResponse(tokenResponse);
      currentUser = this;
      ensureStorageListener();
    }
    static removeSavedSession() {
      isBrowser() && localStorage.removeItem(storageKey);
    }
    static recoverSession(apiInstance) {
      ensureStorageListener();
      if (currentUser) {
        return currentUser;
      }
      const json = isBrowser() && localStorage.getItem(storageKey);
      if (json) {
        try {
          const data = JSON.parse(json);
          const { url, token, audience } = data;
          if (!url || !token) {
            return null;
          }
          const api = apiInstance || new API(url, {});
          return new _User(api, token, audience)._saveUserData(data, true);
        } catch (error) {
          console.error(new Error(`Gotrue-js: Error recovering session: ${error}`));
          return null;
        }
      }
      return null;
    }
    get admin() {
      return new Admin(this);
    }
    async update(attributes) {
      const response = await this._request("/user", {
        method: "PUT",
        body: JSON.stringify(attributes)
      });
      return this._saveUserData(response)._refreshSavedSession();
    }
    jwt(forceRefresh) {
      const token = this.tokenDetails();
      if (token === null || token === void 0) {
        return Promise.reject(new Error(`Gotrue-js: failed getting jwt access token`));
      }
      const { expires_at, refresh_token, access_token } = token;
      if (forceRefresh || expires_at - ExpiryMargin < Date.now()) {
        return this._refreshToken(refresh_token);
      }
      return Promise.resolve(access_token);
    }
    logout() {
      return this._request("/logout", { method: "POST" }).then(this.clearSession.bind(this)).catch(this.clearSession.bind(this));
    }
    _refreshToken(refresh_token) {
      const existingPromise = refreshPromises[refresh_token];
      if (existingPromise) {
        return existingPromise;
      }
      const refreshRequest = this.api.request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${refresh_token}`
      });
      const timeoutPromise = new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error("Token refresh timeout")), 3e4);
      });
      const promise = Promise.race([refreshRequest, timeoutPromise]).then((response) => {
        delete refreshPromises[refresh_token];
        this._processTokenResponse(response);
        this._refreshSavedSession();
        if (!this.token) {
          throw new Error("Gotrue-js: Token not set after refresh");
        }
        return this.token.access_token;
      }).catch((error) => {
        delete refreshPromises[refresh_token];
        this.clearSession();
        throw error;
      });
      refreshPromises[refresh_token] = promise;
      return promise;
    }
    async _request(path, options = {}) {
      options.headers = options.headers || {};
      const aud = options.audience || this.audience;
      if (aud) {
        options.headers["X-JWT-AUD"] = aud;
      }
      try {
        const token = await this.jwt();
        return await this.api.request(path, {
          headers: Object.assign(options.headers, {
            Authorization: `Bearer ${token}`
          }),
          ...options
        });
      } catch (error) {
        if (error instanceof JSONHTTPError && error.json) {
          if (error.json.msg) {
            error.message = error.json.msg;
          } else if (error.json.error) {
            error.message = `${error.json.error}: ${error.json.error_description}`;
          }
        }
        throw error;
      }
    }
    async getUserData() {
      const response = await this._request("/user");
      return this._saveUserData(response)._refreshSavedSession();
    }
    _saveUserData(attributes, fromStorage) {
      for (const key in attributes) {
        if (key in _User.prototype || key in forbiddenUpdateAttributes) {
          continue;
        }
        this[key] = attributes[key];
      }
      if (fromStorage) {
        this._fromStorage = true;
      }
      return this;
    }
    _processTokenResponse(tokenResponse) {
      this.token = tokenResponse;
      try {
        const claims = JSON.parse(urlBase64Decode(tokenResponse.access_token.split(".")[1]));
        this.token.expires_at = claims.exp * 1e3;
      } catch (error) {
        console.error(new Error(`Gotrue-js: Failed to parse tokenResponse claims: ${error}`));
      }
    }
    _refreshSavedSession() {
      if (isBrowser() && localStorage.getItem(storageKey)) {
        this._saveSession();
      }
      return this;
    }
    get _details() {
      const userCopy = {};
      for (const key in this) {
        if (key in _User.prototype || key in forbiddenSaveAttributes) {
          continue;
        }
        userCopy[key] = this[key];
      }
      return userCopy;
    }
    _saveSession() {
      isBrowser() && localStorage.setItem(storageKey, JSON.stringify(this._details));
      return this;
    }
    tokenDetails() {
      return this.token;
    }
    clearSession() {
      _User.removeSavedSession();
      this.token = null;
      currentUser = null;
    }
  };
  function base64Decode(base64) {
    if (typeof atob === "function") {
      return atob(base64);
    }
    return Buffer.from(base64, "base64").toString("binary");
  }
  function urlBase64Decode(str) {
    let output = str.replace(/-/g, "+").replace(/_/g, "/");
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += "==";
        break;
      case 3:
        output += "=";
        break;
      default:
        throw new Error("Illegal base64url string!");
    }
    const binaryString = base64Decode(output);
    try {
      const bytes = Uint8Array.from(binaryString, (char) => char.codePointAt(0) ?? 0);
      return new TextDecoder().decode(bytes);
    } catch {
      return binaryString;
    }
  }
  var HTTPRegexp = /^http:\/\//;
  var defaultApiURL = `/.netlify/identity`;
  var GoTrue = class {
    constructor({
      APIUrl = defaultApiURL,
      audience = "",
      setCookie = false,
      clientName = "gotrue-js"
    } = {}) {
      if (HTTPRegexp.test(APIUrl)) {
        console.warn(
          "Warning:\n\nDO NOT USE HTTP IN PRODUCTION FOR GOTRUE EVER!\nGoTrue REQUIRES HTTPS to work securely."
        );
      }
      if (audience) {
        this.audience = audience;
      }
      this.setCookie = setCookie;
      this.api = new API(APIUrl, { defaultHeaders: { "X-Nf-Client": clientName } });
    }
    async _request(path, options = {}) {
      options.headers = options.headers || {};
      const aud = options.audience || this.audience;
      if (aud) {
        options.headers["X-JWT-AUD"] = aud;
      }
      try {
        return await this.api.request(path, options);
      } catch (error) {
        if (error instanceof JSONHTTPError && error.json) {
          if (error.json.msg) {
            error.message = error.json.msg;
          } else if (error.json.error) {
            error.message = `${error.json.error}: ${error.json.error_description}`;
          }
        }
        throw error;
      }
    }
    settings() {
      return this._request("/settings");
    }
    signup(email, password, data) {
      return this._request("/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, data })
      });
    }
    login(email, password, remember) {
      this._setRememberHeaders(remember);
      return this._request("/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=password&username=${encodeURIComponent(
          email
        )}&password=${encodeURIComponent(password)}`
      }).then((response) => {
        User.removeSavedSession();
        return this.createUser(response, remember);
      });
    }
    loginExternalUrl(provider) {
      return `${this.api.apiURL}/authorize?provider=${provider}`;
    }
    confirm(token, remember) {
      this._setRememberHeaders(remember);
      return this.verify("signup", token, remember);
    }
    requestPasswordRecovery(email) {
      return this._request("/recover", {
        method: "POST",
        body: JSON.stringify({ email })
      });
    }
    recover(token, remember) {
      this._setRememberHeaders(remember);
      return this.verify("recovery", token, remember);
    }
    acceptInvite(token, password, remember) {
      this._setRememberHeaders(remember);
      return this._request("/verify", {
        method: "POST",
        body: JSON.stringify({ token, password, type: "signup" })
      }).then((response) => this.createUser(response, remember));
    }
    acceptInviteExternalUrl(provider, token) {
      return `${this.api.apiURL}/authorize?provider=${provider}&invite_token=${token}`;
    }
    createUser(tokenResponse, remember = false) {
      this._setRememberHeaders(remember);
      const user = new User(this.api, tokenResponse, this.audience || "");
      return user.getUserData().then((userData) => {
        if (remember) {
          userData._saveSession();
        }
        return userData;
      });
    }
    currentUser() {
      const user = User.recoverSession(this.api);
      user && this._setRememberHeaders(user._fromStorage);
      return user;
    }
    async validateCurrentSession() {
      const user = this.currentUser();
      if (!user) {
        return null;
      }
      try {
        return await user.getUserData();
      } catch {
        user.clearSession();
        return null;
      }
    }
    verify(type, token, remember) {
      this._setRememberHeaders(remember);
      return this._request("/verify", {
        method: "POST",
        body: JSON.stringify({ token, type })
      }).then((response) => this.createUser(response, remember));
    }
    _setRememberHeaders(remember) {
      if (this.setCookie) {
        this.api.defaultHeaders = this.api.defaultHeaders || {};
        this.api.defaultHeaders["X-Use-Cookie"] = remember ? "1" : "session";
      }
    }
  };
  if (typeof window !== "undefined") {
    window.GoTrue = GoTrue;
  }

  // node_modules/.pnpm/@netlify+identity@1.2.0/node_modules/@netlify/identity/dist/main.js
  var __require2 = /* @__PURE__ */ ((x) => typeof __require !== "undefined" ? __require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof __require !== "undefined" ? __require : a)[b]
  }) : x)(function(x) {
    if (typeof __require !== "undefined") return __require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var AUTH_PROVIDERS = ["google", "github", "gitlab", "bitbucket", "facebook", "email"];
  var AuthError = class _AuthError extends Error {
    constructor(message2, status, options) {
      super(message2);
      this.name = "AuthError";
      this.status = status;
      if (options && "cause" in options) {
        this.cause = options.cause;
      }
    }
    static from(error) {
      if (error instanceof _AuthError) return error;
      const message2 = error instanceof Error ? error.message : String(error);
      return new _AuthError(message2, void 0, { cause: error });
    }
  };
  var MissingIdentityError = class extends Error {
    constructor(message2 = "Netlify Identity is not available.") {
      super(message2);
      this.name = "MissingIdentityError";
    }
  };
  var IDENTITY_PATH = "/.netlify/identity";
  var goTrueClient = null;
  var cachedApiUrl;
  var warnedMissingUrl = false;
  var isBrowser2 = () => typeof window !== "undefined" && typeof window.location !== "undefined";
  var discoverApiUrl = () => {
    if (cachedApiUrl !== void 0) return cachedApiUrl;
    if (isBrowser2()) {
      cachedApiUrl = `${window.location.origin}${IDENTITY_PATH}`;
    } else {
      const identityContext = getIdentityContext();
      if (identityContext?.url) {
        cachedApiUrl = identityContext.url;
      } else if (globalThis.Netlify?.context?.url) {
        cachedApiUrl = new URL(IDENTITY_PATH, globalThis.Netlify.context.url).href;
      } else if (typeof process !== "undefined" && process.env?.URL) {
        cachedApiUrl = new URL(IDENTITY_PATH, process.env.URL).href;
      }
    }
    return cachedApiUrl ?? null;
  };
  var getGoTrueClient = () => {
    if (goTrueClient) return goTrueClient;
    const apiUrl = discoverApiUrl();
    if (!apiUrl) {
      if (!warnedMissingUrl) {
        console.warn(
          "@netlify/identity: Could not determine the Identity endpoint URL. Make sure your site has Netlify Identity enabled, or run your app with `netlify dev`."
        );
        warnedMissingUrl = true;
      }
      return null;
    }
    goTrueClient = new GoTrue({ APIUrl: apiUrl, setCookie: false });
    return goTrueClient;
  };
  var getClient = () => {
    const client = getGoTrueClient();
    if (!client) throw new MissingIdentityError();
    return client;
  };
  var getIdentityContext = () => {
    const identityContext = globalThis.netlifyIdentityContext;
    if (identityContext?.url) {
      return {
        url: identityContext.url,
        token: identityContext.token
      };
    }
    if (globalThis.Netlify?.context?.url) {
      return { url: new URL(IDENTITY_PATH, globalThis.Netlify.context.url).href };
    }
    const siteUrl = typeof process !== "undefined" ? process.env?.URL : void 0;
    if (siteUrl) {
      return { url: new URL(IDENTITY_PATH, siteUrl).href };
    }
    return null;
  };
  var NF_JWT_COOKIE = "nf_jwt";
  var NF_REFRESH_COOKIE = "nf_refresh";
  var getCookie = (name) => {
    if (typeof document === "undefined") return null;
    const match = new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`).exec(document.cookie);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  };
  var setAuthCookies = (cookies, accessToken, refreshToken) => {
    cookies.set({
      name: NF_JWT_COOKIE,
      value: accessToken,
      httpOnly: false,
      secure: true,
      path: "/",
      sameSite: "Lax"
    });
    if (refreshToken) {
      cookies.set({
        name: NF_REFRESH_COOKIE,
        value: refreshToken,
        httpOnly: false,
        secure: true,
        path: "/",
        sameSite: "Lax"
      });
    }
  };
  var deleteAuthCookies = (cookies) => {
    cookies.delete(NF_JWT_COOKIE);
    cookies.delete(NF_REFRESH_COOKIE);
  };
  var setBrowserAuthCookies = (accessToken, refreshToken) => {
    if (typeof document === "undefined") return;
    document.cookie = `${NF_JWT_COOKIE}=${encodeURIComponent(accessToken)}; path=/; secure; samesite=lax`;
    if (refreshToken) {
      document.cookie = `${NF_REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; path=/; secure; samesite=lax`;
    }
  };
  var deleteBrowserAuthCookies = () => {
    if (typeof document === "undefined") return;
    document.cookie = `${NF_JWT_COOKIE}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${NF_REFRESH_COOKIE}=; path=/; secure; samesite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  };
  var getServerCookie = (name) => {
    const cookies = globalThis.Netlify?.context?.cookies;
    if (!cookies || typeof cookies.get !== "function") return null;
    return cookies.get(name) ?? null;
  };
  var nextHeadersFn;
  var triggerNextjsDynamic = () => {
    if (nextHeadersFn === null) return;
    if (nextHeadersFn === void 0) {
      try {
        if (typeof __require2 === "undefined") {
          nextHeadersFn = null;
          return;
        }
        const mod = __require2("next/headers");
        nextHeadersFn = mod.headers;
      } catch {
        nextHeadersFn = null;
        return;
      }
    }
    const fn = nextHeadersFn;
    if (!fn) return;
    try {
      fn();
    } catch (e) {
      if (e instanceof Error && ("digest" in e || /bail\s*out.*prerende/i.test(e.message))) {
        throw e;
      }
    }
  };
  var DEFAULT_TIMEOUT_MS = 5e3;
  var fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        const pathname = new URL(url).pathname;
        throw new AuthError(`Identity request to ${pathname} timed out after ${String(timeoutMs)}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  var AUTH_EVENTS = {
    LOGIN: "login",
    LOGOUT: "logout",
    TOKEN_REFRESH: "token_refresh",
    USER_UPDATED: "user_updated",
    RECOVERY: "recovery"
  };
  var listeners = /* @__PURE__ */ new Set();
  var emitAuthEvent = (event, user) => {
    for (const listener of listeners) {
      try {
        listener(event, user);
      } catch {
      }
    }
  };
  var REFRESH_MARGIN_S = 60;
  var refreshTimer = null;
  var startTokenRefresh = () => {
    if (!isBrowser2()) return;
    stopTokenRefresh();
    const client = getGoTrueClient();
    const user = client?.currentUser();
    if (!user) return;
    const token = user.tokenDetails();
    if (!token?.expires_at) return;
    const nowS = Math.floor(Date.now() / 1e3);
    const expiresAtS = typeof token.expires_at === "number" && token.expires_at > 1e12 ? Math.floor(token.expires_at / 1e3) : token.expires_at;
    const delayMs = Math.max(0, expiresAtS - nowS - REFRESH_MARGIN_S) * 1e3;
    refreshTimer = setTimeout(() => {
      void (async () => {
        try {
          const freshJwt = await user.jwt(true);
          const freshDetails = user.tokenDetails();
          setBrowserAuthCookies(freshJwt, freshDetails?.refresh_token);
          emitAuthEvent(AUTH_EVENTS.TOKEN_REFRESH, toUser(user));
          startTokenRefresh();
        } catch {
          stopTokenRefresh();
        }
      })();
    }, delayMs);
  };
  var stopTokenRefresh = () => {
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  };
  var getCookies = () => {
    const cookies = globalThis.Netlify?.context?.cookies;
    if (!cookies) {
      throw new AuthError("Server-side auth requires Netlify Functions runtime");
    }
    return cookies;
  };
  var getServerIdentityUrl = () => {
    const ctx = getIdentityContext();
    if (!ctx?.url) {
      throw new AuthError("Could not determine the Identity endpoint URL on the server");
    }
    return ctx.url;
  };
  var persistSession = true;
  var login = async (email, password) => {
    if (!isBrowser2()) {
      const identityUrl = getServerIdentityUrl();
      const cookies = getCookies();
      const body = new URLSearchParams({
        grant_type: "password",
        username: email,
        password
      });
      let res;
      try {
        res = await fetchWithTimeout(`${identityUrl}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString()
        });
      } catch (error) {
        throw AuthError.from(error);
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new AuthError(
          errorBody.msg ?? errorBody.error_description ?? `Login failed (${String(res.status)})`,
          res.status
        );
      }
      const data = await res.json();
      const accessToken = data.access_token;
      let userRes;
      try {
        userRes = await fetchWithTimeout(`${identityUrl}/user`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      } catch (error) {
        throw AuthError.from(error);
      }
      if (!userRes.ok) {
        const errorBody = await userRes.json().catch(() => ({}));
        throw new AuthError(errorBody.msg ?? `Failed to fetch user data (${String(userRes.status)})`, userRes.status);
      }
      const userData = await userRes.json();
      const user = toUser(userData);
      setAuthCookies(cookies, accessToken, data.refresh_token);
      return user;
    }
    const client = getClient();
    try {
      const gotrueUser = await client.login(email, password, persistSession);
      const jwt = await gotrueUser.jwt();
      setBrowserAuthCookies(jwt, gotrueUser.tokenDetails()?.refresh_token);
      const user = toUser(gotrueUser);
      startTokenRefresh();
      emitAuthEvent(AUTH_EVENTS.LOGIN, user);
      return user;
    } catch (error) {
      throw AuthError.from(error);
    }
  };
  var signup = async (email, password, data) => {
    if (!isBrowser2()) {
      const identityUrl = getServerIdentityUrl();
      const cookies = getCookies();
      let res;
      try {
        res = await fetchWithTimeout(`${identityUrl}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, data })
        });
      } catch (error) {
        throw AuthError.from(error);
      }
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new AuthError(errorBody.msg ?? `Signup failed (${String(res.status)})`, res.status);
      }
      const responseData = await res.json();
      const user = toUser(responseData);
      if (responseData.confirmed_at) {
        const accessToken = responseData.access_token;
        if (accessToken) {
          setAuthCookies(cookies, accessToken, responseData.refresh_token);
        }
      }
      return user;
    }
    const client = getClient();
    try {
      const response = await client.signup(email, password, data);
      const user = toUser(response);
      if (response.confirmed_at) {
        const jwt = await response.jwt?.();
        if (jwt) {
          const refreshToken = response.tokenDetails?.()?.refresh_token;
          setBrowserAuthCookies(jwt, refreshToken);
        }
        startTokenRefresh();
        emitAuthEvent(AUTH_EVENTS.LOGIN, user);
      }
      return user;
    } catch (error) {
      throw AuthError.from(error);
    }
  };
  var logout = async () => {
    if (!isBrowser2()) {
      const identityUrl = getServerIdentityUrl();
      const cookies = getCookies();
      const jwt = cookies.get(NF_JWT_COOKIE);
      if (jwt) {
        try {
          await fetchWithTimeout(`${identityUrl}/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` }
          });
        } catch {
        }
      }
      deleteAuthCookies(cookies);
      return;
    }
    const client = getClient();
    try {
      const currentUser3 = client.currentUser();
      if (currentUser3) {
        await currentUser3.logout();
      }
      deleteBrowserAuthCookies();
      stopTokenRefresh();
      emitAuthEvent(AUTH_EVENTS.LOGOUT, null);
    } catch (error) {
      throw AuthError.from(error);
    }
  };
  var handleAuthCallback = async () => {
    if (!isBrowser2()) return null;
    const hash = window.location.hash.substring(1);
    if (!hash) return null;
    const client = getClient();
    const params = new URLSearchParams(hash);
    try {
      const accessToken = params.get("access_token");
      if (accessToken) return await handleOAuthCallback(client, params, accessToken);
      const confirmationToken = params.get("confirmation_token");
      if (confirmationToken) return await handleConfirmationCallback(client, confirmationToken);
      const recoveryToken = params.get("recovery_token");
      if (recoveryToken) return await handleRecoveryCallback(client, recoveryToken);
      const inviteToken = params.get("invite_token");
      if (inviteToken) return handleInviteCallback(inviteToken);
      const emailChangeToken = params.get("email_change_token");
      if (emailChangeToken) return await handleEmailChangeCallback(client, emailChangeToken);
      return null;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw AuthError.from(error);
    }
  };
  var handleOAuthCallback = async (client, params, accessToken) => {
    const refreshToken = params.get("refresh_token") ?? "";
    const expiresIn = parseInt(params.get("expires_in") ?? "", 10);
    const expiresAt = parseInt(params.get("expires_at") ?? "", 10);
    const gotrueUser = await client.createUser(
      {
        access_token: accessToken,
        token_type: params.get("token_type") ?? "bearer",
        expires_in: isFinite(expiresIn) ? expiresIn : 3600,
        expires_at: isFinite(expiresAt) ? expiresAt : Math.floor(Date.now() / 1e3) + 3600,
        refresh_token: refreshToken
      },
      persistSession
    );
    setBrowserAuthCookies(accessToken, refreshToken || void 0);
    const user = toUser(gotrueUser);
    startTokenRefresh();
    clearHash();
    emitAuthEvent(AUTH_EVENTS.LOGIN, user);
    return { type: "oauth", user };
  };
  var handleConfirmationCallback = async (client, token) => {
    const gotrueUser = await client.confirm(token, persistSession);
    const jwt = await gotrueUser.jwt();
    setBrowserAuthCookies(jwt, gotrueUser.tokenDetails()?.refresh_token);
    const user = toUser(gotrueUser);
    startTokenRefresh();
    clearHash();
    emitAuthEvent(AUTH_EVENTS.LOGIN, user);
    return { type: "confirmation", user };
  };
  var handleRecoveryCallback = async (client, token) => {
    const gotrueUser = await client.recover(token, persistSession);
    const jwt = await gotrueUser.jwt();
    setBrowserAuthCookies(jwt, gotrueUser.tokenDetails()?.refresh_token);
    const user = toUser(gotrueUser);
    startTokenRefresh();
    clearHash();
    emitAuthEvent(AUTH_EVENTS.RECOVERY, user);
    return { type: "recovery", user };
  };
  var handleInviteCallback = (token) => {
    clearHash();
    return { type: "invite", user: null, token };
  };
  var handleEmailChangeCallback = async (client, emailChangeToken) => {
    const currentUser3 = client.currentUser();
    if (!currentUser3) {
      throw new AuthError("Email change verification requires an active browser session");
    }
    const jwt = await currentUser3.jwt();
    const identityUrl = `${window.location.origin}${IDENTITY_PATH}`;
    const emailChangeRes = await fetch(`${identityUrl}/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify({ email_change_token: emailChangeToken })
    });
    if (!emailChangeRes.ok) {
      const errorBody = await emailChangeRes.json().catch(() => ({}));
      throw new AuthError(
        errorBody.msg ?? `Email change verification failed (${String(emailChangeRes.status)})`,
        emailChangeRes.status
      );
    }
    const emailChangeData = await emailChangeRes.json();
    const user = toUser(emailChangeData);
    clearHash();
    emitAuthEvent(AUTH_EVENTS.USER_UPDATED, user);
    return { type: "email_change", user };
  };
  var clearHash = () => {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  };
  var hydrateSession = async () => {
    if (!isBrowser2()) return null;
    const client = getClient();
    const currentUser3 = client.currentUser();
    if (currentUser3) {
      startTokenRefresh();
      return toUser(currentUser3);
    }
    const accessToken = getCookie(NF_JWT_COOKIE);
    if (!accessToken) return null;
    const refreshToken = getCookie(NF_REFRESH_COOKIE) ?? "";
    const decoded = decodeJwtPayload(accessToken);
    const expiresAt = decoded?.exp ?? Math.floor(Date.now() / 1e3) + 3600;
    const expiresIn = Math.max(0, expiresAt - Math.floor(Date.now() / 1e3));
    let gotrueUser;
    try {
      gotrueUser = await client.createUser(
        {
          access_token: accessToken,
          token_type: "bearer",
          expires_in: expiresIn,
          expires_at: expiresAt,
          refresh_token: refreshToken
        },
        persistSession
      );
    } catch {
      deleteBrowserAuthCookies();
      return null;
    }
    const user = toUser(gotrueUser);
    startTokenRefresh();
    emitAuthEvent(AUTH_EVENTS.LOGIN, user);
    return user;
  };
  var toAuthProvider = (value) => typeof value === "string" && AUTH_PROVIDERS.includes(value) ? value : void 0;
  var toOptionalString = (value) => typeof value === "string" && value !== "" ? value : void 0;
  var toRoles = (appMeta) => {
    const roles = appMeta.roles;
    if (Array.isArray(roles) && roles.every((r) => typeof r === "string")) {
      return roles;
    }
    return void 0;
  };
  var toUser = (userData) => {
    const userMeta = userData.user_metadata ?? {};
    const appMeta = userData.app_metadata ?? {};
    const name = userMeta.full_name ?? userMeta.name;
    const pictureUrl = userMeta.avatar_url;
    return {
      id: userData.id,
      email: userData.email,
      confirmedAt: toOptionalString(userData.confirmed_at),
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
      role: toOptionalString(userData.role),
      provider: toAuthProvider(appMeta.provider),
      name: typeof name === "string" ? name : void 0,
      pictureUrl: typeof pictureUrl === "string" ? pictureUrl : void 0,
      roles: toRoles(appMeta),
      invitedAt: toOptionalString(userData.invited_at),
      confirmationSentAt: toOptionalString(userData.confirmation_sent_at),
      recoverySentAt: toOptionalString(userData.recovery_sent_at),
      pendingEmail: toOptionalString(userData.new_email),
      emailChangeSentAt: toOptionalString(userData.email_change_sent_at),
      lastSignInAt: toOptionalString(userData.last_sign_in_at),
      userMetadata: userMeta,
      appMetadata: appMeta
    };
  };
  var claimsToUser = (claims) => {
    const appMeta = claims.app_metadata ?? {};
    const userMeta = claims.user_metadata ?? {};
    const name = userMeta.full_name ?? userMeta.name;
    const pictureUrl = userMeta.avatar_url;
    return {
      id: claims.sub ?? "",
      email: claims.email,
      provider: toAuthProvider(appMeta.provider),
      name: typeof name === "string" ? name : void 0,
      pictureUrl: typeof pictureUrl === "string" ? pictureUrl : void 0,
      roles: toRoles(appMeta),
      userMetadata: userMeta,
      appMetadata: appMeta
    };
  };
  var decodeJwtPayload = (token) => {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(payload);
    } catch {
      return null;
    }
  };
  var fetchFullUser = async (identityUrl, jwt) => {
    try {
      const res = await fetchWithTimeout(`${identityUrl}/user`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      if (!res.ok) return null;
      const userData = await res.json();
      return toUser(userData);
    } catch {
      return null;
    }
  };
  var resolveIdentityUrl = () => {
    const identityContext = getIdentityContext();
    if (identityContext?.url) return identityContext.url;
    if (globalThis.Netlify?.context?.url) {
      return new URL(IDENTITY_PATH, globalThis.Netlify.context.url).href;
    }
    const siteUrl = typeof process !== "undefined" ? process.env?.URL : void 0;
    if (siteUrl) {
      return new URL(IDENTITY_PATH, siteUrl).href;
    }
    return null;
  };
  var getUser = async () => {
    if (isBrowser2()) {
      const client = getGoTrueClient();
      const currentUser3 = client?.currentUser() ?? null;
      if (currentUser3) {
        const jwt2 = getCookie(NF_JWT_COOKIE);
        if (!jwt2) {
          try {
            currentUser3.clearSession();
          } catch {
          }
          return null;
        }
        startTokenRefresh();
        return toUser(currentUser3);
      }
      const jwt = getCookie(NF_JWT_COOKIE);
      if (!jwt) return null;
      const claims2 = decodeJwtPayload(jwt);
      if (!claims2) return null;
      const hydrated = await hydrateSession();
      return hydrated ?? null;
    }
    triggerNextjsDynamic();
    const identityContext = globalThis.netlifyIdentityContext;
    const serverJwt = identityContext?.token ?? getServerCookie(NF_JWT_COOKIE);
    if (serverJwt) {
      const identityUrl = resolveIdentityUrl();
      if (identityUrl) {
        const fullUser = await fetchFullUser(identityUrl, serverJwt);
        if (fullUser) return fullUser;
      }
    }
    const claims = identityContext?.user ?? null;
    return claims ? claimsToUser(claims) : null;
  };

  // auth.js
  var byId = (id) => document.getElementById(id);
  var dialog = byId("authDialog");
  var dashboard = byId("dashboardDialog");
  var form = byId("authForm");
  var mode = "login";
  var currentUser2 = null;
  var syncTimer = null;
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
    currentUser2 = user || null;
    const loggedIn = Boolean(user);
    byId("accountButton").textContent = loggedIn ? user.userMetadata?.full_name || user.email || "My account" : "Log in";
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
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
  function dashboardMessage(text, error = false) {
    const target = byId("dashboardMessage");
    target.textContent = text;
    target.style.color = error ? "#b42318" : "";
  }
  function renderDashboard() {
    const plans = window.CareerShieldPlans?.get?.() || [];
    byId("dashboardEmail").textContent = currentUser2?.email || "";
    byId("dashboardPlanCount").textContent = `${plans.length} of 4`;
    byId("dashboardPlans").innerHTML = plans.length ? plans.map((plan, index) => `
    <article class="dashboard-plan">
      <div><strong>${safe(plan.savedLabel || plan.name || "Saved path")}</strong><small>${safe(plan.pathLabel || plan.path || "Career path")} \xB7 ${safe(plan.career?.name || "Career not available")} \xB7 Score ${Number(plan.score) || 0}/100</small></div>
      <div class="dashboard-plan-actions"><button type="button" data-dashboard-action="open" data-index="${index}">Open</button><button type="button" data-dashboard-action="rename" data-index="${index}">Rename</button><button type="button" data-dashboard-action="duplicate" data-index="${index}">Duplicate</button><button type="button" data-dashboard-action="delete" data-index="${index}">Delete</button></div>
    </article>`).join("") : '<div class="dashboard-empty">No paths saved yet. Build a comparison and it will appear here automatically.</div>';
  }
  function formatOrderAmount(amount, currency = "usd") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(Number(amount || 0) / 100);
  }
  async function loadReportOrders() {
    const target = byId("dashboardOrders");
    target.innerHTML = '<div class="dashboard-empty">Loading verified purchases\u2026</div>';
    try {
      const response = await fetch("/api/report-orders", { credentials: "same-origin", headers: { accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Purchases could not be loaded.");
      const orders = Array.isArray(data.orders) ? data.orders : [];
      target.innerHTML = orders.length ? orders.map((order) => {
        const date = order.purchasedAt ? new Date(order.purchasedAt).toLocaleDateString() : "Date unavailable";
        const statusLabel = order.status === "purchased" ? "Purchased" : order.status === "processing" ? "Processing" : "Payment issue";
        const statusClass = order.status === "processing" ? "processing" : order.status === "purchased" ? "" : "issue";
        return `<article class="dashboard-order"><div><strong>Personalized Decision Report \xB7 ${safe(formatOrderAmount(order.amountTotal, order.currency))}</strong><small>${safe(date)} \xB7 Stripe order ${safe(String(order.sessionId || "").slice(-10))}</small></div><span class="order-status ${statusClass}">${statusLabel}</span></article>`;
      }).join("") : '<div class="dashboard-empty">No verified report purchases yet. Purchases made while logged in will appear here.</div>';
    } catch (error) {
      target.innerHTML = `<div class="dashboard-empty">${safe(error.message)}</div>`;
    }
  }
  function openDashboard() {
    if (!currentUser2) return;
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
    if (!currentUser2) return;
    storageStatus("Saving your comparisons\u2026");
    try {
      await plansRequest("PUT", plans);
      storageStatus("Your comparisons are saved securely to your account.");
    } catch (error) {
      storageStatus(error.message, true);
      throw error;
    }
  }
  async function loadAccountPlans() {
    if (!currentUser2 || !window.CareerShieldPlans) return;
    storageStatus("Loading your saved comparisons\u2026");
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
    try {
      showUser(await getUser());
    } catch {
      showUser(null);
    }
  }
  byId("accountButton").addEventListener("click", async () => {
    const user = await getUser().catch(() => null);
    if (user) byId("accountMenu").hidden = !byId("accountMenu").hidden;
    else {
      chooseMode("login");
      dialog.showModal();
    }
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
  window.addEventListener("careershield:plans-changed", (event) => {
    if (!currentUser2) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncPlans(event.detail?.plans || []).catch(() => {
    }), 350);
  });
  window.CareerShieldAccount = { syncPlans };
  byId("dashboardPlans").addEventListener("click", (event) => {
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
  document.querySelectorAll(".product-checkout-link").forEach((link) => link.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!currentUser2) {
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
    link.textContent = "Opening secure checkout\u2026";
    try {
      await syncPlans(plans);
      const response = await fetch("/api/report-checkout", { method: "POST", credentials: "same-origin", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ product: link.dataset.product || "reviewed_report" }) });
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
  byId("generateDeepAnalysis").addEventListener("click", async () => {
    if (!currentUser2) {
      chooseMode("login");
      dialog.showModal();
      message("Log in to open your purchased Deep Analysis.");
      return;
    }
    const button = byId("generateDeepAnalysis");
    const viewer = byId("deepAnalysisViewer");
    const content = byId("deepAnalysisContent");
    if (!dashboard.open) {
      renderDashboard();
      dashboard.showModal();
    }
    button.disabled = true;
    button.textContent = "Preparing analysis\xE2\u20AC\xA6";
    viewer.hidden = false;
    content.textContent = "CareerShield is stress-testing your saved comparison\xE2\u20AC\xA6";
    try {
      const response = await fetch("/api/deep-analysis", { method: "POST", credentials: "same-origin", headers: { accept: "application/json", "content-type": "application/json" }, body: "{}" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 202) {
        content.textContent = data.message || "Your analysis is being prepared. Try again shortly.";
        return;
      }
      if (!response.ok || !data.analysis?.content) throw new Error(data.error || "Deep Analysis could not be opened.");
      content.textContent = data.analysis.content;
      button.textContent = "Open Deep Analysis";
    } catch (error) {
      content.textContent = error.message;
      button.textContent = "Try Deep Analysis again";
    } finally {
      button.disabled = false;
    }
  });
  byId("closeDeepAnalysis").addEventListener("click", () => {
    byId("deepAnalysisViewer").hidden = true;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = byId("authEmail").value.trim();
    const password = byId("authPassword").value;
    const submit = byId("authSubmit");
    submit.disabled = true;
    message(mode === "signup" ? "Creating your account\u2026" : "Logging you in\u2026", true);
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
  document.addEventListener("click", (event) => {
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
    if (currentUser2) await loadAccountPlans();
  }
  initializeIdentity();
})();
