(() => {
  "use strict";

  const NS = "__WitchMOWAutoReload";
  const REMOTE_MARKER = "__witch_autolock_remote_loaded";
  const LOADER_META_KEY = "__witch_autolock_loader_meta";
  const LOADER_META_STORAGE_KEY = `witch-mow-ar:loader-meta:v1:${location.host}`;
  const PANEL_ID = "witch-mow-ar-panel";
  const SCRIPT_NAME = "witch-mow-ar";
  const SCRIPT_VERSION = "2.1.0";

  // ── New feature storage keys ──────────────────────────────────────────────
  const SHIFT_BTN_STORAGE_KEY   = `witch-mow-ar:shift-btn:v1:${location.host}`;
  const NO_STOP_STORAGE_KEY     = `witch-mow-ar:no-stop:v1:${location.host}`;
  const TG_NOTIF_STORAGE_KEY    = `witch-mow-ar:tg-notif:v1:${location.host}`;
  const TG_TOKEN_STORAGE_KEY    = `witch-mow-ar:tg-token:v1:${location.host}`;
  const TG_CHAT_STORAGE_KEY     = `witch-mow-ar:tg-chat:v1:${location.host}`;

  // Shift windows: [startH, startM, startS, endH, endM, endS]
  const SHIFT_WINDOWS = [
    { start: [7, 0, 0], end: [7, 20, 0], lock: [7, 20, 0] },
    { start: [15, 40, 0], end: [15, 50, 0], lock: [15, 50, 0] },
  ];
  const SCRIPT_VERSION_LABEL = `${SCRIPT_NAME}@${SCRIPT_VERSION}`;
  const EXPECTED_LOADER_VERSION = "0.9.1";
  const LOADER_UPDATE_URL =
    "https://script.google.com/macros/s/AKfycbyIXpBteZYjmvyuyKUsO0_ieE4_gpsN5SBsU7PULfZds-3ut0xxT9h8_BmeAt3aknSh/exec";
  const USER_EMAIL_STORAGE_KEY = `witch-mow-ar:user-email:v1:${location.host}`;
  const INSTALL_ID_STORAGE_KEY = `witch-mow-ar:install-id:v1:${location.host}`;
  const FILTER_STORAGE_KEY = `witch-mow-ar:filters:v4:${location.host}`;  // bumped version — old v3 incompatible
  const PRIORITY_RULES_STORAGE_KEY = `witch-mow-ar:priority-rules:v2:${location.host}`;
  const VISUAL_HIGHLIGHT_STORAGE_KEY = `witch-mow-ar:visual-highlight:v2:${location.host}`;
  const DRY_RUN_STORAGE_KEY = `witch-mow-ar:dry-run:v1:${location.host}`;
  const CHANGELOG_SEEN_STORAGE_KEY = `witch-mow-ar:changelog-seen:v1:${location.host}`;
  const ROLE_WARNING_DISMISSED_STORAGE_KEY = `witch-mow-ar:role-warning:v1:${location.host}`;
  const IGNORE_IDS_STORAGE_KEY = `witch-mow-ar:ignore-ids:v1:${location.host}`;
  const IGNORE_BLOCKS_STORAGE_KEY = `witch-mow-ar:ignore-blocks:v1:${location.host}`;

  const AUTO_REFRESH_INTERVAL_MS = 1_000;
  const HOT_RETRY_DELAY_MS = 500;
  const HOT_RETRY_MAX_ATTEMPTS = 3;
  const HARD_STOP_TOTAL_MS = 180_000;
  const FILTER_REVIEW_TTL_MS = 300_000;
  const FILTER_MAX = 20;
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
  // ── Deliverable definitions ────────────────────────────────────────────────
  // Three blocks: LIDAR, INTI (regular interior), EXTY (non-interior)
  // "Lidar" = interior_floor_plan with state waiting_lidar_interior_modeling
  // "Inti"  = interior_floor_plan with state waiting_interior_modeling
  // "Exty"  = everything else (roof, complete, other/all-others merged)

  // Keys that map to the "other" exty bucket (besides the explicit "other" key)

  // Canonical deliverable key → exty bucket key
  function getExtyBucketKey(deliverableKey) {
    const dk = String(deliverableKey || "other");
    if (dk === "roof") return "roof";
    if (dk === "complete") return "complete";
    return "other"; // total_living_area, total_living_area_plus, fast_roof, living_area_plus, other → "other"
  }

  // Is a row a lidar?
  function isLidarRow(row) {
    return (row.deliverableKey || "") === "interior_floor_plan" &&
      String(row.assignmentState || "").toLowerCase() === "waiting_lidar_interior_modeling";
  }

  // Is a row a regular inti (non-lidar interior)?
  function isIntiRow(row) {
    return (row.deliverableKey || "") === "interior_floor_plan" &&
      String(row.assignmentState || "").toLowerCase() !== "waiting_lidar_interior_modeling";
  }

  // Is a row an exty (non-interior)?
  function isExtyRow(row) {
    return (row.deliverableKey || "other") !== "interior_floor_plan";
  }
  const PRIORITY_RULE_DEFINITIONS = [
    {
      key: "lidar_cluster",
      label: "Тримати Лідари окремо (лочити лідари першими; якщо є лідари що не підходять під фільтри — чекаємо)",
      confirmText: "Вимкнути? Лідари більше не матимуть окремого кластера.",
      summaryLabel: "Lidar|*",
    },
    {
      key: "inti_cluster",
      label: "Тримати Інтер'єри окремо (лочити інти другими після лідарів; якщо є інти що не підходять — чекаємо)",
      confirmText: "Вимкнути? Інти більше не матимуть окремого кластера.",
      summaryLabel: "Inti|*",
    },
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
    dryRunEnabled: false,
    visualHighlightEnabled: false,
    roleWarningDismissed: false,
    ignoreIds: ["", "", "", "", ""],
    ignoreBlocks: [false, false, false, false, false],
    priorityRules: createDefaultPriorityRules(),
    // ── Per-block filter state ──────────────────────────────────────────────
    // LIDAR block
    lidarEnabled: true,   // lidar type button active
    lidarPriorities: new Set(Array.from({ length: 19 }, (_, i) => i + 1)),
    lidarComplexities: new Set(COMPLEXITY_LEVELS.map((item) => item.key)),
    lidarNoComplexity: false,
    // INTI block
    intiEnabled: true,    // inti type button active
    intiPriorities: new Set(Array.from({ length: 19 }, (_, i) => i + 1)),
    intiComplexities: new Set(COMPLEXITY_LEVELS.map((item) => item.key)),
    intiNoComplexity: false,
    // EXTY block — three independent type toggles sharing one priority+complexity set
    extyRoof: true,
    extyComplete: true,
    extyOther: true,
    extyPriorities: new Set(Array.from({ length: FILTER_MAX }, (_, i) => i + 1)),
    extyComplexities: new Set(COMPLEXITY_LEVELS.map((item) => item.key)),
    extyNoComplexity: false,
    // Active filter slot (shared across all blocks)
    activeFilterSlot: 1,
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
    // ── New feature state ────────────────────────────────────────────────────
    shiftBtnState: "off",      // "off" | "active" | "waiting"
    noStopEnabled: false,      // stopwatch btn — don't stop after 3 min
    tgNotifEnabled: false,     // bell btn — send Telegram notifications
    tgToken: "",
    tgChatId: "",
    shiftWaitTimeout: null,    // setTimeout handle for shift pre-lock refresh
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
  let filterSlotsEl;
  let filterMetaEl, panelEl, compactPanelEl, compactStatusEl, compactActionEl, compactIndicatorEl;
  let visualToggleBtnEl, minimizeBtnEl, settingsBtnEl, settingsPanelEl, changelogBtnEl, changelogPanelEl;
  let dryRunToggleEl, managedFaviconEl, ignoreIdEls = [], ignoreBlockEls = [], ignoreBtnEl, ignoreMenuEl;
  let shiftBtnEl, noStopBtnEl, tgNotifBtnEl;
  let tgTokenInputEl, tgChatInputEl;
  let debugBtnEl;

  const CHANGELOG_ENTRIES = Object.freeze([
    { version: "2.0.0", title: "2.0.0 — Новий інтерфейс фільтрів", items: [
      "Три незалежних блоки фільтрів: Lidar, Interior Floor Plan, Exty (Roof/Complete/Other)",
      "Кожен блок має власні пріоритети та складності; блок вмикається/вимикається кнопкою типу",
      "Other тепер включає Total Living Area, Fast Roof та інші не-інтеріор типи",
      "Додаткові правила: нові чекбокси 'Тримати Лідари окремо' та 'Тримати Інтер'єри окремо'",
      "Ігнорувати з чекбоксом: замовлення блокує лок але дозволяє лочити інших в цьому кластері",
      "Видалено окремі чекбокси: Відділити лідари, Інти окремо від мод, Ексти лише Сімпл/Аве, Ексти лише 1-2 — їхня логіка тепер реалізована через комбінацію блоків і правил",
    ] },
    { version: "1.4.0", title: "1.4.0", items: ["Додаткові правила (Тримати 1 від 2, 2 від 3-18 тощо) тепер НЕ впливають на Interior Floor Plan — Interior завжди використовує повністю роздільні групи пріоритетів", "Block-ID для не-Interior: якщо кандидат №1 заблокований — скрипт шукає наступного сумісного з правилами кандидата і лочить його замість очікування", "Новий фільтр 'Ексти лише 1-2 пріор': якщо увімкнено Interior + інший тип — Interior лочиться з усіма обраними пріоритетами, решта типів — лише Priority 1-2"] },
    { version: "1.3.0", title: "1.3.0", items: ["Interior Floor Plan + Custom тепер завжди першими в черзі в кластері", "Новий фільтр 'Ексти лише Сімпл і Аве'", "Виправлено block-ID detection"] },
    { version: "1.2.0", title: "1.2.0", items: ["Фільтр 'Відділити лідари': тепер чекає лише лідари з пріоритетом 1-19; лідари з пр.20 просто ігноруються без блокування", "Новий фільтр 'Інти окремо від мод': Interior Floor Plan 1-19 завжди першими в черзі, незалежно від глобальних правил пріоритетів", "Меню 'Ігнорувати': кожне поле тепер має власний чекбокс. Чекбокс вимк. = замовлення пропускається. Чекбокс увімк. = замовлення блокує лок (поле стає червоним)"] },
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

  function persistIgnoreIds() {
    try { localStorage.setItem(IGNORE_IDS_STORAGE_KEY, JSON.stringify(state.ignoreIds)); } catch (_err) { }
  }

  function persistIgnoreBlocks() {
    try { localStorage.setItem(IGNORE_BLOCKS_STORAGE_KEY, JSON.stringify(state.ignoreBlocks)); } catch (_err) { }
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
    try {
      const raw2 = localStorage.getItem(IGNORE_BLOCKS_STORAGE_KEY);
      if (raw2) {
        const parsed2 = JSON.parse(raw2);
        if (Array.isArray(parsed2)) {
          state.ignoreBlocks = Array.from({ length: 5 }, (_, i) => Boolean(parsed2[i]));
        }
      }
    } catch (_err) { }
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
    return { lidar_cluster: true, inti_cluster: true, p1: true, p2: true, p3_18: true, p19: true };
  }

  function normalizePriorityRules(rules) {
    const fallback = createDefaultPriorityRules();
    const source = rules && typeof rules === "object" ? rules : {};
    return {
      lidar_cluster: typeof source.lidar_cluster === "boolean" ? source.lidar_cluster : fallback.lidar_cluster,
      inti_cluster: typeof source.inti_cluster === "boolean" ? source.inti_cluster : fallback.inti_cluster,
      p1: typeof source.p1 === "boolean" ? source.p1 : fallback.p1,
      p2: typeof source.p2 === "boolean" ? source.p2 : fallback.p2,
      p3_18: typeof source.p3_18 === "boolean" ? source.p3_18 : fallback.p3_18,
      p19: typeof source.p19 === "boolean" ? source.p19 : fallback.p19,
    };
  }

  function clonePriorityRules(rules) { return normalizePriorityRules(rules); }

  function applyPriorityRulesMigration(rules, _migrationVersion) {
    // v4: no forced migration overrides; simply normalize
    return { rules: normalizePriorityRules(rules), migrationVersion: 1, changed: false };
  }

  function hasCustomPriorityRules() {
    return PRIORITY_RULE_DEFINITIONS.some((item) => !state.priorityRules[item.key]);
  }

  function getPriorityRulesSummary() {
    const disabled = PRIORITY_RULE_DEFINITIONS.filter((item) => !state.priorityRules[item.key]).map((item) => item.summaryLabel);
    return disabled.length > 0 ? `custom(${disabled.join(",")})` : "default";
  }

  function createDefaultFilterSnapshot() {
    const allP19 = Array.from({ length: 19 }, (_, i) => i + 1);
    const allP20 = Array.from({ length: FILTER_MAX }, (_, i) => i + 1);
    const allC = COMPLEXITY_LEVELS.map((item) => item.key);
    return {
      lidarEnabled: true,
      lidarPriorities: allP19.slice(),
      lidarComplexities: allC.slice(),
      lidarNoComplexity: false,
      intiEnabled: true,
      intiPriorities: allP19.slice(),
      intiComplexities: allC.slice(),
      intiNoComplexity: false,
      extyRoof: true,
      extyComplete: true,
      extyOther: true,
      extyPriorities: allP20.slice(),
      extyComplexities: allC.slice(),
      extyNoComplexity: false,
    };
  }

  function cloneFilterSnapshot(snapshot) {
    const s = snapshot && typeof snapshot === 'object' ? snapshot : createDefaultFilterSnapshot();
    const def = createDefaultFilterSnapshot();
    const arr = (v, d) => Array.isArray(v) ? v.slice() : d;
    const bool = (v, d) => typeof v === 'boolean' ? v : d;
    return {
      lidarEnabled: bool(s.lidarEnabled, def.lidarEnabled),
      lidarPriorities: arr(s.lidarPriorities, def.lidarPriorities),
      lidarComplexities: arr(s.lidarComplexities, def.lidarComplexities),
      lidarNoComplexity: bool(s.lidarNoComplexity, def.lidarNoComplexity),
      intiEnabled: bool(s.intiEnabled, def.intiEnabled),
      intiPriorities: arr(s.intiPriorities, def.intiPriorities),
      intiComplexities: arr(s.intiComplexities, def.intiComplexities),
      intiNoComplexity: bool(s.intiNoComplexity, def.intiNoComplexity),
      extyRoof: bool(s.extyRoof, def.extyRoof),
      extyComplete: bool(s.extyComplete, def.extyComplete),
      extyOther: bool(s.extyOther, def.extyOther),
      extyPriorities: arr(s.extyPriorities, def.extyPriorities),
      extyComplexities: arr(s.extyComplexities, def.extyComplexities),
      extyNoComplexity: bool(s.extyNoComplexity, def.extyNoComplexity),
    };
  }

  function buildCurrentFilterSnapshot() {
    return {
      lidarEnabled: state.lidarEnabled,
      lidarPriorities: Array.from(state.lidarPriorities).sort((a, b) => a - b),
      lidarComplexities: COMPLEXITY_LEVELS.filter((c) => state.lidarComplexities.has(c.key)).map((c) => c.key),
      lidarNoComplexity: state.lidarNoComplexity,
      intiEnabled: state.intiEnabled,
      intiPriorities: Array.from(state.intiPriorities).sort((a, b) => a - b),
      intiComplexities: COMPLEXITY_LEVELS.filter((c) => state.intiComplexities.has(c.key)).map((c) => c.key),
      intiNoComplexity: state.intiNoComplexity,
      extyRoof: state.extyRoof,
      extyComplete: state.extyComplete,
      extyOther: state.extyOther,
      extyPriorities: Array.from(state.extyPriorities).sort((a, b) => a - b),
      extyComplexities: COMPLEXITY_LEVELS.filter((c) => state.extyComplexities.has(c.key)).map((c) => c.key),
      extyNoComplexity: state.extyNoComplexity,
    };
  }

  function normalizePersistedFilterSlot(slot) {
    const def = createDefaultFilterSnapshot();
    if (!slot || typeof slot !== 'object') return def;
    const normP = (v, d) => {
      if (!Array.isArray(v)) return d;
      const s = new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= FILTER_MAX));
      return Array.from(s).sort((a, b) => a - b);
    };
    const normC = (v, d) => {
      if (!Array.isArray(v)) return d;
      const allowed = new Set(COMPLEXITY_LEVELS.map((c) => c.key));
      return Array.from(new Set(v.filter((k) => allowed.has(k))));
    };
    const bool = (v, d) => typeof v === 'boolean' ? v : d;
    return {
      lidarEnabled: bool(slot.lidarEnabled, def.lidarEnabled),
      lidarPriorities: normP(slot.lidarPriorities, def.lidarPriorities),
      lidarComplexities: normC(slot.lidarComplexities, def.lidarComplexities),
      lidarNoComplexity: bool(slot.lidarNoComplexity, def.lidarNoComplexity),
      intiEnabled: bool(slot.intiEnabled, def.intiEnabled),
      intiPriorities: normP(slot.intiPriorities, def.intiPriorities),
      intiComplexities: normC(slot.intiComplexities, def.intiComplexities),
      intiNoComplexity: bool(slot.intiNoComplexity, def.intiNoComplexity),
      extyRoof: bool(slot.extyRoof, def.extyRoof),
      extyComplete: bool(slot.extyComplete, def.extyComplete),
      extyOther: bool(slot.extyOther, def.extyOther),
      extyPriorities: normP(slot.extyPriorities, def.extyPriorities),
      extyComplexities: normC(slot.extyComplexities, def.extyComplexities),
      extyNoComplexity: bool(slot.extyNoComplexity, def.extyNoComplexity),
    };
  }

  function saveCurrentFiltersToActiveSlot() {
    state.filterSlots[state.activeFilterSlot] = buildCurrentFilterSnapshot();
  }

  function applyFilterSnapshot(snapshot) {
    const next = normalizePersistedFilterSlot(snapshot);
    state.lidarEnabled = next.lidarEnabled;
    state.lidarPriorities = new Set(next.lidarPriorities);
    state.lidarComplexities = new Set(next.lidarComplexities);
    state.lidarNoComplexity = next.lidarNoComplexity;
    state.intiEnabled = next.intiEnabled;
    state.intiPriorities = new Set(next.intiPriorities);
    state.intiComplexities = new Set(next.intiComplexities);
    state.intiNoComplexity = next.intiNoComplexity;
    state.extyRoof = next.extyRoof;
    state.extyComplete = next.extyComplete;
    state.extyOther = next.extyOther;
    state.extyPriorities = new Set(next.extyPriorities);
    state.extyComplexities = new Set(next.extyComplexities);
    state.extyNoComplexity = next.extyNoComplexity;
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
    try { localStorage.setItem(PRIORITY_RULES_STORAGE_KEY, JSON.stringify({ rules: clonePriorityRules(state.priorityRules), migrationVersion: 1, updatedAt: nowMs() })); }
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
    const lidarOn = state.lidarEnabled ? "L✓" : "L✗";
    const intiOn = state.intiEnabled ? "I✓" : "I✗";
    const extyParts = [state.extyRoof ? "R" : null, state.extyComplete ? "C" : null, state.extyOther ? "O" : null].filter(Boolean);
    const extyOn = extyParts.length > 0 ? extyParts.join("+") : "E✗";
    return `${lidarOn} ${intiOn} ${extyOn}`;
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

  // ── Block expand state (not persisted — UI only) ────────────────────────────
  const blockPrioExpanded = { lidar: false, inti: false, exty: false };

  function getPrioSetForBlock(block) {
    if (block === "lidar") return state.lidarPriorities;
    if (block === "inti") return state.intiPriorities;
    return state.extyPriorities;
  }

  function getComplexitySetForBlock(block) {
    if (block === "lidar") return state.lidarComplexities;
    if (block === "inti") return state.intiComplexities;
    return state.extyComplexities;
  }

  function getNoComplexityForBlock(block) {
    if (block === "lidar") return state.lidarNoComplexity;
    if (block === "inti") return state.intiNoComplexity;
    return state.extyNoComplexity;
  }

  function getMaxPrioForBlock(block) {
    return (block === "lidar" || block === "inti") ? 19 : FILTER_MAX;
  }

  function getPrioPresetLabel(block) {
    const prioSet = getPrioSetForBlock(block);
    const maxP = getMaxPrioForBlock(block);
    if (prioSet.size === 0) return "none";
    if (prioSet.size === 2 && prioSet.has(1) && prioSet.has(2)) return "occ";
    const full19 = prioSet.size === 19 && Array.from({ length: 19 }, (_, i) => i + 1).every((p) => prioSet.has(p));
    const fullMax = prioSet.size === maxP && Array.from({ length: maxP }, (_, i) => i + 1).every((p) => prioSet.has(p));
    if (full19 || fullMax) return "1_19";
    return "other";
  }

  function renderBlockPriorityRow(block, panelEl) {
    if (!panelEl) return;
    const preset = getPrioPresetLabel(block);
    const expanded = blockPrioExpanded[block];
    const maxP = getMaxPrioForBlock(block);
    const prioSet = getPrioSetForBlock(block);
    const noC = getNoComplexityForBlock(block);

    // Preset buttons
    ["pnone", "pocc", "p1_19", "pother"].forEach((kind) => {
      const btn = panelEl.querySelector(`[data-kind="${kind}"][data-block="${block}"]`);
      if (!btn) return;
      const active = (kind === "pnone" && preset === "none") ||
        (kind === "pocc" && preset === "occ") ||
        (kind === "p1_19" && preset === "1_19") ||
        (kind === "pother" && preset === "other");
      btn.style.background = active ? "#2e6ce6" : "#edf2fb";
      btn.style.borderColor = active ? "#2e6ce6" : "#b7c4dd";
      btn.style.color = active ? "#fff" : "#1d2b44";
    });

    // Expand button arrow
    const expandBtn = panelEl.querySelector(`[data-kind="pexpand"][data-block="${block}"]`);
    if (expandBtn) expandBtn.textContent = expanded ? "▲" : "▼";

    // Priority grid (shown/hidden)
    const pgrid = panelEl.querySelector(`[data-role="witch-mow-ar-pgrid-${block}"]`);
    if (pgrid) {
      pgrid.style.display = expanded ? "grid" : "none";
      if (expanded) {
        pgrid.innerHTML = Array.from({ length: maxP }, (_, i) => {
          const v = i + 1;
          const on = prioSet.has(v);
          const s = on ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;" : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
          return `<button type="button" data-role="witch-mow-ar-chip" data-kind="priority" data-block="${block}" data-value="${v}" style="height:24px;border:1px solid;border-radius:6px;font-size:10px;cursor:pointer;${s}">${v}</button>`;
        }).join("");
      }
    }

    // Complexity grid
    const cgrid = panelEl.querySelector(`[data-role="witch-mow-ar-cgrid-${block}"]`);
    if (cgrid) {
      const cs = getComplexitySetForBlock(block);
      cgrid.innerHTML = COMPLEXITY_LEVELS.map((item) => {
        const on = cs.has(item.key);
        const dis = noC;
        const s = on ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;" : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
        const ds = dis ? "opacity:.45;cursor:not-allowed;" : "";
        return `<button type="button" ${dis ? "disabled" : ""} data-role="witch-mow-ar-chip" data-kind="complexity" data-block="${block}" data-value="${item.key}" style="min-height:26px;padding:3px 2px;border:1px solid;border-radius:6px;font-size:10px;line-height:1.1;${s}${ds}">${item.label}</button>`;
      }).join("");
    }

    // No complexity checkbox
    const noCEl = panelEl.querySelector(`[data-role="witch-mow-ar-no-complexity"][data-block="${block}"]`);
    if (noCEl) noCEl.checked = noC;
  }

  function renderBlockHeader(block, panelEl) {
    if (!panelEl) return;
    const isEnabled = block === "lidar" ? state.lidarEnabled
      : block === "inti" ? state.intiEnabled
      : (state.extyRoof || state.extyComplete || state.extyOther);
    const toggleBtn = panelEl.querySelector(`[data-kind="block-toggle"][data-block="${block}"]`);
    if (toggleBtn) {
      toggleBtn.style.background = isEnabled ? "#2e6ce6" : "transparent";
      toggleBtn.style.color = isEnabled ? "#fff" : "#1d2b44";
    }
    if (block === "exty") {
      ["roof", "complete", "other"].forEach((extyKey) => {
        const on = extyKey === "roof" ? state.extyRoof : extyKey === "complete" ? state.extyComplete : state.extyOther;
        const btn = panelEl.querySelector(`[data-kind="exty-type"][data-exty="${extyKey}"]`);
        if (btn) {
          btn.style.background = on ? "#2e6ce6" : "#fff";
          btn.style.borderColor = on ? "#2e6ce6" : "#b7c4dd";
          btn.style.color = on ? "#fff" : "#1d2b44";
        }
      });
    }
  }

  function renderFilterPanel() {
    if (!filterPanelEl) return;
    filterPanelEl.style.display = state.filterOpen ? "block" : "none";
    renderPriorityRulesPanel();
    renderFilterSlotButtons();
    ["lidar", "inti", "exty"].forEach((block) => {
      renderBlockHeader(block, filterPanelEl);
      renderBlockPriorityRow(block, filterPanelEl);
    });
    renderFilterButtons();
  }

  function applyIgnoreFieldStyle(input, isBlock) {
    if (!input) return;
    if (isBlock) {
      input.style.borderColor = "#dc2626";
      input.style.color = "#dc2626";
    } else {
      input.style.borderColor = "#c7d2e8";
      input.style.color = "";
    }
  }

  function renderIgnorePanel() {
    if (!ignoreMenuEl) return;
    ignoreMenuEl.style.display = state.ignoreOpen ? "block" : "none";
    ignoreIdEls.forEach((input, i) => {
      if (input) {
        input.value = state.ignoreIds[i] || "";
        applyIgnoreFieldStyle(input, Boolean(state.ignoreBlocks[i]));
      }
    });
    ignoreBlockEls.forEach((cb, i) => {
      if (cb) cb.checked = Boolean(state.ignoreBlocks[i]);
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

  // ===== Matching & Cascade Logic (v4 — 3-block architecture) =====

  /**
   * Row classification helpers are defined near the top (isLidarRow, isIntiRow, isExtyRow).
   *
   * Cluster hierarchy (highest → lowest priority):
   *   1. LIDAR cluster  — all lidar rows 1-19 (if lidarEnabled and lidar_cluster rule on)
   *   2. INTI cluster   — all regular-inti rows 1-19 (if intiEnabled and inti_cluster rule on)
   *   3. EXTY clusters  — non-interior rows split by priority rules (p1, p2, p3_18, p19)
   *
   * "Тримати X окремо" means: if rows exist in cluster X but none pass filters → wait.
   * Otherwise → move to next cluster.
   */

  // ── Common guards ────────────────────────────────────────────────────────────

  function passesCommonGuards(row, ignoreSet) {
    if (ignoreSet.size > 0 && ignoreSet.has(compactText(String(row.id || "")))) return false;
    return true;
  }

  /** Returns Set of IDs that should be ignored (skipped silently, checkbox=false) */
  function getIgnoreIdSet() {
    return new Set(
      state.ignoreIds
        .map((id, i) => ({ id: compactText(String(id || "")), block: Boolean(state.ignoreBlocks[i]) }))
        .filter((e) => e.id.length > 0 && !e.block)
        .map((e) => e.id)
    );
  }

  /** Returns Set of IDs that should block locking (checkbox=true) */
  function getBlockIdSet() {
    return new Set(
      state.ignoreIds
        .map((id, i) => ({ id: compactText(String(id || "")), block: Boolean(state.ignoreBlocks[i]) }))
        .filter((e) => e.id.length > 0 && e.block)
        .map((e) => e.id)
    );
  }

  // ── Per-block row matching ───────────────────────────────────────────────────

  function rowMatchesLidarFilters(row) {
    if (!isLidarRow(row)) return false;
    if (!state.lidarEnabled) return false;
    if (!state.lidarPriorities.has(row.priority)) return false;
    if (state.lidarNoComplexity) return Boolean(row.complexityMissing);
    if (!row.complexityKey) return false;
    return state.lidarComplexities.has(row.complexityKey);
  }

  function rowMatchesIntiFilters(row) {
    if (!isIntiRow(row)) return false;
    if (!state.intiEnabled) return false;
    if (!state.intiPriorities.has(row.priority)) return false;
    if (state.intiNoComplexity) return Boolean(row.complexityMissing);
    if (!row.complexityKey) return false;
    return state.intiComplexities.has(row.complexityKey);
  }

  function rowMatchesExtyFilters(row) {
    if (!isExtyRow(row)) return false;
    const bucket = getExtyBucketKey(row.deliverableKey);
    if (bucket === "roof" && !state.extyRoof) return false;
    if (bucket === "complete" && !state.extyComplete) return false;
    if (bucket === "other" && !state.extyOther) return false;
    if (!state.extyPriorities.has(row.priority)) return false;
    if (state.extyNoComplexity) return Boolean(row.complexityMissing);
    if (!row.complexityKey) return false;
    return state.extyComplexities.has(row.complexityKey);
  }

  // ── Inti sorting: Custom first, then others (by table order within each group) ──

  function sortIntiRows(rows) {
    const custom = rows.filter((r) => r.complexityKey === "custom" && !state.intiNoComplexity);
    const others = rows.filter((r) => r.complexityKey !== "custom" || state.intiNoComplexity);
    return [...custom, ...others];
  }

  // ── Exty priority clusters (standard rules, apply only to exty) ─────────────

  function buildExtyClusters() {
    const clusters = [];
    let cur = [];
    for (let i = 0; i < PRIORITY_GROUP_SEQUENCE.length; i++) {
      const group = PRIORITY_GROUP_SEQUENCE[i];
      cur.push(group.key);
      const closed = group.ruleKey ? Boolean(state.priorityRules[group.ruleKey]) : true;
      if (closed || i === PRIORITY_GROUP_SEQUENCE.length - 1) {
        clusters.push({ keys: new Set(cur), rangeLabel: getPriorityGroupRangeLabel(cur) });
        cur = [];
      }
    }
    return clusters;
  }

  // ── Block-ID aware candidate search ─────────────────────────────────────────

  /**
   * Among `rows` that pass `matchFn`, find:
   *  - best: first that passes matchFn AND is not in blockSet AND not in ignoreSet
   *  - topBeforeBlock: first that passes matchFn AND not in ignoreSet (may be in blockSet)
   * Returns { best, topBeforeBlock }
   */
  function findBestWithBlockDetection(rows, matchFn, ignoreSet, blockSet) {
    let best = null, topBeforeBlock = null;
    for (const row of rows) {
      if (!passesCommonGuards(row, ignoreSet)) continue;
      if (!matchFn(row)) continue;
      if (!topBeforeBlock) topBeforeBlock = row;
      if (!blockSet.has(compactText(String(row.id || "")))) {
        if (!best) best = row;
      }
      if (best && topBeforeBlock) break;
    }
    return { best, topBeforeBlock };
  }

  // ── Main cascade ─────────────────────────────────────────────────────────────

  function getPriorityCascadeResult(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const present = getPresentPriorityGroups(list);
    const ignoreSet = getIgnoreIdSet();
    const blockSet = getBlockIdSet();

    // ── CORE PRINCIPLE ──────────────────────────────────────────────────────────
    // Cluster rules block descent based on PRESENCE of rows in the cluster,
    // regardless of whether those rows match the current filters.
    // Filters only decide WHETHER to lock, not whether to wait.
    //
    // Exception: rows in the ignore-list (checkbox OFF) are treated as non-existent
    // for both locking AND cluster presence checks.
    // Rows with block-checkbox ON are present for cluster checks but not locked.

    // ── 1. LIDAR cluster ────────────────────────────────────────────────────────
    if (state.priorityRules.lidar_cluster) {
      // Rule is ON → cluster blocks descent if ANY lidar 1-19 rows exist (ignoring ignore-list)
      const lidarRows = list.filter((r) =>
        isLidarRow(r) && Number.isFinite(r.priority) && r.priority >= 1 && r.priority <= 19 &&
        passesCommonGuards(r, ignoreSet)
      );
      if (lidarRows.length > 0) {
        // Cluster non-empty → try to lock if block enabled
        if (state.lidarEnabled) {
          const { best, topBeforeBlock } = findBestWithBlockDetection(lidarRows, rowMatchesLidarFilters, ignoreSet, blockSet);
          if (topBeforeBlock && blockSet.has(compactText(String(topBeforeBlock.id || "")))) {
            if (!best) return makeWaitResult(present, "Лідар", `Блокуюче замовлення ${topBeforeBlock.id} в черзі лідарів — чекаю`);
          }
          if (best) return makeLockResult(best, present, "Лідари");
        }
        // Either block disabled or nothing matched — rule says WAIT regardless
        return makeWaitResult(present, "Лідар", "Є лідари в черзі — чекаю (Тримати Лідари окремо)");
      }
      // Cluster empty → fall through
    } else if (state.lidarEnabled) {
      // Rule OFF but block enabled → try to lock lidar rows (no blocking of descent)
      const lidarRows = list.filter((r) =>
        isLidarRow(r) && Number.isFinite(r.priority) && r.priority >= 1 && r.priority <= 19 &&
        passesCommonGuards(r, ignoreSet)
      );
      if (lidarRows.length > 0) {
        const { best, topBeforeBlock } = findBestWithBlockDetection(lidarRows, rowMatchesLidarFilters, ignoreSet, blockSet);
        if (topBeforeBlock && blockSet.has(compactText(String(topBeforeBlock.id || "")))) {
          if (!best) return makeWaitResult(present, "Лідар", `Блокуюче замовлення ${topBeforeBlock.id} в черзі лідарів — чекаю`);
        }
        if (best) return makeLockResult(best, present, "Лідари");
        // No match → rule OFF so continue to next cluster
      }
    }

    // ── 2. INTI cluster ─────────────────────────────────────────────────────────
    if (state.priorityRules.inti_cluster) {
      const intiRows = list.filter((r) =>
        isIntiRow(r) && Number.isFinite(r.priority) && r.priority >= 1 && r.priority <= 19 &&
        passesCommonGuards(r, ignoreSet)
      );
      if (intiRows.length > 0) {
        if (state.intiEnabled) {
          const sortedInti = sortIntiRows(intiRows);
          const { best, topBeforeBlock } = findBestWithBlockDetection(sortedInti, rowMatchesIntiFilters, ignoreSet, blockSet);
          if (topBeforeBlock && blockSet.has(compactText(String(topBeforeBlock.id || "")))) {
            if (!best) return makeWaitResult(present, "Інті", `Блокуюче замовлення ${topBeforeBlock.id} в черзі інтів — чекаю`);
          }
          if (best) return makeLockResult(best, present, "Інті");
        }
        return makeWaitResult(present, "Інті", "Є інт'єри в черзі — чекаю (Тримати Інтер'єри окремо)");
      }
    } else if (state.intiEnabled) {
      const intiRows = list.filter((r) =>
        isIntiRow(r) && Number.isFinite(r.priority) && r.priority >= 1 && r.priority <= 19 &&
        passesCommonGuards(r, ignoreSet)
      );
      if (intiRows.length > 0) {
        const sortedInti = sortIntiRows(intiRows);
        const { best, topBeforeBlock } = findBestWithBlockDetection(sortedInti, rowMatchesIntiFilters, ignoreSet, blockSet);
        if (topBeforeBlock && blockSet.has(compactText(String(topBeforeBlock.id || "")))) {
          if (!best) return makeWaitResult(present, "Інті", `Блокуюче замовлення ${topBeforeBlock.id} в черзі інтів — чекаю`);
        }
        if (best) return makeLockResult(best, present, "Інті");
      }
    }

    // ── 3. EXTY clusters ─────────────────────────────────────────────────────────
    // Priority rules (p1/p2/p3_18/p19) block descent based on PRESENCE of any Exty rows
    // in the cluster — regardless of type/priority/complexity filter selection.
    // Only if the cluster is completely empty do we move to the next cluster.
    // If exty filters are all off/empty → we still walk clusters but lock nothing.

    const extyEnabled = state.extyRoof || state.extyComplete || state.extyOther;
    const extyClusters = buildExtyClusters();

    for (const cluster of extyClusters) {
      // All exty rows in this cluster (ignoring ignore-list but not block-list)
      const clusterRows = list.filter((r) =>
        isExtyRow(r) &&
        cluster.keys.has(getPriorityGroupKey(r.priority)) &&
        passesCommonGuards(r, ignoreSet)
      );
      if (clusterRows.length === 0) continue; // Cluster empty → next cluster

      // Cluster is non-empty. Try to lock if exty filters are configured.
      if (extyEnabled) {
        const { best, topBeforeBlock } = findBestWithBlockDetection(clusterRows, rowMatchesExtyFilters, ignoreSet, blockSet);

        if (topBeforeBlock && blockSet.has(compactText(String(topBeforeBlock.id || "")))) {
          const nextResult = findBestWithBlockDetection(
            clusterRows.filter((r) => compactText(String(r.id || "")) !== compactText(String(topBeforeBlock.id || ""))),
            rowMatchesExtyFilters, ignoreSet, blockSet
          );
          if (nextResult.best) return makeLockResult(nextResult.best, present, cluster.rangeLabel);
          // Blocked, no alternative → wait (cluster is non-empty)
          return makeWaitResult(present, cluster.rangeLabel, `Блокуюче замовлення ${topBeforeBlock.id} в черзі — чекаю`);
        }

        if (best) return makeLockResult(best, present, cluster.rangeLabel);
      }

      // Cluster is non-empty but nothing locked (either exty disabled, or type/priority/complexity
      // doesn't match). Either way — cluster blocks descent to next priority cluster.
      // Show appropriate wait message.
      return makeWaitResult(present, cluster.rangeLabel,
        `Є замовлення в групі ${cluster.rangeLabel} що не підходять під фільтри — чекаю`);
    }

    return { row: null, cascadeInfo: createEmptyCascadeInfo(list) };
  }

  function makeLockResult(row, present, rangeLabel) {
    return {
      row,
      cascadeInfo: {
        activeGroupKey: "", activeGroupKeys: [], activeRangeLabel: String(rangeLabel || ""),
        presentGroups: present, status: `Знайдено: ${row.id}`, wait: "",
      },
    };
  }

  function makeWaitResult(present, rangeLabel, waitMsg) {
    return {
      row: null,
      cascadeInfo: {
        activeGroupKey: "", activeGroupKeys: [], activeRangeLabel: String(rangeLabel || ""),
        presentGroups: present, status: waitMsg, wait: waitMsg, lidarBlocked: false,
      },
    };
  }

  function getTopMatchedRow(parsed) {
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    return getPriorityCascadeResult(rows);
  }

  function getCustomInteriorCandidates(parsed) {
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    const ignoreSet = getIgnoreIdSet();
    const blockSet = getBlockIdSet();
    return rows.filter((row) => {
      if (!isIntiRow(row)) return false;
      if (row.complexityKey !== "custom") return false;
      if (!state.intiEnabled) return false;
      if (!state.intiComplexities.has("custom") && !state.intiNoComplexity) return false;
      if (!state.intiPriorities.has(row.priority)) return false;
      if (ignoreSet.size > 0 && ignoreSet.has(compactText(String(row.id || "")))) return false;
      if (blockSet.size > 0 && blockSet.has(compactText(String(row.id || "")))) return false;
      return true;
    });
  }

  function getBlockingInvalidRowCount(parsed, topRow) {
    if (!parsed || !Array.isArray(parsed.rows) || !topRow) return 0;
    let count = 0;
    for (const row of parsed.rows) {
      if (String(row.id || "") === String(topRow.id || "")) break;
      if (row.invalidReason) count += 1;
    }
    return count;
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

  async function multiClickCustomInterior(parsed) {
    const candidates = getCustomInteriorCandidates(parsed);
    if (candidates.length <= 1) return false;
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
            tgNotifyLock(row);
            try { const opened = window.open(targetUrl, "_blank", "noopener"); if (opened) { try { opened.opener = null; } catch (_e) { } } } catch (_e) { }
            stopAuto("Автолок зупинено: лок підтверджено", "Зупинено", `Стоп: лок ${row.id}`, "ok", "lock_opened", { orderId: String(row.id) });
            return true;
          }
        }
      } catch (_err) { /* continue */ }
      await sleep(100);
    }
    return false;
  }

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
        tgNotifyLock(row);
        try { const opened = window.open(targetUrl, "_blank", "noopener"); if (opened) { try { opened.opener = null; } catch (_err) { } } } catch (_err) { }
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
      console.error("[witch-mow-ar] background lock failed:", err);
    } finally {
      if (!controller || state.lockAttemptController === controller) state.lockAttemptController = null;
      if (state.lockAttemptRunId === runIdAtStart) state.lockAttemptRunId = "";
      if (!state.lockAttemptController && !state.lockAttemptRunId) state.lockAttemptInFlight = false;
    }
  }

  function runAutoLockAction(parsed, precomputedMatch) {
    renderFilterButtons();
    if (!state.enabled) return;
    if (state.lockAttemptInFlight) return;
    if (state.locked) return;

    const match = precomputedMatch !== undefined ? precomputedMatch : getTopMatchedRow(parsed);
    const top = match && match.row ? match.row : null;
    const cascadeInfo = match && match.cascadeInfo ? match.cascadeInfo : createEmptyCascadeInfo(parsed && parsed.rows);

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

  // ===== Shift-Wait Logic =====

  function getShiftWindowForNow() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    const totalS = h * 3600 + m * 60 + s;
    for (const w of SHIFT_WINDOWS) {
      const startS = w.start[0] * 3600 + w.start[1] * 60 + w.start[2];
      const endS   = w.end[0]   * 3600 + w.end[1]   * 60 + w.end[2];
      if (totalS >= startS && totalS < endS) return w;
    }
    return null;
  }

  function getMsUntilLockTime(window) {
    const now = new Date();
    const target = new Date(now);
    target.setHours(window.lock[0], window.lock[1], window.lock[2], 0);
    return Math.max(0, target - now);
  }

  function applyShiftBtnState(newState) {
    state.shiftBtnState = newState;
    persistShiftBtnState();
    renderShiftBtn();
  }

  function onShiftBtnClick() {
    if (state.shiftBtnState === "off") {
      // Determine state based on current time
      const win = getShiftWindowForNow();
      applyShiftBtnState(win ? "waiting" : "active");
    } else {
      // Toggle off
      clearShiftWaitTimeout();
      applyShiftBtnState("off");
    }
  }

  function clearShiftWaitTimeout() {
    if (state.shiftWaitTimeout) { clearTimeout(state.shiftWaitTimeout); state.shiftWaitTimeout = null; }
  }

  /** Called from startAuto — if shift-wait active, schedules the wait and returns true (caller should return) */
  function handleShiftWaitOnStart() {
    if (state.shiftBtnState !== "waiting") return false;
    const win = getShiftWindowForNow();
    if (!win) {
      applyShiftBtnState("active");
      return false;
    }
    const msUntilLock = getMsUntilLockTime(win);
    if (msUntilLock <= 0) {
      applyShiftBtnState("active");
      return false;
    }
    const lockH = win.lock[0], lockM = String(win.lock[1]).padStart(2, "0"), lockS = String(win.lock[2]).padStart(2, "0");
    setStatus(`Очікування зміни — старт о ${lockH}:${lockM}:${lockS}`, "warn");
    setAction("Shift-wait: чекаю часу початку зміни", "warn");
    state.enabled = false;
    setAutoOn();
    clearShiftWaitTimeout();

    // 1. After (msUntilLock - 1000ms): one single page refresh to get fresh list
    // 2. After msUntilLock: start locking immediately (no refresh — list already fresh)
    const msUntilRefresh = Math.max(0, msUntilLock - 1000);

    state.shiftWaitTimeout = setTimeout(() => {
      state.shiftWaitTimeout = null;
      setStatus("Shift-wait: оновлюю список перед стартом…", "warn");
      // Single refresh to get fresh data
      void refreshNow("shift_prelck", false).then(() => {
        // Now wait the remaining ~1s until lock time, then start
        const remaining = getMsUntilLockTime(win);
        state.shiftWaitTimeout = setTimeout(() => {
          state.shiftWaitTimeout = null;
          applyShiftBtnState("active");
          startAuto();
        }, Math.max(0, remaining));
      });
    }, msUntilRefresh);

    return true;
  }

  function renderShiftBtn() {
    if (!shiftBtnEl) return;
    const s = state.shiftBtnState;
    if (s === "off") {
      shiftBtnEl.style.background = "transparent";
      shiftBtnEl.style.borderColor = "#d2d8e5";
      shiftBtnEl.style.color = "#64748b";
    } else if (s === "waiting") {
      shiftBtnEl.style.background = "#dc2626";
      shiftBtnEl.style.borderColor = "#dc2626";
      shiftBtnEl.style.color = "#fff";
    } else {
      shiftBtnEl.style.background = "#2563eb";
      shiftBtnEl.style.borderColor = "#2563eb";
      shiftBtnEl.style.color = "#fff";
    }
  }

  // ===== No-Stop (Stopwatch) Logic =====

  function renderNoStopBtn() {
    if (!noStopBtnEl) return;
    noStopBtnEl.style.background = state.noStopEnabled ? "#2563eb" : "transparent";
    noStopBtnEl.style.borderColor = state.noStopEnabled ? "#2563eb" : "#d2d8e5";
    noStopBtnEl.style.color = state.noStopEnabled ? "#fff" : "#64748b";
  }

  // ===== Telegram Notification Logic =====

  function renderTgBtn() {
    if (!tgNotifBtnEl) return;
    tgNotifBtnEl.style.background = state.tgNotifEnabled ? "#2563eb" : "transparent";
    tgNotifBtnEl.style.borderColor = state.tgNotifEnabled ? "#2563eb" : "#d2d8e5";
    tgNotifBtnEl.style.color = state.tgNotifEnabled ? "#fff" : "#64748b";
  }

  async function sendTelegramMessage(text) {
    const token = compactText(String(state.tgToken || ""));
    const chatId = compactText(String(state.tgChatId || ""));
    if (!token || !chatId) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
    } catch (_err) { /* silent */ }
  }

  function tgNotifyLock(row) {
    if (!state.tgNotifEnabled) return;
    const deliverable = String(row.deliverableText || row.deliverableKey || "—");
    const complexity = String(row.complexityText || row.complexityKey || "—");
    const id = String(row.id || "—");
    const priority = row.priority ? `P${row.priority}` : "—";
    void sendTelegramMessage(`🔒 Лок: <b>${id}</b>\nТип: ${deliverable}\nСкладність: ${complexity}\nПріоритет: ${priority}`);
  }

  function tgNotifyStop(stopped, reason) {
    if (!state.tgNotifEnabled) return;
    const noStop = state.noStopEnabled;
    if (reason === "hard_limit_3m") {
      const msg = noStop
        ? "⏱ Пройшло 3 хв — <b>продовжую пошук</b>"
        : "⏱ Пройшло 3 хв — <b>скрипт зупинено</b>";
      void sendTelegramMessage(msg);
    }
  }

  // ===== Persist / Restore new features =====

  function persistShiftBtnState() {
    try { localStorage.setItem(SHIFT_BTN_STORAGE_KEY, state.shiftBtnState); } catch (_e) {}
  }
  function persistNoStop() {
    try { localStorage.setItem(NO_STOP_STORAGE_KEY, state.noStopEnabled ? "1" : "0"); } catch (_e) {}
  }
  function persistTgNotif() {
    try { localStorage.setItem(TG_NOTIF_STORAGE_KEY, state.tgNotifEnabled ? "1" : "0"); } catch (_e) {}
  }
  function persistTgCredentials() {
    try {
      localStorage.setItem(TG_TOKEN_STORAGE_KEY, state.tgToken || "");
      localStorage.setItem(TG_CHAT_STORAGE_KEY, state.tgChatId || "");
    } catch (_e) {}
  }

  function restoreNewFeatures() {
    try {
      const s = localStorage.getItem(SHIFT_BTN_STORAGE_KEY);
      state.shiftBtnState = (s === "active" || s === "waiting" || s === "off") ? s : "off";
      // Always reset waiting state on reload — user must re-press
      if (state.shiftBtnState === "waiting") state.shiftBtnState = "off";
    } catch (_e) { state.shiftBtnState = "off"; }
    try { state.noStopEnabled = localStorage.getItem(NO_STOP_STORAGE_KEY) === "1"; } catch (_e) { state.noStopEnabled = false; }
    try { state.tgNotifEnabled = localStorage.getItem(TG_NOTIF_STORAGE_KEY) === "1"; } catch (_e) { state.tgNotifEnabled = false; }
    try { state.tgToken = localStorage.getItem(TG_TOKEN_STORAGE_KEY) || ""; } catch (_e) { state.tgToken = ""; }
    try { state.tgChatId = localStorage.getItem(TG_CHAT_STORAGE_KEY) || ""; } catch (_e) { state.tgChatId = ""; }
  }

  function hardStop() {
    tgNotifyStop(true, "hard_limit_3m");
    if (state.noStopEnabled && state.enabled) {
      // Don't stop — reset timer and keep going
      state.runStartedAt = nowMs();
      notifyUserOnce("hard_limit_nostop", "⏱ Пройшло 3 хв — продовжую пошук (No-Stop увімкнено)");
      setAction("3 хв минуло — продовжую (No-Stop)", "warn");
      scheduleAuto();
      return;
    }
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
      // ── OPTIMIZATION: find candidate BEFORE DOM manipulation ──────────────
      // This means we start the lock request as early as possible,
      // while DOM update and visual sync happen in parallel.
      const currentMatch = state.enabled ? getTopMatchedRow(parsed) : null;
      const wasEnabledBeforeLockCheck = state.enabled;
      setLockInfo(lockInfo);
      const stoppedByLock = wasEnabledBeforeLockCheck && !state.enabled && Boolean(lockInfo && lockInfo.locked);
      state.lastFingerprint = parsed.fingerprint;
      state.lastUpdatedAt = nowMs();
      state.errorStreak = 0;
      state.domMismatchStreak = 0;
      setLast(state.lastUpdatedAt);
      setUserEmail(currentUserEmail);
      if (!stoppedByLock) {
        // Fire lock attempt immediately — don't wait for DOM/visual updates
        const refreshLabel = getRefreshChangeLabel(changed);
        setStatus(`Оновлено: ${refreshLabel}`, "ok");
        setAction(`Оновлено: ${refreshLabel}`, "ok");
        runAutoLockAction(parsed, currentMatch);
        // DOM update and visual sync after lock attempt is already in flight
        replaceAssignmentsTable(doc);
        syncAssignmentsVisualState(parsed, currentMatch && currentMatch.cascadeInfo ? currentMatch.cascadeInfo : createEmptyCascadeInfo(parsed && parsed.rows), Boolean(currentMatch && currentMatch.cascadeInfo && currentMatch.cascadeInfo.wait && !(currentMatch && currentMatch.row)));
      } else {
        replaceAssignmentsTable(doc);
        syncAssignmentsVisualState(parsed, currentMatch && currentMatch.cascadeInfo ? currentMatch.cascadeInfo : createEmptyCascadeInfo(parsed && parsed.rows), Boolean(currentMatch && currentMatch.cascadeInfo && currentMatch.cascadeInfo.wait && !(currentMatch && currentMatch.row)));
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
    // Shift-wait: if button is in "waiting" state, schedule the wait and return
    if (handleShiftWaitOnStart()) return;
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
      '<div style="display:flex;align-items:center;gap:4px;">' +
      // Shift-wait button
      '<button type="button" data-role="witch-mow-ar-shift-btn" title="Очікування зміни (7:20 / 15:50)" style="border:1px solid #d2d8e5;background:transparent;color:#64748b;font-size:11px;font-weight:700;line-height:1;cursor:pointer;padding:2px 6px;border-radius:6px;min-width:28px;">1!</button>' +
      // No-stop (stopwatch) button
      '<button type="button" data-role="witch-mow-ar-nostop-btn" title="Не зупинятись після 3 хв" style="border:1px solid #d2d8e5;background:transparent;color:#64748b;font-size:13px;line-height:1;cursor:pointer;padding:2px 5px;border-radius:6px;">⏱</button>' +
      // Telegram notification bell button
      '<button type="button" data-role="witch-mow-ar-tg-btn" title="Сповіщення в Telegram" style="border:1px solid #d2d8e5;background:transparent;color:#64748b;font-size:13px;line-height:1;cursor:pointer;padding:2px 5px;border-radius:6px;">🔔</button>' +
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
      '<div style="font-size:11px;font-weight:700;color:#8a5f00;margin-bottom:4px;">Додаткові правила</div>' +
      '<div style="font-size:10px;line-height:1.35;color:#8a5f00;margin-bottom:6px;">Перші два правила стосуються кластерів Lidar та Interior. Решта — лише для не-інтеріорів.</div>' +
      `<div style="display:grid;gap:6px;">${priorityRulesMarkup}</div>` +
      "</div>" +
      // Filter panel — 3 blocks: Lidar, Inti, Exty
      '<div data-role="witch-mow-ar-filter-panel" style="display:none;padding:8px;border:1px solid #cfd8ea;border-radius:8px;background:#fff;">' +
      // Header: meta + slots
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">' +
      '<div data-role="witch-mow-ar-filter-meta" style="min-width:0;font-size:11px;color:#31405f;">Шаблон 1</div>' +
      '<div data-role="witch-mow-ar-filter-slots" style="display:inline-flex;align-items:center;border-radius:7px;background:#ef4444;color:#fff;overflow:hidden;"></div>' +
      '</div>' +
      // ── LIDAR BLOCK ──
      '<div data-role="witch-mow-ar-block-lidar" style="border:1px solid #c7d2e8;border-radius:8px;margin-bottom:8px;overflow:hidden;">' +
      '<div style="display:flex;align-items:center;gap:0;background:#f1f5fb;">' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="block-toggle" data-block="lidar" style="flex:1;border:0;background:transparent;text-align:left;padding:7px 10px;font-size:12px;font-weight:700;color:#1d2b44;cursor:pointer;">Lidar</button>' +
      '</div>' +
      '<div data-role="witch-mow-ar-block-lidar-body" style="padding:8px;">' +
      // Lidar priority row
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pnone" data-block="lidar" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Ніякі</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pocc" data-block="lidar" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">ОЦЦ 1-2</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="p1_19" data-block="lidar" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">1-19</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pother" data-block="lidar" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Інше</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pexpand" data-block="lidar" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 8px;border-radius:999px;font-size:10px;cursor:pointer;" title="Показати/сховати окремі пріоритети">▼</button>' +
      '</div>' +
      '<div data-role="witch-mow-ar-pgrid-lidar" style="display:none;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px;margin-bottom:4px;"></div>' +
      '<div data-role="witch-mow-ar-cgrid-lidar" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;"></div>' +
      '<label style="display:flex;align-items:center;gap:5px;font-size:10px;color:#64748b;margin-top:4px;cursor:pointer;">' +
      '<input type="checkbox" data-role="witch-mow-ar-no-complexity" data-block="lidar" style="margin:0;">Без складності</label>' +
      '</div></div>' +
      // ── INTI BLOCK ──
      '<div data-role="witch-mow-ar-block-inti" style="border:1px solid #c7d2e8;border-radius:8px;margin-bottom:8px;overflow:hidden;">' +
      '<div style="display:flex;align-items:center;gap:0;background:#f1f5fb;">' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="block-toggle" data-block="inti" style="flex:1;border:0;background:transparent;text-align:left;padding:7px 10px;font-size:12px;font-weight:700;color:#1d2b44;cursor:pointer;">Interior Floor Plan</button>' +
      '</div>' +
      '<div data-role="witch-mow-ar-block-inti-body" style="padding:8px;">' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pnone" data-block="inti" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Ніякі</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pocc" data-block="inti" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">ОЦЦ 1-2</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="p1_19" data-block="inti" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">1-19</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pother" data-block="inti" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Інше</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pexpand" data-block="inti" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 8px;border-radius:999px;font-size:10px;cursor:pointer;" title="Показати/сховати окремі пріоритети">▼</button>' +
      '</div>' +
      '<div data-role="witch-mow-ar-pgrid-inti" style="display:none;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px;margin-bottom:4px;"></div>' +
      '<div data-role="witch-mow-ar-cgrid-inti" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;"></div>' +
      '<label style="display:flex;align-items:center;gap:5px;font-size:10px;color:#64748b;margin-top:4px;cursor:pointer;">' +
      '<input type="checkbox" data-role="witch-mow-ar-no-complexity" data-block="inti" style="margin:0;">Без складності</label>' +
      '</div></div>' +
      // ── EXTY BLOCK ──
      '<div data-role="witch-mow-ar-block-exty" style="border:1px solid #c7d2e8;border-radius:8px;margin-bottom:6px;overflow:hidden;">' +
      '<div style="display:flex;align-items:center;gap:4px;background:#f1f5fb;padding:6px 8px;">' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="exty-type" data-exty="roof" style="border:1px solid #b7c4dd;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Roof</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="exty-type" data-exty="complete" style="border:1px solid #b7c4dd;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Complete</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="exty-type" data-exty="other" style="border:1px solid #b7c4dd;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Other</button>' +
      '</div>' +
      '<div style="padding:8px;">' +
      '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pnone" data-block="exty" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Ніякі</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pocc" data-block="exty" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">ОЦЦ 1-2</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="p1_19" data-block="exty" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">1-19</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pother" data-block="exty" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Інше</button>' +
      '<button type="button" data-role="witch-mow-ar-chip" data-kind="pexpand" data-block="exty" style="border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:3px 8px;border-radius:999px;font-size:10px;cursor:pointer;" title="Показати/сховати окремі пріоритети">▼</button>' +
      '</div>' +
      '<div data-role="witch-mow-ar-pgrid-exty" style="display:none;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px;margin-bottom:4px;"></div>' +
      '<div data-role="witch-mow-ar-cgrid-exty" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;"></div>' +
      '<label style="display:flex;align-items:center;gap:5px;font-size:10px;color:#64748b;margin-top:4px;cursor:pointer;">' +
      '<input type="checkbox" data-role="witch-mow-ar-no-complexity" data-block="exty" style="margin:0;">Без складності</label>' +
      '</div></div>' +
      '</div>' + // end filter-panel


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
      // Ignore menu
      '<div style="margin-bottom:8px;">' +
      '<button type="button" data-role="witch-mow-ar-ignore-toggle" style="width:100%;display:flex;align-items:center;justify-content:space-between;border:1px solid #c7d2e8;background:#f1f5fb;color:#1d2b44;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">' +
      '<span>Ігнорувати замовлення</span><span data-role="witch-mow-ar-ignore-arrow" style="font-size:10px;">▼</span>' +
      "</button>" +
      '<div data-role="witch-mow-ar-ignore-panel" style="display:none;padding:8px;border:1px solid #c7d2e8;border-top:0;border-radius:0 0 8px 8px;background:#f9fbff;">' +
      '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">Введіть ID — <b>чекбокс вимк.</b>: замовлення ігнорується (скіпається). <b>Чекбокс увімк.</b>: замовлення блокує лок (чекаємо поки зникне).</div>' +
      Array.from({ length: 5 }, (_, i) =>
        `<div data-role="witch-mow-ar-ignore-row" data-index="${i}" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">` +
        `<input type="text" data-role="witch-mow-ar-ignore-id" data-index="${i}" placeholder="ID замовлення" maxlength="20" style="flex:1;min-width:0;box-sizing:border-box;padding:5px 8px;border:1px solid #c7d2e8;border-radius:6px;font-size:11px;font-family:monospace;">` +
        `<input type="checkbox" data-role="witch-mow-ar-ignore-block" data-index="${i}" title="Блокувати лок замість ігнорування" style="margin:0;flex:0 0 auto;width:16px;height:16px;cursor:pointer;accent-color:#dc2626;">` +
        `</div>`
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
      '<div style="' + settingsRowStyle + 'flex-direction:column;align-items:stretch;gap:6px;">' +
      '<span style="' + settingsTitleStyle + '">Telegram Bot (для 🔔)</span>' +
      '<input type="text" data-role="witch-mow-ar-tg-token" placeholder="Bot Token" autocomplete="off" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font-size:11px;font-family:monospace;">' +
      '<input type="text" data-role="witch-mow-ar-tg-chat" placeholder="Chat ID" autocomplete="off" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font-size:11px;font-family:monospace;">' +
      '<button type="button" data-role="witch-mow-ar-tg-test" style="border:1px solid #cbd5e1;background:#fff;color:#334155;padding:6px 10px;border-radius:8px;font-size:11px;cursor:pointer;">Тест TG</button>' +
      '</div>' +
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
    filterMetaEl = panel.querySelector('[data-role="witch-mow-ar-filter-meta"]');
    ignoreMenuEl = panel.querySelector('[data-role="witch-mow-ar-ignore-panel"]');
    ignoreIdEls = Array.from(panel.querySelectorAll('[data-role="witch-mow-ar-ignore-id"]'));
    ignoreBlockEls = Array.from(panel.querySelectorAll('[data-role="witch-mow-ar-ignore-block"]'));
    ignoreBtnEl = panel.querySelector('[data-role="witch-mow-ar-ignore-clear"]');
    shiftBtnEl   = panel.querySelector('[data-role="witch-mow-ar-shift-btn"]');
    noStopBtnEl  = panel.querySelector('[data-role="witch-mow-ar-nostop-btn"]');
    tgNotifBtnEl = panel.querySelector('[data-role="witch-mow-ar-tg-btn"]');
    tgTokenInputEl = panel.querySelector('[data-role="witch-mow-ar-tg-token"]');
    tgChatInputEl  = panel.querySelector('[data-role="witch-mow-ar-tg-chat"]');

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

    // ── New feature button listeners ──
    if (shiftBtnEl) shiftBtnEl.addEventListener("click", () => { onShiftBtnClick(); });
    if (noStopBtnEl) noStopBtnEl.addEventListener("click", () => {
      state.noStopEnabled = !state.noStopEnabled;
      persistNoStop(); renderNoStopBtn();
      setAction(state.noStopEnabled ? "No-Stop увімкнено: скрипт не зупиниться через 3 хв" : "No-Stop вимкнено", "ok");
    });
    if (tgNotifBtnEl) tgNotifBtnEl.addEventListener("click", () => {
      state.tgNotifEnabled = !state.tgNotifEnabled;
      persistTgNotif(); renderTgBtn();
      setAction(state.tgNotifEnabled ? "TG-сповіщення увімкнено" : "TG-сповіщення вимкнено", "ok");
    });
    if (tgTokenInputEl) {
      tgTokenInputEl.value = state.tgToken || "";
      tgTokenInputEl.addEventListener("input", () => { state.tgToken = tgTokenInputEl.value.trim(); persistTgCredentials(); });
    }
    if (tgChatInputEl) {
      tgChatInputEl.value = state.tgChatId || "";
      tgChatInputEl.addEventListener("input", () => { state.tgChatId = tgChatInputEl.value.trim(); persistTgCredentials(); });
    }
    const tgTestBtn = panel.querySelector('[data-role="witch-mow-ar-tg-test"]');
    if (tgTestBtn) tgTestBtn.addEventListener("click", () => {
      void sendTelegramMessage("🔔 Тест Witch Autolock: з'єднання з Telegram працює!");
      setAction("TG тест відправлено", "ok");
    });

    // Initial render of new buttons
    renderShiftBtn(); renderNoStopBtn(); renderTgBtn();

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
        applyIgnoreFieldStyle(input, Boolean(state.ignoreBlocks[i]));
      });
    });

    // Ignore block checkboxes — toggle block mode per slot
    ignoreBlockEls.forEach((cb, i) => {
      if (!cb) return;
      cb.addEventListener("change", () => {
        state.ignoreBlocks[i] = Boolean(cb.checked);
        persistIgnoreBlocks();
        applyIgnoreFieldStyle(ignoreIdEls[i], state.ignoreBlocks[i]);
      });
    });

    // Ignore clear btn
    if (ignoreBtnEl) {
      ignoreBtnEl.addEventListener("click", () => {
        state.ignoreIds = ["", "", "", "", ""];
        state.ignoreBlocks = [false, false, false, false, false];
        persistIgnoreIds();
        persistIgnoreBlocks();
        ignoreIdEls.forEach((input) => { if (input) { input.value = ""; applyIgnoreFieldStyle(input, false); } });
        ignoreBlockEls.forEach((cb) => { if (cb) cb.checked = false; });
        setAction("Список ігнорування очищено", "ok");
      });
    }

    // Filter panel click handler — 3-block architecture
    filterPanelEl.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      let changed = false;
      const kind = target.getAttribute("data-kind") || "";
      const block = target.getAttribute("data-block") || "";
      const rawValue = target.getAttribute("data-value") || "";
      const role = target.getAttribute("data-role") || "";

      if (role === "witch-mow-ar-filter-slot") {
        const slotId = Number(target.getAttribute("data-slot") || "");
        if (switchFilterSlot(slotId)) { changed = true; setAction(`${getFilterSlotSummary(slotId)} активовано`, "ok"); }
      }

      // Block enable/disable toggle (header button)
      if (kind === "block-toggle") {
        if (block === "lidar") { state.lidarEnabled = !state.lidarEnabled; changed = true; }
        if (block === "inti") { state.intiEnabled = !state.intiEnabled; changed = true; }
        // exty block-toggle not used (individual type buttons handle it)
      }

      // Exty type toggles (Roof / Complete / Other)
      if (kind === "exty-type") {
        const extyKey = target.getAttribute("data-exty") || "";
        if (extyKey === "roof") { state.extyRoof = !state.extyRoof; changed = true; }
        if (extyKey === "complete") { state.extyComplete = !state.extyComplete; changed = true; }
        if (extyKey === "other") { state.extyOther = !state.extyOther; changed = true; }
      }

      // Priority preset buttons
      if (kind === "pnone" && block) {
        getPrioSetForBlock(block).clear(); changed = true;
      }
      if (kind === "pocc" && block) {
        const ps = getPrioSetForBlock(block); ps.clear(); ps.add(1); ps.add(2); changed = true;
      }
      if (kind === "p1_19" && block) {
        const ps = getPrioSetForBlock(block); ps.clear();
        for (let v = 1; v <= (block === "exty" ? FILTER_MAX : 19); v++) ps.add(v);
        changed = true;
      }
      if (kind === "pother" && block) {
        // "Інше" — no-op as preset toggle, just a label; grid handles individual selection
      }

      // Expand priority grid toggle
      if (kind === "pexpand" && block) {
        blockPrioExpanded[block] = !blockPrioExpanded[block];
        renderFilterPanel(); return; // only UI change, no persist
      }

      // Individual priority chip
      if (kind === "priority" && block && rawValue) {
        const v = Number(rawValue);
        if (Number.isFinite(v)) {
          const ps = getPrioSetForBlock(block);
          if (ps.has(v)) ps.delete(v); else ps.add(v);
          changed = true;
        }
      }

      // Complexity chip
      if (kind === "complexity" && block && rawValue) {
        const cs = getComplexitySetForBlock(block);
        if (cs.has(rawValue)) cs.delete(rawValue); else cs.add(rawValue);
        changed = true;
      }

      if (changed) persistFilterState();
      renderFilterPanel();
      if (state.filterOpen) markFiltersReviewed();
      if (changed && state.enabled) stopAuto("Автолок зупинено: змінено фільтри", "Зупинено", "Стоп: змінено фільтри", "warn", "filter_changed");
    });

    // No-complexity checkboxes (one per block, handled via change event on filterPanelEl)
    filterPanelEl.addEventListener("change", (event) => {
      const target = event.target;
      if (!target) return;
      const role = target.getAttribute("data-role") || "";
      const block = target.getAttribute("data-block") || "";
      if (role === "witch-mow-ar-no-complexity" && block) {
        if (block === "lidar") state.lidarNoComplexity = Boolean(target.checked);
        if (block === "inti") state.intiNoComplexity = Boolean(target.checked);
        if (block === "exty") state.extyNoComplexity = Boolean(target.checked);
        persistFilterState(); renderFilterPanel(); markFiltersReviewed();
        setAction("Фільтри автолоку перевірено", "ok");
        if (state.enabled) stopAuto("Автолок зупинено: змінено фільтри", "Зупинено", "Стоп: змінено фільтри", "warn", "filter_changed");
      }
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
  restorePersistedIgnoreIds();
  restoreNewFeatures();
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
