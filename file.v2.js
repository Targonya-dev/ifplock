(() => {
  "use strict";

  const NS = "__WitchMOWAutoReload";
  const REMOTE_MARKER = "__witch_autolock_remote_loaded";
  const LOADER_META_KEY = "__witch_autolock_loader_meta";
  const LOADER_META_STORAGE_KEY = `witch-mow-ar:loader-meta:v1:${location.host}`;
  const PANEL_ID = "witch-mow-ar-panel";
  const SCRIPT_NAME = "witch-mow-ar";
  const SCRIPT_VERSION = "1.1.0";
  const SCRIPT_VERSION_LABEL = `${SCRIPT_NAME}@${SCRIPT_VERSION}`;
  const EXPECTED_LOADER_VERSION = "0.9.1";
  const LOADER_UPDATE_URL =
    "https://script.google.com/macros/s/AKfycbyIXpBteZYjmvyuyKUsO0_ieE4_gpsN5SBsU7PULfZds-3ut0xxT9h8_BmeAt3aknSh/exec";
  const USER_EMAIL_STORAGE_KEY = `witch-mow-ar:user-email:v1:${location.host}`;
  const DAILY_STATS_KEY = `witch-mow-ar:daily:v1:${location.host}`;
  const INSTALL_ID_STORAGE_KEY = `witch-mow-ar:install-id:v1:${location.host}`;
  const FILTER_STORAGE_KEY = `witch-mow-ar:filters:v3:${location.host}`;
  const PRIORITY_RULES_STORAGE_KEY = `witch-mow-ar:priority-rules:v1:${location.host}`;
  const VISUAL_HIGHLIGHT_STORAGE_KEY = `witch-mow-ar:visual-highlight:v2:${location.host}`;
  const DRY_RUN_STORAGE_KEY = `witch-mow-ar:dry-run:v1:${location.host}`;
  const CHANGELOG_SEEN_STORAGE_KEY = `witch-mow-ar:changelog-seen:v1:${location.host}`;
  const ROLE_WARNING_DISMISSED_STORAGE_KEY = `witch-mow-ar:role-warning:v1:${location.host}`;
  const IGNORE_IDS_STORAGE_KEY = `witch-mow-ar:ignore-ids:v1:${location.host}`;
  const LIDAR_SEPARATE_STORAGE_KEY = `witch-mow-ar:lidar-separate:v1:${location.host}`;
  const PRIORITY_RULES_MIGRATION_VERSION = 3;
  const PRIORITY_RULES_MIGRATION_OVERRIDES = Object.freeze({ p1: false });

  const AUTO_REFRESH_INTERVAL_MS = 1_000;
  const HOT_RETRY_DELAY_MS = 500;
  const HOT_RETRY_MAX_ATTEMPTS = 3;
  const HARD_STOP_TOTAL_MS = 180_000;
  const FILTER_REVIEW_TTL_MS = 300_000;
  const FILTER_MAX = 20;
  const DOM_MISMATCH_MAINTENANCE_STREAK = 5;
  const REMOTE_FETCH_TIMEOUT_MS = 15_000;
  const AUTORUN_LOCK_KEY = `witch-mow-ar:autolock-run:v1:${location.host}`;
  const NOTIFICATION_TITLE = "Witch Autolock";
  const NOTIFICATION_DEDUP_MS = 5_000;
  const NOTIFICATION_AUTO_CLOSE_MS = 10_000;
  const ASSIGNMENTS_REQUIRED_HEADERS = ["id", "state", "action", "priority", "complexity"];
  const ASSIGNMENT_ACTION_PATH_RE = /^\/orders\/(\d+)\/manual_state$/;
  const ASSIGNMENT_ACTION_ALLOWED_QUERY_KEYS = new Set(["state", "triggered_from", "timestamp", "signature"]);
  const ASSIGNMENT_ACTION_ALLOWED_TRIGGER = "my-work-v2-index";
  const COMPLEXITY_LEVELS = [
    { key: "simple", label: "Simple" },
    { key: "average", label: "Average" },
    { key: "complex_residential", label: "Complex" },
    { key: "custom", label: "Custom" },
  ];
  const DELIVERABLE_FILTERS = [
    { key: "roof", label: "Roof" },
    { key: "complete", label: "Complete" },
    { key: "total_living_area", label: "Total Living Area" },
    { key: "total_living_area_plus", label: "Living Area Plus" },
    { key: "fast_roof", label: "Fast Roof" },
    { key: "interior_floor_plan", label: "Interior Floor Plan" },
    { key: "other", label: "Other" },
  ];
  const PRIORITY_RULE_DEFINITIONS = [
    {
      key: "p1",
      label: "Тримати 1 окремо від 2",
      confirmText: "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 1 і 2 стануть однією спільною зоною пошуку.",
      summaryLabel: "1|2",
    },
    {
      key: "p2",
      label: "Тримати 2 окремо від 3-18",
      confirmText: "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 2 і 3-18 стануть однією спільною зоною пошуку.",
      summaryLabel: "2|3-18",
    },
    {
      key: "p3_18",
      label: "Тримати 3-18 окремо від 19",
      confirmText: "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 3-18 і 19 стануть однією спільною зоною пошуку.",
      summaryLabel: "3-18|19",
    },
    {
      key: "p19",
      label: "Тримати 19 окремо від 20",
      confirmText: "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 19 і 20 стануть однією спільною зоною пошуку.",
      summaryLabel: "19|20",
    },
  ];
  const FILTER_SLOT_IDS = [1, 2, 3];
  const SEARCH_GROUP_BADGE_ROLE = "witch-mow-ar-search-group-badge";
  const VISUAL_STATE_STYLE_ID = "witch-mow-ar-visual-state-style";

  const COLOR = {
    info: "#1d2b44",
    ok: "#127a12",
    warn: "#8a5f00",
    error: "#b21f1f",
  };

  if (window[NS] && typeof window[NS].show === "function") {
    window[REMOTE_MARKER] = true;
    window[NS].show();
    return;
  }

  const state = {
    enabled: false,
    busy: false,
    timer: null,
    lastRequestAt: 0,
    runStartedAt: 0,
    lastAutoStartAt: 0,
    lastFilterReviewAt: 0,
    lastFingerprint: "",
    lastUpdatedAt: 0,
    locked: false,
    maintenance: false,
    maintenanceReason: "",
    filterOpen: false,
    activeFilterSlot: 1,
    lastLockAttemptAt: 0,
    lastLockAttemptKey: "",
    hotRetryTimer: null,
    hotRetryCount: 0,
    hotRetryOrderId: "",
    hotRetryActive: false,
    priorityRulesOpen: false,
    settingsOpen: false,
    changelogOpen: false,
    ignoreOpen: false,
    panelMinimized: false,
    noComplexityMode: false,
    dryRunEnabled: false,
    visualHighlightEnabled: false,
    roleWarningDismissed: false,
    lidarSeparate: false,
    ignoreIds: ["", "", "", "", ""],
    priorityRules: createDefaultPriorityRules(),
    selectedPriorities: new Set(Array.from({ length: FILTER_MAX }, (_, i) => i + 1)),
    selectedComplexities: new Set(COMPLEXITY_LEVELS.map((item) => item.key)),
    selectedDeliverables: new Set(DELIVERABLE_FILTERS.map((item) => item.key)),
    filterSlots: {
      1: createDefaultFilterSnapshot(),
      2: createDefaultFilterSnapshot(),
      3: createDefaultFilterSnapshot(),
    },
    stopLabel: "Увімкнути автолок",
    currentUserEmail: "",
    installId: "",
    runId: "",
    manualWaitTimer: null,
    pendingManualRefresh: false,
    lockAttemptController: null,
    lockAttemptRunId: "",
    lockAttemptInFlight: false,
    errorStreak: 0,
    domMismatchStreak: 0,
    invalidRowStreak: 0,
    lastLockOrderId: "",
    runLockHeld: false,
    runLockRelease: null,
    runLockOwnerId: "",
    startPending: false,
    backgroundStopFallback: false,
    lastNotificationKey: "",
    lastNotificationAt: 0,
    originalDocumentTitle: typeof document !== "undefined" ? String(document.title || "") : "",
    lastManagedDocumentTitle: "",
    browserIndicatorMode: "idle",
    lastStatusText: "Init...",
    lastStatusTone: "info",
    lastActionText: "-",
    lastActionTone: "info",
    runMetrics: {
      manualRefreshCount: 0,
      autoStartCount: 0,
      autoLockCount: 0,
      errorCount: 0,
    },
  };

  let statusEl, actionEl, lastEl, userEmailEl, lockNoticeEl, loaderNoteEl, roleWarningEl;
  let autoBtnEl, autoHintEl, filterBtnEl, priorityRulesBtnEl, priorityRulesPanelEl, filterPanelEl;
  let filterSlotsEl, prioritiesGridEl, complexitiesGridEl, deliverablesGridEl, noComplexityEl;
  let filterMetaEl, panelEl, compactPanelEl, compactStatusEl, compactActionEl, compactIndicatorEl;
  let visualToggleBtnEl, minimizeBtnEl, settingsBtnEl, settingsPanelEl, changelogBtnEl, changelogPanelEl;
  let dryRunToggleEl, managedFaviconEl, lidarSeparateEl, ignoreIdEls = [], ignoreBtnEl, ignoreMenuEl;
  let debugBtnEl, feedbackBtnEl;

  const CHANGELOG_ENTRIES = Object.freeze([
    { version: "1.1.0", title: "1.1.0", items: ["Видалено Telegram-логування", "Додано Interior Floor Plan до фільтра Deliverable", "Додано чекбокс 'Відділити лідари'", "Мульти-клік для custom Interior без перезавантаження", "Меню 'Ігнорувати' з 5 полями для ID"] },
    { version: "1.0.6", title: "1.0.6 (02-04-2026)", items: ["Додано мінімальний режим панелі з компактною плашкою"] },
  ]);

  // ===== Core Helpers =====

  function nowMs() { return Date.now(); }

  function makeShortId(prefix) {
    return `${prefix}_${nowMs().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function ensureOriginalDocumentTitle() {
    if (!state.originalDocumentTitle) {
      state.originalDocumentTitle = String(document.title || "Assignments");
    }
    return state.originalDocumentTitle;
  }

  function getBrowserIndicatorTitlePrefix(mode) {
    if (mode === "run") return `[RUN ${getRemainingBudgetSec(nowMs())}s] `;
    if (mode === "stop") return "[STOP] ";
    if (mode === "warn") return "[WARN] ";
    if (mode === "lock") return "[LOCK] ";
    return "";
  }

  function stripBrowserIndicatorTitle(title) {
    return String(title || "").replace(/^\[(?:RUN\s+\d+s|STOP|WARN|LOCK)\]\s*/i, "");
  }

  function syncOriginalDocumentTitleFromDocument() {
    const currentTitle = String(document.title || "");
    const normalizedTitle = stripBrowserIndicatorTitle(currentTitle).trim();
    if (normalizedTitle) { state.originalDocumentTitle = normalizedTitle; return normalizedTitle; }
    return ensureOriginalDocumentTitle();
  }

  function setManagedDocumentTitle(title) {
    const nextTitle = String(title || "");
    state.lastManagedDocumentTitle = nextTitle;
    document.title = nextTitle;
  }

  function buildIndicatorFaviconDataUrl(mode) {
    const iconMap = {
      run: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#16a34a"/></svg>',
      stop: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#dc2626"/></svg>',
      warn: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#eab308"/></svg>',
      lock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#16a34a" d="M6.4 11.7 2.9 8.2l1.2-1.2 2.3 2.3 5.5-5.5 1.2 1.2-6.7 6.7Z"/></svg>',
    };
    const svg = iconMap[mode] || "";
    return svg ? `data:image/svg+xml,${encodeURIComponent(svg)}` : "";
  }

  function ensureManagedFaviconElement() {
    if (managedFaviconEl && managedFaviconEl.isConnected) return managedFaviconEl;
    const link = document.createElement("link");
    link.setAttribute("rel", "icon");
    link.setAttribute("data-role", "witch-mow-ar-favicon");
    document.head.appendChild(link);
    managedFaviconEl = link;
    return managedFaviconEl;
  }

  function getNativeFaviconElements() {
    return Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]')).filter(
      (node) => node !== managedFaviconEl && node.getAttribute("data-role") !== "witch-mow-ar-favicon"
    );
  }

  function renderBrowserIndicator() {
    const baseTitle = syncOriginalDocumentTitleFromDocument();
    const mode = String(state.browserIndicatorMode || "idle");
    if (mode === "idle") {
      setManagedDocumentTitle(baseTitle);
      const hasNativeFavicon = getNativeFaviconElements().length > 0;
      if (hasNativeFavicon) {
        if (managedFaviconEl && managedFaviconEl.isConnected) managedFaviconEl.remove();
        managedFaviconEl = null;
      } else {
        const link = ensureManagedFaviconElement();
        link.href = "data:,";
      }
      return;
    }
    const titlePrefix = getBrowserIndicatorTitlePrefix(mode);
    setManagedDocumentTitle(`${titlePrefix}${baseTitle}`);
    const dataUrl = buildIndicatorFaviconDataUrl(mode);
    if (!dataUrl) return;
    const link = ensureManagedFaviconElement();
    link.href = dataUrl;
  }

  function setBrowserIndicator(mode) {
    state.browserIndicatorMode = String(mode || "idle");
    renderBrowserIndicator();
  }

  function getSessionStorage() {
    try { return typeof sessionStorage !== "undefined" ? sessionStorage : null; }
    catch (_err) { return null; }
  }

  function loadOrCreateInstallId() {
    try {
      const existing = localStorage.getItem(INSTALL_ID_STORAGE_KEY);
      if (existing) return existing;
      const next = makeShortId("inst");
      localStorage.setItem(INSTALL_ID_STORAGE_KEY, next);
      return next;
    } catch (_err) { return makeShortId("inst_tmp"); }
  }

  function clearTimer() {
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  }

  function clearManualWaitTimer() {
    if (state.manualWaitTimer) { clearTimeout(state.manualWaitTimer); state.manualWaitTimer = null; }
  }

  function clearHotRetryTimer() {
    if (state.hotRetryTimer) { clearTimeout(state.hotRetryTimer); state.hotRetryTimer = null; }
  }

  function resetHotRetryState() {
    clearHotRetryTimer();
    state.hotRetryCount = 0;
    state.hotRetryOrderId = "";
    state.hotRetryActive = false;
  }

  function getNextBaseRefreshDelayMs(ts) {
    const currentTs = Number.isFinite(ts) ? ts : nowMs();
    if (!state.lastRequestAt) return 0;
    return Math.max(0, state.lastRequestAt + AUTO_REFRESH_INTERVAL_MS - currentTs);
  }

  function scheduleHotRetry(orderId) {
    if (!state.enabled || state.maintenance) return false;
    const normalizedOrderId = compactText(String(orderId || ""));
    const nextCount = normalizedOrderId && normalizedOrderId === state.hotRetryOrderId ? state.hotRetryCount + 1 : 1;
    if (nextCount > HOT_RETRY_MAX_ATTEMPTS) { resetHotRetryState(); return false; }
    clearTimer();
    clearHotRetryTimer();
    state.hotRetryCount = nextCount;
    state.hotRetryOrderId = normalizedOrderId;
    state.hotRetryActive = true;
    const runScheduledHotRetry = () => {
      state.hotRetryTimer = null;
      if (!state.enabled || state.maintenance) { resetHotRetryState(); return; }
      if (state.busy || state.lockAttemptInFlight) {
        state.hotRetryTimer = setTimeout(runScheduledHotRetry, HOT_RETRY_DELAY_MS);
        return;
      }
      const orderSuffix = normalizedOrderId || "-";
      setStatus(`Автолок: швидкий retry ${orderSuffix}`, "warn");
      setAction(`Hot retry ${state.hotRetryCount}/${HOT_RETRY_MAX_ATTEMPTS} для ${orderSuffix}`, "warn");
      void refreshNow("hot_retry", true);
    };
    state.hotRetryTimer = setTimeout(runScheduledHotRetry, HOT_RETRY_DELAY_MS);
    return true;
  }

  function cancelActiveLockAttempt() {
    const controller = state.lockAttemptController;
    state.lockAttemptController = null;
    state.lockAttemptRunId = "";
    state.lockAttemptInFlight = false;
    if (controller && typeof controller.abort === "function") {
      try { controller.abort(); } catch (_err) { }
    }
  }

  function supportsAutolockRunLock() {
    return Boolean(typeof navigator !== "undefined" && navigator.locks && typeof navigator.locks.request === "function");
  }

  async function acquireAutolockRunLock() {
    if (state.runLockHeld) return { ok: true, reason: "already_local", error: "" };
    if (!supportsAutolockRunLock()) return { ok: false, reason: "unsupported", error: "" };
    const ownerId = makeShortId("runlock");
    let releaseResolver = null;
    let acquiredSettled = false;
    const holdPromise = new Promise((resolve) => { releaseResolver = resolve; });
    const acquiredPromise = new Promise((resolve) => {
      const acquiredResolve = (v) => { if (acquiredSettled) return; acquiredSettled = true; resolve(v); };
      state.runLockOwnerId = ownerId;
      void navigator.locks.request(AUTORUN_LOCK_KEY, { mode: "exclusive", ifAvailable: true }, async (lock) => {
        if (!lock) { acquiredResolve({ ok: false, reason: "held_elsewhere", error: "" }); return false; }
        state.runLockHeld = true;
        state.runLockRelease = () => { if (!releaseResolver) return; const r = releaseResolver; releaseResolver = null; r(); };
        acquiredResolve({ ok: true, reason: "acquired", error: "" });
        await holdPromise;
        return true;
      }).catch((err) => {
        const message = compactText(err && err.message ? err.message : String(err || "lock error"));
        acquiredResolve({ ok: false, reason: "error", error: message });
        return false;
      }).finally(() => {
        if (state.runLockOwnerId !== ownerId) return;
        state.runLockHeld = false;
        state.runLockRelease = null;
        state.runLockOwnerId = "";
      });
    });
    return acquiredPromise;
  }

  function releaseAutolockRunLock() {
    const ownerId = state.runLockOwnerId;
    const release = state.runLockRelease;
    state.runLockRelease = null;
    if (release) release();
    if (state.runLockOwnerId === ownerId) { state.runLockHeld = false; state.runLockOwnerId = ""; }
  }

  async function ensureNotificationPermission() {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try { const p = await Notification.requestPermission(); return p === "granted"; }
    catch (_err) { return false; }
  }

  function notifyUserOnce(key, message) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    const normalizedKey = compactText(String(key || ""));
    const normalizedMessage = compactText(String(message || ""));
    if (!normalizedKey || !normalizedMessage) return false;
    const ts = nowMs();
    if (state.lastNotificationKey === normalizedKey && ts - toSafeInt(state.lastNotificationAt) < NOTIFICATION_DEDUP_MS) return false;
    state.lastNotificationKey = normalizedKey;
    state.lastNotificationAt = ts;
    try {
      const n = new Notification(NOTIFICATION_TITLE, { body: normalizedMessage, tag: normalizedKey });
      setTimeout(() => { try { n.close(); } catch (_err) { } }, NOTIFICATION_AUTO_CLOSE_MS);
      return true;
    } catch (_err) { return false; }
  }

  function getStopNotificationMessage(stopReason) {
    const normalized = String(stopReason || "");
    if (normalized === "lock_opened" || normalized === "locked") return "Зафіксовано лок. Стопаю скрипт";
    const reasonMap = {
      hard_limit_3m: "ліміт 3 хв", manual_refresh: "ручне оновлення",
      filter_changed: "змінено фільтри", critical_dom_change: "критична зміна DOM",
      error: "помилка", inactive_tab: "браузер заблокував фонову роботу",
    };
    return `Скрипт стопнуто: ${reasonMap[normalized] || normalized || "невідома причина"}`;
  }

  function maybeNotifyStop(stopReason, wasEnabled) {
    if (!wasEnabled) return false;
    if (String(stopReason || "") === "manual") return false;
    return notifyUserOnce(`stop:${String(stopReason || "unknown")}`, getStopNotificationMessage(stopReason));
  }

  function sendTestNotification() {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    try {
      const n = new Notification(NOTIFICATION_TITLE, { body: "Тест нотифікації: все працює", tag: `debug:test:${nowMs()}` });
      setTimeout(() => { try { n.close(); } catch (_err) { } }, NOTIFICATION_AUTO_CLOSE_MS);
      return true;
    } catch (_err) { return false; }
  }

  async function runNotificationDebugTest() {
    if (typeof Notification === "undefined") { setStatus("Нотифікації недоступні в цьому браузері", "warn"); return; }
    const allowed = await ensureNotificationPermission();
    if (!allowed) { setStatus("Немає дозволу на нотифікації", "warn"); return; }
    if (sendTestNotification()) { setStatus("Тест нотифікації відправлено", "ok"); }
    else { setStatus("Не вдалося показати тестову нотифікацію", "error"); }
  }

  function setTimer(ms, fn) { clearTimer(); state.timer = setTimeout(fn, Math.max(0, ms)); }

  function isVisibleAndFocused() {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  function stopAutoInactive() {
    stopAuto("Автолок зупинено: браузер заблокував фонову роботу", "Зупинено", "Стоп: браузер заблокував фонову роботу", "warn", "inactive_tab");
  }

  function getRunElapsedMs(ts) {
    if (!state.enabled || !state.runStartedAt) return 0;
    return Math.max(0, ts - state.runStartedAt);
  }

  function getRemainingBudgetSec(ts) {
    if (!state.runStartedAt) return Math.ceil(HARD_STOP_TOTAL_MS / 1000);
    const left = Math.max(0, HARD_STOP_TOTAL_MS - getRunElapsedMs(ts));
    return Math.ceil(left / 1000);
  }

  function compactPanelMessage(text) {
    const source = compactText(text || "-");
    if (!source) return "-";
    return source.length > 42 ? `${source.slice(0, 39)}...` : source;
  }

  function setStatus(text, tone) {
    state.lastStatusText = String(text || "");
    state.lastStatusTone = String(tone || "info");
    if (!statusEl) return;
    statusEl.textContent = compactPanelMessage(text);
    statusEl.title = text || "";
    statusEl.style.removeProperty("color");
    statusEl.style.setProperty("color", COLOR[tone] || COLOR.info, "important");
    renderCompactPanel();
  }

  function setAction(text, tone) {
    state.lastActionText = String(text || "-");
    state.lastActionTone = String(tone || "info");
    if (!actionEl) return;
    actionEl.textContent = compactPanelMessage(text || "-");
    actionEl.title = text || "-";
    actionEl.style.removeProperty("color");
    actionEl.style.setProperty("color", COLOR[tone] || COLOR.info, "important");
    renderCompactPanel();
  }

  function setLast(ts) {
    if (!lastEl) return;
    lastEl.textContent = ts ? new Date(ts).toLocaleTimeString() : "-";
  }

  function extractEmail(text) {
    const match = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0].toLowerCase() : "";
  }

  function extractUserEmailFromDoc(doc) {
    const link = doc.querySelector('a[href*="/users/register/edit"]');
    if (!link) return "";
    return extractEmail(link.textContent || "");
  }

  function clearLegacyCachedUserEmail() {
    try { localStorage.removeItem(USER_EMAIL_STORAGE_KEY); } catch (_err) { }
  }

  function readCachedUserEmail() {
    try {
      const storage = getSessionStorage();
      if (!storage) return "";
      const raw = storage.getItem(USER_EMAIL_STORAGE_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return extractEmail(parsed && parsed.email ? parsed.email : "");
    } catch (_err) { return ""; }
  }

  function writeCachedUserEmail(email) {
    if (!email) return;
    try {
      const storage = getSessionStorage();
      if (!storage) return;
      storage.setItem(USER_EMAIL_STORAGE_KEY, JSON.stringify({ email, updatedAt: nowMs(), source: "users/register/edit", scope: "session" }));
    } catch (_err) { }
    clearLegacyCachedUserEmail();
  }

  function resolveCurrentUserEmail(doc) {
    const fromDoc = extractUserEmailFromDoc(doc);
    if (fromDoc) { state.currentUserEmail = fromDoc; writeCachedUserEmail(fromDoc); return fromDoc; }
    if (state.currentUserEmail) return state.currentUserEmail;
    const fromCache = readCachedUserEmail();
    if (fromCache) { state.currentUserEmail = fromCache; return fromCache; }
    return "";
  }

  function setUserEmail(email) {
    if (!userEmailEl) return;
    userEmailEl.textContent = email || "-";
  }

  function persistVisualHighlightState() {
    try { localStorage.setItem(VISUAL_HIGHLIGHT_STORAGE_KEY, state.visualHighlightEnabled ? "1" : "0"); } catch (_err) { }
  }

  function persistDryRunState() {
    try { localStorage.setItem(DRY_RUN_STORAGE_KEY, state.dryRunEnabled ? "1" : "0"); } catch (_err) { }
  }

  function restorePersistedDryRunState() {
    try {
      const raw = localStorage.getItem(DRY_RUN_STORAGE_KEY);
      state.dryRunEnabled = raw === "1";
    } catch (_err) { state.dryRunEnabled = false; }
  }

  function restorePersistedVisualHighlightState() {
    try {
      const raw = localStorage.getItem(VISUAL_HIGHLIGHT_STORAGE_KEY);
      state.visualHighlightEnabled = raw === "1";
    } catch (_err) { state.visualHighlightEnabled = false; }
  }

  function persistRoleWarningDismissedState() {
    try { localStorage.setItem(ROLE_WARNING_DISMISSED_STORAGE_KEY, state.roleWarningDismissed ? "1" : "0"); } catch (_err) { }
  }

  function restorePersistedRoleWarningDismissedState() {
    try {
      const raw = localStorage.getItem(ROLE_WARNING_DISMISSED_STORAGE_KEY);
      state.roleWarningDismissed = raw === "1";
    } catch (_err) { state.roleWarningDismissed = false; }
  }

  function persistLidarSeparate() {
    try { localStorage.setItem(LIDAR_SEPARATE_STORAGE_KEY, state.lidarSeparate ? "1" : "0"); } catch (_err) { }
  }

  function restorePersistedLidarSeparate() {
    try {
      const raw = localStorage.getItem(LIDAR_SEPARATE_STORAGE_KEY);
      state.lidarSeparate = raw === "1";
    } catch (_err) { state.lidarSeparate = false; }
  }

  function persistIgnoreIds() {
    try { localStorage.setItem(IGNORE_IDS_STORAGE_KEY, JSON.stringify(state.ignoreIds)); } catch (_err) { }
  }

  function restorePersistedIgnoreIds() {
    try {
      const raw = localStorage.getItem(IGNORE_IDS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.ignoreIds = Array.from({ length: 5 }, (_, i) => String(parsed[i] || ""));
      }
    } catch (_err) { }
  }

  function getIgnoreIdSet() {
    return new Set(
      state.ignoreIds
        .map((id) => compactText(String(id || "")))
        .filter((id) => id.length > 0)
    );
  }

  function dismissRoleWarning() {
    state.roleWarningDismissed = true;
    persistRoleWarningDismissedState();
    if (!roleWarningEl) return;
    roleWarningEl.style.display = "none";
    roleWarningEl.replaceChildren();
  }

  function extractOrderIdFromLockText(...parts) {
    const text = parts.map((p) => compactText(String(p || ""))).filter(Boolean).join(" | ");
    if (!text) return "";
    const explicitOrderMatch = text.match(/Order\s*#?\s*(\d+)/i);
    if (explicitOrderMatch) return String(explicitOrderMatch[1] || "");
    const fallbackNumberMatch = text.match(/\b(\d{5,})\b/);
    return fallbackNumberMatch ? String(fallbackNumberMatch[1] || "") : "";
  }

  function renderVisualHighlightButton() {
    if (!visualToggleBtnEl) return;
    const enabled = Boolean(state.visualHighlightEnabled);
    visualToggleBtnEl.setAttribute("aria-pressed", enabled ? "true" : "false");
    visualToggleBtnEl.title = enabled ? "Вимкнути візуальну рамку" : "Увімкнути візуальну рамку";
    visualToggleBtnEl.setAttribute("aria-label", enabled ? "Вимкнути візуальну рамку" : "Увімкнути візуальну рамку");
    visualToggleBtnEl.style.borderColor = enabled ? "#93c5fd" : "#cbd5e1";
    visualToggleBtnEl.style.background = enabled ? "#dbeafe" : "#fff";
    visualToggleBtnEl.style.color = enabled ? "#1d4ed8" : "#64748b";
    visualToggleBtnEl.style.opacity = enabled ? "1" : "0.72";
  }

  function renderCompactPanel() {
    if (!compactPanelEl || !compactStatusEl || !compactActionEl || !compactIndicatorEl) return;
    const statusText = compactPanelMessage(state.lastStatusText);
    const actionText = compactPanelMessage(state.lastActionText);
    const tone = COLOR[state.lastStatusTone] || COLOR.info;
    compactStatusEl.textContent = statusText;
    compactStatusEl.title = state.lastStatusText || "";
    compactActionEl.textContent = actionText;
    compactActionEl.title = state.lastActionText;
    compactIndicatorEl.style.background = tone;
    compactPanelEl.style.borderColor = state.enabled ? "#bfdbfe" : "#d2d8e5";
    compactPanelEl.style.boxShadow = state.enabled ? "0 14px 28px rgba(37, 99, 235, 0.16)" : "0 10px 24px rgba(15, 23, 42, 0.14)";
  }

  function renderPanelMode() {
    if (!panelEl) return;
    const minimized = Boolean(state.panelMinimized);
    if (minimized) { state.settingsOpen = false; state.changelogOpen = false; }
    panelEl.style.display = minimized ? "none" : "block";
    if (compactPanelEl) compactPanelEl.style.display = minimized ? "grid" : "none";
    renderSettingsPanel();
    renderChangelogPanel();
    renderSettingsButton();
    renderChangelogButton();
    renderCompactPanel();
  }

  function setPanelMinimized(nextValue) {
    state.panelMinimized = Boolean(nextValue);
    renderPanelMode();
  }

  function getChangelogEntries() {
    return typeof CHANGELOG_ENTRIES === "undefined" || !Array.isArray(CHANGELOG_ENTRIES) ? [] : CHANGELOG_ENTRIES;
  }

  function getCurrentChangelogVersion() {
    const entries = getChangelogEntries();
    const first = entries.length > 0 && entries[0] ? entries[0] : null;
    return compactText(String(first && first.version ? first.version : "")) || SCRIPT_VERSION;
  }

  function getLastSeenChangelogVersion() {
    try { return compactText(String(localStorage.getItem(CHANGELOG_SEEN_STORAGE_KEY) || "")); }
    catch (_err) { return ""; }
  }

  function markChangelogSeen() {
    const version = getCurrentChangelogVersion();
    if (!version) return;
    try { localStorage.setItem(CHANGELOG_SEEN_STORAGE_KEY, version); } catch (_err) { }
  }

  function hasUnreadChangelog() {
    const entries = getChangelogEntries();
    if (entries.length === 0) return false;
    return getLastSeenChangelogVersion() !== getCurrentChangelogVersion();
  }

  function renderDryRunToggle() {
    if (!dryRunToggleEl) return;
    dryRunToggleEl.checked = Boolean(state.dryRunEnabled);
  }

  function renderSettingsButton() {
    if (!settingsBtnEl) return;
    const active = Boolean(state.settingsOpen);
    settingsBtnEl.style.borderColor = active ? "#1d4ed8" : "#cbd5e1";
    settingsBtnEl.style.background = active ? "#dbeafe" : "#fff";
    settingsBtnEl.style.color = active ? "#1d4ed8" : "#334155";
    settingsBtnEl.style.boxShadow = active ? "0 0 0 3px rgba(37, 99, 235, 0.16)" : "none";
  }

  function renderChangelogButton() {
    if (!changelogBtnEl) return;
    const unread = hasUnreadChangelog();
    const active = Boolean(state.changelogOpen);
    changelogBtnEl.textContent = unread ? `${SCRIPT_VERSION_LABEL} • Що нового?` : SCRIPT_VERSION_LABEL;
    changelogBtnEl.style.color = unread ? "#9a3412" : active ? "#1d4ed8" : "#8a94a6";
    changelogBtnEl.style.textDecoration = unread || active ? "underline" : "none";
    changelogBtnEl.style.textDecorationColor = unread ? "#f59e0b" : active ? "#60a5fa" : "transparent";
    changelogBtnEl.style.textUnderlineOffset = "2px";
    changelogBtnEl.setAttribute("aria-label", unread ? `Відкрити changelog для ${SCRIPT_VERSION_LABEL}` : `Відкрити changelog (${SCRIPT_VERSION_LABEL})`);
  }

  function ensureVisualStateStyles() {
    if (document.getElementById(VISUAL_STATE_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = VISUAL_STATE_STYLE_ID;
    style.textContent = `
      table.assignments_grid tbody tr.witch-mow-ar-search-group > td {
        background: rgba(37, 99, 235, 0.06) !important;
        box-shadow: inset 0 0 0 999px rgba(37, 99, 235, 0.03) !important;
      }
      table.assignments_grid tbody tr.witch-mow-ar-search-group > td:first-child {
        border-left: 2px solid rgba(37, 99, 235, 0.5) !important;
        position: relative; overflow: visible;
      }
      table.assignments_grid tbody tr.witch-mow-ar-search-group > td:last-child {
        border-right: 2px solid rgba(37, 99, 235, 0.5) !important;
      }
      table.assignments_grid tbody tr.witch-mow-ar-search-group-start > td {
        border-top: 2px solid rgba(37, 99, 235, 0.5) !important;
      }
      table.assignments_grid tbody tr.witch-mow-ar-search-group-end > td {
        border-bottom: 2px solid rgba(37, 99, 235, 0.5) !important;
      }
      table.assignments_grid tbody tr.witch-mow-ar-locked-row > td {
        background: rgba(22, 163, 74, 0.16) !important;
        border-top: 3px solid #16a34a !important;
        border-bottom: 3px solid #16a34a !important;
      }
      table.assignments_grid tbody tr.witch-mow-ar-locked-row > td:first-child {
        border-left: 3px solid #16a34a !important;
        position: relative; overflow: visible;
      }
      table.assignments_grid tbody tr.witch-mow-ar-locked-row > td:last-child {
        border-right: 3px solid #16a34a !important;
      }
      [data-role="${SEARCH_GROUP_BADGE_ROLE}"] {
        position: absolute; top: auto; bottom: 100%; left: 10px;
        display: inline-block; padding: 3px 9px 4px;
        border: 1px solid rgba(37, 99, 235, 0.45); border-radius: 10px 10px 0 0; border-bottom: 0;
        background: rgba(223, 234, 255, 0.5); color: rgba(33, 72, 166, 0.85);
        font: 700 10px/1.15 Arial, sans-serif; white-space: nowrap;
        box-shadow: 0 3px 10px rgba(37, 99, 235, 0.06);
        pointer-events: none; z-index: 3;
      }
    `;
    document.head.appendChild(style);
  }

  function getPriorityGroupDisplayLabel(groupKey) {
    if (groupKey === "p1") return "1";
    if (groupKey === "p2") return "2";
    if (groupKey === "p3_18") return "3-18";
    if (groupKey === "p19") return "19";
    if (groupKey === "sneaky") return "20";
    return "";
  }

  function getPriorityGroupBounds(groupKey) {
    if (groupKey === "p1") return { start: 1, end: 1 };
    if (groupKey === "p2") return { start: 2, end: 2 };
    if (groupKey === "p3_18") return { start: 3, end: 18 };
    if (groupKey === "p19") return { start: 19, end: 19 };
    if (groupKey === "sneaky") return { start: 20, end: 20 };
    return null;
  }

  function getPriorityGroupRangeLabel(groupKeys) {
    const keys = Array.isArray(groupKeys) ? groupKeys.filter(Boolean) : [];
    if (keys.length === 0) return "";
    const firstBounds = getPriorityGroupBounds(keys[0]);
    const lastBounds = getPriorityGroupBounds(keys[keys.length - 1]);
    if (!firstBounds || !lastBounds) return "";
    return firstBounds.start === lastBounds.end ? String(firstBounds.start) : `${firstBounds.start}-${lastBounds.end}`;
  }

  function getCurrentAssignmentsTable() {
    return document.querySelector("table.assignments_grid");
  }

  function clearSearchGroupDecorations(table) {
    const currentTable = table || getCurrentAssignmentsTable();
    if (currentTable) {
      currentTable.querySelectorAll("tbody tr").forEach((row) => {
        row.classList.remove("witch-mow-ar-search-group", "witch-mow-ar-search-group-start", "witch-mow-ar-search-group-end");
      });
      currentTable.querySelectorAll('[data-witch-search-priority="1"]').forEach((cell) => {
        const orig = cell.getAttribute("data-witch-search-original-style");
        if (orig) cell.setAttribute("style", orig); else cell.removeAttribute("style");
        cell.removeAttribute("data-witch-search-original-style");
        cell.removeAttribute("data-witch-search-priority");
      });
    }
    document.querySelectorAll(`[data-role="${SEARCH_GROUP_BADGE_ROLE}"]`).forEach((node) => node.remove());
  }

  function getActiveGroupRange(parsed, groupKeys) {
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    const keySet = new Set(Array.isArray(groupKeys) ? groupKeys.filter(Boolean) : []);
    if (keySet.size === 0) return null;
    const groupIndexes = rows
      .filter((row) => keySet.has(getPriorityGroupKey(row && row.priority)))
      .map((row) => toSafeInt(row && row.sourceIndex))
      .filter((index) => Number.isInteger(index) && index >= 0)
      .sort((l, r) => l - r);
    if (groupIndexes.length === 0) return null;
    return { startIndex: groupIndexes[0], endIndex: groupIndexes[groupIndexes.length - 1] };
  }

  function renderSearchGroupBadge(startRow, rangeLabel) {
    if (!startRow) return;
    const firstCell = startRow.querySelector("td");
    if (!firstCell) return;
    const label = compactText(String(rangeLabel || ""));
    if (!label) return;
    const badge = document.createElement("div");
    badge.setAttribute("data-role", SEARCH_GROUP_BADGE_ROLE);
    badge.textContent = `Шукаю серед ${label}, але під фільтр нічого не підходить`;
    firstCell.appendChild(badge);
  }

  function renderActiveSearchGroup(parsed, cascadeInfo, showSearchState) {
    const table = getCurrentAssignmentsTable();
    clearSearchGroupDecorations(table);
    if (!table || !state.enabled || state.locked || !showSearchState) return;
    const schema = readAssignmentsTableSchema(document);
    const priorityCellIndex = schema && schema.valid && schema.headerIndex ? toSafeInt(schema.headerIndex.priority) : -1;
    const activeGroupKeys = cascadeInfo && Array.isArray(cascadeInfo.activeGroupKeys) ? cascadeInfo.activeGroupKeys.filter(Boolean) : [];
    const activeRangeLabel = cascadeInfo && cascadeInfo.activeRangeLabel ? compactText(String(cascadeInfo.activeRangeLabel || "")) : "";
    if (activeGroupKeys.length === 0) return;
    const range = getActiveGroupRange(parsed, activeGroupKeys);
    if (!range) return;
    const domRows = Array.from(table.querySelectorAll("tbody tr"));
    const startRow = domRows[range.startIndex];
    const endRow = domRows[range.endIndex];
    if (!startRow || !endRow) return;
    for (let index = range.startIndex; index <= range.endIndex; index += 1) {
      const row = domRows[index];
      if (row) {
        if (priorityCellIndex >= 0 && priorityCellIndex < row.cells.length) {
          const priorityCell = row.cells[priorityCellIndex];
          if (priorityCell) {
            const currentInlineStyle = priorityCell.getAttribute("style") || "";
            priorityCell.setAttribute("data-witch-search-original-style", currentInlineStyle);
            priorityCell.setAttribute("data-witch-search-priority", "1");
            const computedStyle = window.getComputedStyle(priorityCell);
            const backgroundColor = String(computedStyle.backgroundColor || "").trim();
            if (backgroundColor && backgroundColor !== "transparent" && backgroundColor !== "rgba(0, 0, 0, 0)") {
              priorityCell.style.setProperty("background-color", backgroundColor, "important");
            }
            priorityCell.style.setProperty("box-shadow", "none", "important");
          }
        }
        row.classList.add("witch-mow-ar-search-group");
      }
    }
    startRow.classList.add("witch-mow-ar-search-group-start");
    endRow.classList.add("witch-mow-ar-search-group-end");
    renderSearchGroupBadge(startRow, activeRangeLabel || getPriorityGroupRangeLabel(activeGroupKeys));
  }

  function createEmptyCascadeInfo(rows) {
    return { activeGroupKey: "", activeGroupKeys: [], activeRangeLabel: "", presentGroups: getPresentPriorityGroups(rows), status: "", wait: "" };
  }

  function syncAssignmentsVisualState(parsed, cascadeInfo, showSearchState) {
    ensureVisualStateStyles();
    if (!state.visualHighlightEnabled) { clearSearchGroupDecorations(getCurrentAssignmentsTable()); return; }
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    const nextCascadeInfo = cascadeInfo && typeof cascadeInfo === "object" ? cascadeInfo : createEmptyCascadeInfo(rows);
    renderActiveSearchGroup(parsed, nextCascadeInfo, Boolean(showSearchState));
  }

  function readLocalStorageJson(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (_err) { return null; }
  }

  function escapeHtml(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function readLoaderMeta() {
    const raw = window[LOADER_META_KEY];
    if (raw && typeof raw === "object") {
      return { version: compactText(String(raw.version || "")), updateUrl: compactText(String(raw.updateUrl || "")) };
    }
    try {
      const stored = localStorage.getItem(LOADER_META_STORAGE_KEY);
      if (!stored) return { version: "", updateUrl: "" };
      const parsed = JSON.parse(stored);
      return {
        version: compactText(String(parsed && parsed.version ? parsed.version : "")),
        updateUrl: compactText(String(parsed && parsed.updateUrl ? parsed.updateUrl : "")),
      };
    } catch (_err) { return { version: "", updateUrl: "" }; }
  }

  function getSafeLoaderUpdateUrl(rawUrl) {
    const fallback = new URL(LOADER_UPDATE_URL, location.href);
    try {
      const candidate = new URL(String(rawUrl || ""), location.href);
      if (candidate.protocol !== "https:") return fallback.toString();
      if (candidate.host !== fallback.host) return fallback.toString();
      return candidate.toString();
    } catch (_err) { return fallback.toString(); }
  }

  function getLoaderUpdateNotice() {
    const meta = readLoaderMeta();
    if (meta.version === EXPECTED_LOADER_VERSION) return null;
    return { currentVersion: meta.version || "невідомо", expectedVersion: EXPECTED_LOADER_VERSION, updateUrl: getSafeLoaderUpdateUrl(meta.updateUrl) };
  }

  function renderLoaderUpdateNotice() {
    if (!loaderNoteEl) return;
    const notice = getLoaderUpdateNotice();
    if (!notice) { loaderNoteEl.style.display = "none"; loaderNoteEl.innerHTML = ""; return; }
    loaderNoteEl.style.display = "block";
    loaderNoteEl.innerHTML = "";
    const title = document.createElement("div");
    title.innerHTML = `<b>Є оновлення.</b> Ваша: <code>${escapeHtml(notice.currentVersion)}</code> • Нова: <code>${escapeHtml(notice.expectedVersion)}</code>`;
    const link = document.createElement("a");
    link.textContent = "Оновити лоадер";
    link.href = notice.updateUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    loaderNoteEl.appendChild(title);
    loaderNoteEl.appendChild(document.createElement("br"));
    loaderNoteEl.appendChild(link);
  }

  function toSafeInt(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function formatDuration(secValue) {
    const sec = Math.max(0, toSafeInt(secValue));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms))); }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const upstreamSignal = options && options.signal;
    if (upstreamSignal && upstreamSignal.aborted) throw new Error("aborted");
    if (typeof AbortController === "undefined") {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => { setTimeout(() => reject(new Error("timeout")), timeoutMs); }),
      ]);
    }
    const controller = new AbortController();
    let timedOut = false, abortedBySignal = false;
    let upstreamAbortHandler = null;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.max(0, timeoutMs));
    if (upstreamSignal && typeof upstreamSignal.addEventListener === "function") {
      upstreamAbortHandler = () => { abortedBySignal = true; controller.abort(); };
      upstreamSignal.addEventListener("abort", upstreamAbortHandler, { once: true });
    }
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error(timedOut ? "timeout" : abortedBySignal ? "aborted" : "timeout");
      throw error;
    } finally {
      clearTimeout(timer);
      if (upstreamSignal && upstreamAbortHandler && typeof upstreamSignal.removeEventListener === "function") {
        upstreamSignal.removeEventListener("abort", upstreamAbortHandler);
      }
    }
  }

  function resetRunMetrics() {
    state.runMetrics = { manualRefreshCount: 0, autoStartCount: 0, autoLockCount: 0, errorCount: 0 };
    state.errorStreak = 0;
    state.lockAttemptInFlight = false;
    state.lastLockAttemptAt = 0;
    state.lastLockAttemptKey = "";
    resetHotRetryState();
  }

  function parseHttpStatusFromError(error) {
    const fromField = Number(error && error.httpStatus);
    if (Number.isFinite(fromField)) return fromField;
    const message = String(error && error.message ? error.message : error || "");
    const match = message.match(/\bHTTP\s+(\d{3})\b/i);
    return match ? Number(match[1]) : 0;
  }

  // ===== Filters And Panel State =====

  function markFiltersReviewed() { state.lastFilterReviewAt = nowMs(); }

  function createDefaultPriorityRules() {
    return { p1: true, p2: true, p3_18: true, p19: true };
  }

  function normalizePriorityRules(rules) {
    const fallback = createDefaultPriorityRules();
    const source = rules && typeof rules === "object" ? rules : {};
    const legacyColor = typeof source.color === "boolean" ? source.color : null;
    return {
      p1: typeof source.p1 === "boolean" ? source.p1 : fallback.p1,
      p2: typeof source.p2 === "boolean" ? source.p2 : fallback.p2,
      p3_18: typeof source.p3_18 === "boolean" ? source.p3_18 : legacyColor !== null ? legacyColor : fallback.p3_18,
      p19: typeof source.p19 === "boolean" ? source.p19 : legacyColor !== null ? legacyColor : fallback.p19,
    };
  }

  function clonePriorityRules(rules) { return normalizePriorityRules(rules); }

  function applyPriorityRulesMigration(rules, migrationVersion) {
    const normalized = normalizePriorityRules(rules);
    const storedVersion = toSafeInt(migrationVersion);
    const next = { ...normalized };
    let changed = storedVersion < PRIORITY_RULES_MIGRATION_VERSION;
    if (storedVersion < PRIORITY_RULES_MIGRATION_VERSION) {
      for (const [ruleKey, forcedValue] of Object.entries(PRIORITY_RULES_MIGRATION_OVERRIDES)) {
        if (typeof forcedValue !== "boolean") continue;
        if (next[ruleKey] !== forcedValue) { next[ruleKey] = forcedValue; changed = true; }
      }
    }
    return { rules: normalizePriorityRules(next), migrationVersion: PRIORITY_RULES_MIGRATION_VERSION, changed };
  }

  function hasCustomPriorityRules() {
    return PRIORITY_RULE_DEFINITIONS.some((item) => !state.priorityRules[item.key]);
  }

  function getPriorityRulesSummary() {
    const disabled = PRIORITY_RULE_DEFINITIONS.filter((item) => !state.priorityRules[item.key]).map((item) => item.summaryLabel);
    return disabled.length > 0 ? `custom(${disabled.join(",")})` : "default";
  }

  function normalizePersistedPrioritySelection(values) {
    if (!Array.isArray(values)) return null;
    const next = Array.from(new Set(values.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 1 && item <= FILTER_MAX))).sort((l, r) => l - r);
    return new Set(next);
  }

  function normalizePersistedKeySelection(values, allowedKeys) {
    if (!Array.isArray(values)) return null;
    const allowed = new Set(Array.isArray(allowedKeys) ? allowedKeys : []);
    const next = Array.from(new Set(values.map((item) => String(item || "").trim()).filter((item) => allowed.has(item))));
    return new Set(next);
  }

  function createDefaultFilterSnapshot() {
    return {
      priorities: Array.from({ length: FILTER_MAX }, (_, index) => index + 1),
      complexities: COMPLEXITY_LEVELS.map((item) => item.key),
      deliverables: DELIVERABLE_FILTERS.map((item) => item.key),
      noComplexityMode: false,
    };
  }

  function cloneFilterSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : createDefaultFilterSnapshot();
    return {
      priorities: Array.isArray(source.priorities) ? source.priorities.slice() : createDefaultFilterSnapshot().priorities,
      complexities: Array.isArray(source.complexities) ? source.complexities.slice() : createDefaultFilterSnapshot().complexities,
      deliverables: Array.isArray(source.deliverables) ? source.deliverables.slice() : createDefaultFilterSnapshot().deliverables,
      noComplexityMode: Boolean(source.noComplexityMode),
    };
  }

  function buildCurrentFilterSnapshot() {
    return {
      priorities: Array.from(state.selectedPriorities.values()).sort((l, r) => l - r),
      complexities: COMPLEXITY_LEVELS.filter((item) => state.selectedComplexities.has(item.key)).map((item) => item.key),
      deliverables: DELIVERABLE_FILTERS.filter((item) => state.selectedDeliverables.has(item.key)).map((item) => item.key),
      noComplexityMode: Boolean(state.noComplexityMode),
    };
  }

  function normalizePersistedFilterSlot(slot) {
    const fallback = createDefaultFilterSnapshot();
    if (!slot || typeof slot !== "object") return fallback;
    const priorities = normalizePersistedPrioritySelection(slot.priorities);
    const complexities = normalizePersistedKeySelection(slot.complexities, COMPLEXITY_LEVELS.map((item) => item.key));
    const deliverables = normalizePersistedKeySelection(slot.deliverables, DELIVERABLE_FILTERS.map((item) => item.key));
    const deliverableValues = deliverables ? Array.from(deliverables.values()) : fallback.deliverables;
    return {
      priorities: priorities ? Array.from(priorities.values()) : fallback.priorities,
      complexities: complexities ? Array.from(complexities.values()) : fallback.complexities,
      deliverables: deliverableValues,
      noComplexityMode: typeof slot.noComplexityMode === "boolean" ? slot.noComplexityMode : fallback.noComplexityMode,
    };
  }

  function saveCurrentFiltersToActiveSlot() {
    state.filterSlots[state.activeFilterSlot] = buildCurrentFilterSnapshot();
  }

  function applyFilterSnapshot(snapshot) {
    const next = normalizePersistedFilterSlot(snapshot);
    state.selectedPriorities = new Set(next.priorities);
    state.selectedComplexities = new Set(next.complexities);
    state.selectedDeliverables = new Set(next.deliverables);
    state.noComplexityMode = Boolean(next.noComplexityMode);
  }

  function getFilterSlotSummary(slotId) { return `Шаблон ${slotId}`; }

  function persistFilterState() {
    saveCurrentFiltersToActiveSlot();
    try {
      const slots = {};
      FILTER_SLOT_IDS.forEach((slotId) => { slots[slotId] = cloneFilterSnapshot(state.filterSlots[slotId]); });
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ activeSlot: state.activeFilterSlot, slots, updatedAt: nowMs() }));
    } catch (_err) { }
  }

  function persistPriorityRules() {
    try { localStorage.setItem(PRIORITY_RULES_STORAGE_KEY, JSON.stringify({ rules: clonePriorityRules(state.priorityRules), migrationVersion: PRIORITY_RULES_MIGRATION_VERSION, updatedAt: nowMs() })); }
    catch (_err) { }
  }

  function restorePersistedFilters() {
    const persisted = readLocalStorageJson(FILTER_STORAGE_KEY);
    FILTER_SLOT_IDS.forEach((slotId) => {
      state.filterSlots[slotId] = normalizePersistedFilterSlot(persisted && persisted.slots ? persisted.slots[slotId] : null);
    });
    if (persisted && typeof persisted.activeSlot === "number" && FILTER_SLOT_IDS.includes(persisted.activeSlot)) {
      state.activeFilterSlot = persisted.activeSlot;
    }
    applyFilterSnapshot(state.filterSlots[state.activeFilterSlot]);
  }

  function restorePersistedPriorityRules() {
    const persisted = readLocalStorageJson(PRIORITY_RULES_STORAGE_KEY);
    const sourceRules = persisted && persisted.rules && typeof persisted.rules === "object" ? persisted.rules : persisted;
    const sourceVersion = persisted && typeof persisted.migrationVersion === "number" ? persisted.migrationVersion : 0;
    const migrated = applyPriorityRulesMigration(sourceRules, sourceVersion);
    state.priorityRules = migrated.rules;
    if (migrated.changed) persistPriorityRules();
  }

  function canStartAutolock(ts) {
    if (state.filterOpen) return true;
    if (!state.lastFilterReviewAt) return false;
    if (!state.lastAutoStartAt) return true;
    if (ts - state.lastAutoStartAt < FILTER_REVIEW_TTL_MS) return true;
    return state.lastFilterReviewAt >= state.lastAutoStartAt;
  }

  function isFilterReviewRequired(ts) {
    if (state.filterOpen) return false;
    if (!state.lastFilterReviewAt) return true;
    if (!state.lastAutoStartAt) return false;
    if (ts - state.lastAutoStartAt < FILTER_REVIEW_TTL_MS) return false;
    return state.lastFilterReviewAt < state.lastAutoStartAt;
  }

  function renderAutoHint(ts) {
    if (!autoHintEl) return;
    const now = ts || nowMs();
    let text = "";
    if (state.maintenance) text = "Чекайте оновлення скрипта";
    else if (state.locked) text = "В лоці: автолок недоступний";
    else if (!state.enabled && isFilterReviewRequired(now)) text = "Перед запуском відкрий фільтри автолоку";
    autoHintEl.textContent = text;
    autoHintEl.style.display = text ? "block" : "none";
  }

  function setAutoOn() { updateAutoButtonLabel(nowMs()); }

  function updateAutoButtonLabel(ts) {
    if (!autoBtnEl) return;
    if (state.maintenance) {
      autoBtnEl.textContent = "Чекайте оновлення"; autoBtnEl.disabled = true;
      autoBtnEl.style.opacity = "0.6"; autoBtnEl.style.cursor = "not-allowed";
      renderAutoHint(ts); return;
    }
    if (state.locked) {
      autoBtnEl.textContent = "В лоці"; autoBtnEl.disabled = true;
      autoBtnEl.style.opacity = "0.6"; autoBtnEl.style.cursor = "not-allowed";
      renderAutoHint(ts); return;
    }
    autoBtnEl.disabled = false; autoBtnEl.style.opacity = "1"; autoBtnEl.style.cursor = "pointer";
    if (state.enabled && state.runStartedAt) {
      autoBtnEl.textContent = `Автолок: ${getRemainingBudgetSec(ts || nowMs())}s`;
      renderAutoHint(ts); return;
    }
    autoBtnEl.textContent = state.stopLabel || "Увімкнути автолок";
    renderAutoHint(ts);
  }

  function setBudget(ts) {
    updateAutoButtonLabel(ts || nowMs());
    if (state.browserIndicatorMode === "run") renderBrowserIndicator();
  }

  function extractFirstInt(text) {
    const match = String(text || "").match(/-?\d+/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : null;
  }

  function compactText(text) { return String(text || "").trim().replace(/\s+/g, " "); }

  function normalizeHeaderLabel(text) { return compactText(text).toLowerCase(); }

  function normalizeLooseKey(text) {
    return normalizeHeaderLabel(text).replace(/[^a-zа-я0-9]+/gi, " ").trim();
  }

  function hashText(text) {
    const source = String(text || "");
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function togglePriority(value) {
    if (state.selectedPriorities.has(value)) state.selectedPriorities.delete(value);
    else state.selectedPriorities.add(value);
  }

  function toggleComplexity(key) {
    if (state.selectedComplexities.has(key)) state.selectedComplexities.delete(key);
    else state.selectedComplexities.add(key);
  }

  function toggleDeliverable(key) {
    if (state.selectedDeliverables.has(key)) state.selectedDeliverables.delete(key);
    else state.selectedDeliverables.add(key);
  }

  function setPriorityFilter(full) {
    state.selectedPriorities.clear();
    if (full) { for (let v = 1; v <= FILTER_MAX; v += 1) state.selectedPriorities.add(v); }
  }

  function setPriorityRange(from, to) {
    state.selectedPriorities.clear();
    for (let v = from; v <= to; v += 1) state.selectedPriorities.add(v);
  }

  function setComplexityFilter(full) {
    state.selectedComplexities.clear();
    if (full) COMPLEXITY_LEVELS.forEach((item) => state.selectedComplexities.add(item.key));
  }

  function setDeliverableFilter(full) {
    state.selectedDeliverables.clear();
    if (full) DELIVERABLE_FILTERS.forEach((item) => state.selectedDeliverables.add(item.key));
  }

  function switchFilterSlot(slotId) {
    const nextSlot = Number(slotId);
    if (!FILTER_SLOT_IDS.includes(nextSlot) || nextSlot === state.activeFilterSlot) return false;
    saveCurrentFiltersToActiveSlot();
    state.activeFilterSlot = nextSlot;
    applyFilterSnapshot(state.filterSlots[nextSlot]);
    persistFilterState();
    return true;
  }

  function parseComplexityKey(text) {
    const value = normalizeLooseKey(text);
    if (!value) return "";
    if (value === "-" || value === "n/a" || value === "na" || value === "none") return "";
    if ((value.includes("complex") || value.includes("склад")) && value.includes("residential")) return "complex_residential";
    if (value.includes("simple") || value.includes("прост")) return "simple";
    if (value.includes("average") || value.includes("avg") || value.includes("серед")) return "average";
    if (value.includes("custom") || value.includes("кастом")) return "custom";
    return "";
  }

  function parseDeliverableKey(text) {
    const value = normalizeLooseKey(text);
    if (!value) return "other";
    if (value.includes("interior floor plan") || value.includes("interior_floor_plan")) return "interior_floor_plan";
    if (value.includes("total living area plus") || value.includes("living area plus") || value.includes("tla plus")) return "total_living_area_plus";
    if (value.includes("fast roof")) return "fast_roof";
    if (value.includes("total living area") || value.includes("living area total") || value.includes("living area")) return "total_living_area";
    if (value.includes("roof")) return "roof";
    if (value.includes("complete")) return "complete";
    return "other";
  }

  function getRefreshChangeLabel(changed) {
    if (changed === "first") return "перше оновлення";
    if (changed === "yes") return "є зміни";
    return "без змін";
  }

  function getFilterSummary() {
    const deliverableSummary = `D ${state.selectedDeliverables.size}/${DELIVERABLE_FILTERS.length}`;
    if (state.noComplexityMode) return `P ${state.selectedPriorities.size}/${FILTER_MAX} • ${deliverableSummary} • Без складності`;
    return `P ${state.selectedPriorities.size}/${FILTER_MAX} • C ${state.selectedComplexities.size}/${COMPLEXITY_LEVELS.length} • ${deliverableSummary}`;
  }

  function formatNumberRanges(values) {
    const sorted = Array.from(new Set(values)).map((item) => Number(item)).filter((item) => Number.isFinite(item)).sort((a, b) => a - b);
    if (sorted.length === 0) return "-";
    const chunks = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
      const cur = sorted[i];
      if (cur === prev + 1) { prev = cur; continue; }
      chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur; prev = cur;
    }
    chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
    return chunks.join(",");
  }

  function getFilterDetails() {
    const priorities = formatNumberRanges(Array.from(state.selectedPriorities.values()));
    const deliverableLabels = DELIVERABLE_FILTERS.filter((item) => state.selectedDeliverables.has(item.key)).map((item) => item.label);
    if (state.noComplexityMode) return `P: ${priorities} | C: без складності | D: ${deliverableLabels.length > 0 ? deliverableLabels.join(",") : "-"} | R: ${getPriorityRulesSummary()}`;
    const complexityLabels = COMPLEXITY_LEVELS.filter((item) => state.selectedComplexities.has(item.key)).map((item) => item.label);
    return `P: ${priorities} | C: ${complexityLabels.length > 0 ? complexityLabels.join(",") : "-"} | D: ${deliverableLabels.length > 0 ? deliverableLabels.join(",") : "-"} | R: ${getPriorityRulesSummary()}`;
  }

  function setControlsDisabled(disabled) {
    if (!panelEl) return;
    const controls = panelEl.querySelectorAll("button,input,select,textarea");
    controls.forEach((control) => {
      const role = control.getAttribute("data-role") || "";
      if (role === "witch-mow-ar-close") return;
      control.disabled = Boolean(disabled);
      control.style.opacity = disabled ? "0.6" : "1";
      control.style.cursor = disabled ? "not-allowed" : "pointer";
    });
  }

  function renderFilterButtons() {
    if (filterBtnEl) {
      const summary = `${state.activeFilterSlot} • ${getFilterSummary()}`;
      filterBtnEl.innerHTML =
        `<span style="display:block;font-size:12px;font-weight:700;line-height:1.1;">Фільтри автолоку</span>` +
        `<span style="display:block;font-size:10px;font-weight:600;line-height:1.1;opacity:.92;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${summary}</span>`;
    }
    if (filterMetaEl) filterMetaEl.textContent = `${getFilterSlotSummary(state.activeFilterSlot)} • ${getFilterSummary()}`;
    renderPriorityRulesButton();
    renderAutoHint(nowMs());
  }

  function renderPriorityRulesButton() {
    if (!priorityRulesBtnEl) return;
    const hasOverrides = hasCustomPriorityRules();
    const suffix = hasOverrides ? " !" : "";
    priorityRulesBtnEl.textContent = `Додаткові правила${suffix}`;
    priorityRulesBtnEl.style.borderColor = hasOverrides ? "#d97706" : "#bfd0ff";
    priorityRulesBtnEl.style.background = hasOverrides ? "#fff7ed" : "#eef4ff";
    priorityRulesBtnEl.style.color = hasOverrides ? "#9a3412" : "#24438a";
  }

  function renderPriorityRulesPanel() {
    if (!priorityRulesPanelEl) return;
    priorityRulesPanelEl.style.display = state.priorityRulesOpen ? "block" : "none";
    const inputs = priorityRulesPanelEl.querySelectorAll('[data-role="witch-mow-ar-priority-rule"]');
    inputs.forEach((input) => {
      const ruleKey = input.getAttribute("data-rule") || "";
      input.checked = Boolean(state.priorityRules[ruleKey]);
    });
  }

  function renderFilterSlotButtons() {
    if (!filterSlotsEl) return;
    filterSlotsEl.innerHTML = FILTER_SLOT_IDS.map((slotId) => {
      const active = slotId === state.activeFilterSlot;
      const style = active ? "background:#d92d20;color:#fff;" : "background:transparent;color:#fff;opacity:.82;";
      return `<button type="button" data-role="witch-mow-ar-filter-slot" data-slot="${slotId}" style="min-width:34px;border:0;background:transparent;color:inherit;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;${style}">${slotId}</button>`;
    }).join("");
  }

  function renderFilterGrid(targetEl, kind) {
    if (!targetEl) return;
    if (kind === "priority") {
      targetEl.innerHTML = Array.from({ length: FILTER_MAX }, (_, index) => {
        const value = index + 1;
        const on = state.selectedPriorities.has(value);
        const style = on ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;" : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
        return `<button type="button" data-role="witch-mow-ar-chip" data-kind="priority" data-value="${value}" style="height:24px;border:1px solid;border-radius:6px;font-size:11px;cursor:pointer;${style}">${value}</button>`;
      }).join("");
      return;
    }
    if (kind === "complexity") {
      targetEl.innerHTML = COMPLEXITY_LEVELS.map((item) => {
        const on = state.selectedComplexities.has(item.key);
        const style = on ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;" : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
        const disabledAttr = state.noComplexityMode ? "disabled" : "";
        const disabledStyle = state.noComplexityMode ? "opacity:.45;cursor:not-allowed;" : "";
        return `<button type="button" ${disabledAttr} data-role="witch-mow-ar-chip" data-kind="complexity" data-value="${item.key}" style="min-height:28px;padding:4px 3px;border:1px solid;border-radius:6px;font-size:10px;line-height:1.1;white-space:normal;${style}${disabledStyle}">${item.label}</button>`;
      }).join("");
      return;
    }
    if (kind !== "deliverable") return;
    targetEl.innerHTML = DELIVERABLE_FILTERS.map((item) => {
      const on = state.selectedDeliverables.has(item.key);
      const style = on ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;" : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
      return `<button type="button" data-role="witch-mow-ar-chip" data-kind="deliverable" data-value="${item.key}" style="min-height:28px;padding:3px 4px;border:1px solid;border-radius:6px;font-size:10px;line-height:1.1;cursor:pointer;white-space:normal;word-break:break-word;${style}">${item.label}</button>`;
    }).join("");
  }

  function renderFilterPanel() {
    if (!filterPanelEl) return;
    filterPanelEl.style.display = state.filterOpen ? "block" : "none";
    renderPriorityRulesPanel();
    if (noComplexityEl) noComplexityEl.checked = state.noComplexityMode;
    if (lidarSeparateEl) lidarSeparateEl.checked = state.lidarSeparate;
    renderFilterSlotButtons();
    renderFilterGrid(prioritiesGridEl, "priority");
    renderFilterGrid(complexitiesGridEl, "complexity");
    renderFilterGrid(deliverablesGridEl, "deliverable");
    const disableComplexity = state.noComplexityMode;
    const compPresetButtons = filterPanelEl.querySelectorAll('[data-role="witch-mow-ar-comp-all"],[data-role="witch-mow-ar-comp-none"]');
    compPresetButtons.forEach((button) => {
      button.disabled = disableComplexity;
      button.style.opacity = disableComplexity ? "0.45" : "1";
      button.style.cursor = disableComplexity ? "not-allowed" : "pointer";
    });
    renderFilterButtons();
  }

  function renderIgnorePanel() {
    if (!ignoreMenuEl) return;
    ignoreMenuEl.style.display = state.ignoreOpen ? "block" : "none";
    ignoreIdEls.forEach((input, i) => {
      if (input) input.value = state.ignoreIds[i] || "";
    });
  }

  // ===== DOM Parsing =====

  function enterMaintenanceMode(reason) {
    state.maintenance = false;
    state.maintenanceReason = reason || "critical";
    if (state.enabled || state.startPending || state.busy) {
      stopAuto("Автолок зупинено через критичну помилку", "Зупинено", "Критична помилка: можна запустити ще раз", "error", "critical_dom_change");
    } else {
      clearTimer();
      clearManualWaitTimer();
      state.pendingManualRefresh = false;
      cancelActiveLockAttempt();
      state.backgroundStopFallback = false;
      releaseAutolockRunLock();
      setControlsDisabled(false);
      state.stopLabel = "Увімкнути автолок";
      setAutoOn();
      setBudget(nowMs());
      setBrowserIndicator("stop");
      setStatus("Критична помилка: автолок зупинено", "error");
      setAction("Можна запустити ще раз", "warn");
      updateAutoButtonLabel(nowMs());
    }
    console.error("[Smart bookmarklet] critical mode:", state.maintenanceReason);
  }

  function isCriticalError(error) {
    const message = String(error && error.message ? error.message : error).toLowerCase();
    return message.includes("critical:");
  }

  function readAssignmentsTableSchema(doc) {
    const table = doc.querySelector("table.assignments_grid");
    if (!table) return { valid: false, reason: "assignments_grid not found", table: null, headerIndex: null };
    const headers = Array.from(table.querySelectorAll("thead th")).map((cell) => normalizeHeaderLabel(cell.textContent || ""));
    if (headers.length === 0) return { valid: false, reason: "assignments_grid header row is empty", table, headerIndex: null };
    const headerIndex = {}, headerCounts = {};
    headers.forEach((header, index) => {
      if (!header) return;
      headerCounts[header] = toSafeInt(headerCounts[header]) + 1;
      if (!Object.prototype.hasOwnProperty.call(headerIndex, header)) headerIndex[header] = index;
    });
    for (const header of ASSIGNMENTS_REQUIRED_HEADERS) {
      const count = toSafeInt(headerCounts[header]);
      if (count <= 0) return { valid: false, reason: `assignments_grid missing required header "${header}"`, table, headerIndex: null };
      if (count > 1) return { valid: false, reason: `assignments_grid duplicate required header "${header}" (${count})`, table, headerIndex: null };
    }
    return { valid: true, reason: "", table, headerIndex, columnCount: headers.length };
  }

  function getTableCellText(cells, schema, headerName) {
    const index = schema && schema.headerIndex ? schema.headerIndex[headerName] : -1;
    if (!Number.isInteger(index) || index < 0 || index >= cells.length) return "";
    return compactText(cells[index].textContent || "");
  }

  function parseLockInfoFromDoc(doc) {
    const lockNavByIcon = doc.querySelector(".waiting-orders-nav .lock .fa-lock")?.closest(".waiting-orders-nav");
    let lockNavByOrder = null;
    if (!lockNavByIcon) {
      lockNavByOrder = Array.from(doc.querySelectorAll(".waiting-orders-nav")).find((node) => {
        const countText = (node.querySelector(".count")?.textContent || "").trim().replace(/\s+/g, " ");
        return /Order\s+\d+/i.test(countText);
      });
    }
    const nav = lockNavByIcon || lockNavByOrder;
    if (!nav) return { locked: false, orderId: "", text: "" };
    const countText = (nav?.querySelector(".count")?.textContent || "").trim().replace(/\s+/g, " ");
    const text = (nav?.querySelector(".text")?.textContent || "").trim().replace(/\s+/g, " ");
    const orderId = extractOrderIdFromLockText(countText, text);
    return { locked: true, orderId, text: text || countText || "locked" };
  }

  function setLockInfo(lockInfo) {
    state.locked = Boolean(lockInfo && lockInfo.locked);
    if (!lockNoticeEl) return;
    if (lockInfo.locked) {
      const details = lockInfo.orderId ? `Order ${lockInfo.orderId}` : lockInfo.text;
      lockNoticeEl.style.display = "block";
      lockNoticeEl.replaceChildren();
      lockNoticeEl.append("В лоці (");
      if (lockInfo.orderId) {
        const link = document.createElement("a");
        link.href = `https://manowar.hover.to/orders/${encodeURIComponent(String(lockInfo.orderId ?? ""))}`;
        link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = `Order ${lockInfo.orderId}`;
        link.style.color = "inherit"; link.style.fontWeight = "700"; link.style.textDecoration = "underline";
        lockNoticeEl.appendChild(link);
      } else { lockNoticeEl.append(details); }
      lockNoticeEl.append(") — автолок недоступний");
      if (state.enabled) {
        stopAuto("Автолок зупинено: ви в лоці", "Зупинено", "Стоп: ви зараз у лоці", "warn", "locked", { orderId: lockInfo.orderId || "" });
      } else { setAction("В лоці: автолок недоступний", "warn"); updateAutoButtonLabel(nowMs()); setBrowserIndicator("lock"); }
      return;
    }
    lockNoticeEl.style.display = "none"; lockNoticeEl.replaceChildren();
    updateAutoButtonLabel(nowMs());
    if (!state.enabled && !state.maintenance) setBrowserIndicator("idle");
  }

  function parseActionCell(actionCell) {
    if (!actionCell) return { actionText: "", actionHref: "", invalidReason: "action_cell_missing" };
    const actionCandidates = Array.from(
      actionCell.querySelectorAll("a[href],button[formaction],button[data-href],input[type='submit'][formaction]")
    ).map((element) => {
      const text = compactText(element.tagName === "INPUT" ? element.getAttribute("value") || "" : element.textContent || "");
      const href = element.getAttribute("href") || element.getAttribute("formaction") || element.getAttribute("data-href") || "";
      return { actionText: text, actionHref: compactText(href) };
    }).filter((c) => c.actionHref);
    const uniqueCandidates = Array.from(
      actionCandidates.reduce((acc, c) => {
        const cur = acc.get(c.actionHref);
        if (!cur || c.actionText.length > cur.actionText.length) acc.set(c.actionHref, c);
        return acc;
      }, new Map()).values()
    );
    if (uniqueCandidates.length !== 1) return { actionText: "", actionHref: "", invalidReason: uniqueCandidates.length === 0 ? "action_missing" : "action_ambiguous" };
    return { actionText: uniqueCandidates[0].actionText, actionHref: uniqueCandidates[0].actionHref, invalidReason: "" };
  }

  function parseRowsFromDoc(doc) {
    const schema = readAssignmentsTableSchema(doc);
    if (!schema.valid) {
      return { fingerprint: "", rows: [], invalidRows: 0, totalRows: 0, schemaValid: false, schemaReason: schema.reason || "assignments_grid schema mismatch" };
    }
    const rows = Array.from(schema.table.querySelectorAll("tbody tr"));
    const fingerprintParts = [], parsedRows = [], invalidRowIndexes = [];
    let invalidRows = 0;
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length !== schema.columnCount) { invalidRows++; invalidRowIndexes.push(rowIndex); return; }
      const idCell = cells[schema.headerIndex.id];
      const actionCell = cells[schema.headerIndex.action];
      const idLink = idCell ? idCell.querySelector("a") : null;
      const id = compactText(idLink ? idLink.textContent : getTableCellText(cells, schema, "id"));
      const assignmentState = getTableCellText(cells, schema, "state");
      const priorityText = getTableCellText(cells, schema, "priority");
      const rawComplexityText = getTableCellText(cells, schema, "complexity");
      const rawDeliverableText = getTableCellText(cells, schema, "deliverable");
      const complexityText = rawComplexityText || "-";
      const deliverableText = rawDeliverableText || "-";
      const complexityMissing = !rawComplexityText || rawComplexityText === "-" || rawComplexityText.toLowerCase() === "n/a" || rawComplexityText.toLowerCase() === "na";
      const priority = extractFirstInt(priorityText);
      const complexityKey = parseComplexityKey(rawComplexityText);
      const deliverableKey = parseDeliverableKey(rawDeliverableText);
      const action = parseActionCell(actionCell);
      if (!complexityMissing && !complexityKey) { invalidRows++; invalidRowIndexes.push(rowIndex); return; }
      if (!id || !assignmentState || !Number.isFinite(priority) || !action.actionHref || action.invalidReason) { invalidRows++; invalidRowIndexes.push(rowIndex); return; }
      fingerprintParts.push(`${id}|${assignmentState}|${priorityText}|${complexityText}|${deliverableText}`);
      parsedRows.push({
        sourceIndex: rowIndex, id: id || "-", assignmentState: assignmentState || "-",
        priorityText: priorityText || "-", complexityText: complexityText || "-",
        deliverableText, complexityMissing, priority, complexityKey, deliverableKey,
        actionText: action.actionText, actionHref: action.actionHref,
      });
    });
    const totalRows = rows.length;
    const invalidMajority = totalRows > 0 && invalidRows >= Math.ceil(totalRows / 2);
    const schemaValid = !(totalRows > 0 && parsedRows.length === 0) && !invalidMajority;
    const schemaReason = schemaValid ? "" : `assignments_grid row mismatch (${parsedRows.length} valid / ${invalidRows} invalid / ${totalRows} total)`;
    return { fingerprint: fingerprintParts.join("||"), rows: parsedRows, invalidRows, totalRows, invalidRowIndexes, schemaValid, schemaReason };
  }

  function parseRowsFromCurrentTable() {
    const doc = document.implementation.createHTMLDocument("");
    const table = document.querySelector("table.assignments_grid");
    if (!table) return { fingerprint: "", rows: [], invalidRows: 0, totalRows: 0, schemaValid: false, schemaReason: "assignments_grid not found" };
    doc.body.appendChild(table.cloneNode(true));
    return parseRowsFromDoc(doc);
  }

  function getPriorityGroupKey(priority) {
    const value = Number(priority);
    if (value === 1) return "p1";
    if (value === 2) return "p2";
    if (value >= 3 && value <= 18) return "p3_18";
    if (value === 19) return "p19";
    if (value === 20) return "sneaky";
    return "";
  }

  function getPresentPriorityGroups(rows) {
    const present = { p1: false, p2: false, p3_18: false, p19: false, sneaky: false };
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) { const gk = getPriorityGroupKey(row && row.priority); if (gk) present[gk] = true; }
    return present;
  }

  const PRIORITY_GROUP_SEQUENCE = [
    { key: "p1", ruleKey: "p1" },
    { key: "p2", ruleKey: "p2" },
    { key: "p3_18", ruleKey: "p3_18" },
    { key: "p19", ruleKey: "p19" },
    { key: "sneaky", ruleKey: null },
  ];

  function getPriorityClusterRows(rows, groupKeys) {
    const list = Array.isArray(rows) ? rows : [];
    const keySet = new Set(Array.isArray(groupKeys) ? groupKeys.filter(Boolean) : []);
    if (keySet.size === 0) return [];
    return list.filter((row) => keySet.has(getPriorityGroupKey(row && row.priority)));
  }

  // ===== Lidar Separate Logic =====

  function hasLidarRowsInCluster(clusterRows) {
    return clusterRows.some((row) => {
      const s = String(row.assignmentState || "").toLowerCase();
      return s === "waiting_lidar_interior_modeling";
    });
  }

  function isRowMatchedByNonPriorityFilters(row) {
    if (!state.selectedDeliverables.has(row.deliverableKey || "other")) return false;
    if (state.noComplexityMode) return Boolean(row.complexityMissing);
    if (!row.complexityKey) return false;
    return state.selectedComplexities.has(row.complexityKey);
  }

  function isRowMatchedWithinPriorityCluster(row, groupKeys) {
    const keySet = new Set(Array.isArray(groupKeys) ? groupKeys.filter(Boolean) : []);
    if (!keySet.has(getPriorityGroupKey(row && row.priority))) return false;
    if (!Number.isFinite(row && row.priority)) return false;
    if (!state.selectedPriorities.has(row.priority)) return false;
    // Lidar separate filter
    if (state.lidarSeparate) {
      const s = String(row.assignmentState || "").toLowerCase();
      if (s === "waiting_lidar_interior_modeling") return false;
    }
    // Ignore IDs
    const ignoreSet = getIgnoreIdSet();
    if (ignoreSet.size > 0 && ignoreSet.has(compactText(String(row.id || "")))) return false;
    return isRowMatchedByNonPriorityFilters(row);
  }

  function buildPriorityClusters() {
    const clusters = [];
    let currentCluster = [];
    for (let index = 0; index < PRIORITY_GROUP_SEQUENCE.length; index += 1) {
      const group = PRIORITY_GROUP_SEQUENCE[index];
      currentCluster.push(group.key);
      const boundaryClosed = group.ruleKey ? Boolean(state.priorityRules[group.ruleKey]) : true;
      if (boundaryClosed || index === PRIORITY_GROUP_SEQUENCE.length - 1) {
        clusters.push({ keys: currentCluster.slice(), rangeLabel: getPriorityGroupRangeLabel(currentCluster) });
        currentCluster = [];
      }
    }
    return clusters;
  }

  function buildPriorityCascadeMessages(rangeLabel) {
    const label = compactText(String(rangeLabel || ""));
    if (!label) return { status: "", wait: "" };
    return { status: `Шукаю серед ${label}`, wait: `Шукаю серед ${label}, але під тип/складність нічого не підходить, чекаю` };
  }

  /**
   * Returns cascade result.
   * Extra: if lidarSeparate is on and there are lidar rows in the matching cluster,
   * return a special wait message.
   */
  function getPriorityCascadeResult(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const present = getPresentPriorityGroups(list);
    const clusters = buildPriorityClusters();

    for (const cluster of clusters) {
      const clusterRows = getPriorityClusterRows(list, cluster.keys);
      if (clusterRows.length === 0) continue;

      // Lidar-separate: if enabled and lidar rows exist in this cluster, block and wait
      if (state.lidarSeparate && hasLidarRowsInCluster(clusterRows)) {
        return {
          row: null,
          cascadeInfo: {
            activeGroupKey: cluster.keys.length === 1 ? cluster.keys[0] : "",
            activeGroupKeys: cluster.keys.slice(),
            activeRangeLabel: cluster.rangeLabel,
            presentGroups: present,
            status: `Є лідари в групі ${cluster.rangeLabel} — чекаю поки зникнуть`,
            wait: `Є лідари в групі ${cluster.rangeLabel} — чекаю поки зникнуть`,
            lidarBlocked: true,
          },
        };
      }

      const matchedRow = clusterRows.find((row) => isRowMatchedWithinPriorityCluster(row, cluster.keys)) || null;
      const messages = buildPriorityCascadeMessages(cluster.rangeLabel);
      if (matchedRow) {
        return {
          row: matchedRow,
          cascadeInfo: {
            activeGroupKey: cluster.keys.length === 1 ? cluster.keys[0] : "",
            activeGroupKeys: cluster.keys.slice(),
            activeRangeLabel: cluster.rangeLabel,
            presentGroups: present,
            status: messages.status,
            wait: "",
          },
        };
      }
      return {
        row: null,
        cascadeInfo: {
          activeGroupKey: cluster.keys.length === 1 ? cluster.keys[0] : "",
          activeGroupKeys: cluster.keys.slice(),
          activeRangeLabel: cluster.rangeLabel,
          presentGroups: present,
          status: messages.status,
          wait: messages.wait,
        },
      };
    }

    return { row: null, cascadeInfo: createEmptyCascadeInfo(list) };
  }

  function getTopMatchedRow(parsed) {
    const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    return getPriorityCascadeResult(rows);
  }

  function getBlockingInvalidRowCount(parsed, candidate) {
    const invalidIndexes = parsed && Array.isArray(parsed.invalidRowIndexes) ? parsed.invalidRowIndexes : [];
    const candidateIndex = toSafeInt(candidate && candidate.sourceIndex);
    if (!candidate || candidateIndex < 0) return 0;
    return invalidIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < candidateIndex).length;
  }

  function resolveSafeActionUrl(row, rawHref) {
    try {
      const url = new URL(String(rawHref || ""), location.href);
      const isHttp = url.protocol === "http:" || url.protocol === "https:";
      if (!isHttp) return "";
      if (url.origin !== location.origin) return "";
      const pathMatch = url.pathname.match(ASSIGNMENT_ACTION_PATH_RE);
      if (!pathMatch) return "";
      const pathOrderId = compactText(String(pathMatch[1] || ""));
      const expectedOrderId = compactText(String(row && row.id ? row.id : ""));
      if (!pathOrderId || !expectedOrderId || pathOrderId !== expectedOrderId) return "";
      const expectedState = compactText(String(row && row.assignmentState ? row.assignmentState : "")).replace(/^waiting_/i, "").toLowerCase();
      const keyCounts = {};
      for (const key of url.searchParams.keys()) {
        if (!ASSIGNMENT_ACTION_ALLOWED_QUERY_KEYS.has(key)) return "";
        keyCounts[key] = toSafeInt(keyCounts[key]) + 1;
      }
      if (toSafeInt(keyCounts.state) !== 1 || toSafeInt(keyCounts.triggered_from) !== 1 || toSafeInt(keyCounts.timestamp) !== 1 || toSafeInt(keyCounts.signature) !== 1) return "";
      const stateParam = compactText(url.searchParams.get("state") || "").toLowerCase();
      if (!expectedState || !stateParam || stateParam !== expectedState) return "";
      if (compactText(url.searchParams.get("triggered_from") || "") !== ASSIGNMENT_ACTION_ALLOWED_TRIGGER) return "";
      if (!compactText(url.searchParams.get("timestamp") || "")) return "";
      if (!compactText(url.searchParams.get("signature") || "")) return "";
      return url.toString();
    } catch (_err) { return ""; }
  }

  // ===== Multi-Click for Custom Interior =====

  /**
   * Gets all custom Interior floor plan rows that pass filters (except the ignore set filter
   * is still respected) from parsed data.
   */
  function getCustomInteriorCandidates(parsed) {
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    const ignoreSet = getIgnoreIdSet();
    return rows.filter((row) => {
      if (row.deliverableKey !== "interior_floor_plan") return false;
      if (row.complexityKey !== "custom") return false;
      if (!state.selectedDeliverables.has("interior_floor_plan")) return false;
      if (!state.selectedComplexities.has("custom") && !state.noComplexityMode) return false;
      if (!state.selectedPriorities.has(row.priority)) return false;
      if (ignoreSet.size > 0 && ignoreSet.has(compactText(String(row.id || "")))) return false;
      if (state.lidarSeparate) {
        const s = String(row.assignmentState || "").toLowerCase();
        if (s === "waiting_lidar_interior_modeling") return false;
      }
      return true;
    });
  }

  async function multiClickCustomInterior(parsed) {
    const candidates = getCustomInteriorCandidates(parsed);
    if (candidates.length <= 1) return false; // handled by normal flow

    setStatus(`Мульти-клік: ${candidates.length} custom Interior`, "ok");
    setAction(`Натискаю по ${candidates.length} замовленнях по черзі`, "ok");

    for (const row of candidates) {
      if (!state.enabled) break;
      const targetUrl = resolveSafeActionUrl(row, row.actionHref);
      if (!targetUrl) continue;
      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const response = await fetchWithTimeout(targetUrl, {
          method: "GET", credentials: "include", cache: "no-cache", redirect: "follow",
          signal: controller ? controller.signal : undefined,
        }, REMOTE_FETCH_TIMEOUT_MS);
        if (response.ok) {
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const lockInfo = parseLockInfoFromDoc(doc);
          const lockedByThis = lockInfo.locked && lockInfo.orderId && String(lockInfo.orderId) === String(row.id);
          if (lockedByThis) {
            state.runMetrics.autoLockCount += 1;
            state.lastLockOrderId = String(row.id);
            try {
              const opened = window.open(targetUrl, "_blank", "noopener");
              if (opened) { try { opened.opener = null; } catch (_e) { } }
            } catch (_e) { }
            stopAuto("Автолок зупинено: лок підтверджено", "Зупинено", `Стоп: лок ${row.id}`, "ok", "lock_opened", { orderId: String(row.id) });
            return true;
          }
        }
      } catch (_err) { /* continue to next */ }
      await sleep(100);
    }
    return false;
  }

  // ===== Lock Action =====

  async function attemptLockByBackgroundRequest(row, targetUrl, shortTarget) {
    if (state.lockAttemptInFlight || !state.enabled) return;
    state.lockAttemptInFlight = true;
    const orderId = String(row && row.id ? row.id : "");
    const runIdAtStart = String(state.runId || "");
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    state.lockAttemptController = controller;
    state.lockAttemptRunId = runIdAtStart;
    try {
      setStatus(`Автолок: фонова спроба ${orderId || "-"}`, "ok");
      setAction(`Фонова спроба lock для ${orderId || "-"}`, "warn");
      const response = await fetchWithTimeout(targetUrl, {
        method: "GET", credentials: "include", cache: "no-cache", redirect: "follow",
        signal: controller ? controller.signal : undefined,
      }, REMOTE_FETCH_TIMEOUT_MS);
      if (!response.ok) { const err = new Error(`HTTP ${response.status}`); err.httpStatus = response.status; throw err; }
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const lockInfo = parseLockInfoFromDoc(doc);
      const lockedByThisAttempt = Boolean(lockInfo && lockInfo.locked) && Boolean(lockInfo.orderId) && Boolean(orderId) && String(lockInfo.orderId) === String(orderId);
      const lockedByOtherAttempt = lockInfo.locked && (!lockInfo.orderId || !orderId || lockInfo.orderId !== orderId);
      const isCurrentRun = Boolean(state.enabled) && Boolean(runIdAtStart) && String(state.runId || "") === runIdAtStart && (!controller || state.lockAttemptController === controller);
      if (!isCurrentRun) return;
      if (lockedByThisAttempt) {
        resetHotRetryState();
        state.runMetrics.autoLockCount += 1;
        state.lastLockOrderId = String(lockInfo.orderId || orderId || "");
        try {
          const opened = window.open(targetUrl, "_blank", "noopener");
          if (opened) { try { opened.opener = null; } catch (_err) { } }
        } catch (_err) { }
        stopAuto("Автолок зупинено: лок підтверджено (фон)", "Зупинено", `Стоп: лок ${orderId || "-"}`, "ok", "lock_opened", { orderId: String(lockInfo.orderId || orderId || "") });
        return;
      }
      if (lockedByOtherAttempt) {
        resetHotRetryState();
        setStatus("Автолок: ордер уже в лоці, шукаю далі", "warn");
        setAction(`Ордер ${orderId || "-"} уже взяв хтось інший`, "warn");
        return;
      }
      const scheduled = scheduleHotRetry(orderId);
      if (scheduled) { setStatus("Автолок: lock не підтверджено, пробую ще раз", "warn"); setAction(`Lock не підтверджено для ${orderId || "-"}, hot retry`, "warn"); }
      else { resetHotRetryState(); setStatus("Автолок: lock не підтверджено, чекаю наступний цикл", "warn"); setAction(`Lock не підтверджено для ${orderId || "-"}`, "warn"); }
    } catch (err) {
      if (String(err && err.message ? err.message : err || "") === "aborted") return;
      state.runMetrics.errorCount += 1;
      const httpStatus = parseHttpStatusFromError(err);
      const scheduled = scheduleHotRetry(orderId);
      if (scheduled) { setStatus(`Автолок: помилка lock-запиту (${httpStatus || "network"}), швидко пробую ще`, "warn"); }
      else { resetHotRetryState(); setStatus(`Автолок: помилка lock-запиту (${httpStatus || "network"})`, "error"); }
      console.error("[Smart bookmarklet] background lock failed:", err);
    } finally {
      if (!controller || state.lockAttemptController === controller) state.lockAttemptController = null;
      if (state.lockAttemptRunId === runIdAtStart) state.lockAttemptRunId = "";
      if (!state.lockAttemptController && !state.lockAttemptRunId) state.lockAttemptInFlight = false;
    }
  }

  function runAutoLockAction(parsed) {
    renderFilterButtons();
    if (!state.enabled) return;
    if (state.lockAttemptInFlight) return;
    if (state.locked) return;

    const match = getTopMatchedRow(parsed);
    const top = match && match.row ? match.row : null;
    const cascadeInfo = match && match.cascadeInfo ? match.cascadeInfo : createEmptyCascadeInfo(parsed && parsed.rows);
    syncAssignmentsVisualState(parsed, cascadeInfo, Boolean(state.dryRunEnabled) || (!top && Boolean(cascadeInfo.wait)));

    if (!top) {
      resetHotRetryState();
      if (cascadeInfo.lidarBlocked) {
        setStatus(cascadeInfo.wait, "warn");
        setAction(cascadeInfo.status, "warn");
      } else if (cascadeInfo.wait) {
        setStatus(cascadeInfo.wait, "warn");
        setAction(cascadeInfo.status || "Автолок: чекаю кандидатів у дозволеній групі", "warn");
      } else {
        setStatus("Автолок: немає рядків під фільтр", "warn");
        setAction("Автолок: немає кандидатів під фільтр", "warn");
      }
      return;
    }

    const blockingInvalidRowCount = getBlockingInvalidRowCount(parsed, top);
    if (blockingInvalidRowCount > 0) {
      resetHotRetryState();
      setStatus("Автолок: пропуск циклу через биті рядки вище кандидата", "warn");
      setAction(`Автолок: ${blockingInvalidRowCount} битих рядків вище ${top.id}`, "warn");
      return;
    }

    const targetText = top.actionHref || top.actionText || "(кнопку дії не знайдено)";
    if (!top.actionHref) {
      resetHotRetryState();
      setStatus("Автолок: не знайдено посилання дії", "warn");
      setAction(`Автолок: немає посилання для ${top.id}`, "warn");
      return;
    }
    const targetUrl = resolveSafeActionUrl(top, top.actionHref);
    if (!targetUrl) {
      state.runMetrics.errorCount += 1;
      setStatus("Автолок: небезпечне посилання дії", "error");
      setAction(`Автолок: unsafe action URL для ${top.id}`, "error");
      stopAuto("Автолок зупинено: unsafe action URL", "Зупинено", `Стоп: unsafe action URL для ${top.id}`, "error", "unsafe_action_url", { orderId: String(top.id || "") });
      return;
    }

    if (state.hotRetryOrderId && state.hotRetryOrderId !== top.id) resetHotRetryState();

    const shortTarget = targetText.length > 96 ? `${targetText.slice(0, 93)}...` : targetText;

    // Multi-click for custom Interior floor plan
    if (top.deliverableKey === "interior_floor_plan" && top.complexityKey === "custom") {
      const customCandidates = getCustomInteriorCandidates(parsed);
      if (customCandidates.length > 1) {
        if (state.dryRunEnabled) {
          resetHotRetryState();
          setStatus(`Dry run: мульти-клік ${customCandidates.length} custom Interior`, "ok");
          setAction(`Dry run: клікнув би по ${customCandidates.length} замовленнях`, "warn");
          return;
        }
        setStatus(`Мульти-клік: ${customCandidates.length} custom Interior`, "ok");
        setAction(`Клікаю по ${customCandidates.length} замовленнях`, "ok");
        void multiClickCustomInterior(parsed);
        return;
      }
    }

    if (state.dryRunEnabled) {
      resetHotRetryState();
      setStatus(`Dry run: знайшов ${top.id}`, "ok");
      setAction(`Dry run: взяв би ${top.id} -> ${shortTarget}`, "warn");
      return;
    }

    setStatus(`Автолок: беру ${top.id}`, "ok");
    setAction(`Автолок: клік по ${top.id}`, "ok");
    void attemptLockByBackgroundRequest(top, targetUrl, shortTarget);
  }

  function replaceAssignmentsTable(doc) {
    const currentTable = document.querySelector("table.assignments_grid");
    const incomingTable = doc.querySelector("table.assignments_grid");
    if (!currentTable || !incomingTable) throw new Error("assignments_grid not found");
    currentTable.replaceWith(incomingTable);
  }

  function hardStop() {
    stopAuto("Автолок зупинено: ліміт 3 хв", "Зупинено", "Стоп: ліміт 3 хв", "warn", "hard_limit_3m");
  }

  function stopAuto(customStatus, label, actionText, tone, reason, extra) {
    const wasEnabled = state.enabled;
    const stopReason = String(reason || "manual");
    state.enabled = false;
    state.startPending = false;
    clearTimer();
    clearManualWaitTimer();
    resetHotRetryState();
    state.pendingManualRefresh = false;
    cancelActiveLockAttempt();
    state.runStartedAt = 0;
    state.backgroundStopFallback = false;
    releaseAutolockRunLock();
    maybeNotifyStop(stopReason, wasEnabled);
    setBrowserIndicator(stopReason === "lock_opened" || stopReason === "locked" ? "lock" : "stop");
    state.stopLabel = label || "Зупинено";
    setAutoOn();
    setBudget(nowMs());
    setStatus(customStatus || "Автолок зупинено", "info");
    setAction(actionText || customStatus || "Автолок зупинено", tone || "info");
    resetRunMetrics();
    state.runId = "";
    syncAssignmentsVisualState(parseRowsFromCurrentTable(), createEmptyCascadeInfo(), false);
  }

  // ===== Autolock Lifecycle =====

  function scheduleAuto() {
    if (!state.enabled) return;
    if (state.maintenance) return;
    const ts = nowMs();
    if (state.locked) { stopAuto("Автолок зупинено: ви в лоці", "Зупинено", "Стоп: ви зараз у лоці", "warn", "locked"); return; }
    if (getRunElapsedMs(ts) >= HARD_STOP_TOTAL_MS) { hardStop(); return; }
    const wait = getNextBaseRefreshDelayMs(ts);
    setAutoOn();
    setBudget(ts);
    setTimer(wait, () => { refreshNow("auto", false); });
  }

  function handleDomMismatchFailure(message, err) {
    state.runMetrics.errorCount += 1;
    state.errorStreak += 1;
    state.domMismatchStreak += 1;
    if (state.domMismatchStreak >= 3) {
      stopAuto("Автолок зупинено: критична DOM-помилка", "Зупинено", `Критична DOM-помилка (${state.domMismatchStreak}/3)`, "error", "critical_dom_change");
      console.error("[Smart bookmarklet] refresh failed (critical dom mismatch):", err || message);
      return true;
    }
    setStatus("DOM mismatch: retry на наступному циклі", "warn");
    setAction(`DOM mismatch (${state.domMismatchStreak}/3)`, "warn");
    console.error("[Smart bookmarklet] refresh failed (dom mismatch):", err || message);
    return true;
  }

  async function refreshNow(trigger, force) {
    if (state.maintenance) return;
    if (!force && !state.enabled) return;
    if (state.busy) {
      if (trigger === "manual") { state.pendingManualRefresh = true; setAction("Ручне оновлення в черзі", "warn"); }
      return;
    }
    const ts = nowMs();
    if (trigger === "manual") {
      const waitMs = getNextBaseRefreshDelayMs(ts);
      if (waitMs > 0) {
        if (!state.manualWaitTimer) {
          state.manualWaitTimer = setTimeout(() => { state.manualWaitTimer = null; refreshNow("manual", force); }, waitMs);
        }
        return;
      }
      clearManualWaitTimer();
    }
    if (trigger !== "manual" && trigger !== "hot_retry" && !force) {
      const waitMs = getNextBaseRefreshDelayMs(ts);
      if (waitMs > 0) { setTimer(waitMs, () => { refreshNow(trigger, false); }); return; }
    }
    if (!force) {
      if (state.locked) { stopAuto("Автолок зупинено: ви в лоці", "Зупинено", "Стоп: ви зараз у лоці", "warn", "locked"); return; }
      if (getRunElapsedMs(ts) >= HARD_STOP_TOTAL_MS) { hardStop(); return; }
    }
    state.busy = true;
    state.lastRequestAt = ts;
    setBudget(ts);
    setStatus(`Refreshing (${trigger})...`, "info");
    if (trigger === "manual") setAction("Ручне оновлення запущено", "info");
    try {
      const response = await fetchWithTimeout(location.href, { method: "GET", credentials: "include", cache: "no-cache" }, REMOTE_FETCH_TIMEOUT_MS);
      if (!response.ok) { const err = new Error(`HTTP ${response.status}`); err.httpStatus = response.status; throw err; }
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const parsed = parseRowsFromDoc(doc);
      if (parsed.schemaValid === false) {
        handleDomMismatchFailure(parsed.schemaReason || "assignments_grid schema mismatch", new Error(parsed.schemaReason));
        return;
      }
      const lockInfo = parseLockInfoFromDoc(doc);
      const currentUserEmail = resolveCurrentUserEmail(doc);
      if (toSafeInt(parsed.invalidRows) > 0) {
        state.invalidRowStreak += 1;
        const invalidMajority = parsed.totalRows > 0 && parsed.invalidRows >= Math.ceil(parsed.totalRows / 2);
        if (invalidMajority) throw new Error(`critical: assignments_grid row mismatch (${toSafeInt(parsed.invalidRows)}/${toSafeInt(parsed.totalRows)})`);
      } else { state.invalidRowStreak = 0; }
      const changed = state.lastFingerprint ? (state.lastFingerprint === parsed.fingerprint ? "no" : "yes") : "first";
      replaceAssignmentsTable(doc);
      const wasEnabledBeforeLockCheck = state.enabled;
      setLockInfo(lockInfo);
      const stoppedByLock = wasEnabledBeforeLockCheck && !state.enabled && Boolean(lockInfo && lockInfo.locked);
      state.lastFingerprint = parsed.fingerprint;
      state.lastUpdatedAt = nowMs();
      state.errorStreak = 0;
      state.domMismatchStreak = 0;
      setLast(state.lastUpdatedAt);
      setUserEmail(currentUserEmail);
      const currentMatch = state.enabled ? getTopMatchedRow(parsed) : null;
      syncAssignmentsVisualState(parsed, currentMatch && currentMatch.cascadeInfo ? currentMatch.cascadeInfo : createEmptyCascadeInfo(parsed && parsed.rows), Boolean(currentMatch && currentMatch.cascadeInfo && currentMatch.cascadeInfo.wait && !(currentMatch && currentMatch.row)));
      if (!stoppedByLock) {
        const refreshLabel = getRefreshChangeLabel(changed);
        setStatus(`Оновлено: ${refreshLabel}`, "ok");
        setAction(`Оновлено: ${refreshLabel}`, "ok");
        runAutoLockAction(parsed);
      }
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      const lowerMessage = String(message || "").toLowerCase();
      if (isCriticalError(err)) { enterMaintenanceMode(message); return; }
      if (lowerMessage.includes("assignments_grid not found")) { handleDomMismatchFailure(message, err); return; }
      const httpStatus = parseHttpStatusFromError(err);
      state.runMetrics.errorCount += 1;
      state.errorStreak += 1;
      state.domMismatchStreak = 0;
      setStatus(`Error: ${message}`, "error");
      setAction(`Помилка: ${message}`, "error");
      console.error("[Smart bookmarklet] refresh failed:", err);
    } finally {
      state.busy = false;
      if (state.pendingManualRefresh) { state.pendingManualRefresh = false; refreshNow("manual", true); return; }
      if (state.enabled) scheduleAuto();
    }
  }

  async function startAuto() {
    if (state.maintenance || state.startPending) return;
    state.startPending = true;
    try {
      const ts = nowMs();
      if (!canStartAutolock(ts)) {
        state.filterOpen = true; renderFilterPanel();
        setStatus("Автолок не запущено", "warn"); setAction("Фільтри відкрито: перевір і натисни ще раз", "warn");
        setBrowserIndicator("warn"); return;
      }
      if (state.locked) {
        setStatus("Ви в лоці: автолок заблоковано", "warn"); setAction("В лоці: автолок недоступний", "warn");
        updateAutoButtonLabel(nowMs()); setBrowserIndicator("lock"); return;
      }
      let notificationPermissionPromise = null;
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        notificationPermissionPromise = ensureNotificationPermission();
      }
      const hasRunLockSupport = supportsAutolockRunLock();
      if (hasRunLockSupport) {
        const lockResult = await acquireAutolockRunLock();
        if (!lockResult.ok) {
          if (lockResult.reason === "held_elsewhere") { setStatus("Автолок уже працює в іншій вкладці", "warn"); setAction("В іншій вкладці вже є активний runner", "warn"); setBrowserIndicator("warn"); }
          else { setStatus("Автолок не запущено: помилка browser lock", "error"); setAction(`Single-runner lock error: ${lockResult.error || "помилка"}`, "error"); setBrowserIndicator("warn"); }
          updateAutoButtonLabel(nowMs()); return;
        }
      }
      void notificationPermissionPromise;
      state.enabled = true;
      state.backgroundStopFallback = !hasRunLockSupport;
      cancelActiveLockAttempt();
      resetHotRetryState();
      clearManualWaitTimer();
      state.pendingManualRefresh = false;
      state.runStartedAt = ts;
      state.lastAutoStartAt = ts;
      state.runId = makeShortId("run");
      state.lastLockOrderId = "";
      state.domMismatchStreak = 0;
      resetRunMetrics();
      state.runMetrics.autoStartCount = 1;
      state.stopLabel = "Зупинено";
      setBrowserIndicator("run");
      setAutoOn();
      setBudget(ts);
      const nextDelay = getNextBaseRefreshDelayMs(ts);
      if (nextDelay > 0) { setAction(`Автолок запущено, чекаю ${Math.ceil(nextDelay)}ms`, "ok"); scheduleAuto(); }
      else { setAction("Автолок запущено", "ok"); void refreshNow("auto", false); }
    } finally { state.startPending = false; }
  }

  function toggleAuto() {
    if (state.maintenance) return;
    if (state.locked) { setStatus("Ви в лоці: автолок заблоковано", "warn"); setAction("В лоці: автолок недоступний", "warn"); updateAutoButtonLabel(nowMs()); setBrowserIndicator("lock"); return; }
    if (state.enabled) { stopAuto("Автолок зупинено", "Зупинено", "Автолок зупинено", "info", "manual"); return; }
    startAuto();
  }

  function attachActivityListeners() {
    const onVisibilityOrFocusChange = () => {
      if (!state.enabled || !state.backgroundStopFallback) return;
      if (!isVisibleAndFocused()) stopAutoInactive();
    };
    document.addEventListener("visibilitychange", onVisibilityOrFocusChange);
    window.addEventListener("blur", onVisibilityOrFocusChange);
    if (typeof MutationObserver === "undefined") return;
    const target = document.head || document.documentElement;
    if (!target) return;
    const titleObserver = new MutationObserver(() => {
      const currentTitle = String(document.title || "");
      if (currentTitle === String(state.lastManagedDocumentTitle || "")) return;
      const prevTitle = state.originalDocumentTitle;
      const nextTitle = syncOriginalDocumentTitleFromDocument();
      if (state.browserIndicatorMode !== "idle" && nextTitle !== prevTitle) renderBrowserIndicator();
    });
    titleObserver.observe(target, { childList: true, subtree: true, characterData: true });
  }

  // ===== Settings/Changelog panels =====

  function renderSettingsPanel() {
    if (!settingsPanelEl) return;
    settingsPanelEl.style.display = state.settingsOpen ? "block" : "none";
    settingsPanelEl.setAttribute("aria-hidden", state.settingsOpen ? "false" : "true");
    renderSettingsButton();
    renderDryRunToggle();
    renderVisualHighlightButton();
  }

  function renderChangelogPanel() {
    if (!changelogPanelEl) return;
    const contentEl = changelogPanelEl.querySelector('[data-role="witch-mow-ar-changelog-content"]');
    const isOpen = Boolean(state.changelogOpen);
    if (isOpen) markChangelogSeen();
    changelogPanelEl.style.display = isOpen ? "block" : "none";
    changelogPanelEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
    renderChangelogButton();
    if (!isOpen || !contentEl) return;
    const entries = getChangelogEntries();
    contentEl.replaceChildren();
    if (entries.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.textContent = "Changelog поки порожній.";
      emptyEl.style.fontSize = "11px"; emptyEl.style.color = "#475569";
      contentEl.appendChild(emptyEl); return;
    }
    entries.forEach((entry) => {
      if (!entry || !entry.version || !Array.isArray(entry.items)) return;
      const sectionEl = document.createElement("section");
      sectionEl.style.cssText = "display:grid;gap:6px;";
      const titleEl = document.createElement("div");
      titleEl.textContent = String(entry.title || `v${entry.version}`);
      titleEl.style.cssText = "font-size:12px;font-weight:700;color:#1d2b44;";
      sectionEl.appendChild(titleEl);
      const listEl = document.createElement("ul");
      listEl.style.cssText = "margin:0;padding-left:18px;display:grid;gap:4px;font-size:11px;line-height:1.35;color:#334155;";
      entry.items.forEach((item) => { const li = document.createElement("li"); li.textContent = String(item || ""); listEl.appendChild(li); });
      sectionEl.appendChild(listEl);
      contentEl.appendChild(sectionEl);
    });
  }

  // ===== Build Panel =====

  function buildPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) return existing;

    const priorityRulesMarkup = PRIORITY_RULE_DEFINITIONS.map(
      (item) => `<label style="display:flex;align-items:flex-start;gap:8px;font-size:11px;line-height:1.35;color:#243451;cursor:pointer;"><input type="checkbox" data-role="witch-mow-ar-priority-rule" data-rule="${item.key}" style="margin:2px 0 0 0;"><span>${item.label}</span></label>`
    ).join("");

    const overlayCardStyle = "display:none;position:fixed;right:12px;bottom:72px;z-index:2147483648;background:#fff;border:1px solid #d2d8e5;border-radius:14px;box-shadow:0 20px 48px rgba(15,23,42,.18);padding:12px;width:340px;max-width:calc(100vw - 24px);";
    const overlayHeaderStyle = "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;";
    const overlayTitleStyle = "font-size:12px;font-weight:700;color:#1d2b44;";
    const overlayCloseStyle = "border:1px solid #d5dbe8;background:#fff;color:#475569;padding:3px 8px;border-radius:999px;font-size:11px;line-height:1;cursor:pointer;";
    const settingsRowStyle = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;";
    const settingsMetaStyle = "display:grid;gap:2px;min-width:0;";
    const settingsTitleStyle = "font-size:12px;font-weight:700;color:#1d2b44;";
    const settingsHintStyle = "font-size:11px;line-height:1.35;color:#64748b;";

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#fff;border:1px solid #d2d8e5;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.15);padding:12px;width:388px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;font-family:Arial,sans-serif;color:#111;";

    panel.innerHTML =
      // Header row
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<div style="font-size:11px;color:#4a5670;">Останнє оновлення: <span data-role="witch-mow-ar-last">-</span></div>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" data-role="witch-mow-ar-minimize" title="Згорнути" aria-label="Згорнути" style="border:1px solid #d5dbe8;background:#fff;font-size:15px;line-height:1;cursor:pointer;padding:2px 8px;color:#48556d;border-radius:999px;">-</button>' +
      '<button type="button" data-role="witch-mow-ar-close" title="Закрити" aria-label="Закрити" style="border:1px solid #efcaca;background:#fff5f5;font-size:14px;line-height:1;cursor:pointer;padding:2px 8px;color:#b42318;border-radius:999px;">x</button>' +
      "</div></div>" +
      // Refresh
      '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
      '<button type="button" data-role="witch-mow-ar-refresh" style="flex:1;border:1px solid #2e6ce6;background:#2e6ce6;color:#fff;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;">Оновити зараз</button>' +
      "</div>" +
      // Auto block
      '<div style="border:1px solid #d9e1f0;border-radius:8px;padding:8px;margin-bottom:8px;background:#f8fbff;">' +
      '<div style="display:flex;gap:8px;margin-bottom:6px;">' +
      '<button type="button" data-role="witch-mow-ar-auto-btn" style="flex:1;border:1px solid #1f7a36;background:#1f7a36;color:#fff;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;">Увімкнути автолок</button>' +
      '<button type="button" data-role="witch-mow-ar-filter-btn" style="flex:1;border:1px solid #44516a;background:#44516a;color:#fff;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;">Фільтри автолоку</button>' +
      "</div>" +
      '<button type="button" data-role="witch-mow-ar-rules-btn" style="width:100%;border:1px solid #bfd0ff;background:#eef4ff;color:#24438a;padding:6px 8px;border-radius:6px;font-size:11px;cursor:pointer;margin-bottom:6px;">Додаткові правила</button>' +
      '<div data-role="witch-mow-ar-auto-hint" style="display:none;font-size:11px;color:#8a5f00;margin-bottom:6px;"></div>' +
      // Priority rules panel
      '<div data-role="witch-mow-ar-rules-panel" style="display:none;padding:8px;border:1px solid #f2d3a2;border-radius:8px;background:#fffaf0;margin-bottom:6px;">' +
      '<div style="font-size:11px;font-weight:700;color:#8a5f00;margin-bottom:4px;">Глобальні правила пріоритетів</div>' +
      '<div style="font-size:10px;line-height:1.35;color:#8a5f00;margin-bottom:6px;">Ці параметри діють для всіх шаблонів фільтра.</div>' +
      `<div style="display:grid;gap:6px;">${priorityRulesMarkup}</div>` +
      "</div>" +
      // Filter panel
      '<div data-role="witch-mow-ar-filter-panel" style="display:none;padding:8px;border:1px solid #cfd8ea;border-radius:8px;background:#fff;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">' +
      '<div data-role="witch-mow-ar-filter-meta" style="min-width:0;font-size:11px;color:#31405f;">Шаблон 1 • P 20/20 • C 4/4 • D 7/7</div>' +
      '<div data-role="witch-mow-ar-filter-slots" style="display:inline-flex;align-items:center;border-radius:7px;background:#ef4444;color:#fff;overflow:hidden;"></div>' +
      "</div>" +
      // Lidar separate checkbox
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#243451;margin-bottom:6px;cursor:pointer;">' +
      '<input type="checkbox" data-role="witch-mow-ar-lidar-separate" style="margin:0;">' +
      'Відділити лідари (не лочити поки є waiting_lidar_interior_modeling)' +
      "</label>" +
      // Priority
      '<div style="font-size:11px;font-weight:700;color:#243451;margin-bottom:4px;">Пріоритет</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
      '<button type="button" data-role="witch-mow-ar-prio-all" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Всі</button>' +
      '<button type="button" data-role="witch-mow-ar-prio-none" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Ніякі</button>' +
      '<button type="button" data-role="witch-mow-ar-prio-occ" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">ОЦЦ 1-2</button>' +
      '<button type="button" data-role="witch-mow-ar-prio-color" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">1-19</button>' +
      "</div>" +
      '<div data-role="witch-mow-ar-priority-grid" style="display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px;margin-bottom:6px;"></div>' +
      // Complexity
      '<div style="font-size:11px;font-weight:700;color:#243451;margin-bottom:4px;">Складність</div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#243451;margin-bottom:6px;cursor:pointer;">' +
      '<input type="checkbox" data-role="witch-mow-ar-no-complexity" style="margin:0;">' +
      "Без складності (наприклад, інтер'єри)" +
      "</label>" +
      '<div data-role="witch-mow-ar-complexity-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-bottom:8px;"></div>' +
      // Deliverable
      '<div style="font-size:11px;font-weight:700;color:#243451;margin-bottom:4px;">Тип</div>' +
      '<div data-role="witch-mow-ar-deliverable-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;"></div>' +
      "</div>" + // end filter-panel
      "</div>" + // end auto block
      // Status rows
      '<div style="font-size:12px;line-height:1.3;margin-bottom:8px;display:grid;gap:4px;min-height:42px;">' +
      '<div style="display:flex;align-items:center;gap:6px;min-width:0;">' +
      '<span style="flex:0 0 76px;color:#475569;">Status:</span>' +
      '<span data-role="witch-mow-ar-status" style="display:block;min-width:0;flex:1;color:#1d2b44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Init...</span>' +
      "</div>" +
      '<div style="display:flex;align-items:center;gap:6px;min-width:0;">' +
      '<span style="flex:0 0 76px;color:#475569;">Остання дія:</span>' +
      '<span data-role="witch-mow-ar-action" style="display:block;min-width:0;flex:1;color:#1d2b44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">-</span>' +
      "</div>" +
      "</div>" +
      // Lock notice
      '<div data-role="witch-mow-ar-lock-note" style="display:none;font-size:11px;line-height:1.35;margin-bottom:8px;padding:6px;border:1px solid #f1d8a6;border-radius:6px;background:#fffbf0;color:#8a5f00;"></div>' +
      // Loader note
      '<div data-role="witch-mow-ar-loader-note" style="display:none;font-size:10px;line-height:1.25;margin-bottom:8px;padding:5px 6px;border:1px solid #f3d19c;border-radius:6px;background:#fffaf0;color:#8a5f00;"></div>' +
      // Role warning
      (state.roleWarningDismissed ? "" :
        '<div data-role="witch-mow-ar-role-warning" style="margin-bottom:8px;padding:8px;border:1px solid #f2d3a2;border-radius:8px;background:#fffaf0;color:#8a5f00;">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">' +
        '<div style="min-width:0;"><div style="font-size:11px;font-weight:700;margin-bottom:4px;">Обмеження скрипта</div>' +
        '<div style="font-size:12px;font-weight:700;line-height:1.4;">Цей скрипт розроблявся і перевірявся тільки для exterior-моделерів.<br>Інші ролі і фільтри для них будуть додаватись пізніше.</div>' +
        "</div>" +
        '<button type="button" data-role="witch-mow-ar-role-warning-close" style="flex:0 0 auto;border:1px solid #d6b783;background:#fff;color:#8a5f00;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">Закрити</button>' +
        "</div></div>") +
      // Warning box
      '<div style="font-size:11px;line-height:1.35;margin-bottom:8px;padding:6px;border:1px solid #f0d4d4;border-radius:6px;background:#fff7f7;color:#8a2626;">' +
      '<b>УВАГА:</b> Використання скрипта на ваш ризик.<br>Не є виправданням для неправильного локу.' +
      "</div>" +
      // Ignore menu
      '<div style="margin-bottom:8px;">' +
      '<button type="button" data-role="witch-mow-ar-ignore-toggle" style="width:100%;display:flex;align-items:center;justify-content:space-between;border:1px solid #c7d2e8;background:#f1f5fb;color:#1d2b44;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">' +
      '<span>Ігнорувати замовлення</span><span data-role="witch-mow-ar-ignore-arrow" style="font-size:10px;">▼</span>' +
      "</button>" +
      '<div data-role="witch-mow-ar-ignore-panel" style="display:none;padding:8px;border:1px solid #c7d2e8;border-top:0;border-radius:0 0 8px 8px;background:#f9fbff;">' +
      '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">Введіть ID замовлень (по одному в полі) — такі замовлення скрипт не буде лочити</div>' +
      Array.from({ length: 5 }, (_, i) =>
        `<input type="text" data-role="witch-mow-ar-ignore-id" data-index="${i}" placeholder="ID замовлення (8 цифр)" maxlength="20" style="display:block;width:100%;box-sizing:border-box;margin-bottom:4px;padding:5px 8px;border:1px solid #c7d2e8;border-radius:6px;font-size:11px;font-family:monospace;">`
      ).join("") +
      '<button type="button" data-role="witch-mow-ar-ignore-clear" style="margin-top:4px;border:1px solid #e2a0a0;background:#fff5f5;color:#b42318;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;">Видалити все</button>' +
      "</div></div>" +
      // Footer
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
      '<div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0;max-width:100%;color:#9aa3b2;">' +
      '<span data-role="witch-mow-ar-user-email" style="font-size:10px;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">-</span>' +
      '<button type="button" data-role="witch-mow-ar-changelog-btn" style="margin-top:2px;border:0;background:transparent;padding:0;font-size:8px;line-height:1.25;color:#8a94a6;white-space:normal;word-break:break-word;text-align:left;cursor:pointer;">' + SCRIPT_VERSION_LABEL + "</button></div>" +
      '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" data-role="witch-mow-ar-settings-btn" title="Параметри" aria-label="Параметри" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid #cbd5e1;background:#fff;color:#334155;padding:0;border-radius:999px;cursor:pointer;">' +
      '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2 4.25h3.5v1H2v-1Zm8.5 0H14v1h-3.5v-1ZM2 7.5h7v1H2v-1Zm10 0h2v1h-2v-1ZM2 10.75h1.5v1H2v-1Zm6.5 0H14v1H8.5v-1Z"/><circle cx="7.25" cy="4.75" r="1.75" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10.25" cy="8" r="1.75" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="5.75" cy="11.25" r="1.75" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' +
      "</button>" +
      "</div></div>" +
      // Settings overlay
      '<div data-role="witch-mow-ar-settings-panel" style="' + overlayCardStyle + '" aria-hidden="true">' +
      '<div style="' + overlayHeaderStyle + '"><div style="' + overlayTitleStyle + '">Параметри</div><button type="button" data-role="witch-mow-ar-settings-close" style="' + overlayCloseStyle + '">x</button></div>' +
      '<div style="display:grid;gap:8px;">' +
      '<label style="' + settingsRowStyle + 'cursor:pointer;"><span style="' + settingsMetaStyle + '"><span style="' + settingsTitleStyle + '">Dry run</span><span style="' + settingsHintStyle + '">Тестовий режим, вимикає лок за будинками</span></span><input type="checkbox" data-role="witch-mow-ar-dry-run-toggle" style="margin:0;inline-size:16px;block-size:16px;accent-color:#2563eb;"></label>' +
      '<div style="' + settingsRowStyle + '"><span style="' + settingsMetaStyle + '"><span style="' + settingsTitleStyle + '">Підсвітка пошуку</span></span><button type="button" data-role="witch-mow-ar-visual-toggle" title="Візуальна рамка" aria-label="Візуальна рамка" aria-pressed="true" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid #93c5fd;background:#dbeafe;color:#1d4ed8;padding:0;border-radius:999px;cursor:pointer;flex:0 0 auto;"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 3c3.8 0 6.5 3.1 7.4 4.4a1 1 0 0 1 0 1.1C14.5 9.9 11.8 13 8 13S1.5 9.9.6 8.5a1 1 0 0 1 0-1.1C1.5 6.1 4.2 3 8 3Zm0 1C5 4 2.7 6.3 1.7 8 2.7 9.7 5 12 8 12s5.3-2.3 6.3-4C13.3 6.3 11 4 8 4Zm0 1.5A2.5 2.5 0 1 1 8 10.5 2.5 2.5 0 0 1 8 5.5Zm0 1A1.5 1.5 0 1 0 8 9.5 1.5 1.5 0 0 0 8 6.5Z"/></svg></button></div>' +
      '<div style="' + settingsRowStyle + '"><span style="' + settingsMetaStyle + '"><span style="' + settingsTitleStyle + '">Тест сповіщень</span></span><button type="button" data-role="witch-mow-ar-debug-notify" style="border:1px solid #cbd5e1;background:#fff;color:#334155;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;flex:0 0 auto;">Запустити</button></div>' +
      "</div></div>" +
      // Changelog overlay
      '<div data-role="witch-mow-ar-changelog-panel" style="' + overlayCardStyle + 'width:360px;max-height:calc(100vh - 32px);" aria-hidden="true">' +
      '<div style="' + overlayHeaderStyle + '"><div style="' + overlayTitleStyle + '">Що нового</div><button type="button" data-role="witch-mow-ar-changelog-close" style="' + overlayCloseStyle + '">x</button></div>' +
      '<div data-role="witch-mow-ar-changelog-content" style="display:grid;gap:12px;max-height:340px;overflow:auto;padding-right:4px;"></div>' +
      "</div>";

    document.body.appendChild(panel);

    // Compact panel
    const compactPanel = document.createElement("button");
    compactPanel.type = "button";
    compactPanel.id = `${PANEL_ID}-compact`;
    compactPanel.style.cssText = "display:none;position:fixed;right:12px;bottom:12px;z-index:2147483647;width:220px;max-width:calc(100vw - 24px);padding:10px 12px;border:1px solid #d2d8e5;border-radius:14px;background:#fff;box-shadow:0 10px 24px rgba(15,23,42,.14);cursor:pointer;text-align:left;font-family:Arial,sans-serif;";
    compactPanel.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span data-role="witch-mow-ar-compact-indicator" style="flex:0 0 auto;width:10px;height:10px;border-radius:999px;background:#2563eb;"></span>' +
      '<div style="min-width:0;display:grid;gap:2px;flex:1;">' +
      '<div data-role="witch-mow-ar-compact-status" style="font-size:12px;font-weight:700;color:#1d2b44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Init...</div>' +
      '<div data-role="witch-mow-ar-compact-action" style="font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">-</div>' +
      "</div><span style='flex:0 0 auto;font-size:14px;line-height:1;color:#64748b;'>&gt;</span></div>";
    document.body.appendChild(compactPanel);

    // Wire up element refs
    panelEl = panel; compactPanelEl = compactPanel;
    compactStatusEl = compactPanel.querySelector('[data-role="witch-mow-ar-compact-status"]');
    compactActionEl = compactPanel.querySelector('[data-role="witch-mow-ar-compact-action"]');
    compactIndicatorEl = compactPanel.querySelector('[data-role="witch-mow-ar-compact-indicator"]');
    statusEl = panel.querySelector('[data-role="witch-mow-ar-status"]');
    actionEl = panel.querySelector('[data-role="witch-mow-ar-action"]');
    lastEl = panel.querySelector('[data-role="witch-mow-ar-last"]');
    userEmailEl = panel.querySelector('[data-role="witch-mow-ar-user-email"]');
    lockNoticeEl = panel.querySelector('[data-role="witch-mow-ar-lock-note"]');
    loaderNoteEl = panel.querySelector('[data-role="witch-mow-ar-loader-note"]');
    roleWarningEl = panel.querySelector('[data-role="witch-mow-ar-role-warning"]');
    autoBtnEl = panel.querySelector('[data-role="witch-mow-ar-auto-btn"]');
    autoHintEl = panel.querySelector('[data-role="witch-mow-ar-auto-hint"]');
    filterBtnEl = panel.querySelector('[data-role="witch-mow-ar-filter-btn"]');
    priorityRulesBtnEl = panel.querySelector('[data-role="witch-mow-ar-rules-btn"]');
    priorityRulesPanelEl = panel.querySelector('[data-role="witch-mow-ar-rules-panel"]');
    visualToggleBtnEl = panel.querySelector('[data-role="witch-mow-ar-visual-toggle"]');
    debugBtnEl = panel.querySelector('[data-role="witch-mow-ar-debug-notify"]');
    settingsBtnEl = panel.querySelector('[data-role="witch-mow-ar-settings-btn"]');
    settingsPanelEl = panel.querySelector('[data-role="witch-mow-ar-settings-panel"]');
    changelogBtnEl = panel.querySelector('[data-role="witch-mow-ar-changelog-btn"]');
    changelogPanelEl = panel.querySelector('[data-role="witch-mow-ar-changelog-panel"]');
    dryRunToggleEl = panel.querySelector('[data-role="witch-mow-ar-dry-run-toggle"]');
    minimizeBtnEl = panel.querySelector('[data-role="witch-mow-ar-minimize"]');
    filterPanelEl = panel.querySelector('[data-role="witch-mow-ar-filter-panel"]');
    filterSlotsEl = panel.querySelector('[data-role="witch-mow-ar-filter-slots"]');
    prioritiesGridEl = panel.querySelector('[data-role="witch-mow-ar-priority-grid"]');
    complexitiesGridEl = panel.querySelector('[data-role="witch-mow-ar-complexity-grid"]');
    deliverablesGridEl = panel.querySelector('[data-role="witch-mow-ar-deliverable-grid"]');
    noComplexityEl = panel.querySelector('[data-role="witch-mow-ar-no-complexity"]');
    filterMetaEl = panel.querySelector('[data-role="witch-mow-ar-filter-meta"]');
    lidarSeparateEl = panel.querySelector('[data-role="witch-mow-ar-lidar-separate"]');
    ignoreMenuEl = panel.querySelector('[data-role="witch-mow-ar-ignore-panel"]');
    ignoreIdEls = Array.from(panel.querySelectorAll('[data-role="witch-mow-ar-ignore-id"]'));
    ignoreBtnEl = panel.querySelector('[data-role="witch-mow-ar-ignore-clear"]');

    // ---- Event wiring ----

    panel.querySelector('[data-role="witch-mow-ar-close"]').addEventListener("click", () => {
      if (state.enabled) stopAuto("Автолок зупинено: панель закрито", "Зупинено", "Стоп: панель закрито", "warn", "manual");
      state.settingsOpen = false; state.changelogOpen = false;
      renderSettingsPanel(); renderChangelogPanel();
      panel.style.display = "none";
      if (compactPanelEl) compactPanelEl.style.display = "none";
    });

    if (minimizeBtnEl) minimizeBtnEl.addEventListener("click", () => setPanelMinimized(true));
    if (compactPanelEl) compactPanelEl.addEventListener("click", () => setPanelMinimized(false));

    panel.querySelector('[data-role="witch-mow-ar-refresh"]').addEventListener("click", () => {
      if (state.enabled) { state.runMetrics.manualRefreshCount += 1; stopAuto("Автолок зупинено: ручне оновлення", "Зупинено", "Стоп: ручне оновлення", "warn", "manual_refresh"); }
      refreshNow("manual", true);
    });

    const roleWarningCloseBtn = panel.querySelector('[data-role="witch-mow-ar-role-warning-close"]');
    if (roleWarningCloseBtn) roleWarningCloseBtn.addEventListener("click", () => dismissRoleWarning());

    // Visual toggle
    if (visualToggleBtnEl) {
      visualToggleBtnEl.addEventListener("click", () => {
        state.visualHighlightEnabled = !state.visualHighlightEnabled;
        persistVisualHighlightState();
        renderVisualHighlightButton();
        syncAssignmentsVisualState(parseRowsFromCurrentTable(), createEmptyCascadeInfo(), false);
      });
    }

    if (debugBtnEl) debugBtnEl.addEventListener("click", () => { void runNotificationDebugTest(); });

    // Settings
    if (settingsBtnEl) {
      settingsBtnEl.addEventListener("click", () => {
        state.settingsOpen = !state.settingsOpen;
        if (state.settingsOpen) state.changelogOpen = false;
        renderSettingsPanel(); renderChangelogPanel();
      });
    }

    if (changelogBtnEl) {
      changelogBtnEl.addEventListener("click", () => {
        state.changelogOpen = !state.changelogOpen;
        if (state.changelogOpen) state.settingsOpen = false;
        renderSettingsPanel(); renderChangelogPanel();
      });
    }

    const settingsCloseBtn = panel.querySelector('[data-role="witch-mow-ar-settings-close"]');
    if (settingsCloseBtn) settingsCloseBtn.addEventListener("click", () => { state.settingsOpen = false; renderSettingsPanel(); });

    const changelogCloseBtn = panel.querySelector('[data-role="witch-mow-ar-changelog-close"]');
    if (changelogCloseBtn) changelogCloseBtn.addEventListener("click", () => { state.changelogOpen = false; renderChangelogPanel(); });

    // Settings panel change
    if (settingsPanelEl) {
      settingsPanelEl.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || target.getAttribute("data-role") !== "witch-mow-ar-dry-run-toggle") return;
        state.dryRunEnabled = Boolean(target.checked);
        persistDryRunState(); renderDryRunToggle();
        if (state.enabled) stopAuto("Автолок зупинено: змінено dry run", "Зупинено", state.dryRunEnabled ? "Стоп: увімкнено dry run" : "Стоп: вимкнено dry run", "warn", "manual");
        else setAction(state.dryRunEnabled ? "Dry run увімкнено" : "Dry run вимкнено", "ok");
      });
    }

    // Auto btn
    autoBtnEl.addEventListener("click", () => toggleAuto());

    // Filter btn
    filterBtnEl.addEventListener("click", () => {
      state.filterOpen = !state.filterOpen;
      if (state.filterOpen) { markFiltersReviewed(); setAction("Фільтри автолоку перевірено", "ok"); }
      renderFilterPanel();
    });

    // Priority rules btn
    if (priorityRulesBtnEl) {
      priorityRulesBtnEl.addEventListener("click", () => {
        state.priorityRulesOpen = !state.priorityRulesOpen;
        if (state.priorityRulesOpen) { markFiltersReviewed(); setAction("Правила пріоритетів перевірено", "ok"); }
        renderFilterPanel();
      });
    }

    // Priority rules panel change
    if (priorityRulesPanelEl) {
      priorityRulesPanelEl.addEventListener("change", (event) => {
        const target = event.target;
        if (!target || target.getAttribute("data-role") !== "witch-mow-ar-priority-rule") return;
        if (state.maintenance) return;
        const ruleKey = target.getAttribute("data-rule") || "";
        const nextValue = Boolean(target.checked);
        const ruleDef = PRIORITY_RULE_DEFINITIONS.find((item) => item.key === ruleKey);
        if (!ruleDef) return;
        if (!nextValue) {
          const confirmed = typeof window.confirm === "function" ? window.confirm(ruleDef.confirmText) : true;
          if (!confirmed) { target.checked = true; return; }
        }
        state.priorityRules[ruleKey] = nextValue;
        persistPriorityRules(); renderFilterPanel(); markFiltersReviewed(); setAction("Правила пріоритетів збережено", "ok");
        if (state.enabled) stopAuto("Автолок зупинено: змінено правила пріоритетів", "Зупинено", "Стоп: змінено правила пріоритетів", "warn", "filter_changed");
      });
    }

    // No complexity
    if (noComplexityEl) {
      noComplexityEl.addEventListener("change", () => {
        if (state.maintenance) return;
        state.noComplexityMode = Boolean(noComplexityEl.checked);
        persistFilterState(); renderFilterPanel(); markFiltersReviewed(); setAction("Фільтри автолоку перевірено", "ok");
        if (state.enabled) stopAuto("Автолок зупинено: змінено фільтри", "Зупинено", "Стоп: змінено фільтри", "warn", "filter_changed");
      });
    }

    // Lidar separate
    if (lidarSeparateEl) {
      lidarSeparateEl.addEventListener("change", () => {
        state.lidarSeparate = Boolean(lidarSeparateEl.checked);
        persistLidarSeparate();
        setAction(state.lidarSeparate ? "Лідари відділено" : "Лідари не відділяються", "ok");
        if (state.enabled) stopAuto("Автолок зупинено: змінено режим лідарів", "Зупинено", "Стоп: змінено режим лідарів", "warn", "filter_changed");
      });
    }

    // Ignore toggle btn
    const ignoreToggleBtn = panel.querySelector('[data-role="witch-mow-ar-ignore-toggle"]');
    const ignoreArrow = panel.querySelector('[data-role="witch-mow-ar-ignore-arrow"]');
    if (ignoreToggleBtn && ignoreMenuEl) {
      ignoreToggleBtn.addEventListener("click", () => {
        state.ignoreOpen = !state.ignoreOpen;
        ignoreMenuEl.style.display = state.ignoreOpen ? "block" : "none";
        if (ignoreArrow) ignoreArrow.textContent = state.ignoreOpen ? "▲" : "▼";
        if (state.ignoreOpen) renderIgnorePanel();
      });
    }

    // Ignore ID inputs — save on change
    ignoreIdEls.forEach((input, i) => {
      if (!input) return;
      input.addEventListener("input", () => {
        state.ignoreIds[i] = compactText(input.value || "");
        persistIgnoreIds();
      });
    });

    // Ignore clear btn
    if (ignoreBtnEl) {
      ignoreBtnEl.addEventListener("click", () => {
        state.ignoreIds = ["", "", "", "", ""];
        persistIgnoreIds();
        ignoreIdEls.forEach((input) => { if (input) input.value = ""; });
        setAction("Список ігнорування очищено", "ok");
      });
    }

    // Filter panel click (chips, presets)
    filterPanelEl.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      let changed = false;
      const role = target.getAttribute("data-role") || "";
      if (role === "witch-mow-ar-filter-slot") {
        const slotId = Number(target.getAttribute("data-slot") || "");
        if (switchFilterSlot(slotId)) { changed = true; setAction(`${getFilterSlotSummary(slotId)} активовано`, "ok"); }
      }
      if (role === "witch-mow-ar-prio-all") { setPriorityFilter(true); changed = true; }
      if (role === "witch-mow-ar-prio-none") { setPriorityFilter(false); changed = true; }
      if (role === "witch-mow-ar-prio-occ") { setPriorityRange(1, 2); changed = true; }
      if (role === "witch-mow-ar-prio-color") { setPriorityRange(1, 19); changed = true; }
      if (role === "witch-mow-ar-comp-all") { setComplexityFilter(true); changed = true; }
      if (role === "witch-mow-ar-comp-none") { setComplexityFilter(false); changed = true; }
      if (role === "witch-mow-ar-deliv-all") { setDeliverableFilter(true); changed = true; }
      if (role === "witch-mow-ar-deliv-none") { setDeliverableFilter(false); changed = true; }
      if (role === "witch-mow-ar-chip") {
        const kind = target.getAttribute("data-kind");
        const rawValue = target.getAttribute("data-value") || "";
        if (kind === "priority") { const v = Number(rawValue); if (Number.isFinite(v)) { togglePriority(v); changed = true; } }
        if (kind === "complexity" && rawValue) { toggleComplexity(rawValue); changed = true; }
        if (kind === "deliverable" && rawValue) { toggleDeliverable(rawValue); changed = true; }
      }
      if (changed) persistFilterState();
      renderFilterPanel();
      if (state.filterOpen) markFiltersReviewed();
      if (changed && state.enabled) stopAuto("Автолок зупинено: змінено фільтри", "Зупинено", "Стоп: змінено фільтри", "warn", "filter_changed");
      if (!state.enabled) return;
      const parsed = parseRowsFromCurrentTable();
      if (parsed.schemaValid === false) return;
      runAutoLockAction(parsed);
    });

    renderVisualHighlightButton();
    renderSettingsButton();
    renderChangelogButton();
    renderDryRunToggle();
    renderCompactPanel();
    renderPanelMode();
    return panel;
  }

  function show() {
    const panel = buildPanel();
    renderPanelMode();
    setControlsDisabled(state.maintenance);
    const parsedCurrent = parseRowsFromCurrentTable();
    if (parsedCurrent.schemaValid === false) {
      enterMaintenanceMode(parsedCurrent.schemaReason || "assignments_grid not found on current page");
      return;
    }
    syncAssignmentsVisualState(parsedCurrent, createEmptyCascadeInfo(parsedCurrent && parsedCurrent.rows), false);
    renderFilterPanel();
    renderSettingsPanel();
    renderChangelogPanel();
    renderLoaderUpdateNotice();
    syncOriginalDocumentTitleFromDocument();
    setLockInfo(parseLockInfoFromDoc(document));
    setUserEmail(resolveCurrentUserEmail(document));
    if (state.maintenance) setBrowserIndicator("warn");
    else if (state.enabled) setBrowserIndicator("run");
    else if (!state.locked) { setStatus("Готово", "info"); setAction("Готово до запуску автолоку", "info"); setBrowserIndicator("idle"); }
    setLast(state.lastUpdatedAt);
    updateAutoButtonLabel(nowMs());
    if (!state.lastUpdatedAt) void refreshNow("manual", true);
  }

  // ===== Bootstrap =====
  state.installId = loadOrCreateInstallId();
  restorePersistedFilters();
  restorePersistedPriorityRules();
  restorePersistedDryRunState();
  restorePersistedVisualHighlightState();
  restorePersistedRoleWarningDismissedState();
  restorePersistedLidarSeparate();
  restorePersistedIgnoreIds();
  attachActivityListeners();
  show();

  window[NS] = {
    show,
    start: startAuto,
    stop: () => stopAuto("Автолок зупинено", "Зупинено", "Автолок зупинено", "info", "manual"),
    refresh: () => refreshNow("manual", true),
    version: SCRIPT_VERSION,
    versionLabel: SCRIPT_VERSION_LABEL,
  };
  window[REMOTE_MARKER] = true;
})();
