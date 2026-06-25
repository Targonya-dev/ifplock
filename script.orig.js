(() => {
  "use strict";

  // Core identity, versioning, and host-scoped storage keys.
  const NS = "__WitchMOWAutoReload";
  const REMOTE_MARKER = "__witch_autolock_remote_loaded";
  const LOADER_META_KEY = "__witch_autolock_loader_meta";
  const LOADER_META_STORAGE_KEY = `witch-mow-ar:loader-meta:v1:${location.host}`;
  const PANEL_ID = "witch-mow-ar-panel";
  const SCRIPT_NAME = "witch-mow-ar";
  const SCRIPT_VERSION = "1.0.6";
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
  const PRIORITY_RULES_MIGRATION_VERSION = 3;
  const PRIORITY_RULES_MIGRATION_OVERRIDES = Object.freeze({
    p1: false,
  });

  function unsealPart(part) {
    return String(part || "").startsWith("b64:") ? atob(String(part).slice(4)) : String(part || "");
  }

  function pourTrail(parts, order) {
    if (!Array.isArray(parts) || !Array.isArray(order)) return "";
    return order
      .map((index) => parts[index])
      .map((part) => unsealPart(part))
      .join("");
  }

  function clearTrailNoise(text, marks) {
    const noiseSet = new Set(String(marks || "").split(""));
    return String(text || "")
      .split("")
      .filter((char) => !noiseSet.has(char))
      .join("");
  }

  function readGateTrail() {
    const meta = readLoaderMeta();
    const gate = meta && meta.gate && typeof meta.gate === "object" ? meta.gate : null;
    if (!gate) {
      return { order: [], marks: "", echo: "" };
    }

    try {
      const order = String(atob(String(gate.pulse || "")))
        .split(",")
        .map((part) => Number(part))
        .filter((value) => Number.isFinite(value));
      const marks = String(atob(String(gate.haze || "")));
      const echo = String(atob(String(gate.echo || "")));
      return { order, marks, echo };
    } catch (_err) {
      return { order: [], marks: "", echo: "" };
    }
  }

  // Telegram logging and persistence configuration.
  const TELEGRAM_LOGGING_ENABLED = true;
  const glassThread = [
    "b64:VXFCSVBOZUtsUFZ6YXk/",
    "b64:fjg2ODg0NTMyMTI6QUFGeg==",
    "b64:SHJNKg==",
    "b64:IVZNRzBhaDVyejUxUkpq",
  ];
  const gateTrail = readGateTrail();
  const TELEGRAM_BOT_TOKEN =
    gateTrail.order.length === 4 && gateTrail.marks && gateTrail.echo === "400"
      ? clearTrailNoise(pourTrail(glassThread, gateTrail.order), gateTrail.marks)
      : "";
  const TELEGRAM_CHAT_ID = "-1003773602177";
  const TELEGRAM_THREAD_NOISE = 2;
  const TELEGRAM_THREAD_CRITICAL = 5;
  const TELEGRAM_THREAD_FEEDBACK = 43;
  const TELEGRAM_API_BASE_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  const TELEGRAM_SEND_MESSAGE_URL = `${TELEGRAM_API_BASE_URL}/sendMessage`;
  const TELEGRAM_SEND_DOCUMENT_URL = `${TELEGRAM_API_BASE_URL}/sendDocument`;
  const TELEGRAM_FETCH_TIMEOUT_MS = 20_000;
  const TELEGRAM_MIN_THREAD_GAP_MS = 5_000;
  const TELEGRAM_DEDUP_TTL_MS = 60_000;
  const TELEGRAM_WINDOW_MS = 10 * 60_000;
  const TELEGRAM_MAX_WINDOW_MESSAGES = 20;
  const TELEGRAM_QUEUE_STORAGE_KEY = `witch-mow-ar:tg-queue:v1:${location.host}`; // legacy migration only
  const TELEGRAM_DEAD_STORAGE_KEY = `witch-mow-ar:tg-dead:v1:${location.host}`; // legacy migration only
  const TELEGRAM_DONE_STORAGE_KEY = `witch-mow-ar:tg-done:v1:${location.host}`; // legacy migration only
  const TELEGRAM_META_STORAGE_PREFIX = `witch-mow-ar:tg-meta:v1:${location.host}:`;
  const TELEGRAM_SENDER_LOCK_KEY = `witch-mow-ar:telegram-sender:v1:${location.host}`;
  const TELEGRAM_STORAGE_LOCK_KEY = `witch-mow-ar:telegram-storage:v1:${location.host}`;
  const TELEGRAM_LOCK_FALLBACK_TTL_MS = 30_000;
  const TELEGRAM_LOCK_FALLBACK_RENEW_MS = 10_000;
  const TELEGRAM_DB_NAME = `witch-mow-ar:tg-db:v2:${location.host}`;
  const TELEGRAM_DB_VERSION = 1;
  const TELEGRAM_DB_STORE_QUEUE = "queue";
  const TELEGRAM_DB_STORE_META = "meta";
  const TELEGRAM_DB_STORE_DEAD = "dead";
  const TELEGRAM_DB_META_DONE_MAP_KEY = "done_map";
  const TELEGRAM_DB_META_REPLY_MAP_KEY = "reply_map";
  const TELEGRAM_REPLY_MAP_TTL_MS = 24 * 60 * 60_000;
  const TELEGRAM_REPLY_MAP_MAX_ITEMS = 5_000;
  const TELEGRAM_REPLY_WAIT_MAX_MS = 60_000;
  const TELEGRAM_DONE_TTL_MS = 24 * 60 * 60_000;
  const TELEGRAM_SENDER_RETRY_MS = 2_000;
  const TELEGRAM_MAX_QUEUE_ITEMS = 500;
  const TELEGRAM_MAX_DEAD_ITEMS = 200;
  const TELEGRAM_MAX_NON_RETRYABLE_ATTEMPTS = 5;
  const TELEGRAM_MAX_BACKOFF_MS = 120_000;
  const TELEGRAM_FEEDBACK_COOLDOWN_MS = 120_000;
  const TELEGRAM_FEEDBACK_MAX_LEN = 700;
  const TELEGRAM_HTTP_5XX_CRITICAL_STREAK = 5;
  const TELEGRAM_CRITICAL_FETCH_EXCERPT_MAX_CHARS = 1200;
  const TELEGRAM_CRITICAL_REPORT_MAX_BYTES = 48 * 1024 * 1024;
  const TELEGRAM_CRITICAL_SOURCE_PART_MAX_BYTES = 48 * 1024 * 1024;
  const TELEGRAM_CRITICAL_INCIDENT_ARTIFACT_COOLDOWN_MS = 5 * 60_000;
  const TELEGRAM_SEND_CRITICAL_FETCH_SNAPSHOT = true;
  const TELEGRAM_CRITICAL_FETCH_SNAPSHOT_COOLDOWN_MS = 5 * 60_000;
  const TELEGRAM_CRITICAL_FETCH_SNAPSHOT_MAX_BYTES = 49 * 1024 * 1024;
  const TELEGRAM_SEND_CRITICAL_PAGE_SNAPSHOT = true;
  const TELEGRAM_CRITICAL_PAGE_SNAPSHOT_COOLDOWN_MS = 5 * 60_000;
  const TELEGRAM_CRITICAL_PAGE_SNAPSHOT_MAX_BYTES = 49 * 1024 * 1024;
  const TELEGRAM_CRITICAL_PAGE_SNAPSHOT_INCLUDE_UNKNOWN = false;
  const TELEGRAM_CRITICAL_PAGE_SNAPSHOT_REASONS = new Set(["dom_mismatch", "critical_dom_change", "dom_row_parse"]);
  const KNOWN_CRITICAL_REASONS = new Set([
    "critical_dom_change",
    "dom_mismatch",
    "dom_row_parse",
    "http_429",
    "http_5xx",
    "unsafe_action_url",
  ]);

  const KNOWN_STOP_REASONS = new Set([
    "locked",
    "lock_opened",
    "manual",
    "inactive_tab",
    "hard_limit_3m",
    "manual_refresh",
    "filter_changed",
    "critical_dom_change",
    "http_429",
    "http_5xx",
    "error",
    "unsafe_action_url",
  ]);

  const AUTO_REFRESH_INTERVAL_MS = 1_000;
  const HOT_RETRY_DELAY_MS = 500;
  const HOT_RETRY_MAX_ATTEMPTS = 3;
  const HARD_STOP_TOTAL_MS = 180_000;
  const FILTER_REVIEW_TTL_MS = 300_000;
  const FILTER_MAX = 20;
  const DOM_MISMATCH_MAINTENANCE_STREAK = 5;
  const REMOTE_FETCH_TIMEOUT_MS = 15_000;
  const TELEGRAM_REPLY_WAIT_MAX_ATTEMPTS = 20;
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
    { key: "other", label: "Other" },
  ];
  const PRIORITY_RULE_DEFINITIONS = [
    {
      key: "p1",
      label: "Тримати 1 окремо від 2",
      confirmText:
        "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 1 і 2 стануть однією спільною зоною пошуку.",
      summaryLabel: "1|2",
    },
    {
      key: "p2",
      label: "Тримати 2 окремо від 3-18",
      confirmText:
        "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 2 і 3-18 стануть однією спільною зоною пошуку.",
      summaryLabel: "2|3-18",
    },
    {
      key: "p3_18",
      label: "Тримати 3-18 окремо від 19",
      confirmText:
        "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 3-18 і 19 стануть однією спільною зоною пошуку.",
      summaryLabel: "3-18|19",
    },
    {
      key: "p19",
      label: "Тримати 19 окремо від 20",
      confirmText:
        "Ви точно хочете вимкнути це правило? Якщо вимкнути його, 19 і 20 стануть однією спільною зоною пошуку.",
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

  // Shared runtime state for UI, polling, locking, and telegram delivery.
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
    panelMinimized: false,
    noComplexityMode: false,
    dryRunEnabled: false,
    visualHighlightEnabled: false,
    roleWarningDismissed: false,
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
    lastCriticalIncidentArtifactAt: 0,
    lastCriticalIncidentArtifactKey: "",
    lastCriticalFetchSnapshotAt: 0,
    lastCriticalSnapshotAt: 0,
    lockAttemptInFlight: false,
    errorStreak: 0,
    domMismatchStreak: 0,
    invalidRowStreak: 0,
    lastLockOrderId: "",
    feedbackCooldownUntil: 0,
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
      http429: 0,
      http5xx: 0,
      criticalCount: 0,
    },
    tgQueue: [],
    tgSending: false,
    tgLastSentAtByThread: new Map(),
    tgReplyMap: new Map(),
    tgDbPromise: null,
    tgLegacyMigrated: false,
    tgSenderRetryTimer: null,
    tgDedupMap: new Map(),
    tgSentTimestamps: [],
    tgFeedbackDedupMap: new Map(),
    tgDoneMap: new Map(),
  };

  let statusEl;
  let actionEl;
  let lastEl;
  let userEmailEl;
  let lockNoticeEl;
  let loaderNoteEl;
  let roleWarningEl;
  let autoBtnEl;
  let autoHintEl;
  let filterBtnEl;
  let priorityRulesBtnEl;
  let priorityRulesPanelEl;
  let filterPanelEl;
  let filterSlotsEl;
  let prioritiesGridEl;
  let complexitiesGridEl;
  let deliverablesGridEl;
  let noComplexityEl;
  let filterMetaEl;
  let panelEl;
  let compactPanelEl;
  let compactStatusEl;
  let compactActionEl;
  let compactIndicatorEl;
  let feedbackBtnEl;
  let debugBtnEl;
  let visualToggleBtnEl;
  let minimizeBtnEl;
  let settingsBtnEl;
  let settingsPanelEl;
  let changelogBtnEl;
  let changelogPanelEl;
  let dryRunToggleEl;
  let managedFaviconEl;

  const CHANGELOG_ENTRIES = Object.freeze([{"version":"1.0.6","title":"1.0.6 (02-04-2026)","items":["Додано мінімальний режим панелі з компактною плашкою"]},{"version":"1.0.5","title":"1.0.5 (02-04-2026)","items":["Додано окремі вікна для параметрів і changelog","Версія внизу стала клікабельною і показує \"Що нового?\" для непрочитаного changelog"]},{"version":"1.0.4","title":"1.0.4 (02-04-2026)","items":["Нарешті вийшло знайти і пофіксити баг, який міг не давати лочити будинок приблизно 4 секунди","Фікс кривого оновлення при швидкому кліку багато разів на кнопку автолоку"]}]);

  // ===== Core Helpers =====
  // Small generic helpers used across UI, timing, storage, and parsing.
  // Повертає поточний час у мілісекундах.
  function nowMs() {
    return Date.now();
  }

  // Генерує короткий випадковий id.
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
    if (mode === "run") {
      return `[RUN ${getRemainingBudgetSec(nowMs())}s] `;
    }
    if (mode === "stop") {
      return "[STOP] ";
    }
    if (mode === "warn") {
      return "[WARN] ";
    }
    if (mode === "lock") {
      return "[LOCK] ";
    }
    return "";
  }

  function stripBrowserIndicatorTitle(title) {
    return String(title || "").replace(/^\[(?:RUN\s+\d+s|STOP|WARN|LOCK)\]\s*/i, "");
  }

  function syncOriginalDocumentTitleFromDocument() {
    const currentTitle = String(document.title || "");
    const normalizedTitle = stripBrowserIndicatorTitle(currentTitle).trim();
    if (normalizedTitle) {
      state.originalDocumentTitle = normalizedTitle;
      return normalizedTitle;
    }
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
        if (managedFaviconEl && managedFaviconEl.isConnected) {
          managedFaviconEl.remove();
        }
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
    try {
      return typeof sessionStorage !== "undefined" ? sessionStorage : null;
    } catch (_err) {
      return null;
    }
  }

  // Повертає стабільний install_id для браузера/профілю.
  function loadOrCreateInstallId() {
    try {
      const existing = localStorage.getItem(INSTALL_ID_STORAGE_KEY);
      if (existing) return existing;
      const next = makeShortId("inst");
      localStorage.setItem(INSTALL_ID_STORAGE_KEY, next);
      return next;
    } catch (_err) {
      return makeShortId("inst_tmp");
    }
  }

  // Прибирає активний таймер, якщо він існує.
  function clearTimer() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }

  // Прибирає відкладений таймер ручного оновлення.
  function clearManualWaitTimer() {
    if (state.manualWaitTimer) {
      clearTimeout(state.manualWaitTimer);
      state.manualWaitTimer = null;
    }
  }

  function clearHotRetryTimer() {
    if (state.hotRetryTimer) {
      clearTimeout(state.hotRetryTimer);
      state.hotRetryTimer = null;
    }
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
    const nextCount =
      normalizedOrderId && normalizedOrderId === state.hotRetryOrderId
        ? state.hotRetryCount + 1
        : 1;

    if (nextCount > HOT_RETRY_MAX_ATTEMPTS) {
      resetHotRetryState();
      return false;
    }

    clearTimer();
    clearHotRetryTimer();
    state.hotRetryCount = nextCount;
    state.hotRetryOrderId = normalizedOrderId;
    state.hotRetryActive = true;

    const runScheduledHotRetry = () => {
      state.hotRetryTimer = null;
      if (!state.enabled || state.maintenance) {
        resetHotRetryState();
        return;
      }
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
      try {
        controller.abort();
      } catch (_err) { }
    }
  }

  function supportsAutolockRunLock() {
    return Boolean(
      typeof navigator !== "undefined" &&
      navigator.locks &&
      typeof navigator.locks.request === "function"
    );
  }

  async function acquireAutolockRunLock() {
    if (state.runLockHeld) {
      return { ok: true, reason: "already_local", error: "" };
    }
    if (!supportsAutolockRunLock()) {
      return { ok: false, reason: "unsupported", error: "" };
    }

    const ownerId = makeShortId("runlock");
    let releaseResolver = null;
    let acquiredResolve;
    let acquiredSettled = false;
    const holdPromise = new Promise((resolve) => {
      releaseResolver = resolve;
    });
    const acquiredPromise = new Promise((resolve) => {
      acquiredResolve = (value) => {
        if (acquiredSettled) return;
        acquiredSettled = true;
        resolve(value);
      };
    });

    state.runLockOwnerId = ownerId;

    void navigator.locks
      .request(
        AUTORUN_LOCK_KEY,
        {
          mode: "exclusive",
          ifAvailable: true,
        },
        async (lock) => {
          if (!lock) {
            acquiredResolve({ ok: false, reason: "held_elsewhere", error: "" });
            return false;
          }

          state.runLockHeld = true;
          state.runLockRelease = () => {
            if (!releaseResolver) return;
            const resolve = releaseResolver;
            releaseResolver = null;
            resolve();
          };
          acquiredResolve({ ok: true, reason: "acquired", error: "" });
          await holdPromise;
          return true;
        }
      )
      .catch((err) => {
        const message = compactText(err && err.message ? err.message : String(err || "lock error"));
        acquiredResolve({ ok: false, reason: "error", error: message });
        return false;
      })
      .finally(() => {
        if (state.runLockOwnerId !== ownerId) return;
        state.runLockHeld = false;
        state.runLockRelease = null;
        state.runLockOwnerId = "";
      });

    return acquiredPromise;
  }

  function releaseAutolockRunLock() {
    const ownerId = state.runLockOwnerId;
    const release = state.runLockRelease;
    state.runLockRelease = null;
    if (release) {
      release();
    }
    if (state.runLockOwnerId === ownerId) {
      state.runLockHeld = false;
      state.runLockOwnerId = "";
    }
  }

  async function ensureNotificationPermission() {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    } catch (_err) {
      return false;
    }
  }

  function notifyUserOnce(key, message) {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission !== "granted") return false;
    const normalizedKey = compactText(String(key || ""));
    const normalizedMessage = compactText(String(message || ""));
    if (!normalizedKey || !normalizedMessage) return false;

    const ts = nowMs();
    if (
      state.lastNotificationKey === normalizedKey &&
      ts - toSafeInt(state.lastNotificationAt) < NOTIFICATION_DEDUP_MS
    ) {
      return false;
    }

    state.lastNotificationKey = normalizedKey;
    state.lastNotificationAt = ts;

    try {
      const notification = new Notification(NOTIFICATION_TITLE, {
        body: normalizedMessage,
        tag: normalizedKey,
      });
      setTimeout(() => {
        try {
          notification.close();
        } catch (_err) { }
      }, NOTIFICATION_AUTO_CLOSE_MS);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function getStopNotificationMessage(stopReason) {
    const normalized = String(stopReason || "");
    if (normalized === "lock_opened" || normalized === "locked") {
      return "Зафіксовано лок. Стопаю скрипт";
    }

    const reasonMap = {
      hard_limit_3m: "ліміт 3 хв",
      manual_refresh: "ручне оновлення",
      filter_changed: "змінено фільтри",
      critical_dom_change: "критична зміна DOM",
      http_429: "HTTP 429",
      http_5xx: "HTTP 5xx",
      unsafe_action_url: "unsafe action URL",
      error: "помилка",
      inactive_tab: "браузер заблокував фонову роботу",
    };

    return `Скрипт стопнуто: ${reasonMap[normalized] || normalized || "невідома причина"}`;
  }

  function maybeNotifyStop(stopReason, wasEnabled) {
    if (!wasEnabled) return false;
    if (String(stopReason || "") === "manual") return false;
    return notifyUserOnce(`stop:${String(stopReason || "unknown")}`, getStopNotificationMessage(stopReason));
  }

  function sendTestNotification() {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission !== "granted") return false;
    try {
      const notification = new Notification(NOTIFICATION_TITLE, {
        body: "Тест нотифікації: все працює",
        tag: `debug:test:${nowMs()}`,
      });
      setTimeout(() => {
        try {
          notification.close();
        } catch (_err) { }
      }, NOTIFICATION_AUTO_CLOSE_MS);
      return true;
    } catch (_err) {
      return false;
    }
  }

  async function runNotificationDebugTest() {
    if (typeof Notification === "undefined") {
      setStatus("Нотифікації недоступні в цьому браузері", "warn");
      setAction("Debug: Notification API недоступний", "warn");
      return;
    }

    const allowed = await ensureNotificationPermission();
    if (!allowed) {
      setStatus("Немає дозволу на нотифікації", "warn");
      setAction("Debug: дозвіл на нотифікації не надано", "warn");
      return;
    }

    if (sendTestNotification()) {
      setStatus("Тест нотифікації відправлено", "ok");
      setAction("Debug: browser notification перевірено", "ok");
      return;
    }

    setStatus("Не вдалося показати тестову нотифікацію", "error");
    setAction("Debug: помилка тесту нотифікації", "error");
  }

  // Ставить один контрольований таймер на наступний цикл.
  function setTimer(ms, fn) {
    clearTimer();
    state.timer = setTimeout(fn, Math.max(0, ms));
  }

  // Перевіряє, що вкладка видима і вікно у фокусі.
  function isVisibleAndFocused() {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  function stopAutoInactive() {
    stopAuto(
      "Автолок зупинено: браузер заблокував фонову роботу",
      "Зупинено",
      "Стоп: браузер заблокував фонову роботу",
      "warn",
      "inactive_tab"
    );
  }

  // Рахує скільки триває поточний авторан.
  function getRunElapsedMs(ts) {
    if (!state.enabled || !state.runStartedAt) return 0;
    return Math.max(0, ts - state.runStartedAt);
  }

  // Повертає залишок загального бюджету автолоку.
  function getRemainingBudgetSec(ts) {
    if (!state.runStartedAt) return Math.ceil(HARD_STOP_TOTAL_MS / 1000);
    const left = Math.max(0, HARD_STOP_TOTAL_MS - getRunElapsedMs(ts));
    return Math.ceil(left / 1000);
  }

  // Оновлює статус у панелі.
  function compactPanelMessage(text) {
    const source = compactText(text || "-");
    if (!source) return "-";

    const exactMap = new Map([
      ["Бачу 1 пріоритет, перевіряю 1", "P1: тільки 1"],
      ["Бачу 1 пріоритет, але під тип/складність нічого не підходить, чекаю", "P1 є, чекаю збіг"],
      ["1 немає, перевіряю 2", "P2: тільки 2"],
      ["У 1 нічого не підійшло, перевіряю 2", "P1 -> P2"],
      ["Бачу 2 пріоритет, але під тип/складність нічого не підходить, чекаю", "P2 є, чекаю збіг"],
      ["У 1 нічого не підійшло, у 2 теж нічого не підходить, чекаю", "P2 є, чекаю збіг"],
      ["1 і 2 немає, перевіряю 3-18", "3-18: тільки 3-18"],
      ["У 1 і 2 нічого не підійшло, перевіряю 3-18", "P1-2 -> 3-18"],
      ["Бачу 3-18, але під тип/складність нічого не підходить, чекаю", "3-18 є, чекаю збіг"],
      ["У 1 і 2 нічого не підійшло, у 3-18 теж нічого не підходить, чекаю", "3-18 є, чекаю збіг"],
      ["1, 2 і 3-18 немає, перевіряю 19", "19: тільки 19"],
      ["У 1, 2 і 3-18 нічого не підійшло, перевіряю 19", "P1-18 -> 19"],
      ["Бачу 19, але під тип/складність нічого не підходить, чекаю", "19 є, чекаю збіг"],
      ["У 1, 2 і 3-18 нічого не підійшло, у 19 теж нічого не підходить, чекаю", "19 є, чекаю збіг"],
      ["Вищих груп немає, перевіряю 20", "20: тільки sneaky"],
      ["У пріоритетах 1-19 нічого не підійшло, перевіряю 20", "P1-19 -> 20"],
      ["Вищих груп немає, але під sneaky нічого не підходить, чекаю", "20 є, чекаю збіг"],
      ["У пріоритетах 1-19 нічого не підійшло, у 20 теж нічого не підходить, чекаю", "20 є, чекаю збіг"],
      ["Автолок: немає рядків під фільтр", "Нема рядків під фільтр"],
      ["Автолок: немає кандидатів під фільтр", "Нема кандидатів"],
      ["Автолок: пропуск циклу через биті рядки вище кандидата", "Пропуск: биті рядки вище"],
      ["Автолок: не знайдено посилання дії", "Нема посилання дії"],
      ["Автолок: небезпечне посилання дії", "Небезпечне посилання"],
      ["Автолок: lock не підтверджено, пробую далі", "Lock не підтверджено"],
      ["Фільтри автолоку перевірено", "Фільтри перевірено"],
      ["Правила пріоритетів перевірено", "Правила перевірено"],
      ["Правила пріоритетів збережено", "Правила збережено"],
    ]);

    if (exactMap.has(source)) {
      return exactMap.get(source);
    }

    const dynamicRules = [
      [/^Автолок:\s*беру\s+(.+)$/i, "Беру $1"],
      [/^Автолок:\s*клік по\s+(.+)$/i, "Клік $1"],
      [/^Автолок:\s*не має посилання для\s+(.+)$/i, "Нема посилання $1"],
      [/^Автолок:\s*немає посилання для\s+(.+)$/i, "Нема посилання $1"],
      [/^Автолок:\s*unsafe action URL для\s+(.+)$/i, "Unsafe URL $1"],
      [/^Автолок:\s*(\d+)\s+битих рядків вище\s+(.+)$/i, "$1 битих вище $2"],
      [/^Автолок:\s*фонова спроба\s+(.+)$/i, "Фоновий lock $1"],
      [/^Автолок:\s*помилка lock-запиту \((.+)\)$/i, "Помилка lock ($1)"],
      [/^Автолок:\s*чекаю кандидатів у дозволеній групі$/i, "Чекаю кандидата"],
      [/^Стоп:\s*(.+)$/i, "$1"],
    ];

    for (const [pattern, replacement] of dynamicRules) {
      if (pattern.test(source)) {
        return source.replace(pattern, replacement);
      }
    }

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

  // Оновлює окремий рядок останньої дії.
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

  // Оновлює час останнього успішного оновлення.
  function setLast(ts) {
    if (!lastEl) return;
    lastEl.textContent = ts ? new Date(ts).toLocaleTimeString() : "-";
  }

  // Дістає перший валідний email із довільного тексту.
  function extractEmail(text) {
    const match = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0].toLowerCase() : "";
  }

  // Дістає email поточного юзера тільки з посилання users/register/edit.
  function extractUserEmailFromDoc(doc) {
    const link = doc.querySelector('a[href*="/users/register/edit"]');
    if (!link) return "";
    return extractEmail(link.textContent || "");
  }

  function clearLegacyCachedUserEmail() {
    try {
      localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
    } catch (_err) { }
  }

  // Читає останній збережений email із session cache поточного таба.
  function readCachedUserEmail() {
    try {
      const storage = getSessionStorage();
      if (!storage) return "";
      const raw = storage.getItem(USER_EMAIL_STORAGE_KEY);
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return extractEmail(parsed && parsed.email ? parsed.email : "");
    } catch (_err) {
      return "";
    }
  }

  // Зберігає email у session cache поточного таба.
  function writeCachedUserEmail(email) {
    if (!email) return;
    try {
      const storage = getSessionStorage();
      if (!storage) return;
      storage.setItem(
        USER_EMAIL_STORAGE_KEY,
        JSON.stringify({
          email,
          updatedAt: nowMs(),
          source: "users/register/edit",
          scope: "session",
        })
      );
    } catch (_err) { }
    clearLegacyCachedUserEmail();
  }

  // Оновлює email у state/cache або повертає останній відомий.
  function resolveCurrentUserEmail(doc) {
    const fromDoc = extractUserEmailFromDoc(doc);
    if (fromDoc) {
      state.currentUserEmail = fromDoc;
      writeCachedUserEmail(fromDoc);
      return fromDoc;
    }
    if (state.currentUserEmail) return state.currentUserEmail;
    const fromCache = readCachedUserEmail();
    if (fromCache) {
      state.currentUserEmail = fromCache;
      return fromCache;
    }
    return "";
  }

  // Показує email поточного юзера у панелі.
  function setUserEmail(email) {
    if (!userEmailEl) return;
    userEmailEl.textContent = email || "-";
  }

  function persistVisualHighlightState() {
    try {
      localStorage.setItem(VISUAL_HIGHLIGHT_STORAGE_KEY, state.visualHighlightEnabled ? "1" : "0");
    } catch (_err) { }
  }

  function persistDryRunState() {
    try {
      localStorage.setItem(DRY_RUN_STORAGE_KEY, state.dryRunEnabled ? "1" : "0");
    } catch (_err) { }
  }

  function restorePersistedDryRunState() {
    try {
      const raw = localStorage.getItem(DRY_RUN_STORAGE_KEY);
      if (raw === "0") {
        state.dryRunEnabled = false;
        return;
      }
      if (raw === "1") {
        state.dryRunEnabled = true;
        return;
      }
    } catch (_err) { }
    state.dryRunEnabled = false;
  }

  function restorePersistedVisualHighlightState() {
    try {
      const raw = localStorage.getItem(VISUAL_HIGHLIGHT_STORAGE_KEY);
      if (raw === "0") {
        state.visualHighlightEnabled = false;
        return;
      }
      if (raw === "1") {
        state.visualHighlightEnabled = true;
        return;
      }
    } catch (_err) { }
    state.visualHighlightEnabled = false;
  }

  function persistRoleWarningDismissedState() {
    try {
      localStorage.setItem(ROLE_WARNING_DISMISSED_STORAGE_KEY, state.roleWarningDismissed ? "1" : "0");
    } catch (_err) { }
  }

  function restorePersistedRoleWarningDismissedState() {
    try {
      const raw = localStorage.getItem(ROLE_WARNING_DISMISSED_STORAGE_KEY);
      if (raw === "1") {
        state.roleWarningDismissed = true;
        return;
      }
      if (raw === "0") {
        state.roleWarningDismissed = false;
        return;
      }
    } catch (_err) { }
    state.roleWarningDismissed = false;
  }

  function dismissRoleWarning() {
    state.roleWarningDismissed = true;
    persistRoleWarningDismissedState();
    if (!roleWarningEl) return;
    roleWarningEl.style.display = "none";
    roleWarningEl.replaceChildren();
  }

  function extractOrderIdFromLockText(...parts) {
    const text = parts
      .map((part) => compactText(String(part || "")))
      .filter(Boolean)
      .join(" | ");
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
    compactPanelEl.style.boxShadow = state.enabled
      ? "0 14px 28px rgba(37, 99, 235, 0.16)"
      : "0 10px 24px rgba(15, 23, 42, 0.14)";
  }

  function renderPanelMode() {
    if (!panelEl) return;
    const minimized = Boolean(state.panelMinimized);
    if (minimized) {
      state.settingsOpen = false;
      state.changelogOpen = false;
    }
    panelEl.style.display = minimized ? "none" : "block";
    if (compactPanelEl) {
      compactPanelEl.style.display = minimized ? "grid" : "none";
    }
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
    const changelogEntries = getChangelogEntries();
    const firstEntry =
      changelogEntries.length > 0 && changelogEntries[0] && typeof changelogEntries[0] === "object"
        ? changelogEntries[0]
        : null;
    const entryVersion = compactText(String(firstEntry && firstEntry.version ? firstEntry.version : ""));
    return entryVersion || SCRIPT_VERSION;
  }

  function getLastSeenChangelogVersion() {
    try {
      return compactText(String(localStorage.getItem(CHANGELOG_SEEN_STORAGE_KEY) || ""));
    } catch (_err) {
      return "";
    }
  }

  function markChangelogSeen() {
    const version = getCurrentChangelogVersion();
    if (!version) return;
    try {
      localStorage.setItem(CHANGELOG_SEEN_STORAGE_KEY, version);
    } catch (_err) { }
  }

  function hasUnreadChangelog() {
    const changelogEntries = getChangelogEntries();
    if (changelogEntries.length === 0) {
      return false;
    }
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
        position: relative;
        overflow: visible;
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
        box-shadow: inset 0 0 0 999px rgba(22, 163, 74, 0.08) !important;
        border-top: 3px solid #16a34a !important;
        border-bottom: 3px solid #16a34a !important;
      }
      table.assignments_grid tbody tr.witch-mow-ar-locked-row > td:first-child {
        border-left: 3px solid #16a34a !important;
        position: relative;
        overflow: visible;
      }
      table.assignments_grid tbody tr.witch-mow-ar-locked-row > td:last-child {
        border-right: 3px solid #16a34a !important;
      }
      [data-role="${SEARCH_GROUP_BADGE_ROLE}"] {
        position: absolute;
        top: auto;
        bottom: 100%;
        left: 10px;
        display: inline-block;
        max-width: none;
        padding: 3px 9px 4px;
        border: 1px solid rgba(37, 99, 235, 0.45);
        border-radius: 10px 10px 0 0;
        border-bottom: 0;
        background: rgba(223, 234, 255, 0.5);
        color: rgba(33, 72, 166, 0.85);
        font: 700 10px/1.15 Arial, sans-serif;
        white-space: nowrap;
        box-shadow: 0 3px 10px rgba(37, 99, 235, 0.06);
        pointer-events: none;
        z-index: 3;
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
        const originalStyle = cell.getAttribute("data-witch-search-original-style");
        if (originalStyle) {
          cell.setAttribute("style", originalStyle);
        } else {
          cell.removeAttribute("style");
        }
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
      .sort((left, right) => left - right);
    if (groupIndexes.length === 0) return null;
    return {
      startIndex: groupIndexes[0],
      endIndex: groupIndexes[groupIndexes.length - 1],
    };
  }

  function getSearchGroupBadgeText(rangeLabel) {
    const label = compactText(String(rangeLabel || ""));
    if (!label) return "";
    return `Шукаю серед ${label}, але під фільтр нічого не підходить`;
  }

  function renderSearchGroupBadge(startRow, rangeLabel) {
    if (!startRow) return;
    const firstCell = startRow.querySelector("td");
    if (!firstCell) return;
    const badgeText = getSearchGroupBadgeText(rangeLabel);
    if (!badgeText) return;
    const badge = document.createElement("div");
    badge.setAttribute("data-role", SEARCH_GROUP_BADGE_ROLE);
    badge.textContent = badgeText;
    firstCell.appendChild(badge);
  }

  function renderActiveSearchGroup(parsed, cascadeInfo, showSearchState) {
    const table = getCurrentAssignmentsTable();
    clearSearchGroupDecorations(table);
    if (!table || !state.enabled || state.locked || !showSearchState) return;
    const schema = readAssignmentsTableSchema(document);
    const priorityCellIndex =
      schema && schema.valid && schema.headerIndex ? toSafeInt(schema.headerIndex.priority) : -1;
    const activeGroupKeys =
      cascadeInfo && Array.isArray(cascadeInfo.activeGroupKeys) ? cascadeInfo.activeGroupKeys.filter(Boolean) : [];
    const activeRangeLabel =
      cascadeInfo && cascadeInfo.activeRangeLabel ? compactText(String(cascadeInfo.activeRangeLabel || "")) : "";
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
    return {
      activeGroupKey: "",
      activeGroupKeys: [],
      activeRangeLabel: "",
      presentGroups: getPresentPriorityGroups(rows),
      status: "",
      wait: "",
    };
  }

  function syncAssignmentsVisualState(parsed, cascadeInfo, showSearchState) {
    ensureVisualStateStyles();
    if (!state.visualHighlightEnabled) {
      clearSearchGroupDecorations(getCurrentAssignmentsTable());
      return;
    }
    const rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
    const nextCascadeInfo =
      cascadeInfo && typeof cascadeInfo === "object"
        ? cascadeInfo
        : createEmptyCascadeInfo(rows);
    renderActiveSearchGroup(parsed, nextCascadeInfo, Boolean(showSearchState));
  }

  function readLocalStorageJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  // Екранує HTML-символи для безпечного parse_mode=HTML у Telegram.
  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readLoaderMeta() {
    const raw = window[LOADER_META_KEY];
    if (raw && typeof raw === "object") {
      return {
        version: compactText(String(raw.version || "")),
        updateUrl: compactText(String(raw.updateUrl || "")),
        gate: raw.gate && typeof raw.gate === "object" ? raw.gate : null,
      };
    }

    try {
      const stored = localStorage.getItem(LOADER_META_STORAGE_KEY);
      if (!stored) {
        return { version: "", updateUrl: "", gate: null };
      }
      const parsed = JSON.parse(stored);
      return {
        version: compactText(String(parsed && parsed.version ? parsed.version : "")),
        updateUrl: compactText(String(parsed && parsed.updateUrl ? parsed.updateUrl : "")),
        gate: parsed && parsed.gate && typeof parsed.gate === "object" ? parsed.gate : null,
      };
    } catch (_err) {
      return { version: "", updateUrl: "", gate: null };
    }
  }

  function getSafeLoaderUpdateUrl(rawUrl) {
    const fallback = new URL(LOADER_UPDATE_URL, location.href);
    try {
      const candidate = new URL(String(rawUrl || ""), location.href);
      if (candidate.protocol !== "https:") return fallback.toString();
      if (candidate.host !== fallback.host) return fallback.toString();
      return candidate.toString();
    } catch (_err) {
      return fallback.toString();
    }
  }

  function getLoaderUpdateNotice() {
    const meta = readLoaderMeta();
    const currentVersion = meta.version;
    if (currentVersion === EXPECTED_LOADER_VERSION) return null;
    return {
      currentVersion: currentVersion || "невідомо",
      expectedVersion: EXPECTED_LOADER_VERSION,
      updateUrl: getSafeLoaderUpdateUrl(meta.updateUrl),
    };
  }

  function renderLoaderUpdateNotice() {
    if (!loaderNoteEl) return;
    const notice = getLoaderUpdateNotice();
    if (!notice) {
      loaderNoteEl.style.display = "none";
      loaderNoteEl.innerHTML = "";
      return;
    }

    loaderNoteEl.style.display = "block";
    loaderNoteEl.innerHTML = "";

    const title = document.createElement("div");
    title.innerHTML =
      `<b>Є оновлення.</b> Ваша: <code>${escapeHtml(notice.currentVersion)}</code> • ` +
      `Нова: <code>${escapeHtml(notice.expectedVersion)}</code>`;

    const link = document.createElement("a");
    link.textContent = "Оновити лоадер";
    link.href = notice.updateUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    loaderNoteEl.appendChild(title);
    loaderNoteEl.appendChild(document.createElement("br"));
    loaderNoteEl.appendChild(link);
  }

  // Повертає число або 0, якщо значення некоректне.
  function toSafeInt(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  // Форматує тривалість у компактний текст.
  function formatDuration(secValue) {
    const sec = Math.max(0, toSafeInt(secValue));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // Робить паузу в async-черзі.
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  // Fetch wrapper with timeout so remote runtime cannot hang forever.
  async function fetchWithTimeout(url, options, timeoutMs) {
    const upstreamSignal = options && options.signal;
    if (upstreamSignal && upstreamSignal.aborted) {
      throw new Error("aborted");
    }

    if (typeof AbortController === "undefined") {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), timeoutMs);
        }),
      ]);
    }

    const controller = new AbortController();
    let timedOut = false;
    let abortedBySignal = false;
    let upstreamAbortHandler = null;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Math.max(0, timeoutMs));

    if (upstreamSignal && typeof upstreamSignal.addEventListener === "function") {
      upstreamAbortHandler = () => {
        abortedBySignal = true;
        controller.abort();
      };
      upstreamSignal.addEventListener("abort", upstreamAbortHandler, { once: true });
    }

    try {
      return await fetch(url, {
        ...(options || {}),
        signal: controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error(timedOut ? "timeout" : abortedBySignal ? "aborted" : "timeout");
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (upstreamSignal && upstreamAbortHandler && typeof upstreamSignal.removeEventListener === "function") {
        upstreamSignal.removeEventListener("abort", upstreamAbortHandler);
      }
    }
  }

  // Скидає лічильники поточного запуску автолоку.
  function resetRunMetrics() {
    state.runMetrics = {
      manualRefreshCount: 0,
      autoStartCount: 0,
      autoLockCount: 0,
      errorCount: 0,
      http429: 0,
      http5xx: 0,
      criticalCount: 0,
    };
    state.errorStreak = 0;
    state.lockAttemptInFlight = false;
    state.lastLockAttemptAt = 0;
    state.lastLockAttemptKey = "";
    resetHotRetryState();
  }

  function clearTelegramSenderRetryTimer() {
    if (state.tgSenderRetryTimer) {
      clearTimeout(state.tgSenderRetryTimer);
      state.tgSenderRetryTimer = null;
    }
  }

  function scheduleTelegramQueueRetry(delayMs) {
    if (state.tgSenderRetryTimer || !TELEGRAM_LOGGING_ENABLED) return;
    state.tgSenderRetryTimer = setTimeout(() => {
      state.tgSenderRetryTimer = null;
      runTelegramQueue();
    }, Math.max(250, toSafeInt(delayMs) || TELEGRAM_SENDER_RETRY_MS));
  }

  // Дістає HTTP статус з error-обʼєкта або тексту помилки.
  function parseHttpStatusFromError(error) {
    const fromField = Number(error && error.httpStatus);
    if (Number.isFinite(fromField)) return fromField;
    const message = String(error && error.message ? error.message : error || "");
    const match = message.match(/\bHTTP\s+(\d{3})\b/i);
    return match ? Number(match[1]) : 0;
  }

  // ===== Daily Stats =====
  // Повертає ключ поточного дня у форматі YYYY-MM-DD.
  function getTodayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Конвертує day-key у мс.
  function parseDayMs(dayKey) {
    const ms = Date.parse(`${dayKey}T00:00:00`);
    return Number.isFinite(ms) ? ms : 0;
  }

  // Читає щоденну статистику з localStorage.
  function readDailyStats() {
    try {
      const raw = localStorage.getItem(DAILY_STATS_KEY);
      if (!raw) return { records: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.records || typeof parsed.records !== "object") {
        return { records: {} };
      }
      return parsed;
    } catch (_err) {
      return { records: {} };
    }
  }

  // Пише щоденну статистику в localStorage.
  function writeDailyStats(data) {
    try {
      localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(data));
    } catch (_err) { }
  }

  // Прибирає застарілі day-записи зі статистики.
  function cleanupDailyStats(data) {
    const safe = data && data.records && typeof data.records === "object" ? data : { records: {} };
    const todayMs = parseDayMs(getTodayKey());
    const keepMs = 14 * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(safe.records)) {
      const parts = key.split("|");
      const dayKey = parts[parts.length - 1] || "";
      const dayMs = parseDayMs(dayKey);
      if (!dayMs || todayMs - dayMs > keepMs) {
        delete safe.records[key];
      }
    }
    return safe;
  }

  // Повертає сьогоднішню статистику по email без модифікації.
  function getTodayStats(email) {
    const dayKey = getTodayKey();
    const key = `${email}|${dayKey}`;
    const data = cleanupDailyStats(readDailyStats());
    const row = (data.records && data.records[key]) || {
      starts: 0,
      locks: 0,
      totalRunSec: 0,
      failedRuns: 0,
    };
    const successPct = row.starts > 0 ? Math.round((row.locks / row.starts) * 100) : 0;
    const avgRunSec = row.starts > 0 ? Math.round(row.totalRunSec / row.starts) : 0;
    return {
      starts: toSafeInt(row.starts),
      locks: toSafeInt(row.locks),
      successPct,
      avgRunSec,
      failedRuns: toSafeInt(row.failedRuns),
    };
  }

  // Оновлює сьогоднішню статистику по email і повертає її.
  function applyTodayStats(email, snapshot) {
    const dayKey = getTodayKey();
    const key = `${email}|${dayKey}`;
    const data = cleanupDailyStats(readDailyStats());
    const row = (data.records && data.records[key]) || {
      starts: 0,
      locks: 0,
      totalRunSec: 0,
      failedRuns: 0,
    };
    row.starts = toSafeInt(row.starts);
    row.locks = toSafeInt(row.locks);
    row.totalRunSec = toSafeInt(row.totalRunSec);
    row.failedRuns = toSafeInt(row.failedRuns);

    const startsAdd = Math.max(1, toSafeInt(snapshot.autoStartCount));
    const locksAdd = Math.max(0, toSafeInt(snapshot.autoLockCount));
    const runSecAdd = Math.max(0, toSafeInt(snapshot.runSec));
    const errors = Math.max(
      0,
      toSafeInt(snapshot.errorCount) ||
      toSafeInt(snapshot.http429) + toSafeInt(snapshot.http5xx) + toSafeInt(snapshot.criticalCount)
    );
    const failedRun = !snapshot.lockSuccess && errors > 0;

    row.starts += startsAdd;
    row.locks += locksAdd;
    row.totalRunSec += runSecAdd;
    if (failedRun) row.failedRuns += 1;

    data.records[key] = row;
    writeDailyStats(data);
    return getTodayStats(email);
  }

  function shouldEmitStopSummary(stopReason) {
    return String(stopReason || "") === "lock_opened";
  }

  // ===== Telegram Queue And Payloads =====
  // Telegram queue shaping, payload encoding, and snapshot helpers.
  // Чистить старі дедуп-ключі в telegram map.
  function pruneTelegramDedup() {
    const ts = nowMs();
    for (const [key, seenAt] of state.tgDedupMap.entries()) {
      if (ts - seenAt > TELEGRAM_DEDUP_TTL_MS) {
        state.tgDedupMap.delete(key);
      }
    }
    for (const [key, seenAt] of state.tgFeedbackDedupMap.entries()) {
      if (ts - seenAt > TELEGRAM_DEDUP_TTL_MS) {
        state.tgFeedbackDedupMap.delete(key);
      }
    }
  }

  // Чистить sliding-window ліміт telegram-відправок.
  function pruneTelegramWindow() {
    const ts = nowMs();
    state.tgSentTimestamps = state.tgSentTimestamps.filter((itemTs) => ts - itemTs <= TELEGRAM_WINDOW_MS);
  }

  // Повертає thread id за типом повідомлення.
  function resolveTelegramThread(kind) {
    if (kind === "critical") return TELEGRAM_THREAD_CRITICAL;
    if (kind === "feedback") return TELEGRAM_THREAD_FEEDBACK;
    return TELEGRAM_THREAD_NOISE;
  }

  function getUtf8ByteLength(text) {
    try {
      return new TextEncoder().encode(String(text || "")).length;
    } catch (_err) {
      return unescape(encodeURIComponent(String(text || ""))).length;
    }
  }

  function utf8ToBase64(text) {
    try {
      const bytes = new TextEncoder().encode(String(text || ""));
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      return btoa(binary);
    } catch (_err) {
      return btoa(unescape(encodeURIComponent(String(text || ""))));
    }
  }

  function base64ToBlob(base64, mimeType) {
    const raw = atob(String(base64 || ""));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) {
      out[i] = raw.charCodeAt(i);
    }
    return new Blob([out], { type: mimeType || "application/octet-stream" });
  }

  function buildCurrentPageSnapshotHtml() {
    const sourceRoot = document.documentElement;
    if (!sourceRoot) return "";

    const cloneRoot = sourceRoot.cloneNode(true);
    cloneRoot.querySelectorAll("script").forEach((node) => node.remove());
    cloneRoot.querySelectorAll("input").forEach((node) => {
      const type = String(node.getAttribute("type") || "").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        if (node.checked) {
          node.setAttribute("checked", "checked");
        } else {
          node.removeAttribute("checked");
        }
        return;
      }
      node.setAttribute("value", "[redacted]");
    });
    cloneRoot.querySelectorAll("textarea").forEach((node) => {
      node.textContent = "[redacted]";
    });
    cloneRoot.querySelectorAll("select").forEach((node) => {
      Array.from(node.options || []).forEach((option) => {
        if (option.selected) {
          option.setAttribute("selected", "selected");
        } else {
          option.removeAttribute("selected");
        }
      });
    });

    let headEl = cloneRoot.querySelector("head");
    if (!headEl) {
      headEl = cloneRoot.ownerDocument.createElement("head");
      cloneRoot.insertBefore(headEl, cloneRoot.firstChild);
    }

    const baseEl = cloneRoot.ownerDocument.createElement("base");
    baseEl.setAttribute("href", location.href);
    headEl.insertBefore(baseEl, headEl.firstChild);

    const metaCharset = cloneRoot.ownerDocument.createElement("meta");
    metaCharset.setAttribute("charset", "utf-8");
    headEl.insertBefore(metaCharset, headEl.firstChild);

    const metaSnapshot = cloneRoot.ownerDocument.createElement("meta");
    metaSnapshot.setAttribute("name", "witch-mow-snapshot");
    metaSnapshot.setAttribute(
      "content",
      `captured_at=${new Date(nowMs()).toISOString()};url=${location.href};scroll_x=${toSafeInt(window.scrollX)};scroll_y=${toSafeInt(
        window.scrollY
      )};viewport=${toSafeInt(window.innerWidth)}x${toSafeInt(window.innerHeight)}`
    );
    headEl.appendChild(metaSnapshot);

    const doctype = document.doctype
      ? `<!DOCTYPE ${document.doctype.name || "html"}${document.doctype.publicId ? ` PUBLIC "${document.doctype.publicId}"` : ""}${document.doctype.systemId ? ` "${document.doctype.systemId}"` : ""
      }>\n`
      : "";
    const html = cloneRoot.outerHTML;
    return `${doctype}${html}`;
  }

  function buildFetchedResponseSnapshotHtml(html) {
    return String(html || "");
  }

  function safeFileNamePart(text, fallback) {
    const cleaned = String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return cleaned || fallback;
  }

  function buildCriticalSnapshotFileName(reason, runId, suffix) {
    const reasonPart = safeFileNamePart(reason, "critical");
    const runPart = safeFileNamePart(runId, "no-run");
    const suffixPart = safeFileNamePart(
      suffix,
      new Date(nowMs()).toISOString().replace(/[^\d]/g, "").slice(0, 14) || String(nowMs())
    );
    return `critical-current-page-${reasonPart}-${runPart}-${suffixPart}.html`;
  }

  function buildCriticalFetchedResponseFileName(reason, runId, suffix) {
    const reasonPart = safeFileNamePart(reason, "critical");
    const runPart = safeFileNamePart(runId, "no-run");
    const suffixPart = safeFileNamePart(suffix, "body");
    return `critical-fetched-response-${reasonPart}-${runPart}-${suffixPart}.html`;
  }

  function buildCriticalDiagnosticsFileName(reason, runId, suffix) {
    const reasonPart = safeFileNamePart(reason, "critical");
    const runPart = safeFileNamePart(runId, "no-run");
    const suffixPart = safeFileNamePart(suffix, "diag");
    return `critical-diagnostics-${reasonPart}-${runPart}-${suffixPart}.json`;
  }

  function buildCriticalIncidentReportFileName(reason, runId, suffix) {
    const reasonPart = safeFileNamePart(reason, "critical");
    const runPart = safeFileNamePart(runId, "no-run");
    const suffixPart = safeFileNamePart(suffix, "report");
    return `critical-incident-report-${reasonPart}-${runPart}-${suffixPart}.html`;
  }

  function buildCriticalSourcePartFileName(reason, runId, sourceKind, index, total, suffix) {
    const reasonPart = safeFileNamePart(reason, "critical");
    const runPart = safeFileNamePart(runId, "no-run");
    const sourcePart = safeFileNamePart(sourceKind, "source");
    const suffixPart = safeFileNamePart(suffix, "part");
    const partIndex = String(index + 1).padStart(2, "0");
    const partTotal = String(Math.max(1, total)).padStart(2, "0");
    return `critical-${sourcePart}-${reasonPart}-${runPart}-${suffixPart}.part-${partIndex}-of-${partTotal}.txt`;
  }

  function splitTextByUtf8Bytes(text, maxBytes) {
    const value = String(text || "");
    const limit = Math.max(1, toSafeInt(maxBytes));
    if (!value) return [];
    if (getUtf8ByteLength(value) <= limit) return [value];

    const parts = [];
    let start = 0;
    while (start < value.length) {
      let low = start + 1;
      let high = value.length;
      let best = start + 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const chunk = value.slice(start, mid);
        const bytes = getUtf8ByteLength(chunk);
        if (bytes <= limit) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best <= start) {
        best = start + 1;
      }

      const prevChar = value.charCodeAt(best - 1);
      const nextChar = value.charCodeAt(best);
      const endsWithHighSurrogate = prevChar >= 0xd800 && prevChar <= 0xdbff;
      const startsWithLowSurrogate = nextChar >= 0xdc00 && nextChar <= 0xdfff;
      if (endsWithHighSurrogate && startsWithLowSurrogate) {
        best -= 1;
      }

      if (best <= start) {
        best = Math.min(value.length, start + 2);
      }

      parts.push(value.slice(start, best));
      start = best;
    }

    return parts;
  }

  function makeTelegramQueueItemId(raw, threadId, text, createdAt, messageType) {
    const existing = compactText(String(raw && raw.id ? raw.id : ""));
    if (existing) return existing.slice(0, 120);
    const base = `${threadId}|${createdAt}|${messageType || "text"}|${text.slice(0, 180)}`;
    return `tg_${hashText(base)}`;
  }

  function getTelegramQueueDedupKey(raw) {
    return compactText(String(raw && raw.dedupKey ? raw.dedupKey : "")).slice(0, 240);
  }

  function getTelegramQueueMergeKey(item) {
    const dedupKey = getTelegramQueueDedupKey(item);
    if (dedupKey) return `dedup:${dedupKey}`;
    const id = compactText(String(item && item.id ? item.id : "")).slice(0, 120);
    return id ? `id:${id}` : "";
  }

  // Нормалізує telegram queue item до безпечного формату.
  function normalizeTelegramQueueItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const threadId = toSafeInt(raw.threadId);
    if (!threadId) return null;
    const messageType = String(raw.messageType || "text") === "document" ? "document" : "text";
    const text = String(raw.text || "").slice(0, 3500);
    const documentName = compactText(String(raw.documentName || "")).slice(0, 120);
    const documentMime = compactText(String(raw.documentMime || "")).slice(0, 120) || "text/html";
    const documentBase64 = String(raw.documentBase64 || "");
    const documentSize = Math.max(0, toSafeInt(raw.documentSize));
    const replyToItemId = compactText(String(raw.replyToItemId || "")).slice(0, 120);
    const replyToMessageId = Math.max(0, toSafeInt(raw.replyToMessageId));
    const dedupKey = getTelegramQueueDedupKey(raw);
    if (messageType === "text" && !text) return null;
    if (messageType === "document" && (!documentName || !documentBase64)) return null;
    const createdAt = Math.max(0, toSafeInt(raw.createdAt) || nowMs());
    return {
      id: makeTelegramQueueItemId(raw, threadId, messageType === "document" ? documentName : text, createdAt, messageType),
      threadId,
      messageType,
      text,
      documentName,
      documentMime,
      documentBase64,
      documentSize,
      replyToItemId,
      replyToMessageId,
      disableNotification: Boolean(raw.disableNotification),
      kind: String(raw.kind || "noise"),
      eventType: String(raw.eventType || ""),
      attempts: Math.max(0, toSafeInt(raw.attempts)),
      retryAt: Math.max(0, toSafeInt(raw.retryAt)),
      createdAt,
      lastError: compactText(String(raw.lastError || "")).slice(0, 240),
      dedupKey,
    };
  }

  function pickNewerTelegramQueueItem(left, right) {
    if (!left) return right;
    if (!right) return left;
    if (toSafeInt(right.replyToMessageId) > toSafeInt(left.replyToMessageId)) return right;
    if (!compactText(String(left.replyToItemId || "")) && compactText(String(right.replyToItemId || ""))) return right;
    if (toSafeInt(right.attempts) > toSafeInt(left.attempts)) return right;
    if (toSafeInt(right.retryAt) > toSafeInt(left.retryAt)) return right;
    if (toSafeInt(right.createdAt) > toSafeInt(left.createdAt) && compactText(String(right.lastError || ""))) return right;
    return left;
  }

  function trimTelegramQueueItems(items) {
    const list = (Array.isArray(items) ? items : [])
      .map((item) => normalizeTelegramQueueItem(item))
      .filter((item) => item && !isTelegramItemDone(item.id));
    if (list.length <= TELEGRAM_MAX_QUEUE_ITEMS) {
      return list.sort((a, b) => toSafeInt(a.createdAt) - toSafeInt(b.createdAt));
    }

    const keepIds = new Set(
      list
        .slice()
        .sort((left, right) => {
          const leftPriority = getTelegramItemPriority(left.kind);
          const rightPriority = getTelegramItemPriority(right.kind);
          if (leftPriority !== rightPriority) return leftPriority - rightPriority;
          return toSafeInt(right.createdAt) - toSafeInt(left.createdAt);
        })
        .slice(0, TELEGRAM_MAX_QUEUE_ITEMS)
        .map((item) => item.id)
    );

    return list
      .filter((item) => keepIds.has(item.id))
      .sort((a, b) => toSafeInt(a.createdAt) - toSafeInt(b.createdAt));
  }

  function parseLegacyTelegramDoneMapFromLocalStorage() {
    try {
      const raw = localStorage.getItem(TELEGRAM_DONE_STORAGE_KEY);
      if (!raw) return new Map();
      const parsed = JSON.parse(raw);
      const source = parsed && typeof parsed === "object" && parsed.items && typeof parsed.items === "object" ? parsed.items : {};
      const map = new Map();
      for (const [id, ts] of Object.entries(source)) {
        const safeTs = Math.max(0, toSafeInt(ts));
        if (id && safeTs) map.set(id, safeTs);
      }
      return map;
    } catch (_err) {
      return new Map();
    }
  }

  function parseLegacyTelegramQueueItemsFromLocalStorage() {
    try {
      const raw = localStorage.getItem(TELEGRAM_QUEUE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.items) ? parsed.items : [];
      return items.map((item) => normalizeTelegramQueueItem(item)).filter((item) => item);
    } catch (_err) {
      return [];
    }
  }

  function parseLegacyTelegramDeadItemsFromLocalStorage() {
    try {
      const raw = localStorage.getItem(TELEGRAM_DEAD_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed && parsed.items) ? parsed.items : [];
    } catch (_err) {
      return [];
    }
  }

  function getTelegramMetaStorageKey(key) {
    return `${TELEGRAM_META_STORAGE_PREFIX}${compactText(String(key || ""))}`;
  }

  function readTelegramMetaFromLocalStorage(key) {
    try {
      const raw = localStorage.getItem(getTelegramMetaStorageKey(key));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function writeTelegramMetaToLocalStorage(key, value) {
    try {
      localStorage.setItem(getTelegramMetaStorageKey(key), JSON.stringify(value));
      return true;
    } catch (_err) {
      return false;
    }
  }

  // IndexedDB-backed telegram persistence with legacy localStorage migration.
  function openTelegramDb() {
    if (state.tgDbPromise) return state.tgDbPromise;
    state.tgDbPromise = new Promise((resolve) => {
      if (typeof indexedDB === "undefined") {
        state.tgDbPromise = null;
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(TELEGRAM_DB_NAME, TELEGRAM_DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(TELEGRAM_DB_STORE_QUEUE)) {
            db.createObjectStore(TELEGRAM_DB_STORE_QUEUE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(TELEGRAM_DB_STORE_META)) {
            db.createObjectStore(TELEGRAM_DB_STORE_META, { keyPath: "key" });
          }
          if (!db.objectStoreNames.contains(TELEGRAM_DB_STORE_DEAD)) {
            db.createObjectStore(TELEGRAM_DB_STORE_DEAD, { keyPath: "id" });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            try {
              db.close();
            } catch (_err) { }
            state.tgDbPromise = null;
          };
          resolve(db);
        };
        req.onblocked = () => {
          console.error("[Smart bookmarklet] telegram IndexedDB open blocked by another tab");
          state.tgDbPromise = null;
          resolve(null);
        };
        req.onerror = () => {
          console.error("[Smart bookmarklet] telegram IndexedDB open failed:", req.error);
          state.tgDbPromise = null;
          resolve(null);
        };
      } catch (err) {
        console.error("[Smart bookmarklet] telegram IndexedDB init failed:", err);
        state.tgDbPromise = null;
        resolve(null);
      }
    });
    return state.tgDbPromise;
  }

  function idbRequestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  function idbTransactionDonePromise(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
      tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    });
  }

  function parseLocalStorageLeaseRecord(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? {
          ownerId: compactText(String(parsed.ownerId || "")),
          expiresAt: Math.max(0, toSafeInt(parsed.expiresAt)),
        }
        : null;
    } catch (_err) {
      return null;
    }
  }

  function tryAcquireLocalStorageLease(lockKey, ownerId, ttlMs) {
    try {
      const now = nowMs();
      const existing = parseLocalStorageLeaseRecord(localStorage.getItem(lockKey));
      if (existing && existing.ownerId !== ownerId && existing.expiresAt > now) {
        return false;
      }
      localStorage.setItem(
        lockKey,
        JSON.stringify({
          ownerId,
          expiresAt: now + Math.max(1_000, toSafeInt(ttlMs) || TELEGRAM_LOCK_FALLBACK_TTL_MS),
        })
      );
      const confirmed = parseLocalStorageLeaseRecord(localStorage.getItem(lockKey));
      return Boolean(confirmed && confirmed.ownerId === ownerId && confirmed.expiresAt > now);
    } catch (_err) {
      return false;
    }
  }

  function renewLocalStorageLease(lockKey, ownerId, ttlMs) {
    try {
      const existing = parseLocalStorageLeaseRecord(localStorage.getItem(lockKey));
      if (!existing || existing.ownerId !== ownerId) return false;
      localStorage.setItem(
        lockKey,
        JSON.stringify({
          ownerId,
          expiresAt: nowMs() + Math.max(1_000, toSafeInt(ttlMs) || TELEGRAM_LOCK_FALLBACK_TTL_MS),
        })
      );
      return true;
    } catch (_err) {
      return false;
    }
  }

  function releaseLocalStorageLease(lockKey, ownerId) {
    try {
      const existing = parseLocalStorageLeaseRecord(localStorage.getItem(lockKey));
      if (existing && existing.ownerId === ownerId) {
        localStorage.removeItem(lockKey);
      }
    } catch (_err) { }
  }

  function canUseLocalStorageLease(lockKey) {
    try {
      const probeKey = `${lockKey}:probe`;
      localStorage.setItem(probeKey, "1");
      localStorage.removeItem(probeKey);
      return true;
    } catch (_err) {
      return false;
    }
  }

  async function withLocalStorageLease(lockKey, task) {
    if (!canUseLocalStorageLease(lockKey)) {
      await task();
      return true;
    }
    const ownerId = makeShortId("lease");
    if (!tryAcquireLocalStorageLease(lockKey, ownerId, TELEGRAM_LOCK_FALLBACK_TTL_MS)) {
      return false;
    }
    const renewTimer = setInterval(() => {
      renewLocalStorageLease(lockKey, ownerId, TELEGRAM_LOCK_FALLBACK_TTL_MS);
    }, TELEGRAM_LOCK_FALLBACK_RENEW_MS);
    try {
      await task();
      return true;
    } finally {
      clearInterval(renewTimer);
      releaseLocalStorageLease(lockKey, ownerId);
    }
  }

  async function withTelegramStorageLock(task) {
    if (
      typeof navigator !== "undefined" &&
      navigator.locks &&
      typeof navigator.locks.request === "function"
    ) {
      try {
        return await navigator.locks.request(
          TELEGRAM_STORAGE_LOCK_KEY,
          { mode: "exclusive" },
          () => task()
        );
      } catch (_err) { }
    }
    return withLocalStorageLease(TELEGRAM_STORAGE_LOCK_KEY, task);
  }

  async function withTelegramSenderLock(task) {
    if (
      typeof navigator !== "undefined" &&
      navigator.locks &&
      typeof navigator.locks.request === "function"
    ) {
      try {
        return await navigator.locks.request(
          TELEGRAM_SENDER_LOCK_KEY,
          { mode: "exclusive", ifAvailable: true },
          (lock) => {
            if (!lock) return false;
            return task();
          }
        );
      } catch (_err) {
        return false;
      }
    }
    return withLocalStorageLease(TELEGRAM_SENDER_LOCK_KEY, task);
  }

  async function readTelegramMeta(key) {
    const db = await openTelegramDb();
    if (!db) return readTelegramMetaFromLocalStorage(key);
    try {
      const tx = db.transaction(TELEGRAM_DB_STORE_META, "readonly");
      const store = tx.objectStore(TELEGRAM_DB_STORE_META);
      const record = await idbRequestPromise(store.get(String(key || "")));
      await idbTransactionDonePromise(tx).catch(() => { });
      return record && typeof record === "object" ? record.value : null;
    } catch (err) {
      console.error("[Smart bookmarklet] telegram meta read failed:", err);
      return null;
    }
  }

  async function writeTelegramMeta(key, value) {
    const db = await openTelegramDb();
    if (!db) return writeTelegramMetaToLocalStorage(key, value);
    try {
      const tx = db.transaction(TELEGRAM_DB_STORE_META, "readwrite");
      tx.objectStore(TELEGRAM_DB_STORE_META).put({
        key: String(key || ""),
        value,
        updatedAt: nowMs(),
      });
      await idbTransactionDonePromise(tx);
      return true;
    } catch (err) {
      console.error("[Smart bookmarklet] telegram meta write failed:", err);
      return false;
    }
  }

  async function readTelegramQueueItemsFromDb() {
    const db = await openTelegramDb();
    if (!db) return parseLegacyTelegramQueueItemsFromLocalStorage();
    try {
      const tx = db.transaction(TELEGRAM_DB_STORE_QUEUE, "readonly");
      const records = await idbRequestPromise(tx.objectStore(TELEGRAM_DB_STORE_QUEUE).getAll());
      await idbTransactionDonePromise(tx).catch(() => { });
      const list = Array.isArray(records) ? records : [];
      return list.map((item) => normalizeTelegramQueueItem(item)).filter((item) => item);
    } catch (err) {
      console.error("[Smart bookmarklet] telegram queue read failed:", err);
      return [];
    }
  }

  async function upsertTelegramQueueItemsToDb(items) {
    const db = await openTelegramDb();
    if (!db) {
      try {
        const existing = parseLegacyTelegramQueueItemsFromLocalStorage();
        const merged = new Map();
        existing.forEach((item) => {
          if (!item || isTelegramItemDone(item.id)) return;
          const mergeKey = getTelegramQueueMergeKey(item);
          if (!mergeKey) return;
          merged.set(mergeKey, item);
        });
        (Array.isArray(items) ? items : []).forEach((item) => {
          const normalized = normalizeTelegramQueueItem(item);
          if (!normalized || isTelegramItemDone(normalized.id)) return;
          const mergeKey = getTelegramQueueMergeKey(normalized);
          if (!mergeKey) return;
          merged.set(mergeKey, pickNewerTelegramQueueItem(merged.get(mergeKey), normalized));
        });
        localStorage.setItem(TELEGRAM_QUEUE_STORAGE_KEY, JSON.stringify({ items: trimTelegramQueueItems(Array.from(merged.values())) }));
        return true;
      } catch (_err) {
        return false;
      }
    }
    try {
      const tx = db.transaction(TELEGRAM_DB_STORE_QUEUE, "readwrite");
      const store = tx.objectStore(TELEGRAM_DB_STORE_QUEUE);
      (Array.isArray(items) ? items : []).forEach((item) => {
        const normalized = normalizeTelegramQueueItem(item);
        if (normalized) store.put(normalized);
      });
      await idbTransactionDonePromise(tx);
      return true;
    } catch (err) {
      console.error("[Smart bookmarklet] telegram queue write failed:", err);
      return false;
    }
  }

  async function deleteTelegramQueueItemsFromDb(ids) {
    const db = await openTelegramDb();
    if (!db) {
      try {
        const deleteIds = new Set(
          (Array.isArray(ids) ? ids : []).map((id) => compactText(String(id || ""))).filter(Boolean)
        );
        const kept = parseLegacyTelegramQueueItemsFromLocalStorage().filter((item) => item && !deleteIds.has(item.id));
        localStorage.setItem(TELEGRAM_QUEUE_STORAGE_KEY, JSON.stringify({ items: trimTelegramQueueItems(kept) }));
        return true;
      } catch (_err) {
        return false;
      }
    }
    try {
      const uniqueIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => compactText(String(id || ""))).filter(Boolean)));
      if (uniqueIds.length === 0) return true;
      const tx = db.transaction(TELEGRAM_DB_STORE_QUEUE, "readwrite");
      const store = tx.objectStore(TELEGRAM_DB_STORE_QUEUE);
      uniqueIds.forEach((id) => store.delete(id));
      await idbTransactionDonePromise(tx);
      return true;
    } catch (err) {
      console.error("[Smart bookmarklet] telegram queue delete failed:", err);
      return false;
    }
  }

  async function readTelegramDeadItemsFromDb() {
    const db = await openTelegramDb();
    if (!db) return parseLegacyTelegramDeadItemsFromLocalStorage();
    try {
      const tx = db.transaction(TELEGRAM_DB_STORE_DEAD, "readonly");
      const records = await idbRequestPromise(tx.objectStore(TELEGRAM_DB_STORE_DEAD).getAll());
      await idbTransactionDonePromise(tx).catch(() => { });
      return Array.isArray(records) ? records : [];
    } catch (err) {
      console.error("[Smart bookmarklet] telegram dead-letter read failed:", err);
      return [];
    }
  }

  async function upsertTelegramDeadItemsToDb(items) {
    const db = await openTelegramDb();
    if (!db) {
      try {
        const existing = parseLegacyTelegramDeadItemsFromLocalStorage();
        const merged = [...existing, ...(Array.isArray(items) ? items : [])]
          .filter((item) => item && typeof item === "object" && item.id)
          .slice(-TELEGRAM_MAX_DEAD_ITEMS);
        localStorage.setItem(TELEGRAM_DEAD_STORAGE_KEY, JSON.stringify({ items: merged }));
        return true;
      } catch (_err) {
        return false;
      }
    }
    try {
      const retained = [...(Array.isArray(items) ? items : [])]
        .filter((item) => item && typeof item === "object" && item.id)
        .slice(-TELEGRAM_MAX_DEAD_ITEMS);
      const tx = db.transaction(TELEGRAM_DB_STORE_DEAD, "readwrite");
      const store = tx.objectStore(TELEGRAM_DB_STORE_DEAD);
      store.clear();
      retained.forEach((item) => {
        if (item && typeof item === "object" && item.id) {
          store.put(item);
        }
      });
      await idbTransactionDonePromise(tx);
      return true;
    } catch (err) {
      console.error("[Smart bookmarklet] telegram dead-letter write failed:", err);
      return false;
    }
  }

  async function migrateLegacyTelegramStorageToIndexedDb() {
    if (state.tgLegacyMigrated) return;
    await withTelegramStorageLock(async () => {
      if (state.tgLegacyMigrated) return;

      const db = await openTelegramDb();
      if (!db) {
        state.tgLegacyMigrated = true;
        return;
      }

      const legacyQueue = parseLegacyTelegramQueueItemsFromLocalStorage();
      const legacyDoneMap = parseLegacyTelegramDoneMapFromLocalStorage();
      const legacyDead = parseLegacyTelegramDeadItemsFromLocalStorage();

      if (legacyQueue.length === 0 && legacyDoneMap.size === 0 && legacyDead.length === 0) {
        state.tgLegacyMigrated = true;
        return;
      }

      const existingQueue = await readTelegramQueueItemsFromDb();
      const queueMerged = new Map();
      existingQueue.forEach((item) => {
        if (!item) return;
        const mergeKey = getTelegramQueueMergeKey(item);
        if (!mergeKey) return;
        queueMerged.set(mergeKey, item);
      });
      legacyQueue.forEach((item) => {
        if (!item) return;
        const mergeKey = getTelegramQueueMergeKey(item);
        if (!mergeKey) return;
        queueMerged.set(mergeKey, pickNewerTelegramQueueItem(queueMerged.get(mergeKey), item));
      });
      const mergedQueueItems = trimTelegramQueueItems(Array.from(queueMerged.values()));
      await upsertTelegramQueueItemsToDb(mergedQueueItems);

      const existingDoneRaw = await readTelegramMeta(TELEGRAM_DB_META_DONE_MAP_KEY);
      const existingDone = existingDoneRaw && typeof existingDoneRaw === "object" ? existingDoneRaw : {};
      const doneObj = { ...existingDone };
      for (const [id, doneAt] of legacyDoneMap.entries()) {
        if (!id) continue;
        const cur = toSafeInt(doneObj[id]);
        const next = toSafeInt(doneAt);
        if (!cur || next > cur) doneObj[id] = next;
      }
      await writeTelegramMeta(TELEGRAM_DB_META_DONE_MAP_KEY, doneObj);

      if (legacyDead.length > 0) {
        const existingDead = await readTelegramDeadItemsFromDb();
        const mergedDead = [...existingDead, ...legacyDead]
          .filter((item) => item && typeof item === "object")
          .slice(-TELEGRAM_MAX_DEAD_ITEMS);
        await upsertTelegramDeadItemsToDb(
          mergedDead.map((item) => ({
            id: item.id || makeShortId("tg_dead"),
            kind: item.kind || "noise",
            eventType: item.eventType || "",
            messageType: item.messageType || "text",
            threadId: toSafeInt(item.threadId),
            attempts: toSafeInt(item.attempts),
            error: compactText(String(item.error || "")).slice(0, 240),
            text: String(item.text || "").slice(0, 400),
            documentName: String(item.documentName || "").slice(0, 120),
            documentSize: toSafeInt(item.documentSize),
            droppedAt: Math.max(0, toSafeInt(item.droppedAt) || nowMs()),
          }))
        );
      }

      try {
        localStorage.removeItem(TELEGRAM_QUEUE_STORAGE_KEY);
        localStorage.removeItem(TELEGRAM_DONE_STORAGE_KEY);
        localStorage.removeItem(TELEGRAM_DEAD_STORAGE_KEY);
      } catch (_err) { }

      state.tgLegacyMigrated = true;
    });
  }

  async function readTelegramDoneMap() {
    const raw = await readTelegramMeta(TELEGRAM_DB_META_DONE_MAP_KEY);
    const source = raw && typeof raw === "object" ? raw : {};
    const map = new Map();
    for (const [id, ts] of Object.entries(source)) {
      const safeTs = Math.max(0, toSafeInt(ts));
      if (id && safeTs) map.set(id, safeTs);
    }
    return map;
  }

  function pruneTelegramDoneMap() {
    const ts = nowMs();
    let changed = false;
    for (const [id, doneAt] of state.tgDoneMap.entries()) {
      if (!id || ts - doneAt > TELEGRAM_DONE_TTL_MS) {
        state.tgDoneMap.delete(id);
        changed = true;
      }
    }
    return changed;
  }

  async function writeTelegramDoneMap(map) {
    const value = {};
    map.forEach((doneAt, id) => {
      const safeTs = Math.max(0, toSafeInt(doneAt));
      if (id && safeTs) value[id] = safeTs;
    });
    return writeTelegramMeta(TELEGRAM_DB_META_DONE_MAP_KEY, value);
  }

  async function mergeTelegramDoneMapFromDb() {
    const latest = await readTelegramDoneMap();
    latest.forEach((doneAt, id) => {
      const current = toSafeInt(state.tgDoneMap.get(id));
      if (!current || doneAt > current) {
        state.tgDoneMap.set(id, doneAt);
      }
    });
    const changed = pruneTelegramDoneMap();
    if (changed) {
      await writeTelegramDoneMap(state.tgDoneMap);
    }
  }

  function isTelegramItemDone(itemId) {
    if (!itemId) return false;
    return state.tgDoneMap.has(itemId);
  }

  async function markTelegramItemDone(itemId) {
    if (!itemId) return;
    state.tgDoneMap.set(itemId, nowMs());
    pruneTelegramDoneMap();
    await writeTelegramDoneMap(state.tgDoneMap);
  }

  async function readTelegramReplyMap() {
    const raw = await readTelegramMeta(TELEGRAM_DB_META_REPLY_MAP_KEY);
    const source = raw && typeof raw === "object" ? raw : {};
    const map = new Map();
    for (const [id, payload] of Object.entries(source)) {
      const parsed = payload && typeof payload === "object" ? payload : {};
      const messageId = toSafeInt(parsed.messageId);
      const at = Math.max(0, toSafeInt(parsed.at));
      if (id && messageId > 0 && at > 0) {
        map.set(id, { messageId, at });
      }
    }
    return map;
  }

  function pruneTelegramReplyMap() {
    const ts = nowMs();
    let changed = false;
    const all = Array.from(state.tgReplyMap.entries()).sort((a, b) => toSafeInt(a[1] && a[1].at) - toSafeInt(b[1] && b[1].at));
    all.forEach(([id, payload], index) => {
      const rec = payload && typeof payload === "object" ? payload : {};
      const at = Math.max(0, toSafeInt(rec.at));
      const messageId = toSafeInt(rec.messageId);
      const expired = !id || !at || !messageId || ts - at > TELEGRAM_REPLY_MAP_TTL_MS;
      const overLimit = all.length > TELEGRAM_REPLY_MAP_MAX_ITEMS && index < all.length - TELEGRAM_REPLY_MAP_MAX_ITEMS;
      if (expired || overLimit) {
        state.tgReplyMap.delete(id);
        changed = true;
      }
    });
    return changed;
  }

  async function writeTelegramReplyMap(map) {
    const value = {};
    map.forEach((payload, id) => {
      const rec = payload && typeof payload === "object" ? payload : {};
      const messageId = toSafeInt(rec.messageId);
      const at = Math.max(0, toSafeInt(rec.at));
      if (id && messageId > 0 && at > 0) {
        value[id] = { messageId, at };
      }
    });
    return writeTelegramMeta(TELEGRAM_DB_META_REPLY_MAP_KEY, value);
  }

  async function mergeTelegramReplyMapFromDb() {
    const latest = await readTelegramReplyMap();
    latest.forEach((payload, id) => {
      const current = state.tgReplyMap.get(id);
      const currentAt = toSafeInt(current && current.at);
      const nextAt = toSafeInt(payload && payload.at);
      if (!current || nextAt > currentAt) {
        state.tgReplyMap.set(id, payload);
      }
    });
    const changed = pruneTelegramReplyMap();
    if (changed) {
      await writeTelegramReplyMap(state.tgReplyMap);
    }
  }

  function getTelegramReplyMessageId(itemId) {
    const rec = state.tgReplyMap.get(String(itemId || ""));
    const messageId = toSafeInt(rec && rec.messageId);
    return messageId > 0 ? messageId : 0;
  }

  async function markTelegramReplyMessage(itemId, messageId) {
    const safeItemId = compactText(String(itemId || "")).slice(0, 120);
    const safeMessageId = toSafeInt(messageId);
    if (!safeItemId || safeMessageId <= 0) return;
    state.tgReplyMap.set(safeItemId, {
      messageId: safeMessageId,
      at: nowMs(),
    });
    pruneTelegramReplyMap();
    await writeTelegramReplyMap(state.tgReplyMap);
  }

  async function readPersistedTelegramQueueItems() {
    return readTelegramQueueItemsFromDb();
  }

  // Читає персистентну telegram-чергу з IndexedDB.
  async function loadPersistedTelegramQueue() {
    await mergeTelegramDoneMapFromDb();
    await mergeTelegramReplyMapFromDb();
    const items = await readPersistedTelegramQueueItems();
    return trimTelegramQueueItems(items);
  }

  async function pushTelegramDeadLetter(item, errorText) {
    const ok = await withTelegramStorageLock(async () => {
      const existing = await readTelegramDeadItemsFromDb();
      const next = {
        id: item.id || makeShortId("tg_dead"),
        kind: item.kind || "noise",
        eventType: item.eventType || "",
        messageType: item.messageType || "text",
        threadId: toSafeInt(item.threadId),
        attempts: toSafeInt(item.attempts),
        error: compactText(String(errorText || item.lastError || "")).slice(0, 240),
        text: String(item.text || "").slice(0, 400),
        documentName: String(item.documentName || "").slice(0, 120),
        documentSize: toSafeInt(item.documentSize),
        droppedAt: nowMs(),
      };
      const merged = [...existing, next].slice(-TELEGRAM_MAX_DEAD_ITEMS);
      return upsertTelegramDeadItemsToDb(merged);
    });
    if (!ok) {
      console.error("[Smart bookmarklet] telegram dead-letter persist failed");
    }
  }

  // Пише персистентну telegram-чергу в IndexedDB.
  async function persistTelegramQueue() {
    return withTelegramStorageLock(async () => {
      await mergeTelegramDoneMapFromDb();
      await mergeTelegramReplyMapFromDb();
      const storageItems = await readPersistedTelegramQueueItems();
      const merged = new Map();

      storageItems.forEach((item) => {
        if (!item || isTelegramItemDone(item.id)) return;
        const mergeKey = getTelegramQueueMergeKey(item);
        if (!mergeKey) return;
        merged.set(mergeKey, item);
      });
      state.tgQueue.forEach((item) => {
        const normalized = normalizeTelegramQueueItem(item);
        if (!normalized || isTelegramItemDone(normalized.id)) return;
        const mergeKey = getTelegramQueueMergeKey(normalized);
        if (!mergeKey) return;
        merged.set(mergeKey, pickNewerTelegramQueueItem(merged.get(mergeKey), normalized));
      });

      const items = trimTelegramQueueItems(Array.from(merged.values()));
      state.tgQueue = items;

      const ok = await upsertTelegramQueueItemsToDb(items);
      const keptIds = new Set(items.map((item) => item.id));
      const deleteIds = storageItems
        .filter((item) => item && (isTelegramItemDone(item.id) || !keptIds.has(item.id)))
        .map((item) => item.id);
      if (deleteIds.length > 0) {
        await deleteTelegramQueueItemsFromDb(deleteIds);
      }
      if (!ok) {
        console.error("[Smart bookmarklet] telegram queue persist failed");
      }
      return ok;
    });
  }

  // Дістає retry_after (мс) із відповіді Telegram.
  function parseTelegramRetryAfterMs(bodyText) {
    const body = String(bodyText || "");
    if (!body) return 0;

    try {
      const parsed = JSON.parse(body);
      const sec = toSafeInt(parsed && parsed.parameters ? parsed.parameters.retry_after : 0);
      if (sec > 0) return sec * 1000;
    } catch (_err) { }

    const match = body.match(/retry[_\s-]*after["'\s:]*([0-9]+)/i);
    const sec = match ? Number(match[1]) : 0;
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 0;
  }

  // Обгортає telegram-помилку в уніфікований error.
  function makeTelegramError(httpStatus, bodyText) {
    const status = toSafeInt(httpStatus);
    const safeBody = compactText(String(bodyText || "")).slice(0, 500);
    const err = new Error(`HTTP ${status || 0}${safeBody ? ` ${safeBody}` : ""}`.trim());
    err.httpStatus = status;
    const retryAfterMs = parseTelegramRetryAfterMs(bodyText);
    if (retryAfterMs > 0) err.retryAfterMs = retryAfterMs;
    return err;
  }

  function parseTelegramSuccessMessageId(bodyText) {
    const body = String(bodyText || "");
    if (!body) {
      throw makeTelegramError(0, "empty telegram response");
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (_err) {
      throw makeTelegramError(0, `invalid telegram json ${body.slice(0, 240)}`);
    }

    if (!parsed || parsed.ok !== true || !parsed.result || !toSafeInt(parsed.result.message_id)) {
      throw makeTelegramError(parsed && parsed.error_code ? parsed.error_code : 0, body);
    }
    return toSafeInt(parsed.result.message_id);
  }

  // Визначає, чи Telegram-помилку має сенс ретраїти.
  function isRetryableTelegramError(error) {
    const status = toSafeInt(error && error.httpStatus);
    return status === 0 || status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);
  }

  // Рахує backoff для повторної telegram-відправки.
  function getTelegramBackoffMs(error, attempts) {
    const retryAfterMs = toSafeInt(error && error.retryAfterMs);
    if (retryAfterMs > 0) return Math.min(TELEGRAM_MAX_BACKOFF_MS, Math.max(1000, retryAfterMs));
    const expMs = Math.max(2000, 1000 * 2 ** Math.min(Math.max(1, toSafeInt(attempts)), 7));
    return Math.min(TELEGRAM_MAX_BACKOFF_MS, expMs);
  }

  // Шле текстове повідомлення в Telegram через POST.
  async function sendTelegramTextByFetch(threadId, text, disableNotification) {
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      message_thread_id: threadId,
      text,
      parse_mode: "HTML",
      disable_notification: Boolean(disableNotification),
      disable_web_page_preview: true,
    };
    const res = await fetchWithTimeout(
      TELEGRAM_SEND_MESSAGE_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        credentials: "omit",
        keepalive: true,
      },
      TELEGRAM_FETCH_TIMEOUT_MS
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw makeTelegramError(res.status, body);
    }

    const body = await res.text().catch(() => "");
    return parseTelegramSuccessMessageId(body);
  }

  // Шле документ в Telegram через multipart/form-data.
  async function sendTelegramDocumentByFetch(item) {
    const threadId = toSafeInt(item && item.threadId);
    const documentName = compactText(String(item && item.documentName ? item.documentName : "")).slice(0, 120);
    const documentMime = compactText(String(item && item.documentMime ? item.documentMime : "")).slice(0, 120) || "text/html";
    const documentBase64 = String(item && item.documentBase64 ? item.documentBase64 : "");
    if (!threadId || !documentName || !documentBase64) {
      throw new Error("HTTP 0 invalid document payload");
    }

    const blob = base64ToBlob(documentBase64, documentMime);
    const form = new FormData();
    form.append("chat_id", TELEGRAM_CHAT_ID);
    form.append("message_thread_id", String(threadId));
    form.append("disable_notification", String(Boolean(item && item.disableNotification)));
    form.append("disable_content_type_detection", "false");
    const replyToMessageId = Math.max(0, toSafeInt(item && item.replyToMessageId));
    if (replyToMessageId > 0) {
      form.append("reply_to_message_id", String(replyToMessageId));
    }
    const caption = String(item && item.text ? item.text : "").slice(0, 1000);
    if (caption) {
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }
    form.append("document", blob, documentName);

    const res = await fetchWithTimeout(
      TELEGRAM_SEND_DOCUMENT_URL,
      {
        method: "POST",
        body: form,
        cache: "no-store",
        credentials: "omit",
        keepalive: false,
      },
      TELEGRAM_FETCH_TIMEOUT_MS
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw makeTelegramError(res.status, body);
    }

    const body = await res.text().catch(() => "");
    return parseTelegramSuccessMessageId(body);
  }

  // Telegram queue intake, prioritization, and background sending.
  // Пушить повідомлення в telegram-чергу (з дедупом і reroute).
  function enqueueTelegram(kind, eventType, reason, meta) {
    if (!TELEGRAM_LOGGING_ENABLED || !TELEGRAM_BOT_TOKEN) return null;

    const normalizedEvent = String(eventType || "").trim();
    const normalizedReason = String(reason || "").trim().toLowerCase();
    const metaObj = meta || {};
    const messageType = String(metaObj.messageType || "text") === "document" ? "document" : "text";
    let actualKind = kind;

    if (actualKind === "noise") {
      const unknownNoiseEvent = normalizedEvent !== "autolock_stop";
      const unknownStopReason = normalizedEvent === "autolock_stop" && !KNOWN_STOP_REASONS.has(normalizedReason);
      if (unknownNoiseEvent || unknownStopReason) {
        actualKind = "critical";
      }
    }

    const threadId = resolveTelegramThread(actualKind);
    pruneTelegramDedup();
    const dedupTextHash = hashText(compactText(String(metaObj.text || "")).toLowerCase());
    const dedupDocHash = hashText(
      `${compactText(String(metaObj.documentName || ""))}|${toSafeInt(metaObj.documentSize)}|${compactText(String(metaObj.documentMime || ""))}`
    );
    const dedupKey =
      `${actualKind}|${normalizedEvent}|${normalizedReason}|${metaObj.orderId || ""}|` +
      `${metaObj.httpStatus || ""}|${metaObj.failStreak || ""}|${metaObj.runId || ""}|${messageType}|${dedupTextHash}|${dedupDocHash}`;
    if (state.tgDedupMap.has(dedupKey)) return null;
    state.tgDedupMap.set(dedupKey, nowMs());

    const item = {
      id: makeShortId("tg"),
      threadId,
      messageType,
      text: String(metaObj.text || "").slice(0, 3500),
      documentName: messageType === "document" ? compactText(String(metaObj.documentName || "")).slice(0, 120) : "",
      documentMime: messageType === "document" ? compactText(String(metaObj.documentMime || "")).slice(0, 120) || "text/html" : "",
      documentBase64: messageType === "document" ? String(metaObj.documentBase64 || "") : "",
      documentSize: messageType === "document" ? Math.max(0, toSafeInt(metaObj.documentSize)) : 0,
      replyToItemId: messageType === "document" ? compactText(String(metaObj.replyToItemId || "")).slice(0, 120) : "",
      replyToMessageId: messageType === "document" ? Math.max(0, toSafeInt(metaObj.replyToMessageId)) : 0,
      disableNotification: actualKind !== "critical",
      kind: actualKind,
      eventType: normalizedEvent,
      attempts: 0,
      retryAt: 0,
      createdAt: nowMs(),
      lastError: "",
      dedupKey,
    };
    const normalized = normalizeTelegramQueueItem(item);
    if (!normalized) return null;

    state.tgQueue.push(normalized);
    void persistTelegramQueue();
    runTelegramQueue();
    return normalized;
  }

  function getTelegramItemPriority(kind) {
    if (kind === "critical") return 0;
    if (kind === "feedback") return 1;
    return 2;
  }

  function selectDueTelegramItem(ts) {
    let bestIndex = -1;
    let best = null;
    let minRetryWaitMs = Infinity;
    let minThreadWaitMs = Infinity;

    for (let index = 0; index < state.tgQueue.length; index += 1) {
      const item = state.tgQueue[index];
      if (!item || isTelegramItemDone(item.id)) continue;
      const retryWaitMs = Math.max(0, toSafeInt(item.retryAt) - ts);
      if (retryWaitMs > 0) {
        minRetryWaitMs = Math.min(minRetryWaitMs, retryWaitMs);
        continue;
      }

      const lastAt = state.tgLastSentAtByThread.get(item.threadId) || 0;
      const threadWaitMs = Math.max(0, TELEGRAM_MIN_THREAD_GAP_MS - (ts - lastAt));
      if (threadWaitMs > 0) {
        minThreadWaitMs = Math.min(minThreadWaitMs, threadWaitMs);
        continue;
      }

      if (!best) {
        best = item;
        bestIndex = index;
        continue;
      }

      const curPriority = getTelegramItemPriority(item.kind);
      const bestPriority = getTelegramItemPriority(best.kind);
      if (curPriority < bestPriority) {
        best = item;
        bestIndex = index;
        continue;
      }
      if (curPriority === bestPriority && toSafeInt(item.createdAt) < toSafeInt(best.createdAt)) {
        best = item;
        bestIndex = index;
      }
    }

    if (best) return { item: best, index: bestIndex, waitMs: 0 };
    const waitMs = Math.min(minRetryWaitMs, minThreadWaitMs);
    if (Number.isFinite(waitMs) && waitMs > 0) {
      return { item: null, index: -1, waitMs: Math.max(200, Math.min(1000, waitMs)) };
    }
    return { item: null, index: -1, waitMs: 400 };
  }

  // Відправляє елементи telegram-черги з рейт-лімітом.
  async function runTelegramQueue() {
    if (state.tgSending || !TELEGRAM_LOGGING_ENABLED) return;

    const acquired = await withTelegramSenderLock(async () => {
      if (state.tgSending) return true;
      clearTelegramSenderRetryTimer();
      state.tgSending = true;
      try {
        while (true) {
          const storageQueue = await loadPersistedTelegramQueue();
          if (storageQueue.length > 0) {
            const merged = new Map();
            storageQueue.forEach((item) => {
              if (!item || isTelegramItemDone(item.id)) return;
              const mergeKey = getTelegramQueueMergeKey(item);
              if (!mergeKey) return;
              merged.set(mergeKey, item);
            });
            state.tgQueue.forEach((item) => {
              const normalized = normalizeTelegramQueueItem(item);
              if (!normalized || isTelegramItemDone(normalized.id)) return;
              const mergeKey = getTelegramQueueMergeKey(normalized);
              if (!mergeKey) return;
              merged.set(mergeKey, pickNewerTelegramQueueItem(merged.get(mergeKey), normalized));
            });
            state.tgQueue = Array.from(merged.values()).sort((a, b) => toSafeInt(a.createdAt) - toSafeInt(b.createdAt));
          } else {
            state.tgQueue = state.tgQueue.filter((item) => item && !isTelegramItemDone(item.id));
          }
          if (state.tgQueue.length === 0) break;

          pruneTelegramWindow();
          const ts = nowMs();
          if (state.tgSentTimestamps.length >= TELEGRAM_MAX_WINDOW_MESSAGES) {
            const oldestTs = state.tgSentTimestamps[0] || ts;
            const waitForWindowMs = Math.max(250, TELEGRAM_WINDOW_MS - (ts - oldestTs) + 50);
            await sleep(waitForWindowMs);
            continue;
          }

          const selected = selectDueTelegramItem(ts);
          if (!selected.item) {
            await sleep(selected.waitMs);
            continue;
          }

          if (selected.index > 0) {
            const moved = state.tgQueue.splice(selected.index, 1)[0];
            if (moved) state.tgQueue.unshift(moved);
            await persistTelegramQueue();
          }
          const item = state.tgQueue[0];
          if (!item || isTelegramItemDone(item.id)) {
            state.tgQueue.shift();
            await persistTelegramQueue();
            continue;
          }

          try {
            await mergeTelegramReplyMapFromDb();
            if (item.messageType === "document" && item.replyToItemId && !toSafeInt(item.replyToMessageId)) {
              const replyToMessageId = getTelegramReplyMessageId(item.replyToItemId);
              if (replyToMessageId > 0) {
                item.replyToMessageId = replyToMessageId;
                await persistTelegramQueue();
              } else if (!isTelegramItemDone(item.replyToItemId)) {
                const waitingMs = Math.max(0, nowMs() - toSafeInt(item.createdAt));
                if (waitingMs >= TELEGRAM_REPLY_WAIT_MAX_MS || toSafeInt(item.attempts) >= TELEGRAM_REPLY_WAIT_MAX_ATTEMPTS) {
                  item.replyToItemId = "";
                  item.lastError = "reply parent timeout";
                  await persistTelegramQueue();
                } else {
                  const moved = state.tgQueue.shift();
                  if (moved) state.tgQueue.push(moved);
                  await persistTelegramQueue();
                  await sleep(300);
                  continue;
                }
              } else {
                item.replyToItemId = "";
                item.lastError = "reply parent missing";
                await persistTelegramQueue();
              }
            }

            let sentMessageId = 0;
            if (item.messageType === "document") {
              sentMessageId = await sendTelegramDocumentByFetch(item);
            } else {
              sentMessageId = await sendTelegramTextByFetch(item.threadId, item.text, item.disableNotification);
            }
            if (sentMessageId > 0) {
              await markTelegramReplyMessage(item.id, sentMessageId);
            }
            await markTelegramItemDone(item.id);
            state.tgQueue.shift();
            state.tgLastSentAtByThread.set(item.threadId, nowMs());
            state.tgSentTimestamps.push(nowMs());
            if (item.kind === "feedback") {
              state.feedbackCooldownUntil = nowMs() + TELEGRAM_FEEDBACK_COOLDOWN_MS;
            }
            await persistTelegramQueue();
            continue;
          } catch (sendErr) {
            item.attempts = toSafeInt(item.attempts) + 1;
            item.lastError = compactText(String(sendErr && sendErr.message ? sendErr.message : sendErr || "")).slice(
              0,
              240
            );

            const retryable = isRetryableTelegramError(sendErr);
            if (!retryable && item.attempts >= TELEGRAM_MAX_NON_RETRYABLE_ATTEMPTS) {
              await pushTelegramDeadLetter(item, item.lastError);
              await markTelegramItemDone(item.id);
              state.tgQueue.shift();
              await persistTelegramQueue();
              continue;
            }

            const backoffMs = getTelegramBackoffMs(sendErr, item.attempts);
            item.retryAt = nowMs() + backoffMs;
            const moved = state.tgQueue.shift();
            if (moved) state.tgQueue.push(moved);
            await persistTelegramQueue();
            await sleep(Math.min(backoffMs, 5_000));
            continue;
          }
        }
      } finally {
        state.tgSending = false;
      }
      return true;
    });

    if (acquired === false && state.tgQueue.length > 0) {
      scheduleTelegramQueueRetry(500);
      return;
    }

    if (state.tgQueue.length > 0) {
      scheduleTelegramQueueRetry(250);
    }
  }

  // ===== Run Summary And Telemetry =====
  // Збирає snapshot поточного рану для логування.
  function buildRunSnapshot(stopReason, extra) {
    const email = state.currentUserEmail || readCachedUserEmail() || "-";
    const runSecFromExtra = extra && Number.isFinite(Number(extra.runSec)) ? Number(extra.runSec) : null;
    const criticalContext = extra && extra.criticalContext && typeof extra.criticalContext === "object" ? extra.criticalContext : null;
    return {
      userEmail: email,
      runId: state.runId || "-",
      installId: state.installId || "-",
      scriptName: SCRIPT_NAME,
      scriptVersion: SCRIPT_VERSION,
      scriptLabel: SCRIPT_VERSION_LABEL,
      reason: stopReason || "-",
      runSec: runSecFromExtra !== null ? Math.round(runSecFromExtra) : Math.round(getRunElapsedMs(nowMs()) / 1000),
      lockSuccess: state.runMetrics.autoLockCount > 0,
      orderId: (extra && extra.orderId) || state.lastLockOrderId || "",
      manualRefreshCount: state.runMetrics.manualRefreshCount,
      autoStartCount: state.runMetrics.autoStartCount || 1,
      autoLockCount: state.runMetrics.autoLockCount,
      errorCount: state.runMetrics.errorCount,
      http429: state.runMetrics.http429,
      http5xx: state.runMetrics.http5xx,
      criticalCount: state.runMetrics.criticalCount,
      filterSummary: getFilterDetails(),
      details: (extra && extra.details) || "",
      failStreak: (extra && extra.failStreak) || 0,
      httpStatus: (extra && extra.httpStatus) || (criticalContext && criticalContext.responseStatus) || 0,
      criticalContext,
    };
  }

  // Будує URL замовлення в межах поточного origin.
  function buildOrderUrl(orderId) {
    const id = String(orderId || "").trim();
    if (!id) return "";
    return new URL(`/orders/${id}`, location.origin).toString();
  }

  function readResponseHeaderValue(response, headerName) {
    try {
      if (!response || !response.headers || typeof response.headers.get !== "function") return "";
      return compactText(String(response.headers.get(headerName) || ""));
    } catch (_err) {
      return "";
    }
  }

  function formatCriticalDomSummary(summary) {
    const safe = summary && typeof summary === "object" ? summary : {};
    return [
      `container=${safe.foundContainer ? "yes" : "no"}`,
      `table=${safe.foundTable ? "yes" : "no"}`,
      `rows=${toSafeInt(safe.validRowCount)}/${toSafeInt(safe.invalidRowCount)}/${toSafeInt(safe.rowCount)}`,
      `headers=${toSafeInt(safe.headersCount)}`,
    ].join(" | ");
  }

  function buildCriticalDiffSummary(fetchedSummary, currentSummary) {
    const fetched = fetchedSummary && typeof fetchedSummary === "object" ? fetchedSummary : {};
    const current = currentSummary && typeof currentSummary === "object" ? currentSummary : {};
    const parts = [];

    if (Boolean(fetched.foundTable) !== Boolean(current.foundTable)) {
      parts.push(`fetched table ${fetched.foundTable ? "present" : "missing"}, current table ${current.foundTable ? "present" : "missing"}`);
    }
    if (Boolean(fetched.foundContainer) !== Boolean(current.foundContainer)) {
      parts.push(
        `fetched container ${fetched.foundContainer ? "present" : "missing"}, current container ${current.foundContainer ? "present" : "missing"}`
      );
    }
    if (toSafeInt(fetched.headersCount) !== toSafeInt(current.headersCount)) {
      parts.push(`headers ${toSafeInt(fetched.headersCount)} vs ${toSafeInt(current.headersCount)}`);
    }
    if (toSafeInt(fetched.rowCount) !== toSafeInt(current.rowCount)) {
      parts.push(`rows ${toSafeInt(fetched.rowCount)} vs ${toSafeInt(current.rowCount)}`);
    }
    if (toSafeInt(fetched.invalidRowCount) !== toSafeInt(current.invalidRowCount)) {
      parts.push(`invalid rows ${toSafeInt(fetched.invalidRowCount)} vs ${toSafeInt(current.invalidRowCount)}`);
    }

    const fetchedHeaders = Array.isArray(fetched.headersFirstN) ? fetched.headersFirstN.join("|") : "";
    const currentHeaders = Array.isArray(current.headersFirstN) ? current.headersFirstN.join("|") : "";
    if (!parts.length && fetchedHeaders !== currentHeaders) {
      parts.push("headers list differs");
    }

    return parts.join(" | ") || "fetched/current summaries match";
  }

  function buildCriticalFetchContext(meta) {
    const metaObj = meta && typeof meta === "object" ? meta : {};
    const html = buildFetchedResponseSnapshotHtml(metaObj.html || "");
    const fetchedSummary = buildAssignmentsDocSummary(metaObj.doc, metaObj.parsed);
    const currentSummary = buildAssignmentsCurrentSummary();
    const diffSummary = buildCriticalDiffSummary(fetchedSummary, currentSummary);
    return {
      artifactScope: "dom",
      stage: compactText(metaObj.stage || ""),
      subreason: compactText(metaObj.subreason || metaObj.details || fetchedSummary.schemaReason || ""),
      requestUrl: location.href,
      responseStatus: Math.max(0, toSafeInt(metaObj.response && metaObj.response.status)),
      responseFinalUrl: compactText(String(metaObj.response && metaObj.response.url ? metaObj.response.url : "")),
      contentType: readResponseHeaderValue(metaObj.response, "content-type"),
      htmlLength: html.length,
      htmlHash: hashText(html),
      fetchedSummary,
      currentSummary,
      diffSummary,
      headExcerpt: html.slice(0, TELEGRAM_CRITICAL_FETCH_EXCERPT_MAX_CHARS),
      tailExcerpt: html.slice(-TELEGRAM_CRITICAL_FETCH_EXCERPT_MAX_CHARS),
      fetchedHtml: html,
      attachCurrentPageSnapshot: diffSummary !== "fetched/current summaries match",
    };
  }

  function buildCriticalDiagnosticsPayload(snapshot) {
    const context = snapshot && snapshot.criticalContext;
    if (!context || context.artifactScope !== "dom") return null;

    return {
      generated_at: new Date(nowMs()).toISOString(),
      user_email: snapshot.userEmail || "-",
      run_id: snapshot.runId || "-",
      install_id: snapshot.installId || "-",
      reason: snapshot.reason || "-",
      details: snapshot.details || "",
      stage: context.stage || "",
      subreason: context.subreason || "",
      request_url: context.requestUrl || location.href,
      response_status: toSafeInt(context.responseStatus),
      response_final_url: context.responseFinalUrl || "",
      content_type: context.contentType || "",
      html_length: toSafeInt(context.htmlLength),
      html_hash: context.htmlHash || "",
      filter_summary: snapshot.filterSummary || "",
      visibility_state: typeof document !== "undefined" ? String(document.visibilityState || "") : "",
      current_location: location.href,
      fetched_summary: context.fetchedSummary || {},
      current_summary: context.currentSummary || {},
      diff_summary: context.diffSummary || "",
      html_head_excerpt: context.headExcerpt || "",
      html_tail_excerpt: context.tailExcerpt || "",
    };
  }

  function buildCriticalDiagnosticsText(payload) {
    if (!payload || typeof payload !== "object") return "";
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  function escapeJsonForScript(value) {
    return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
      if (char === "<") return "\\u003c";
      if (char === ">") return "\\u003e";
      if (char === "&") return "\\u0026";
      if (char === "\u2028") return "\\u2028";
      if (char === "\u2029") return "\\u2029";
      return char;
    });
  }

  function buildHtmlSourceExcerpt(html) {
    const value = String(html || "");
    if (!value) return "";
    if (value.length <= TELEGRAM_CRITICAL_FETCH_EXCERPT_MAX_CHARS * 2) return value;
    return `${value.slice(0, TELEGRAM_CRITICAL_FETCH_EXCERPT_MAX_CHARS)}\n\n...\n\n${value.slice(-TELEGRAM_CRITICAL_FETCH_EXCERPT_MAX_CHARS)}`;
  }

  function buildIncidentStatusText(snapshot) {
    const context = snapshot && snapshot.criticalContext;
    if (!context || context.artifactScope !== "dom") return compactText(snapshot && snapshot.details) || "Критична помилка";
    const subreason = compactText(context.subreason || "");
    if (subreason) return subreason;
    if (snapshot && snapshot.details) return compactText(snapshot.details);
    return "Критична DOM-помилка";
  }

  function renderIncidentMetaItem(label, value) {
    return `<div class="kv"><span class="kv-label">${escapeHtml(label)}</span><span class="kv-value">${escapeHtml(value || "-")}</span></div>`;
  }

  function renderIncidentSummaryItem(label, value) {
    return `<div class="kv"><span class="kv-label">${escapeHtml(label)}</span><span class="kv-value">${escapeHtml(value || "-")}</span></div>`;
  }

  function renderIncidentFactItem(text) {
    return `<div class="fact">${escapeHtml(text || "-")}</div>`;
  }

  function buildCriticalSourceStatus(sourceLabel, embeddedFull, partsCount) {
    if (embeddedFull) return `${sourceLabel} вбудовано в репорт`;
    if (partsCount > 0) return `${sourceLabel} винесено в ${partsCount} part-файл(ів)`;
    return `${sourceLabel} недоступне`;
  }

  function shouldEnqueueCriticalIncidentArtifacts(snapshot, fetchedHash, currentHash) {
    const context = snapshot && snapshot.criticalContext;
    if (!context || context.artifactScope !== "dom") return false;

    const artifactKey = [
      snapshot.reason || "-",
      context.stage || "-",
      context.subreason || "-",
      fetchedHash || "-",
      currentHash || "-",
    ].join("|");
    const ts = nowMs();
    const cooldownLeftMs =
      state.lastCriticalIncidentArtifactKey === artifactKey
        ? Math.max(0, state.lastCriticalIncidentArtifactAt + TELEGRAM_CRITICAL_INCIDENT_ARTIFACT_COOLDOWN_MS - ts)
        : 0;
    if (cooldownLeftMs > 0) return false;

    state.lastCriticalIncidentArtifactKey = artifactKey;
    state.lastCriticalIncidentArtifactAt = ts;
    return true;
  }

  function buildCriticalIncidentReportHtml(report) {
    const reportData = report && typeof report === "object" ? report : {};
    const context = reportData.context && typeof reportData.context === "object" ? reportData.context : {};
    const fetchedSummary = context.fetchedSummary && typeof context.fetchedSummary === "object" ? context.fetchedSummary : {};
    const currentSummary = context.currentSummary && typeof context.currentSummary === "object" ? context.currentSummary : {};
    const diffFacts = Array.isArray(reportData.diffFacts) ? reportData.diffFacts.filter(Boolean) : [];
    const pills = Array.isArray(reportData.pills) ? reportData.pills.filter(Boolean) : [];
    const dataScript = escapeJsonForScript({
      fetched_source_full: String(reportData.fetchedSourceFull || ""),
      current_source_full: String(reportData.currentSourceFull || ""),
      fetched_source_excerpt: String(reportData.fetchedSourceExcerpt || ""),
      current_source_excerpt: String(reportData.currentSourceExcerpt || ""),
      fetched_source_status: String(reportData.fetchedSourceStatus || ""),
      current_source_status: String(reportData.currentSourceStatus || ""),
    });

    return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <title>Звіт про інцидент Autolock</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --bg: #e3e9f2;
      --bg-accent: #d6dfeb;
      --card: #eef3f9;
      --card-strong: #e4ebf4;
      --line: #bcc8d9;
      --text: #132033;
      --muted: #4f6077;
      --code-bg: #0b1220;
      --code-text: #dbe7ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background:
        radial-gradient(circle at top left, #f3f6fb 0, transparent 26%),
        linear-gradient(180deg, var(--bg) 0%, var(--bg-accent) 100%);
      color: var(--text);
      font: 14px/1.55 "Segoe UI", Arial, sans-serif;
    }
    .wrap {
      width: 100%;
      display: grid;
      gap: 16px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 10px 30px rgba(18, 32, 51, 0.08);
    }
    h1, h2, h3 {
      margin: 0 0 10px;
      line-height: 1.2;
    }
    p {
      margin: 0;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .kv {
      min-width: 0;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card-strong);
    }
    .kv-label {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .kv-value {
      display: block;
      font-size: 15px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .pill {
      display: inline-block;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #e7eef8;
      margin: 0 6px 6px 0;
      font-size: 12px;
    }
    .facts {
      display: grid;
      gap: 10px;
    }
    .fact {
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card-strong);
    }
    .muted {
      color: var(--muted);
    }
    iframe {
      width: 100%;
      min-height: 560px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #dbe4f0;
    }
    code {
      background: #dde7f4;
      border-radius: 6px;
      padding: 2px 6px;
    }
    details {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card-strong);
      padding: 12px 14px;
    }
    details + details {
      margin-top: 12px;
    }
    summary {
      cursor: pointer;
      font-weight: 700;
    }
    .source-note {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    pre {
      margin: 12px 0 0;
      padding: 14px;
      overflow: auto;
      border-radius: 8px;
      background: var(--code-bg);
      color: var(--code-text);
      font: 12px/1.45 Consolas, monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Звіт про інцидент Autolock</h1>
      <div class="meta">
        ${renderIncidentMetaItem("Користувач", reportData.userEmail)}
        ${renderIncidentMetaItem("Причина", reportData.reason)}
        ${renderIncidentMetaItem("Етап", context.stage || "-")}
        ${renderIncidentMetaItem("Статус", reportData.statusText)}
        ${renderIncidentMetaItem("Run ID", reportData.runId)}
        ${renderIncidentMetaItem("Install ID", reportData.installId)}
        ${renderIncidentMetaItem("Згенеровано", reportData.generatedAt)}
        ${renderIncidentMetaItem("Сторінка", reportData.pagePath)}
      </div>
    </section>

    <section class="card">
      <h2>Підсумок</h2>
      <p>${escapeHtml(reportData.summaryText || "-")}</p>
      <div style="margin-top:10px;">
        ${pills.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Зведення по fetched response</h2>
      <div class="meta">
        ${renderIncidentSummaryItem("Контейнер", fetchedSummary.foundContainer ? "Так" : "Ні")}
        ${renderIncidentSummaryItem("Таблиця", fetchedSummary.foundTable ? "Так" : "Ні")}
        ${renderIncidentSummaryItem("Заголовки", String(toSafeInt(fetchedSummary.headersCount)))}
        ${renderIncidentSummaryItem("Рядки", String(toSafeInt(fetchedSummary.rowCount)))}
        ${renderIncidentSummaryItem("Валідні рядки", String(toSafeInt(fetchedSummary.validRowCount)))}
        ${renderIncidentSummaryItem("Невалідні рядки", String(toSafeInt(fetchedSummary.invalidRowCount)))}
      </div>
    </section>

    <section class="card">
      <h2>Зведення по поточній сторінці</h2>
      <div class="meta">
        ${renderIncidentSummaryItem("Контейнер", currentSummary.foundContainer ? "Так" : "Ні")}
        ${renderIncidentSummaryItem("Таблиця", currentSummary.foundTable ? "Так" : "Ні")}
        ${renderIncidentSummaryItem("Заголовки", String(toSafeInt(currentSummary.headersCount)))}
        ${renderIncidentSummaryItem("Рядки", String(toSafeInt(currentSummary.rowCount)))}
        ${renderIncidentSummaryItem("Валідні рядки", String(toSafeInt(currentSummary.validRowCount)))}
        ${renderIncidentSummaryItem("Невалідні рядки", String(toSafeInt(currentSummary.invalidRowCount)))}
      </div>
    </section>

    <section class="card">
      <h2>Ключові відмінності</h2>
      <div class="facts">
        ${diffFacts.map((item) => renderIncidentFactItem(item)).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Попередній перегляд fetched response</h2>
      <iframe id="fetched-preview" title="Попередній перегляд fetched response" loading="lazy" sandbox></iframe>
    </section>

    <section class="card">
      <h2>Попередній перегляд поточної сторінки</h2>
      <iframe id="current-preview" title="Попередній перегляд поточної сторінки" loading="lazy" sandbox></iframe>
    </section>

    <section class="card">
      <h2>Джерело сторінок</h2>
      <details>
        <summary>Показати fetched response HTML</summary>
        <div class="source-note" id="fetched-source-note"></div>
        <pre id="fetched-source-pre"></pre>
      </details>

      <details>
        <summary>Показати current page HTML</summary>
        <div class="source-note" id="current-source-note"></div>
        <pre id="current-source-pre"></pre>
      </details>
    </section>
  </main>

  <script id="incident-report-data" type="application/json">${dataScript}</script>
  <script>
    (function () {
      var dataEl = document.getElementById("incident-report-data");
      if (!dataEl) return;

      var data = {};
      try {
        data = JSON.parse(dataEl.textContent || "{}");
      } catch (_err) {
        data = {};
      }

      var fetchedPreview = document.getElementById("fetched-preview");
      var currentPreview = document.getElementById("current-preview");
      var fetchedNote = document.getElementById("fetched-source-note");
      var currentNote = document.getElementById("current-source-note");
      var fetchedPre = document.getElementById("fetched-source-pre");
      var currentPre = document.getElementById("current-source-pre");

      var previewFallback = "<!doctype html><html><head><meta charset=\\"utf-8\\"><style>html,body{margin:0;padding:24px;background:#f4f7fb;color:#162033;font:14px/1.5 Arial,sans-serif}.note{padding:14px 16px;border:1px solid #c8d3e2;border-radius:10px;background:#ffffff}</style></head><body><div class=\\"note\\">Preview недоступний у цьому файлі. Повний source дивись нижче або в part-файлах.</div></body></html>";

      if (fetchedPreview) {
        fetchedPreview.srcdoc = String(data.fetched_source_full || "") || previewFallback;
      }
      if (currentPreview) {
        currentPreview.srcdoc = String(data.current_source_full || "") || previewFallback;
      }
      if (fetchedNote) {
        fetchedNote.textContent = String(data.fetched_source_status || "");
      }
      if (currentNote) {
        currentNote.textContent = String(data.current_source_status || "");
      }
      if (fetchedPre) {
        fetchedPre.textContent = String(data.fetched_source_full || data.fetched_source_excerpt || "");
      }
      if (currentPre) {
        currentPre.textContent = String(data.current_source_full || data.current_source_excerpt || "");
      }
    })();
  </script>
</body>
</html>`;
  }

  function buildCriticalIncidentReportData(snapshot, fetchedHtml, currentHtml, options) {
    const context = snapshot && snapshot.criticalContext;
    const opts = options && typeof options === "object" ? options : {};
    const fetchedSourceFull = opts.includeFetchedFullSource ? String(fetchedHtml || "") : "";
    const currentSourceFull = opts.includeCurrentFullSource ? String(currentHtml || "") : "";
    const fetchedSourceExcerpt = opts.includeFetchedFullSource ? "" : buildHtmlSourceExcerpt(fetchedHtml);
    const currentSourceExcerpt = opts.includeCurrentFullSource ? "" : buildHtmlSourceExcerpt(currentHtml);
    const summaryText =
      context && context.diffSummary && context.diffSummary !== "fetched/current summaries match"
        ? `Refresh завершився з HTTP ${toSafeInt(context.responseStatus) || 0}, але отриманий HTML і поточний DOM розійшлися: ${context.diffSummary}.`
        : "Refresh завершився критичною DOM-помилкою.";

    const diffFacts = [];
    if (context && context.fetchedSummary && context.currentSummary) {
      if (Boolean(context.fetchedSummary.foundTable) !== Boolean(context.currentSummary.foundTable)) {
        diffFacts.push(
          `Fetched response: таблиця ${context.fetchedSummary.foundTable ? "присутня" : "відсутня"}; current page: таблиця ${context.currentSummary.foundTable ? "присутня" : "відсутня"}.`
        );
      }
      if (Boolean(context.fetchedSummary.foundContainer) !== Boolean(context.currentSummary.foundContainer)) {
        diffFacts.push(
          `Fetched response: контейнер ${context.fetchedSummary.foundContainer ? "присутній" : "відсутній"}; current page: контейнер ${context.currentSummary.foundContainer ? "присутній" : "відсутній"}.`
        );
      }
      if (toSafeInt(context.fetchedSummary.rowCount) !== toSafeInt(context.currentSummary.rowCount)) {
        diffFacts.push(
          `Кількість рядків: fetched=${toSafeInt(context.fetchedSummary.rowCount)}, current=${toSafeInt(context.currentSummary.rowCount)}.`
        );
      }
      if (toSafeInt(context.fetchedSummary.headersCount) !== toSafeInt(context.currentSummary.headersCount)) {
        diffFacts.push(
          `Кількість заголовків: fetched=${toSafeInt(context.fetchedSummary.headersCount)}, current=${toSafeInt(context.currentSummary.headersCount)}.`
        );
      }
    }
    if (!diffFacts.length && context && context.diffSummary) {
      diffFacts.push(context.diffSummary);
    }
    if (!diffFacts.length) {
      diffFacts.push("Критичний кейс зафіксовано без додаткового diff-опису.");
    }

    return {
      userEmail: snapshot.userEmail || "-",
      reason: snapshot.reason || "-",
      runId: snapshot.runId || "-",
      installId: snapshot.installId || "-",
      generatedAt: new Date(nowMs()).toISOString().replace("T", " ").replace("Z", " UTC"),
      pagePath: `${location.host}${location.pathname}`,
      statusText: buildIncidentStatusText(snapshot),
      summaryText,
      pills: [
        `response_status: ${toSafeInt(context && context.responseStatus)}`,
        `reason: ${snapshot.reason || "-"}`,
        `fetched_table: ${context && context.fetchedSummary && context.fetchedSummary.foundTable ? "present" : "missing"}`,
        `current_table: ${context && context.currentSummary && context.currentSummary.foundTable ? "present" : "missing"}`,
        `content_type: ${context && context.contentType ? context.contentType : "-"}`,
      ],
      context,
      diffFacts,
      fetchedSourceFull,
      currentSourceFull,
      fetchedSourceExcerpt,
      currentSourceExcerpt,
      fetchedSourceStatus: buildCriticalSourceStatus("Fetched HTML", Boolean(opts.includeFetchedFullSource), toSafeInt(opts.fetchedPartsCount)),
      currentSourceStatus: buildCriticalSourceStatus("Current HTML", Boolean(opts.includeCurrentFullSource), toSafeInt(opts.currentPartsCount)),
    };
  }

  function maybeEnqueueCriticalIncidentArtifacts(snapshot, replyToItemId) {
    const context = snapshot && snapshot.criticalContext;
    if (!context || context.artifactScope !== "dom") return;

    const fetchedHtml = buildFetchedResponseSnapshotHtml(context.fetchedHtml || "");
    const includeCurrent = context.attachCurrentPageSnapshot === true && shouldSendCriticalPageSnapshot(snapshot.reason);
    const currentHtml = includeCurrent ? buildCurrentPageSnapshotHtml() : "";
    const fetchedHash = context.htmlHash || hashText(fetchedHtml);
    const currentHash = currentHtml ? hashText(currentHtml) : "";
    if (!shouldEnqueueCriticalIncidentArtifacts(snapshot, fetchedHash, currentHash)) return;

    const fullReportData = buildCriticalIncidentReportData(snapshot, fetchedHtml, currentHtml, {
      includeFetchedPreview: Boolean(fetchedHtml),
      includeCurrentPreview: Boolean(currentHtml),
      includeFetchedFullSource: Boolean(fetchedHtml),
      includeCurrentFullSource: Boolean(currentHtml),
      fetchedPartsCount: 0,
      currentPartsCount: 0,
    });
    const fullReportHtml = buildCriticalIncidentReportHtml(fullReportData);
    const fullReportBytes = getUtf8ByteLength(fullReportHtml);

    if (fullReportBytes > 0 && fullReportBytes <= TELEGRAM_CRITICAL_REPORT_MAX_BYTES) {
      const reportKey = hashText([snapshot.reason || "", snapshot.runId || "", fetchedHash, currentHash || "-", "full"].join("|"));
      enqueueTelegram("critical", "critical_incident_report", snapshot.reason, {
        messageType: "document",
        text: "",
        documentName: buildCriticalIncidentReportFileName(snapshot.reason, snapshot.runId, reportKey),
        documentMime: "text/html",
        documentBase64: utf8ToBase64(fullReportHtml),
        documentSize: fullReportBytes,
        replyToItemId: String(replyToItemId || ""),
        runId: snapshot.runId,
        orderId: snapshot.orderId,
        httpStatus: snapshot.httpStatus,
      });
      return;
    }

    const fetchedParts = fetchedHtml ? splitTextByUtf8Bytes(fetchedHtml, TELEGRAM_CRITICAL_SOURCE_PART_MAX_BYTES) : [];
    const currentParts = currentHtml ? splitTextByUtf8Bytes(currentHtml, TELEGRAM_CRITICAL_SOURCE_PART_MAX_BYTES) : [];
    const fallbackReportData = buildCriticalIncidentReportData(snapshot, fetchedHtml, currentHtml, {
      includeFetchedPreview: false,
      includeCurrentPreview: false,
      includeFetchedFullSource: false,
      includeCurrentFullSource: false,
      fetchedPartsCount: fetchedParts.length,
      currentPartsCount: currentParts.length,
    });
    const fallbackReportHtml = buildCriticalIncidentReportHtml(fallbackReportData);
    const fallbackReportBytes = getUtf8ByteLength(fallbackReportHtml);

    if (fallbackReportBytes > 0 && fallbackReportBytes <= TELEGRAM_CRITICAL_REPORT_MAX_BYTES) {
      const reportKey = hashText([
        snapshot.reason || "",
        snapshot.runId || "",
        fetchedHash,
        currentHash || "-",
        "fallback",
        fetchedParts.length,
        currentParts.length,
      ].join("|"));
      enqueueTelegram("critical", "critical_incident_report", snapshot.reason, {
        messageType: "document",
        text: "",
        documentName: buildCriticalIncidentReportFileName(snapshot.reason, snapshot.runId, reportKey),
        documentMime: "text/html",
        documentBase64: utf8ToBase64(fallbackReportHtml),
        documentSize: fallbackReportBytes,
        replyToItemId: String(replyToItemId || ""),
        runId: snapshot.runId,
        orderId: snapshot.orderId,
        httpStatus: snapshot.httpStatus,
      });
    }

    fetchedParts.forEach((partText, index) => {
      enqueueTelegram("critical", "critical_fetched_source_part", snapshot.reason, {
        messageType: "document",
        text: "",
        documentName: buildCriticalSourcePartFileName(snapshot.reason, snapshot.runId, "fetched-source", index, fetchedParts.length, fetchedHash),
        documentMime: "text/plain",
        documentBase64: utf8ToBase64(partText),
        documentSize: getUtf8ByteLength(partText),
        replyToItemId: String(replyToItemId || ""),
        runId: snapshot.runId,
        orderId: snapshot.orderId,
        httpStatus: snapshot.httpStatus,
      });
    });

    currentParts.forEach((partText, index) => {
      enqueueTelegram("critical", "critical_current_source_part", snapshot.reason, {
        messageType: "document",
        text: "",
        documentName: buildCriticalSourcePartFileName(snapshot.reason, snapshot.runId, "current-source", index, currentParts.length, currentHash || "current"),
        documentMime: "text/plain",
        documentBase64: utf8ToBase64(partText),
        documentSize: getUtf8ByteLength(partText),
        replyToItemId: String(replyToItemId || ""),
        runId: snapshot.runId,
        orderId: snapshot.orderId,
        httpStatus: snapshot.httpStatus,
      });
    });
  }

  // Формує noise summary текст для завершення автолоку.
  function buildStopSummaryText(snapshot, today) {
    const orderUrl = snapshot.lockSuccess && snapshot.orderId ? buildOrderUrl(snapshot.orderId) : "";
    const lines = [
      `<b>👤 ${escapeHtml(snapshot.userEmail)}</b>`,
      `<b>ID:</b> <code>run=${escapeHtml(snapshot.runId)} | install=${escapeHtml(snapshot.installId)}</code>`,
      `<b>Подія:</b> <code>${escapeHtml(snapshot.reason)}</code>`,
      `<b>Ран:</b> <code>${escapeHtml(formatDuration(snapshot.runSec))}</code>`,
      `<b>Лок:</b> <code>${snapshot.lockSuccess ? "yes" : "no"}</code>` +
      (orderUrl ? ` • <a href="${escapeHtml(orderUrl)}">${escapeHtml(String(snapshot.orderId))}</a>` : ""),
      `<b>Ця сесія:</b> <code>Оновлень вручну=${toSafeInt(snapshot.manualRefreshCount)} | Запусків автолоку=${toSafeInt(
        snapshot.autoStartCount
      )} | Автолоків=${toSafeInt(snapshot.autoLockCount)} | Помилки=${toSafeInt(snapshot.errorCount)}</code>`,
      `<b>Версія:</b> <code>${escapeHtml(snapshot.scriptLabel || SCRIPT_VERSION_LABEL)}</code>`,
      `<b>Фільтри:</b> <code>${escapeHtml(snapshot.filterSummary || "-")}</code>`,
      `<b>Сьогодні:</b> <code>Запусків=${toSafeInt(today.starts)} | Локів=${toSafeInt(today.locks)} | Успішність=${toSafeInt(
        today.successPct
      )}% | Сер. ран=${formatDuration(today.avgRunSec)} | Помилкових=${toSafeInt(today.failedRuns)}</code>`,
    ];
    if (snapshot.details) {
      lines.push(`<b>Деталі:</b> <code>${escapeHtml(snapshot.details)}</code>`);
    }
    return lines.join("\n").slice(0, 3500);
  }

  // Формує critical текст з розширеною діагностикою.
  function buildCriticalText(snapshot, today) {
    const orderUrl = snapshot.orderId ? buildOrderUrl(snapshot.orderId) : "";
    const context = snapshot.criticalContext;
    const lines = [
      `<b>👤 ${escapeHtml(snapshot.userEmail)}</b>`,
      `<b>ID:</b> <code>run=${escapeHtml(snapshot.runId)} | install=${escapeHtml(snapshot.installId)}</code>`,
      `<b>Подія:</b> <code>${escapeHtml(snapshot.reason || "critical_error")}</code>`,
      `<b>Ран:</b> <code>${escapeHtml(formatDuration(snapshot.runSec))}</code>`,
      `<b>Лок:</b> <code>${snapshot.lockSuccess ? "yes" : "no"}</code>` +
      (orderUrl ? ` • <a href="${escapeHtml(orderUrl)}">${escapeHtml(String(snapshot.orderId))}</a>` : ""),
      `<b>Ця сесія:</b> <code>Оновлень вручну=${toSafeInt(snapshot.manualRefreshCount)} | Запусків автолоку=${toSafeInt(
        snapshot.autoStartCount
      )} | Автолоків=${toSafeInt(snapshot.autoLockCount)} | Помилки=${toSafeInt(snapshot.errorCount)}</code>`,
      `<b>Фільтри:</b> <code>${escapeHtml(snapshot.filterSummary || "-")}</code>`,
      `<b>Сьогодні:</b> <code>Запусків=${toSafeInt(today.starts)} | Локів=${toSafeInt(today.locks)} | Успішність=${toSafeInt(
        today.successPct
      )}% | Сер. ран=${formatDuration(today.avgRunSec)} | Помилкових=${toSafeInt(today.failedRuns)}</code>`,
      `<b>Деталі:</b> <code>${escapeHtml(snapshot.details || "-")}</code>`,
      `<b>Помилки:</b> <code>429=${toSafeInt(snapshot.http429)} | 5xx=${toSafeInt(snapshot.http5xx)} | critical=${toSafeInt(
        snapshot.criticalCount
      )}</code>`,
    ];

    if (context && context.artifactScope === "dom") {
      lines.push(
        `<b>Fetch:</b> <code>${context.responseStatus ? `HTTP ${context.responseStatus}` : "-"} | len=${toSafeInt(
          context.htmlLength
        )} | type=${escapeHtml(context.contentType || "-")}</code>`
      );
      if (context.stage || context.subreason) {
        lines.push(`<b>DOM:</b> <code>${escapeHtml([context.stage, context.subreason].filter(Boolean).join(" | ") || "-")}</code>`);
      }
      lines.push(`<b>Fetched:</b> <code>${escapeHtml(formatCriticalDomSummary(context.fetchedSummary))}</code>`);
      lines.push(`<b>Current:</b> <code>${escapeHtml(formatCriticalDomSummary(context.currentSummary))}</code>`);
      if (context.diffSummary && context.diffSummary !== "fetched/current summaries match") {
        lines.push(`<b>Diff:</b> <code>${escapeHtml(context.diffSummary)}</code>`);
      }
    }

    lines.push(
      `<b>Статус:</b> <code>${snapshot.httpStatus ? `HTTP ${snapshot.httpStatus}` : "-"}</code>` +
      (snapshot.failStreak ? ` • <code>streak=${toSafeInt(snapshot.failStreak)}</code>` : ""),
      `<b>Версія:</b> <code>${escapeHtml(snapshot.scriptLabel || SCRIPT_VERSION_LABEL)}</code>`,
      `<b>Сторінка:</b> <code>${escapeHtml(`${location.host}${location.pathname}`)}</code>`
    );
    return lines.join("\n").slice(0, 3500);
  }

  function shouldSendCriticalPageSnapshot(reason) {
    if (!TELEGRAM_SEND_CRITICAL_PAGE_SNAPSHOT) return false;
    const normalizedReason = String(reason || "").trim().toLowerCase();
    if (!normalizedReason) return false;
    if (TELEGRAM_CRITICAL_PAGE_SNAPSHOT_REASONS.has(normalizedReason)) return true;
    if (TELEGRAM_CRITICAL_PAGE_SNAPSHOT_INCLUDE_UNKNOWN && !KNOWN_CRITICAL_REASONS.has(normalizedReason)) {
      return true;
    }
    return false;
  }

  function maybeEnqueueCriticalPageSnapshot(reason, snapshot, replyToItemId) {
    const context = snapshot && snapshot.criticalContext;
    if (!context || context.attachCurrentPageSnapshot !== true) return;
    if (!shouldSendCriticalPageSnapshot(reason)) return;

    const ts = nowMs();
    const cooldownLeftMs = Math.max(
      0,
      state.lastCriticalSnapshotAt + TELEGRAM_CRITICAL_PAGE_SNAPSHOT_COOLDOWN_MS - ts
    );
    if (cooldownLeftMs > 0) return;

    const html = buildCurrentPageSnapshotHtml();
    const bytes = getUtf8ByteLength(html);
    if (!html || bytes <= 0) return;

    if (bytes > TELEGRAM_CRITICAL_PAGE_SNAPSHOT_MAX_BYTES) {
      return;
    }

    const fileName = buildCriticalSnapshotFileName(reason, snapshot.runId, hashText(html));
    const documentBase64 = utf8ToBase64(html);
    state.lastCriticalSnapshotAt = ts;
    enqueueTelegram("critical", "critical_snapshot_file", String(reason || "critical_snapshot"), {
      messageType: "document",
      text: "",
      documentName: fileName,
      documentMime: "text/html",
      documentBase64,
      documentSize: bytes,
      replyToItemId: String(replyToItemId || ""),
      runId: snapshot.runId,
      orderId: snapshot.orderId,
      httpStatus: snapshot.httpStatus,
    });
  }

  function maybeEnqueueCriticalDiagnostics(snapshot, replyToItemId) {
    const payload = buildCriticalDiagnosticsPayload(snapshot);
    if (!payload) return;

    const text = buildCriticalDiagnosticsText(payload);
    const bytes = getUtf8ByteLength(text);
    if (!text || bytes <= 0) return;

    enqueueTelegram("critical", "critical_diagnostics_file", snapshot.reason, {
      messageType: "document",
      text: "",
      documentName: buildCriticalDiagnosticsFileName(snapshot.reason, snapshot.runId, hashText(text)),
      documentMime: "application/json",
      documentBase64: utf8ToBase64(text),
      documentSize: bytes,
      replyToItemId: String(replyToItemId || ""),
      runId: snapshot.runId,
      orderId: snapshot.orderId,
      httpStatus: snapshot.httpStatus,
    });
  }

  function maybeEnqueueCriticalFetchedResponseSnapshot(snapshot, replyToItemId) {
    const context = snapshot && snapshot.criticalContext;
    if (!TELEGRAM_SEND_CRITICAL_FETCH_SNAPSHOT || !context || context.artifactScope !== "dom") return;

    const html = buildFetchedResponseSnapshotHtml(context.fetchedHtml || "");
    const bytes = getUtf8ByteLength(html);
    if (!html || bytes <= 0 || bytes > TELEGRAM_CRITICAL_FETCH_SNAPSHOT_MAX_BYTES) return;

    const ts = nowMs();
    const cooldownLeftMs = Math.max(
      0,
      state.lastCriticalFetchSnapshotAt + TELEGRAM_CRITICAL_FETCH_SNAPSHOT_COOLDOWN_MS - ts
    );
    if (cooldownLeftMs > 0) return;

    state.lastCriticalFetchSnapshotAt = ts;
    enqueueTelegram("critical", "critical_fetched_response_file", snapshot.reason, {
      messageType: "document",
      text: "",
      documentName: buildCriticalFetchedResponseFileName(snapshot.reason, snapshot.runId, context.htmlHash || hashText(html)),
      documentMime: "text/html",
      documentBase64: utf8ToBase64(html),
      documentSize: bytes,
      replyToItemId: String(replyToItemId || ""),
      runId: snapshot.runId,
      orderId: snapshot.orderId,
      httpStatus: snapshot.httpStatus,
    });
  }

  // Шле run summary у noise при завершенні автолоку.
  function emitStopSummary(stopReason, extra) {
    if (!TELEGRAM_LOGGING_ENABLED) return;
    const snapshot = buildRunSnapshot(stopReason, extra || {});
    const today = applyTodayStats(snapshot.userEmail, snapshot);
    const text = buildStopSummaryText(snapshot, today);
    enqueueTelegram("noise", "autolock_stop", stopReason, {
      text,
      orderId: snapshot.orderId,
      runId: snapshot.runId,
      failStreak: snapshot.failStreak,
      httpStatus: snapshot.httpStatus,
    });
  }

  // Шле critical подію в Telegram (для критичних і нестандартних кейсів).
  function emitCritical(reason, details, extra) {
    if (!TELEGRAM_LOGGING_ENABLED) return;
    const snapshot = buildRunSnapshot(reason, {
      ...(extra || {}),
      details: details || (extra && extra.details) || "",
    });
    const today = getTodayStats(snapshot.userEmail);
    const text = buildCriticalText(snapshot, today);
    const infoItem = enqueueTelegram("critical", "critical_event", reason, {
      text,
      orderId: snapshot.orderId,
      runId: snapshot.runId,
      failStreak: snapshot.failStreak,
      httpStatus: snapshot.httpStatus,
    });
    const replyToItemId = infoItem && infoItem.id ? infoItem.id : "";
    maybeEnqueueCriticalIncidentArtifacts(snapshot, replyToItemId);
  }

  // Відкриває невелике модальне вікно для введення фідбеку.
  function openFeedbackDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;background:rgba(17,24,39,.35);display:flex;align-items:center;justify-content:center;padding:16px;";

      const modal = document.createElement("div");
      modal.style.cssText =
        "width:min(520px,100%);background:#fff;border:1px solid #d2d8e5;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:12px;font-family:Arial,sans-serif;color:#111;";
      modal.innerHTML =
        '<div style="font-size:14px;font-weight:700;color:#1d2b44;margin-bottom:8px;">Фідбек</div>' +
        '<div style="font-size:11px;color:#4a5670;margin-bottom:6px;">Категорія</div>' +
        '<div data-role="feedback-categories" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
        '<button type="button" data-role="feedback-category-btn" data-value="bug" aria-pressed="false" style="border:1px solid #cfd8ea;background:#fff;color:#1d2b44;padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer;">Баг</button>' +
        '<button type="button" data-role="feedback-category-btn" data-value="wish" aria-pressed="false" style="border:1px solid #cfd8ea;background:#fff;color:#1d2b44;padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer;">Побажання</button>' +
        '<button type="button" data-role="feedback-category-btn" data-value="other" aria-pressed="false" style="border:1px solid #cfd8ea;background:#fff;color:#1d2b44;padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer;">Інше</button>' +
        "</div>" +
        '<div style="font-size:11px;color:#4a5670;margin-bottom:6px;">Повідомлення (до 700 символів)</div>' +
        '<textarea data-role="feedback-text" maxlength="' +
        TELEGRAM_FEEDBACK_MAX_LEN +
        '" style="width:100%;min-height:120px;max-height:240px;resize:vertical;border:1px solid #cfd8ea;border-radius:6px;padding:8px;box-sizing:border-box;font-family:Arial,sans-serif;font-size:12px;color:#111;"></textarea>' +
        '<div data-role="feedback-count" style="font-size:10px;color:#64748b;text-align:right;margin-top:4px;">0/' +
        TELEGRAM_FEEDBACK_MAX_LEN +
        "</div>" +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">' +
        '<button type="button" data-role="feedback-cancel" style="border:1px solid #94a3b8;background:#fff;color:#334155;padding:6px 10px;border-radius:6px;font-size:12px;cursor:pointer;">Скасувати</button>' +
        '<button type="button" data-role="feedback-send" disabled style="border:1px solid #1f7a36;background:#1f7a36;color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;cursor:not-allowed;opacity:.5;">Надіслати</button>' +
        "</div>";

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const categoryBtnEls = Array.from(modal.querySelectorAll('[data-role="feedback-category-btn"]'));
      const textEl = modal.querySelector('[data-role="feedback-text"]');
      const countEl = modal.querySelector('[data-role="feedback-count"]');
      const cancelBtn = modal.querySelector('[data-role="feedback-cancel"]');
      const sendBtn = modal.querySelector('[data-role="feedback-send"]');
      const selectedCategories = new Set();

      const close = (result) => {
        overlay.remove();
        resolve(result);
      };

      const syncCount = () => {
        if (!countEl || !textEl) return;
        countEl.textContent = `${String(textEl.value || "").length}/${TELEGRAM_FEEDBACK_MAX_LEN}`;
      };

      const renderCategories = () => {
        categoryBtnEls.forEach((button) => {
          const value = String(button.getAttribute("data-value") || "");
          const selected = selectedCategories.has(value);
          button.setAttribute("aria-pressed", selected ? "true" : "false");
          button.style.background = selected ? "#2e6ce6" : "#fff";
          button.style.borderColor = selected ? "#2e6ce6" : "#cfd8ea";
          button.style.color = selected ? "#fff" : "#1d2b44";
        });
      };

      const syncSendState = () => {
        const hasText = Boolean(compactText(textEl.value || ""));
        const hasCategory = selectedCategories.size > 0;
        sendBtn.disabled = !hasText || !hasCategory;
        sendBtn.style.cursor = sendBtn.disabled ? "not-allowed" : "pointer";
        sendBtn.style.opacity = sendBtn.disabled ? "0.5" : "1";
      };

      textEl.addEventListener("input", () => {
        syncCount();
        syncSendState();
      });
      categoryBtnEls.forEach((button) => {
        button.addEventListener("click", () => {
          const value = String(button.getAttribute("data-value") || "");
          if (!value) return;
          if (selectedCategories.has(value)) {
            selectedCategories.delete(value);
          } else {
            selectedCategories.add(value);
          }
          renderCategories();
          syncSendState();
        });
      });
      syncCount();
      renderCategories();
      syncSendState();
      textEl.focus();

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close(null);
      });
      cancelBtn.addEventListener("click", () => close(null));
      sendBtn.addEventListener("click", () => {
        const text = compactText(textEl.value || "").slice(0, TELEGRAM_FEEDBACK_MAX_LEN);
        const categories = Array.from(selectedCategories.values());
        if (!text || categories.length === 0) {
          textEl.focus();
          return;
        }
        close({ categories, text });
      });
    });
  }

  // Повертає людинозрозумілий label категорії фідбеку.
  function getFeedbackCategoryLabel(category) {
    if (category === "bug") return "Баг";
    if (category === "wish") return "Побажання";
    return "Інше";
  }

  function getFeedbackCategoryLabels(categories) {
    const values = Array.isArray(categories) ? categories : [];
    const unique = Array.from(new Set(values.map((item) => String(item || "")).filter(Boolean)));
    return unique.map((item) => getFeedbackCategoryLabel(item));
  }

  // Шле фідбек від юзера в окремий feedback-thread.
  async function sendFeedbackToTelegram() {
    if (!TELEGRAM_LOGGING_ENABLED) return;
    const ts = nowMs();
    if (ts < state.feedbackCooldownUntil) {
      const leftSec = Math.ceil((state.feedbackCooldownUntil - ts) / 1000);
      setAction(`Фідбек: зачекай ${leftSec}s`, "warn");
      return;
    }

    const payload = await openFeedbackDialog();
    if (!payload) return;
    const text = compactText(payload.text || "").slice(0, TELEGRAM_FEEDBACK_MAX_LEN);
    const categories = Array.from(
      new Set((Array.isArray(payload.categories) ? payload.categories : []).map((item) => String(item || "")).filter(Boolean))
    );
    if (!text || categories.length === 0) return;

    pruneTelegramDedup();
    const dedupKey = `${categories.slice().sort().join("|")}|${text.toLowerCase()}`;
    if (state.tgFeedbackDedupMap.has(dedupKey)) {
      setAction("Фідбек дубль: пропущено", "warn");
      return;
    }
    state.tgFeedbackDedupMap.set(dedupKey, ts);

    const email = state.currentUserEmail || readCachedUserEmail() || "-";
    const categoryLabels = getFeedbackCategoryLabels(categories);
    const lines = [
      `<b>👤 ${escapeHtml(email)}</b>`,
      `<b>Подія:</b> <code>feedback</code>`,
      `<b>Категорія:</b> <code>${escapeHtml(categoryLabels.join(", "))}</code>`,
      `<b>Текст:</b> <code>${escapeHtml(text)}</code>`,
      `<b>Статус:</b> <code>${escapeHtml(String(statusEl ? statusEl.textContent : "-"))}</code>`,
      `<b>Остання дія:</b> <code>${escapeHtml(String(actionEl ? actionEl.textContent : "-"))}</code>`,
      `<b>Фільтри:</b> <code>${escapeHtml(getFilterDetails())}</code>`,
      `<b>ID:</b> <code>run=${escapeHtml(state.runId || "-")} | install=${escapeHtml(state.installId || "-")}</code>`,
      `<b>Версія:</b> <code>${escapeHtml(SCRIPT_VERSION_LABEL)}</code>`,
      `<b>Сторінка:</b> <code>${escapeHtml(`${location.host}${location.pathname}`)}</code>`,
    ];

    const queuedItem = enqueueTelegram("feedback", "feedback", "user_feedback", {
      text: lines.join("\n").slice(0, 3500),
    });
    if (queuedItem) {
      setAction("Фідбек додано в чергу", "ok");
    } else {
      setAction("Фідбек: не вдалося зберегти чергу", "error");
    }
  }

  // ===== Filters And Panel State =====
  // Filter state, compact summaries, and UI rendering for panel controls.
  // Фіксує, що фільтри були перевірені користувачем.
  function markFiltersReviewed() {
    state.lastFilterReviewAt = nowMs();
  }

  function createDefaultPriorityRules() {
    return {
      p1: true,
      p2: true,
      p3_18: true,
      p19: true,
    };
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

  function clonePriorityRules(rules) {
    return normalizePriorityRules(rules);
  }

  function applyPriorityRulesMigration(rules, migrationVersion) {
    const normalized = normalizePriorityRules(rules);
    const storedVersion = toSafeInt(migrationVersion);
    const next = { ...normalized };
    let changed = storedVersion < PRIORITY_RULES_MIGRATION_VERSION;
    if (storedVersion < PRIORITY_RULES_MIGRATION_VERSION) {
      for (const [ruleKey, forcedValue] of Object.entries(PRIORITY_RULES_MIGRATION_OVERRIDES)) {
        if (typeof forcedValue !== "boolean") continue;
        if (next[ruleKey] !== forcedValue) {
          next[ruleKey] = forcedValue;
          changed = true;
        }
      }
    }
    return {
      rules: normalizePriorityRules(next),
      migrationVersion: PRIORITY_RULES_MIGRATION_VERSION,
      changed,
    };
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
    const next = Array.from(
      new Set(
        values
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 1 && item <= FILTER_MAX)
      )
    ).sort((left, right) => left - right);
    return new Set(next);
  }

  function normalizePersistedKeySelection(values, allowedKeys) {
    if (!Array.isArray(values)) return null;
    const allowed = new Set(Array.isArray(allowedKeys) ? allowedKeys : []);
    const next = Array.from(
      new Set(
        values
          .map((item) => String(item || "").trim())
          .filter((item) => allowed.has(item))
      )
    );
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
      priorities: Array.from(state.selectedPriorities.values()).sort((left, right) => left - right),
      complexities: COMPLEXITY_LEVELS.filter((item) => state.selectedComplexities.has(item.key)).map((item) => item.key),
      deliverables: DELIVERABLE_FILTERS.filter((item) => state.selectedDeliverables.has(item.key)).map((item) => item.key),
      noComplexityMode: Boolean(state.noComplexityMode),
    };
  }

  function normalizePersistedFilterSlot(slot) {
    const fallback = createDefaultFilterSnapshot();
    if (!slot || typeof slot !== "object") return fallback;

    const priorities = normalizePersistedPrioritySelection(slot.priorities);
    const complexities = normalizePersistedKeySelection(
      slot.complexities,
      COMPLEXITY_LEVELS.map((item) => item.key)
    );
    const deliverables = normalizePersistedKeySelection(
      slot.deliverables,
      DELIVERABLE_FILTERS.map((item) => item.key)
    );
    const deliverableValues = deliverables ? Array.from(deliverables.values()) : fallback.deliverables;
    const legacyFullDeliverables =
      deliverables &&
      deliverables.size === 3 &&
      deliverables.has("roof") &&
      deliverables.has("complete") &&
      deliverables.has("other");

    return {
      priorities: priorities ? Array.from(priorities.values()) : fallback.priorities,
      complexities: complexities ? Array.from(complexities.values()) : fallback.complexities,
      deliverables: legacyFullDeliverables ? fallback.deliverables : deliverableValues,
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

  function getFilterSlotSummary(slotId) {
    return `Шаблон ${slotId}`;
  }

  function persistFilterState() {
    saveCurrentFiltersToActiveSlot();
    try {
      const slots = {};
      FILTER_SLOT_IDS.forEach((slotId) => {
        slots[slotId] = cloneFilterSnapshot(state.filterSlots[slotId]);
      });
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          activeSlot: state.activeFilterSlot,
          slots,
          updatedAt: nowMs(),
        })
      );
    } catch (_err) { }
  }

  function persistPriorityRules() {
    try {
      localStorage.setItem(
        PRIORITY_RULES_STORAGE_KEY,
        JSON.stringify({
          rules: clonePriorityRules(state.priorityRules),
          migrationVersion: PRIORITY_RULES_MIGRATION_VERSION,
          updatedAt: nowMs(),
        })
      );
    } catch (_err) { }
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
    if (migrated.changed) {
      persistPriorityRules();
    }
  }

  // Перевіряє, чи можна запускати автолок без повторної перевірки фільтрів.
  function canStartAutolock(ts) {
    if (state.filterOpen) return true;
    if (!state.lastFilterReviewAt) return false;
    if (!state.lastAutoStartAt) return true;
    if (ts - state.lastAutoStartAt < FILTER_REVIEW_TTL_MS) return true;
    return state.lastFilterReviewAt >= state.lastAutoStartAt;
  }

  // Повертає true, якщо перед запуском автолоку треба перевірити фільтри.
  function isFilterReviewRequired(ts) {
    if (state.filterOpen) return false;
    if (!state.lastFilterReviewAt) return true;
    if (!state.lastAutoStartAt) return false;
    if (ts - state.lastAutoStartAt < FILTER_REVIEW_TTL_MS) return false;
    return state.lastFilterReviewAt < state.lastAutoStartAt;
  }

  // Оновлює коротку підказку біля кнопки автолоку.
  function renderAutoHint(ts) {
    if (!autoHintEl) return;
    const now = ts || nowMs();
    let text = "";

    if (state.maintenance) {
      text = "Чекайте оновлення скрипта";
    } else if (state.locked) {
      text = "В лоці: автолок недоступний";
    } else if (!state.enabled && isFilterReviewRequired(now)) {
      text = "Перед запуском відкрий фільтри автолоку";
    }

    autoHintEl.textContent = text;
    autoHintEl.style.display = text ? "block" : "none";
  }

  // Перемикає стан автолоку у UI.
  function setAutoOn() {
    updateAutoButtonLabel(nowMs());
  }

  // Оновлює підпис і доступність кнопки автолоку.
  function updateAutoButtonLabel(ts) {
    if (!autoBtnEl) return;

    if (state.maintenance) {
      autoBtnEl.textContent = "Чекайте оновлення";
      autoBtnEl.disabled = true;
      autoBtnEl.style.opacity = "0.6";
      autoBtnEl.style.cursor = "not-allowed";
      renderAutoHint(ts);
      return;
    }

    if (state.locked) {
      autoBtnEl.textContent = "В лоці";
      autoBtnEl.disabled = true;
      autoBtnEl.style.opacity = "0.6";
      autoBtnEl.style.cursor = "not-allowed";
      renderAutoHint(ts);
      return;
    }

    autoBtnEl.disabled = false;
    autoBtnEl.style.opacity = "1";
    autoBtnEl.style.cursor = "pointer";

    if (state.enabled && state.runStartedAt) {
      autoBtnEl.textContent = `Автолок: ${getRemainingBudgetSec(ts || nowMs())}s`;
      renderAutoHint(ts);
      return;
    }

    autoBtnEl.textContent = state.stopLabel || "Увімкнути автолок";
    renderAutoHint(ts);
  }

  // Оновлює текст авто-кнопки з актуальним таймером.
  function setBudget(ts) {
    updateAutoButtonLabel(ts || nowMs());
    if (state.browserIndicatorMode === "run") {
      renderBrowserIndicator();
    }
  }

  // Витягує перше ціле число з тексту.
  function extractFirstInt(text) {
    const match = String(text || "").match(/-?\d+/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : null;
  }

  // Повертає текст у короткому нормалізованому вигляді.
  function compactText(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function normalizeHeaderLabel(text) {
    return compactText(text).toLowerCase();
  }

  function normalizeLooseKey(text) {
    return normalizeHeaderLabel(text).replace(/[^a-zа-я0-9]+/gi, " ").trim();
  }

  // Короткий стабільний hash для dedup-key без збереження повного тексту.
  function hashText(text) {
    const source = String(text || "");
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  // Перемикає число пріоритету у наборі фільтра.
  function togglePriority(value) {
    if (state.selectedPriorities.has(value)) {
      state.selectedPriorities.delete(value);
    } else {
      state.selectedPriorities.add(value);
    }
  }

  // Перемикає ключ комплексіті у наборі фільтра.
  function toggleComplexity(key) {
    if (state.selectedComplexities.has(key)) {
      state.selectedComplexities.delete(key);
    } else {
      state.selectedComplexities.add(key);
    }
  }

  function toggleDeliverable(key) {
    if (state.selectedDeliverables.has(key)) {
      state.selectedDeliverables.delete(key);
    } else {
      state.selectedDeliverables.add(key);
    }
  }

  // Заповнює набір пріоритетів всіма значеннями 1..20 або очищає його.
  function setPriorityFilter(full) {
    state.selectedPriorities.clear();
    if (full) {
      for (let value = 1; value <= FILTER_MAX; value += 1) {
        state.selectedPriorities.add(value);
      }
    }
  }

  // Заповнює набір пріоритетів діапазоном.
  function setPriorityRange(from, to) {
    state.selectedPriorities.clear();
    for (let value = from; value <= to; value += 1) {
      state.selectedPriorities.add(value);
    }
  }

  // Заповнює набір комплексіті всіма рівнями або очищає його.
  function setComplexityFilter(full) {
    state.selectedComplexities.clear();
    if (full) {
      COMPLEXITY_LEVELS.forEach((item) => state.selectedComplexities.add(item.key));
    }
  }

  function setDeliverableFilter(full) {
    state.selectedDeliverables.clear();
    if (full) {
      DELIVERABLE_FILTERS.forEach((item) => state.selectedDeliverables.add(item.key));
    }
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

  // Нормалізує текст комплексіті у один із 4 рівнів.
  function parseComplexityKey(text) {
    const value = normalizeLooseKey(text);
    if (!value) return "";
    if (value === "-" || value === "n/a" || value === "na" || value === "none") return "";
    if ((value.includes("complex") || value.includes("склад")) && value.includes("residential")) {
      return "complex_residential";
    }
    if (value.includes("simple") || value.includes("прост")) return "simple";
    if (value.includes("average") || value.includes("avg") || value.includes("серед")) return "average";
    if (value.includes("custom") || value.includes("кастом")) return "custom";
    return "";
  }

  function parseDeliverableKey(text) {
    const value = normalizeLooseKey(text);
    if (!value) return "other";
    if (
      value.includes("total living area plus") ||
      value.includes("living area plus") ||
      value.includes("tla plus")
    ) {
      return "total_living_area_plus";
    }
    if (value.includes("fast roof")) return "fast_roof";
    if (value.includes("total living area") || value.includes("living area total") || value.includes("living area")) {
      return "total_living_area";
    }
    if (value.includes("roof")) return "roof";
    if (value.includes("complete")) return "complete";
    return "other";
  }

  function getRefreshChangeLabel(changed) {
    if (changed === "first") return "перше оновлення";
    if (changed === "yes") return "є зміни";
    return "без змін";
  }

  // Повертає коротке summary вибраних фільтрів.
  function getFilterSummary() {
    const deliverableSummary = `D ${state.selectedDeliverables.size}/${DELIVERABLE_FILTERS.length}`;
    if (state.noComplexityMode) {
      return `P ${state.selectedPriorities.size}/${FILTER_MAX} • ${deliverableSummary} • Без складності`;
    }
    return `P ${state.selectedPriorities.size}/${FILTER_MAX} • C ${state.selectedComplexities.size}/${COMPLEXITY_LEVELS.length} • ${deliverableSummary}`;
  }

  // Формує стислі діапазони чисел (напр. 1-3, 7, 10-12).
  function formatNumberRanges(values) {
    const sorted = Array.from(new Set(values))
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .sort((a, b) => a - b);
    if (sorted.length === 0) return "-";

    const chunks = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
      const cur = sorted[i];
      if (cur === prev + 1) {
        prev = cur;
        continue;
      }
      chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = cur;
      prev = cur;
    }
    chunks.push(start === prev ? `${start}` : `${start}-${prev}`);
    return chunks.join(",");
  }

  // Повертає деталізований опис фільтрів для логів.
  function getFilterDetails() {
    const priorities = formatNumberRanges(Array.from(state.selectedPriorities.values()));
    const deliverableLabels = DELIVERABLE_FILTERS.filter((item) => state.selectedDeliverables.has(item.key)).map(
      (item) => item.label
    );
    if (state.noComplexityMode) {
      return `P: ${priorities} | C: без складності | D: ${deliverableLabels.length > 0 ? deliverableLabels.join(",") : "-"} | R: ${getPriorityRulesSummary()}`;
    }
    const complexityLabels = COMPLEXITY_LEVELS.filter((item) => state.selectedComplexities.has(item.key)).map(
      (item) => item.label
    );
    return `P: ${priorities} | C: ${complexityLabels.length > 0 ? complexityLabels.join(",") : "-"} | D: ${deliverableLabels.length > 0 ? deliverableLabels.join(",") : "-"
      } | R: ${getPriorityRulesSummary()}`;
  }

  // Блокує або розблоковує всі кнопки в панелі.
  function setControlsDisabled(disabled) {
    if (!panelEl) return;
    const controls = panelEl.querySelectorAll("button,input,select,textarea");
    controls.forEach((control) => {
      const role = control.getAttribute("data-role") || "";
      if (role === "witch-mow-ar-close") return;
      control.disabled = Boolean(disabled);
      if (disabled) {
        control.style.opacity = "0.6";
        control.style.cursor = "not-allowed";
      } else {
        control.style.opacity = "1";
        control.style.cursor = "pointer";
      }
    });
  }

  // Оновлює підписи кнопок фільтра.
  function renderFilterButtons() {
    if (filterBtnEl) {
      const summary = `${state.activeFilterSlot} • ${getFilterSummary()}`;
      const subline = summary;
      filterBtnEl.innerHTML =
        `<span style="display:block;font-size:12px;font-weight:700;line-height:1.1;">Фільтри автолоку</span>` +
        `<span style="display:block;font-size:10px;font-weight:600;line-height:1.1;opacity:.92;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subline}</span>`;
    }
    if (filterMetaEl) {
      filterMetaEl.textContent = `${getFilterSlotSummary(state.activeFilterSlot)} • ${getFilterSummary()}`;
    }
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
      const style = active
        ? "background:#d92d20;color:#fff;"
        : "background:transparent;color:#fff;opacity:.82;";
      return `<button type="button" data-role="witch-mow-ar-filter-slot" data-slot="${slotId}" style="min-width:34px;border:0;background:transparent;color:inherit;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;${style}">${slotId}</button>`;
    }).join("");
  }

  // Малює сітку кнопок фільтра для P/C/D.
  function renderFilterGrid(targetEl, kind) {
    if (!targetEl) return;
    if (kind === "priority") {
      targetEl.innerHTML = Array.from({ length: FILTER_MAX }, (_, index) => {
        const value = index + 1;
        const on = state.selectedPriorities.has(value);
        const style = on
          ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;"
          : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
        return `<button type="button" data-role="witch-mow-ar-chip" data-kind="priority" data-value="${value}" style="height:24px;border:1px solid;border-radius:6px;font-size:11px;cursor:pointer;${style}">${value}</button>`;
      }).join("");
      return;
    }

    if (kind === "complexity") {
      targetEl.innerHTML = COMPLEXITY_LEVELS.map((item) => {
        const on = state.selectedComplexities.has(item.key);
        const style = on
          ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;"
          : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
        const disabledAttr = state.noComplexityMode ? "disabled" : "";
        const disabledStyle = state.noComplexityMode ? "opacity:.45;cursor:not-allowed;" : "";
        return `<button type="button" ${disabledAttr} data-role="witch-mow-ar-chip" data-kind="complexity" data-value="${item.key}" style="min-height:28px;padding:4px 3px;border:1px solid;border-radius:6px;font-size:10px;line-height:1.1;white-space:normal;${style}${disabledStyle}">${item.label}</button>`;
      }).join("");
      return;
    }

    if (kind !== "deliverable") return;

    targetEl.innerHTML = DELIVERABLE_FILTERS.map((item) => {
      const on = state.selectedDeliverables.has(item.key);
      const style = on
        ? "background:#2e6ce6;border-color:#2e6ce6;color:#fff;"
        : "background:#fff;border-color:#cfd8ea;color:#1d2b44;";
      return `<button type="button" data-role="witch-mow-ar-chip" data-kind="deliverable" data-value="${item.key}" style="min-height:28px;padding:3px 4px;border:1px solid;border-radius:6px;font-size:10px;line-height:1.1;cursor:pointer;white-space:normal;word-break:break-word;${style}">${item.label}</button>`;
    }).join("");
  }

  // Відмальовує панель налаштувань фільтра.
  function renderFilterPanel() {
    if (!filterPanelEl) return;
    filterPanelEl.style.display = state.filterOpen ? "block" : "none";
    renderPriorityRulesPanel();
    if (noComplexityEl) {
      noComplexityEl.checked = state.noComplexityMode;
    }
    renderFilterSlotButtons();
    renderFilterGrid(prioritiesGridEl, "priority");
    renderFilterGrid(complexitiesGridEl, "complexity");
    renderFilterGrid(deliverablesGridEl, "deliverable");

    const disableComplexity = state.noComplexityMode;
    const compPresetButtons = filterPanelEl.querySelectorAll(
      '[data-role="witch-mow-ar-comp-all"],[data-role="witch-mow-ar-comp-none"]'
    );
    compPresetButtons.forEach((button) => {
      button.disabled = disableComplexity;
      button.style.opacity = disableComplexity ? "0.45" : "1";
      button.style.cursor = disableComplexity ? "not-allowed" : "pointer";
    });

    renderFilterButtons();
  }

  // ===== DOM Parsing And Candidate Selection =====
  // Зупиняє автолок при критичній помилці, але не блокує повторний запуск.
  function enterMaintenanceMode(reason, extra) {
    const details = reason || "critical";
    state.runMetrics.criticalCount += 1;
    emitCritical("critical_dom_change", details, {
      ...(extra || {}),
      criticalCount: state.runMetrics.criticalCount,
      failStreak: state.errorStreak,
    });

    state.maintenance = false;
    state.maintenanceReason = reason || "critical";

    if (state.enabled || state.startPending || state.busy) {
      stopAuto(
        "Автолок зупинено через критичну помилку",
        "Зупинено",
        "Критична помилка: можна запустити ще раз",
        "error",
        "critical_dom_change"
      );
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

  // Перевіряє, чи помилка є критичною для подальшої роботи.
  function isCriticalError(error) {
    const message = String(error && error.message ? error.message : error).toLowerCase();
    return message.includes("critical:");
  }

  function readAssignmentsTableSchema(doc) {
    const table = doc.querySelector("table.assignments_grid");
    if (!table) {
      return { valid: false, reason: "assignments_grid not found", table: null, headerIndex: null };
    }

    const headers = Array.from(table.querySelectorAll("thead th")).map((cell) => normalizeHeaderLabel(cell.textContent || ""));
    if (headers.length === 0) {
      return {
        valid: false,
        reason: "assignments_grid header row is empty",
        table,
        headerIndex: null,
      };
    }

    const headerIndex = {};
    const headerCounts = {};
    headers.forEach((header, index) => {
      if (!header) return;
      headerCounts[header] = toSafeInt(headerCounts[header]) + 1;
      if (!Object.prototype.hasOwnProperty.call(headerIndex, header)) {
        headerIndex[header] = index;
      }
    });
    for (const header of ASSIGNMENTS_REQUIRED_HEADERS) {
      const count = toSafeInt(headerCounts[header]);
      if (count <= 0) {
        return {
          valid: false,
          reason: `assignments_grid missing required header "${header}"`,
          table,
          headerIndex: null,
        };
      }
      if (count > 1) {
        return {
          valid: false,
          reason: `assignments_grid duplicate required header "${header}" (${count})`,
          table,
          headerIndex: null,
        };
      }
    }

    return {
      valid: true,
      reason: "",
      table,
      headerIndex,
      columnCount: headers.length,
    };
  }

  function getTableCellText(cells, schema, headerName) {
    const index = schema && schema.headerIndex ? schema.headerIndex[headerName] : -1;
    if (!Number.isInteger(index) || index < 0 || index >= cells.length) return "";
    return compactText(cells[index].textContent || "");
  }

  // Парсить lock-стан зі сторінки або з отриманого HTML.
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
    if (!nav) {
      return { locked: false, orderId: "", text: "" };
    }

    const countText = (nav?.querySelector(".count")?.textContent || "").trim().replace(/\s+/g, " ");
    const text = (nav?.querySelector(".text")?.textContent || "").trim().replace(/\s+/g, " ");
    const orderId = extractOrderIdFromLockText(countText, text);

    return {
      locked: true,
      orderId,
      text: text || countText || "locked",
    };
  }

  // Оновлює lock-стан у панелі.
  function setLockInfo(lockInfo) {
    state.locked = Boolean(lockInfo && lockInfo.locked);

    if (!lockNoticeEl) return;
    if (lockInfo.locked) {
      const details = lockInfo.orderId ? `Order ${lockInfo.orderId}` : lockInfo.text;
      if (lockNoticeEl) {
        lockNoticeEl.style.display = "block";
        lockNoticeEl.replaceChildren();
        lockNoticeEl.append("В лоці (");
        if (lockInfo.orderId) {
          const link = document.createElement("a");
          link.href = `https://manowar.hover.to/orders/${encodeURIComponent(String(lockInfo.orderId || ""))}`;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = `Order ${lockInfo.orderId}`;
          link.style.color = "inherit";
          link.style.fontWeight = "700";
          link.style.textDecoration = "underline";
          lockNoticeEl.appendChild(link);
        } else {
          lockNoticeEl.append(details);
        }
        lockNoticeEl.append(") — автолок недоступний");
      }
      if (state.enabled) {
        stopAuto("Автолок зупинено: ви в лоці", "Зупинено", "Стоп: ви зараз у лоці", "warn", "locked", {
          orderId: lockInfo.orderId || "",
        });
      } else {
        setAction("В лоці: автолок недоступний", "warn");
        updateAutoButtonLabel(nowMs());
        setBrowserIndicator("lock");
      }
      return;
    }
    if (lockNoticeEl) {
      lockNoticeEl.style.display = "none";
      lockNoticeEl.replaceChildren();
    }
    updateAutoButtonLabel(nowMs());
    if (!state.enabled && !state.maintenance) {
      setBrowserIndicator("idle");
    }
  }

  // Шукає кнопку дії в Action-колонці і повертає її метадані.
  function parseActionCell(actionCell) {
    if (!actionCell) return { actionText: "", actionHref: "", invalidReason: "action_cell_missing" };

    const actionCandidates = Array.from(
      actionCell.querySelectorAll("a[href],button[formaction],button[data-href],input[type='submit'][formaction]")
    )
      .map((element) => {
        const text = compactText(
          element.tagName === "INPUT" ? element.getAttribute("value") || "" : element.textContent || ""
        );
        const href =
          element.getAttribute("href") ||
          element.getAttribute("formaction") ||
          element.getAttribute("data-href") ||
          "";
        return {
          actionText: text,
          actionHref: compactText(href),
        };
      })
      .filter((candidate) => candidate.actionHref);

    const uniqueCandidates = Array.from(
      actionCandidates.reduce((acc, candidate) => {
        const current = acc.get(candidate.actionHref);
        if (!current || candidate.actionText.length > current.actionText.length) {
          acc.set(candidate.actionHref, candidate);
        }
        return acc;
      }, new Map()).values()
    );

    if (uniqueCandidates.length !== 1) {
      return {
        actionText: "",
        actionHref: "",
        invalidReason: uniqueCandidates.length === 0 ? "action_missing" : "action_ambiguous",
      };
    }

    return {
      actionText: uniqueCandidates[0].actionText,
      actionHref: uniqueCandidates[0].actionHref,
      invalidReason: "",
    };
  }

  // Парсить таблицю в нормалізований вигляд і формує fingerprint.
  function parseRowsFromDoc(doc) {
    const schema = readAssignmentsTableSchema(doc);
    if (!schema.valid) {
      return {
        fingerprint: "",
        rows: [],
        invalidRows: 0,
        totalRows: 0,
        schemaValid: false,
        schemaReason: schema.reason || "assignments_grid schema mismatch",
      };
    }

    const rows = Array.from(schema.table.querySelectorAll("tbody tr"));
    const fingerprintParts = [];
    const parsedRows = [];
    const invalidRowIndexes = [];
    let invalidRows = 0;

    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length !== schema.columnCount) {
        invalidRows += 1;
        invalidRowIndexes.push(rowIndex);
        return;
      }

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
      const complexityMissing =
        !rawComplexityText || rawComplexityText === "-" || rawComplexityText.toLowerCase() === "n/a" || rawComplexityText.toLowerCase() === "na";
      const priority = extractFirstInt(priorityText);
      const complexityKey = parseComplexityKey(rawComplexityText);
      const deliverableKey = parseDeliverableKey(rawDeliverableText);
      const action = parseActionCell(actionCell);

      if (!complexityMissing && !complexityKey) {
        invalidRows += 1;
        invalidRowIndexes.push(rowIndex);
        return;
      }

      if (!id || !assignmentState || !Number.isFinite(priority) || !action.actionHref || action.invalidReason) {
        invalidRows += 1;
        invalidRowIndexes.push(rowIndex);
        return;
      }

      fingerprintParts.push(`${id}|${assignmentState}|${priorityText}|${complexityText}|${deliverableText}`);
      parsedRows.push({
        sourceIndex: rowIndex,
        id: id || "-",
        assignmentState: assignmentState || "-",
        priorityText: priorityText || "-",
        complexityText: complexityText || "-",
        deliverableText,
        complexityMissing,
        priority,
        complexityKey,
        deliverableKey,
        actionText: action.actionText,
        actionHref: action.actionHref,
      });
    });

    const totalRows = rows.length;
    const invalidMajority = totalRows > 0 && invalidRows >= Math.ceil(totalRows / 2);
    const schemaValid = !(totalRows > 0 && parsedRows.length === 0) && !invalidMajority;
    const schemaReason = schemaValid
      ? ""
      : `assignments_grid row mismatch (${parsedRows.length} valid / ${invalidRows} invalid / ${totalRows} total)`;

    return {
      fingerprint: fingerprintParts.join("||"),
      rows: parsedRows,
      invalidRows,
      totalRows,
      invalidRowIndexes,
      schemaValid,
      schemaReason,
    };
  }

  // Парсить поточну таблицю зі сторінки (без fetch).
  function parseRowsFromCurrentTable() {
    const doc = document.implementation.createHTMLDocument("");
    const table = document.querySelector("table.assignments_grid");
    if (!table) {
      return {
        fingerprint: "",
        rows: [],
        invalidRows: 0,
        totalRows: 0,
        schemaValid: false,
        schemaReason: "assignments_grid not found",
      };
    }
    doc.body.appendChild(table.cloneNode(true));
    return parseRowsFromDoc(doc);
  }

  function buildTableSelectorSummary(table, index) {
    if (!table) return "";
    const idPart = compactText(String(table.id || ""));
    const classPart = compactText(String(table.className || ""))
      .split(" ")
      .filter(Boolean)
      .slice(0, 3)
      .map((item) => `.${item}`)
      .join("");
    const label = `table${idPart ? `#${idPart}` : ""}${classPart}`;
    if (label !== "table") return label;
    return `table[${toSafeInt(index)}]`;
  }

  function buildAssignmentsDocSummary(doc, parsedOverride) {
    const safeDoc = doc && typeof doc.querySelector === "function" ? doc : null;
    const container = safeDoc ? safeDoc.querySelector(".container.controller_assignments.action_index") : null;
    const table = safeDoc ? safeDoc.querySelector("table.assignments_grid") : null;
    const headers = table ? Array.from(table.querySelectorAll("thead th")).map((cell) => normalizeHeaderLabel(cell.textContent || "")) : [];
    const headerCounts = {};
    headers.forEach((header) => {
      if (!header) return;
      headerCounts[header] = toSafeInt(headerCounts[header]) + 1;
    });

    let parsed = parsedOverride || null;
    if (!parsed && safeDoc) {
      parsed = safeDoc === document ? parseRowsFromCurrentTable() : parseRowsFromDoc(safeDoc);
    }

    const parsedRows = Array.isArray(parsed && parsed.rows) ? parsed.rows : [];
    const invalidRowIndexes = Array.isArray(parsed && parsed.invalidRowIndexes)
      ? parsed.invalidRowIndexes.slice(0, 20).map((item) => toSafeInt(item))
      : [];
    const tableList = safeDoc
      ? Array.from(safeDoc.querySelectorAll("table"))
        .slice(0, 5)
        .map((item, index) => buildTableSelectorSummary(item, index))
        .filter(Boolean)
      : [];

    return {
      foundContainer: Boolean(container),
      foundTable: Boolean(table),
      pageTitle: safeDoc ? compactText(String(safeDoc.title || "")) : "",
      headersFirstN: headers.slice(0, 20),
      headersCount: headers.length,
      missingHeaders: ASSIGNMENTS_REQUIRED_HEADERS.filter((header) => toSafeInt(headerCounts[header]) <= 0),
      duplicateHeaders: ASSIGNMENTS_REQUIRED_HEADERS.filter((header) => toSafeInt(headerCounts[header]) > 1).map(
        (header) => `${header}(${toSafeInt(headerCounts[header])})`
      ),
      tableCount: safeDoc ? safeDoc.querySelectorAll("table").length : 0,
      tableLikeSelectorsFirstN: tableList,
      rowCount: table ? table.querySelectorAll("tbody tr").length : 0,
      validRowCount: parsedRows.length,
      invalidRowCount: Math.max(0, toSafeInt(parsed && parsed.invalidRows)),
      invalidRowIndexesFirstN: invalidRowIndexes,
      schemaValid: parsed ? parsed.schemaValid !== false : Boolean(table),
      schemaReason: compactText(parsed && parsed.schemaReason ? parsed.schemaReason : ""),
    };
  }

  function buildAssignmentsCurrentSummary() {
    return buildAssignmentsDocSummary(document, parseRowsFromCurrentTable());
  }

  function ensureCompatibleCurrentTable(parsed, reasonPrefix) {
    if (!parsed || parsed.schemaValid !== false) return true;
    const reason = compactText(parsed.schemaReason || "") || compactText(reasonPrefix || "") || "assignments_grid schema mismatch";
    enterMaintenanceMode(reason);
    return false;
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
    const present = {
      p1: false,
      p2: false,
      p3_18: false,
      p19: false,
      sneaky: false,
    };
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      const groupKey = getPriorityGroupKey(row && row.priority);
      if (groupKey) {
        present[groupKey] = true;
      }
    }
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

  function isRowMatchedWithinPriorityCluster(row, groupKeys) {
    const keySet = new Set(Array.isArray(groupKeys) ? groupKeys.filter(Boolean) : []);
    if (!keySet.has(getPriorityGroupKey(row && row.priority))) return false;
    if (!Number.isFinite(row && row.priority)) return false;
    if (!state.selectedPriorities.has(row.priority)) return false;
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
        clusters.push({
          keys: currentCluster.slice(),
          rangeLabel: getPriorityGroupRangeLabel(currentCluster),
        });
        currentCluster = [];
      }
    }
    return clusters;
  }

  function buildPriorityCascadeMessages(rangeLabel) {
    const label = compactText(String(rangeLabel || ""));
    if (!label) return { status: "", wait: "" };
    return {
      status: `Шукаю серед ${label}`,
      wait: `Шукаю серед ${label}, але під тип/складність нічого не підходить, чекаю`,
    };
  }

  function getPriorityCascadeResult(rows) {
    const list = Array.isArray(rows) ? rows : [];
    const present = getPresentPriorityGroups(list);
    const clusters = buildPriorityClusters();

    for (const cluster of clusters) {
      const clusterRows = getPriorityClusterRows(list, cluster.keys);
      if (clusterRows.length === 0) continue;
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

    return {
      row: null,
      cascadeInfo: createEmptyCascadeInfo(list),
    };
  }

  function isRowMatchedByNonPriorityFilters(row) {
    if (!state.selectedDeliverables.has(row.deliverableKey || "other")) return false;
    if (state.noComplexityMode) return Boolean(row.complexityMissing);
    if (!row.complexityKey) return false;
    return state.selectedComplexities.has(row.complexityKey);
  }

  // Повертає перший зверху рядок, який проходить фільтр.
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

      const expectedState = compactText(String(row && row.assignmentState ? row.assignmentState : ""))
        .replace(/^waiting_/i, "")
        .toLowerCase();
      const keyCounts = {};
      for (const key of url.searchParams.keys()) {
        if (!ASSIGNMENT_ACTION_ALLOWED_QUERY_KEYS.has(key)) return "";
        keyCounts[key] = toSafeInt(keyCounts[key]) + 1;
      }
      if (
        toSafeInt(keyCounts.state) !== 1 ||
        toSafeInt(keyCounts.triggered_from) !== 1 ||
        toSafeInt(keyCounts.timestamp) !== 1 ||
        toSafeInt(keyCounts.signature) !== 1
      ) {
        return "";
      }
      const stateParam = compactText(url.searchParams.get("state") || "").toLowerCase();
      if (!expectedState || !stateParam || stateParam !== expectedState) return "";
      if (compactText(url.searchParams.get("triggered_from") || "") !== ASSIGNMENT_ACTION_ALLOWED_TRIGGER) return "";
      if (!compactText(url.searchParams.get("timestamp") || "")) return "";
      if (!compactText(url.searchParams.get("signature") || "")) return "";
      return url.toString();
    } catch (_err) {
      return "";
    }
  }

  // Safe lock attempt flow: validate target URL, fetch in background, confirm lock state.
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
        method: "GET",
        credentials: "include",
        cache: "no-cache",
        redirect: "follow",
        signal: controller ? controller.signal : undefined,
      }, REMOTE_FETCH_TIMEOUT_MS);
      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.httpStatus = response.status;
        throw err;
      }

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const lockInfo = parseLockInfoFromDoc(doc);
      const lockedByThisAttempt =
        Boolean(lockInfo && lockInfo.locked) &&
        Boolean(lockInfo.orderId) &&
        Boolean(orderId) &&
        String(lockInfo.orderId) === String(orderId);
      const lockedByOtherAttempt =
        lockInfo.locked &&
        (!lockInfo.orderId || !orderId || lockInfo.orderId !== orderId);

      const isCurrentRun =
        Boolean(state.enabled) &&
        Boolean(runIdAtStart) &&
        String(state.runId || "") === runIdAtStart &&
        (!controller || state.lockAttemptController === controller);
      if (!isCurrentRun) {
        return;
      }

      if (lockedByThisAttempt) {
        resetHotRetryState();
        state.runMetrics.autoLockCount += 1;
        state.lastLockOrderId = String(lockInfo.orderId || orderId || "");
        const openUrl = targetUrl;
        if (openUrl) {
          try {
            const opened = window.open(openUrl, "_blank", "noopener");
            if (opened) {
              try {
                opened.opener = null;
              } catch (_err) { }
            }
          } catch (_err) { }
        }
        stopAuto("Автолок зупинено: лок підтверджено (фон)", "Зупинено", `Стоп: лок ${orderId || "-"}`, "ok", "lock_opened", {
          orderId: String(lockInfo.orderId || orderId || ""),
          details: `background lock request: ${shortTarget}`,
        });
        return;
      }

      if (lockedByOtherAttempt) {
        resetHotRetryState();
        setStatus("Автолок: ордер уже в лоці, шукаю далі", "warn");
        setAction(`Ордер ${orderId || "-"} уже взяв хтось інший`, "warn");
        return;
      }

      const scheduled = scheduleHotRetry(orderId);
      if (scheduled) {
        setStatus("Автолок: lock не підтверджено, пробую ще раз", "warn");
        setAction(`Lock не підтверджено для ${orderId || "-"}, hot retry`, "warn");
      } else {
        resetHotRetryState();
        setStatus("Автолок: lock не підтверджено, чекаю наступний цикл", "warn");
        setAction(`Lock не підтверджено для ${orderId || "-"}`, "warn");
      }
    } catch (err) {
      if (String(err && err.message ? err.message : err || "") === "aborted") {
        return;
      }
      state.runMetrics.errorCount += 1;
      const httpStatus = parseHttpStatusFromError(err);
      if (httpStatus === 429) {
        state.runMetrics.http429 += 1;
      } else if (httpStatus >= 500 && httpStatus < 600) {
        state.runMetrics.http5xx += 1;
      }
      const scheduled = scheduleHotRetry(orderId);
      if (scheduled) {
        setStatus(`Автолок: помилка lock-запиту (${httpStatus || "network"}), швидко пробую ще`, "warn");
        setAction(`Lock-запит помилка для ${orderId || "-"}, hot retry`, "warn");
      } else {
        resetHotRetryState();
        setStatus(`Автолок: помилка lock-запиту (${httpStatus || "network"})`, "error");
        setAction(`Lock-запит помилка для ${orderId || "-"}`, "error");
      }
      console.error("[Smart bookmarklet] background lock failed:", err);
    } finally {
      if (!controller || state.lockAttemptController === controller) {
        state.lockAttemptController = null;
      }
      if (state.lockAttemptRunId === runIdAtStart) {
        state.lockAttemptRunId = "";
      }
      if (!state.lockAttemptController && !state.lockAttemptRunId) {
        state.lockAttemptInFlight = false;
      }
    }
  }

  // Виконує background lock-спробу для top-кандидата (або debug-повідомлення).
  function runAutoLockAction(parsed) {
    renderFilterButtons();

    if (!state.enabled) return;
    if (state.lockAttemptInFlight) return;
    if (state.locked) {
      return;
    }

    const match = getTopMatchedRow(parsed);
    const top = match && match.row ? match.row : null;
    const cascadeInfo = match && match.cascadeInfo ? match.cascadeInfo : createEmptyCascadeInfo(parsed && parsed.rows);
    syncAssignmentsVisualState(parsed, cascadeInfo, Boolean(state.dryRunEnabled) || (!top && Boolean(cascadeInfo.wait)));
    if (!top) {
      resetHotRetryState();
      if (cascadeInfo.wait) {
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
      emitCritical("unsafe_action_url", `Blocked non-safe action url: ${String(top.actionHref || "-")}`, {
        orderId: String(top.id || ""),
      });
      stopAuto(
        "Автолок зупинено: unsafe action URL",
        "Зупинено",
        `Стоп: unsafe action URL для ${top.id}`,
        "error",
        "unsafe_action_url",
        {
          orderId: String(top.id || ""),
          details: `unsafe action url: ${String(top.actionHref || "-")}`,
        }
      );
      return;
    }

    if (state.hotRetryOrderId && state.hotRetryOrderId !== top.id) {
      resetHotRetryState();
    }

    const shortTarget = targetText.length > 96 ? `${targetText.slice(0, 93)}...` : targetText;

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

  // Замінює тільки таблицю асайментів без reload сторінки.
  function replaceAssignmentsTable(doc) {
    const currentTable = document.querySelector("table.assignments_grid");
    const incomingTable = doc.querySelector("table.assignments_grid");
    if (!currentTable || !incomingTable) {
      throw new Error("assignments_grid not found");
    }
    currentTable.replaceWith(incomingTable);
  }

  // Робить хард-стоп, коли вичерпано 3 хв автолоку.
  function hardStop() {
    stopAuto("Автолок зупинено: ліміт 3 хв", "Зупинено", "Стоп: ліміт 3 хв", "warn", "hard_limit_3m");
  }

  // Зупиняє автолок з кастомним текстом статусу.
  function stopAuto(customStatus, label, actionText, tone, reason, extra) {
    const wasEnabled = state.enabled;
    const stopReason = String(reason || "manual");
    const stopMeta = extra || {};
    const runSec = Math.round(getRunElapsedMs(nowMs()) / 1000);

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

    if (wasEnabled && shouldEmitStopSummary(stopReason)) {
      emitStopSummary(stopReason, {
        ...stopMeta,
        runSec,
      });
    }
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
  // Main autolock lifecycle: stop, schedule, refresh, and start a bounded run.

  // Планує наступний автозапуск з фіксованим інтервалом.
  function scheduleAuto() {
    if (!state.enabled) return;
    if (state.maintenance) return;

    const ts = nowMs();

    if (state.locked) {
      stopAuto("Автолок зупинено: ви в лоці", "Зупинено", "Стоп: ви зараз у лоці", "warn", "locked");
      return;
    }

    if (getRunElapsedMs(ts) >= HARD_STOP_TOTAL_MS) {
      hardStop();
      return;
    }

    const wait = getNextBaseRefreshDelayMs(ts);

    setAutoOn();
    setBudget(ts);

    setTimer(wait, () => {
      refreshNow("auto", false);
    });
  }

  function handleDomMismatchFailure(message, criticalContext, err) {
    state.runMetrics.errorCount += 1;
    state.errorStreak += 1;
    state.domMismatchStreak += 1;

    if (state.domMismatchStreak >= 3) {
      emitCritical("critical_dom_change", message, {
        failStreak: state.domMismatchStreak,
        criticalContext,
      });
      stopAuto(
        "Автолок зупинено: критична DOM-помилка",
        "Зупинено",
        `Критична DOM-помилка (${state.domMismatchStreak}/3)`,
        "error",
        "critical_dom_change",
        {
          details: message,
          failStreak: state.domMismatchStreak,
          criticalContext,
        }
      );
      console.error("[Smart bookmarklet] refresh failed (critical dom mismatch):", err || message);
      return true;
    }

    setStatus("DOM mismatch: retry на наступному циклі", "warn");
    setAction(`DOM mismatch (${state.domMismatchStreak}/3)`, "warn");
    console.error("[Smart bookmarklet] refresh failed (dom mismatch):", err || message);
    return true;
  }

  // Виконує один цикл оновлення (manual або auto).
  async function refreshNow(trigger, force) {
    if (state.maintenance) return;
    if (!force && !state.enabled) return;
    if (state.busy) {
      if (trigger === "manual") {
        state.pendingManualRefresh = true;
        setAction("Ручне оновлення в черзі", "warn");
      }
      return;
    }

    const ts = nowMs();
    if (trigger === "manual") {
      const waitMs = getNextBaseRefreshDelayMs(ts);
      if (waitMs > 0) {
        if (!state.manualWaitTimer) {
          state.manualWaitTimer = setTimeout(() => {
            state.manualWaitTimer = null;
            refreshNow("manual", force);
          }, waitMs);
        }
        return;
      }
      clearManualWaitTimer();
    }

    if (trigger !== "manual" && trigger !== "hot_retry" && !force) {
      const waitMs = getNextBaseRefreshDelayMs(ts);
      if (waitMs > 0) {
        setTimer(waitMs, () => {
          refreshNow(trigger, false);
        });
        return;
      }
    }

    if (!force) {
      if (state.locked) {
        stopAuto("Автолок зупинено: ви в лоці", "Зупинено", "Стоп: ви зараз у лоці", "warn", "locked");
        return;
      }
      if (getRunElapsedMs(ts) >= HARD_STOP_TOTAL_MS) {
        hardStop();
        return;
      }
    }

    state.busy = true;
    state.lastRequestAt = ts;
    setBudget(ts);
    setStatus(`Refreshing (${trigger})...`, "info");
    if (trigger === "manual") {
      setAction("Ручне оновлення запущено", "info");
    }

    let lastResponse = null;
    let lastFetchedHtml = "";
    let lastFetchedDoc = null;
    let lastFetchedParsed = null;

    try {
      const response = await fetchWithTimeout(location.href, {
        method: "GET",
        credentials: "include",
        cache: "no-cache",
      }, REMOTE_FETCH_TIMEOUT_MS);
      lastResponse = response;

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.httpStatus = response.status;
        throw err;
      }

      const html = await response.text();
      lastFetchedHtml = html;
      const doc = new DOMParser().parseFromString(html, "text/html");
      lastFetchedDoc = doc;
      const parsed = parseRowsFromDoc(doc);
      lastFetchedParsed = parsed;
      if (parsed.schemaValid === false) {
        const mismatchMessage = parsed.schemaReason || "assignments_grid schema mismatch";
        const criticalContext = buildCriticalFetchContext({
          stage: "parse_rows",
          subreason: mismatchMessage,
          response,
          html,
          doc,
          parsed,
        });
        handleDomMismatchFailure(mismatchMessage, criticalContext, new Error(mismatchMessage));
        return;
      }
      const lockInfo = parseLockInfoFromDoc(doc);
      const currentUserEmail = resolveCurrentUserEmail(doc);
      if (toSafeInt(parsed.invalidRows) > 0) {
        state.invalidRowStreak += 1;
        const invalidMajority = parsed.totalRows > 0 && parsed.invalidRows >= Math.ceil(parsed.totalRows / 2);
        if (invalidMajority) {
          const criticalErr = new Error(
            `critical: assignments_grid row mismatch (${toSafeInt(parsed.invalidRows)}/${toSafeInt(parsed.totalRows)})`
          );
          criticalErr.criticalContext = buildCriticalFetchContext({
            stage: "parse_rows",
            subreason: `assignments_grid row mismatch (${toSafeInt(parsed.invalidRows)}/${toSafeInt(parsed.totalRows)})`,
            response,
            html,
            doc,
            parsed,
          });
          throw criticalErr;
        }
        if (state.invalidRowStreak >= 3) {
          emitCritical("dom_row_parse", `Invalid rows in table: ${toSafeInt(parsed.invalidRows)}`, {
            failStreak: state.invalidRowStreak,
            criticalContext: buildCriticalFetchContext({
              stage: "parse_rows",
              subreason: `invalid rows ${toSafeInt(parsed.invalidRows)}/${toSafeInt(parsed.totalRows)}`,
              response,
              html,
              doc,
              parsed,
            }),
          });
        }
      } else {
        state.invalidRowStreak = 0;
      }

      const changed = state.lastFingerprint
        ? state.lastFingerprint === parsed.fingerprint
          ? "no"
          : "yes"
        : "first";

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
      syncAssignmentsVisualState(
        parsed,
        currentMatch && currentMatch.cascadeInfo ? currentMatch.cascadeInfo : createEmptyCascadeInfo(parsed && parsed.rows),
        Boolean(currentMatch && currentMatch.cascadeInfo && currentMatch.cascadeInfo.wait && !(currentMatch && currentMatch.row))
      );
      if (!stoppedByLock) {
        const refreshLabel = getRefreshChangeLabel(changed);
        setStatus(`Оновлено: ${refreshLabel}`, "ok");
        setAction(`Оновлено: ${refreshLabel}`, "ok");
        runAutoLockAction(parsed);
      }
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      const lowerMessage = String(message || "").toLowerCase();
      if (isCriticalError(err)) {
        enterMaintenanceMode(message, {
          criticalContext:
            err && err.criticalContext
              ? err.criticalContext
              : buildCriticalFetchContext({
                stage: "critical_catch",
                subreason: message,
                response: lastResponse,
                html: lastFetchedHtml,
                doc: lastFetchedDoc,
                parsed: lastFetchedParsed,
              }),
        });
        return;
      }

      if (lowerMessage.includes("assignments_grid not found")) {
        const criticalContext = buildCriticalFetchContext({
          stage: "replace_assignments_table",
          subreason: message,
          response: lastResponse,
          html: lastFetchedHtml,
          doc: lastFetchedDoc,
          parsed: lastFetchedParsed,
        });
        handleDomMismatchFailure(message, criticalContext, err);
        return;
      }

      const httpStatus = parseHttpStatusFromError(err);
      state.runMetrics.errorCount += 1;
      state.errorStreak += 1;
      state.domMismatchStreak = 0;
      if (httpStatus === 429) {
        state.runMetrics.http429 += 1;
      } else if (httpStatus >= 500 && httpStatus < 600) {
        state.runMetrics.http5xx += 1;
      }

      if (
        (httpStatus === 429 && state.errorStreak >= 3) ||
        (httpStatus >= 500 && httpStatus < 600 && state.errorStreak >= TELEGRAM_HTTP_5XX_CRITICAL_STREAK)
      ) {
        emitCritical(httpStatus === 429 ? "http_429" : "http_5xx", message, {
          httpStatus,
          failStreak: state.errorStreak,
          http429: state.runMetrics.http429,
          http5xx: state.runMetrics.http5xx,
          criticalCount: state.runMetrics.criticalCount,
        });
      }

      setStatus(`Error: ${message}`, "error");
      setAction(`Помилка: ${message}`, "error");
      console.error("[Smart bookmarklet] refresh failed:", err);
    } finally {
      state.busy = false;
      if (state.pendingManualRefresh) {
        state.pendingManualRefresh = false;
        refreshNow("manual", true);
        return;
      }
      if (state.enabled) scheduleAuto();
    }
  }

  // Запускає нову сесію автолоку з чистим лімітом.
  async function startAuto() {
    if (state.maintenance || state.startPending) return;
    state.startPending = true;

    try {
      const ts = nowMs();
      if (!canStartAutolock(ts)) {
        state.filterOpen = true;
        renderFilterPanel();
        setStatus("Автолок не запущено", "warn");
        setAction("Фільтри відкрито: перевір і натисни ще раз", "warn");
        setBrowserIndicator("warn");
        return;
      }

      if (state.locked) {
        setStatus("Ви в лоці: автолок заблоковано", "warn");
        setAction("В лоці: автолок недоступний", "warn");
        updateAutoButtonLabel(nowMs());
        setBrowserIndicator("lock");
        return;
      }

      let notificationPermissionPromise = null;
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        notificationPermissionPromise = ensureNotificationPermission();
      }

      const hasRunLockSupport = supportsAutolockRunLock();
      if (hasRunLockSupport) {
        const lockResult = await acquireAutolockRunLock();
        if (!lockResult.ok) {
          if (lockResult.reason === "held_elsewhere") {
            setStatus("Автолок уже працює в іншій вкладці", "warn");
            setAction("В іншій вкладці вже є активний runner", "warn");
            setBrowserIndicator("warn");
          } else {
            const details = lockResult.error || "не вдалося взяти browser lock";
            setStatus("Автолок не запущено: помилка browser lock", "error");
            setAction(`Single-runner lock error: ${details}`, "error");
            setBrowserIndicator("warn");
          }
          updateAutoButtonLabel(nowMs());
          return;
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
      if (nextDelay > 0) {
        setAction(`Автолок запущено, чекаю ${Math.ceil(nextDelay)}ms`, "ok");
        scheduleAuto();
      } else {
        setAction("Автолок запущено", "ok");
        void refreshNow("auto", false);
      }
    } finally {
      state.startPending = false;
    }
  }

  // Перемикає стан автолоку кнопкою.
  function toggleAuto() {
    if (state.maintenance) return;
    if (state.locked) {
      setStatus("Ви в лоці: автолок заблоковано", "warn");
      setAction("В лоці: автолок недоступний", "warn");
      updateAutoButtonLabel(nowMs());
      setBrowserIndicator("lock");
      return;
    }

    if (state.enabled) {
      stopAuto("Автолок зупинено", "Зупинено", "Автолок зупинено", "info", "manual");
      return;
    }
    startAuto();
  }

  function attachActivityListeners() {
    const onVisibilityOrFocusChange = () => {
      if (!state.enabled || !state.backgroundStopFallback) return;
      if (!isVisibleAndFocused()) {
        stopAutoInactive();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityOrFocusChange);
    window.addEventListener("blur", onVisibilityOrFocusChange);

    if (typeof MutationObserver === "undefined") return;
    const target = document.head || document.documentElement;
    if (!target) return;

    const titleObserver = new MutationObserver(() => {
      const currentTitle = String(document.title || "");
      if (currentTitle === String(state.lastManagedDocumentTitle || "")) {
        return;
      }

      const prevTitle = state.originalDocumentTitle;
      const nextTitle = syncOriginalDocumentTitleFromDocument();
      if (state.browserIndicatorMode !== "idle" && nextTitle !== prevTitle) {
        renderBrowserIndicator();
      }
    });

    titleObserver.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // ===== Bootstrap And UI =====
  // Boot sequence: restore persistence, build panel, expose public API.
  async function bootstrapTelegramPersistence() {
    if (!TELEGRAM_LOGGING_ENABLED) return;
    await migrateLegacyTelegramStorageToIndexedDb();
    state.tgDoneMap = await readTelegramDoneMap();
    pruneTelegramDoneMap();
    await writeTelegramDoneMap(state.tgDoneMap);
    state.tgReplyMap = await readTelegramReplyMap();
    pruneTelegramReplyMap();
    await writeTelegramReplyMap(state.tgReplyMap);
    state.tgQueue = await loadPersistedTelegramQueue();
    if (state.tgQueue.length > 0) {
      await persistTelegramQueue();
      runTelegramQueue();
    }
  }

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

    if (isOpen) {
      markChangelogSeen();
    }
    changelogPanelEl.style.display = isOpen ? "block" : "none";
    changelogPanelEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
    renderChangelogButton();

    if (!isOpen || !contentEl) return;

    const changelogEntries = getChangelogEntries();
    contentEl.replaceChildren();
    if (changelogEntries.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.textContent = "Changelog поки порожній.";
      emptyEl.style.fontSize = "11px";
      emptyEl.style.color = "#475569";
      contentEl.appendChild(emptyEl);
      return;
    }

    changelogEntries.forEach((entry) => {
      if (!entry || !entry.version || !Array.isArray(entry.items)) return;
      const sectionEl = document.createElement("section");
      sectionEl.style.display = "grid";
      sectionEl.style.gap = "6px";

      const titleEl = document.createElement("div");
      titleEl.textContent = String(entry.title || `v${entry.version}`);
      titleEl.style.fontSize = "12px";
      titleEl.style.fontWeight = "700";
      titleEl.style.color = "#1d2b44";
      sectionEl.appendChild(titleEl);

      const listEl = document.createElement("ul");
      listEl.style.margin = "0";
      listEl.style.paddingLeft = "18px";
      listEl.style.display = "grid";
      listEl.style.gap = "4px";
      listEl.style.fontSize = "11px";
      listEl.style.lineHeight = "1.35";
      listEl.style.color = "#334155";

      entry.items.forEach((item) => {
        const itemEl = document.createElement("li");
        itemEl.textContent = String(item || "");
        listEl.appendChild(itemEl);
      });

      sectionEl.appendChild(listEl);
      contentEl.appendChild(sectionEl);
    });
  }

  // Створює панель і вішає обробники UI-кнопок.
  function buildPanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) return existing;

    const priorityRulesMarkup = PRIORITY_RULE_DEFINITIONS.map(
      (item) =>
        `<label style="display:flex;align-items:flex-start;gap:8px;font-size:11px;line-height:1.35;color:#243451;cursor:pointer;">` +
        `<input type="checkbox" data-role="witch-mow-ar-priority-rule" data-rule="${item.key}" style="margin:2px 0 0 0;">` +
        `<span>${item.label}</span>` +
        `</label>`
    ).join("");
    const overlayCardStyle =
      "display:none;position:fixed;right:12px;bottom:72px;z-index:2147483648;background:#fff;border:1px solid #d2d8e5;border-radius:14px;box-shadow:0 20px 48px rgba(15,23,42,.18);padding:12px;width:340px;max-width:calc(100vw - 24px);";
    const overlayHeaderStyle = "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;";
    const overlayTitleStyle = "font-size:12px;font-weight:700;color:#1d2b44;";
    const overlayCloseStyle = "border:1px solid #d5dbe8;background:#fff;color:#475569;padding:3px 8px;border-radius:999px;font-size:11px;line-height:1;cursor:pointer;";
    const settingsRowStyle =
      "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;";
    const settingsMetaStyle = "display:grid;gap:2px;min-width:0;";
    const settingsTitleStyle = "font-size:12px;font-weight:700;color:#1d2b44;";
    const settingsHintStyle = "font-size:11px;line-height:1.35;color:#64748b;";

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText =
      "position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#fff;border:1px solid #d2d8e5;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.15);padding:12px;width:388px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;font-family:Arial,sans-serif;color:#111;";

    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<div style="font-size:11px;color:#4a5670;">Останнє оновлення: <span data-role="witch-mow-ar-last">-</span></div>' +
      '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" data-role="witch-mow-ar-minimize" title="Згорнути" aria-label="Згорнути" style="border:1px solid #d5dbe8;background:#fff;font-size:15px;line-height:1;cursor:pointer;padding:2px 8px;color:#48556d;border-radius:999px;">-</button>' +
      '<button type="button" data-role="witch-mow-ar-close" title="Закрити" aria-label="Закрити" style="border:1px solid #efcaca;background:#fff5f5;font-size:14px;line-height:1;cursor:pointer;padding:2px 8px;color:#b42318;border-radius:999px;">x</button>' +
      "</div>" +
      "</div>" +
      '<div style="display:flex;gap:8px;margin-bottom:8px;">' +
      '<button type="button" data-role="witch-mow-ar-refresh" style="flex:1;border:1px solid #2e6ce6;background:#2e6ce6;color:#fff;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;">Оновити зараз</button>' +
      "</div>" +
      '<div style="border:1px solid #d9e1f0;border-radius:8px;padding:8px;margin-bottom:8px;background:#f8fbff;">' +
      '<div style="display:flex;gap:8px;margin-bottom:6px;">' +
      '<button type="button" data-role="witch-mow-ar-auto-btn" style="flex:1;border:1px solid #1f7a36;background:#1f7a36;color:#fff;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;">Увімкнути автолок</button>' +
      '<button type="button" data-role="witch-mow-ar-filter-btn" style="flex:1;border:1px solid #44516a;background:#44516a;color:#fff;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;">Фільтри автолоку</button>' +
      "</div>" +
      '<button type="button" data-role="witch-mow-ar-rules-btn" style="width:100%;border:1px solid #bfd0ff;background:#eef4ff;color:#24438a;padding:6px 8px;border-radius:6px;font-size:11px;cursor:pointer;margin-bottom:6px;">Додаткові правила</button>' +
      '<div data-role="witch-mow-ar-auto-hint" style="display:none;font-size:11px;color:#8a5f00;margin-bottom:6px;"></div>' +
      '<div data-role="witch-mow-ar-rules-panel" style="display:none;padding:8px;border:1px solid #f2d3a2;border-radius:8px;background:#fffaf0;margin-bottom:6px;">' +
      '<div style="font-size:11px;font-weight:700;color:#8a5f00;margin-bottom:4px;">Глобальні правила пріоритетів</div>' +
      '<div style="font-size:10px;line-height:1.35;color:#8a5f00;margin-bottom:6px;">Ці параметри діють для всіх шаблонів фільтра. Якщо вимкнути правило, скрипт може брати нижчі пріоритети раніше.</div>' +
      `<div style="display:grid;gap:6px;">${priorityRulesMarkup}</div>` +
      "</div>" +
      '<div data-role="witch-mow-ar-filter-panel" style="display:none;padding:8px;border:1px solid #cfd8ea;border-radius:8px;background:#fff;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">' +
      '<div data-role="witch-mow-ar-filter-meta" style="min-width:0;font-size:11px;color:#31405f;">Шаблон 1 • P 20/20 • C 4/4 • D 6/6</div>' +
      '<div data-role="witch-mow-ar-filter-slots" style="display:inline-flex;align-items:center;border-radius:7px;background:#ef4444;color:#fff;overflow:hidden;"></div>' +
      "</div>" +
      '<div style="font-size:11px;font-weight:700;color:#243451;margin-bottom:4px;">Пріоритет</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
      '<button type="button" data-role="witch-mow-ar-prio-all" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Всі</button>' +
      '<button type="button" data-role="witch-mow-ar-prio-none" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">Ніякі</button>' +
      '<button type="button" data-role="witch-mow-ar-prio-occ" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">ОЦЦ 1-2</button>' +
      '<button type="button" data-role="witch-mow-ar-prio-color" style="flex:1;border:1px solid #b7c4dd;background:#edf2fb;color:#1d2b44;padding:4px 6px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;">1-19</button>' +
      "</div>" +
      '<div data-role="witch-mow-ar-priority-grid" style="display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px;margin-bottom:6px;"></div>' +
      '<div style="font-size:11px;font-weight:700;color:#243451;margin-bottom:4px;">Складність</div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#243451;margin-bottom:6px;cursor:pointer;">' +
      '<input type="checkbox" data-role="witch-mow-ar-no-complexity" style="margin:0;">' +
      "Без складності (наприклад, інтер'єри)" +
      "</label>" +
      '<div data-role="witch-mow-ar-complexity-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-bottom:8px;"></div>' +
      '<div style="font-size:11px;font-weight:700;color:#243451;margin-bottom:4px;">Тип</div>' +
      '<div data-role="witch-mow-ar-deliverable-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;"></div>' +
      "</div>" +
      "</div>" +
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
      '<div data-role="witch-mow-ar-lock-note" style="display:none;font-size:11px;line-height:1.35;margin-bottom:8px;padding:6px;border:1px solid #f1d8a6;border-radius:6px;background:#fffbf0;color:#8a5f00;"></div>' +
      '<div data-role="witch-mow-ar-loader-note" style="display:none;font-size:10px;line-height:1.25;margin-bottom:8px;padding:5px 6px;border:1px solid #f3d19c;border-radius:6px;background:#fffaf0;color:#8a5f00;"></div>' +
      (state.roleWarningDismissed
        ? ""
        : '<div data-role="witch-mow-ar-role-warning" style="margin-bottom:8px;padding:8px;border:1px solid #f2d3a2;border-radius:8px;background:#fffaf0;color:#8a5f00;">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">' +
          '<div style="min-width:0;">' +
          '<div style="font-size:11px;font-weight:700;margin-bottom:4px;">Обмеження скрипта</div>' +
          "<div style=\"font-size:12px;font-weight:700;line-height:1.4;\">Цей скрипт розроблявся і перевірявся тільки для exterior-моделерів.<br>Інші ролі і фільтри для них будуть додаватись пізніше.</div>" +
          "</div>" +
          '<button type="button" data-role="witch-mow-ar-role-warning-close" style="flex:0 0 auto;border:1px solid #d6b783;background:#fff;color:#8a5f00;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">Закрити</button>' +
          "</div>" +
          "</div>") +
      '<div style="font-size:11px;line-height:1.35;margin-bottom:8px;padding:6px;border:1px solid #f0d4d4;border-radius:6px;background:#fff7f7;color:#8a2626;">' +
      '<b>УВАГА:</b> Використання скрипта на ваш ризик.<br>Не є виправданням для неправильного локу.<br>Якщо знайдете помилку - відправляйте фідбек кнопкою нижче.' +
      "</div>" +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
      '<div style="display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0;max-width:100%;color:#9aa3b2;">' +
      '<span data-role="witch-mow-ar-user-email" style="font-size:10px;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">-</span>' +
      '<button type="button" data-role="witch-mow-ar-changelog-btn" style="margin-top:2px;border:0;background:transparent;padding:0;font-size:8px;line-height:1.25;color:#8a94a6;white-space:normal;word-break:break-word;text-align:left;cursor:pointer;">' +
      SCRIPT_VERSION_LABEL +
      "</button></div>" +
      '<div style="display:flex;align-items:center;gap:6px;">' +
      '<button type="button" data-role="witch-mow-ar-settings-btn" title="Параметри" aria-label="Параметри" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:1px solid #cbd5e1;background:#fff;color:#334155;padding:0;border-radius:999px;cursor:pointer;">' +
      '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2 4.25h3.5v1H2v-1Zm8.5 0H14v1h-3.5v-1ZM2 7.5h7v1H2v-1Zm10 0h2v1h-2v-1ZM2 10.75h1.5v1H2v-1Zm6.5 0H14v1H8.5v-1Z"/><circle cx="7.25" cy="4.75" r="1.75" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="10.25" cy="8" r="1.75" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="5.75" cy="11.25" r="1.75" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' +
      "</button>" +
      '<button type="button" data-role="witch-mow-ar-feedback" style="border:1px solid #64748b;background:#f8fafc;color:#1d2b44;padding:2px 8px;border-radius:999px;font-size:10px;cursor:pointer;">Фідбек</button>' +
      "</div>" +
      "</div>" +
      '<div data-role="witch-mow-ar-settings-panel" style="' + overlayCardStyle + '" aria-hidden="true">' +
      '<div style="' + overlayHeaderStyle + '">' +
      '<div style="' + overlayTitleStyle + '">Параметри</div>' +
      '<button type="button" data-role="witch-mow-ar-settings-close" style="' + overlayCloseStyle + '">x</button>' +
      "</div>" +
      '<div style="display:grid;gap:8px;">' +
      '<label style="' + settingsRowStyle + 'cursor:pointer;">' +
      '<span style="' + settingsMetaStyle + '">' +
      '<span style="' + settingsTitleStyle + '">Dry run</span>' +
      '<span style="' + settingsHintStyle + '">Тестовий режим, вимикає лок за будинками</span>' +
      "</span>" +
      '<input type="checkbox" data-role="witch-mow-ar-dry-run-toggle" style="margin:0;inline-size:16px;block-size:16px;accent-color:#2563eb;">' +
      "</label>" +
      '<div style="' + settingsRowStyle + '">' +
      '<span style="' + settingsMetaStyle + '">' +
      '<span style="' + settingsTitleStyle + '">Підсвітка пошуку</span>' +
      "</span>" +
      '<button type="button" data-role="witch-mow-ar-visual-toggle" title="Візуальна рамка" aria-label="Візуальна рамка" aria-pressed="true" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:1px solid #93c5fd;background:#dbeafe;color:#1d4ed8;padding:0;border-radius:999px;cursor:pointer;flex:0 0 auto;">' +
      '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 3c3.8 0 6.5 3.1 7.4 4.4a1 1 0 0 1 0 1.1C14.5 9.9 11.8 13 8 13S1.5 9.9.6 8.5a1 1 0 0 1 0-1.1C1.5 6.1 4.2 3 8 3Zm0 1C5 4 2.7 6.3 1.7 8 2.7 9.7 5 12 8 12s5.3-2.3 6.3-4C13.3 6.3 11 4 8 4Zm0 1.5A2.5 2.5 0 1 1 8 10.5 2.5 2.5 0 0 1 8 5.5Zm0 1A1.5 1.5 0 1 0 8 9.5 1.5 1.5 0 0 0 8 6.5Z"/></svg>' +
      "</button>" +
      "</div>" +
      '<div style="' + settingsRowStyle + '">' +
      '<span style="' + settingsMetaStyle + '">' +
      '<span style="' + settingsTitleStyle + '">Тест сповіщень</span>' +
      "</span>" +
      '<button type="button" data-role="witch-mow-ar-debug-notify" style="border:1px solid #cbd5e1;background:#fff;color:#334155;padding:7px 10px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;flex:0 0 auto;">Запустити</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div data-role="witch-mow-ar-changelog-panel" style="' + overlayCardStyle + 'width:360px;max-height:calc(100vh - 32px);" aria-hidden="true">' +
      '<div style="' + overlayHeaderStyle + '">' +
      '<div style="' + overlayTitleStyle + '">Що нового</div>' +
      '<button type="button" data-role="witch-mow-ar-changelog-close" style="' + overlayCloseStyle + '">x</button>' +
      "</div>" +
      '<div data-role="witch-mow-ar-changelog-content" style="display:grid;gap:12px;max-height:340px;overflow:auto;padding-right:4px;"></div>' +
      "</div>" +
      "</div>" +
      "</div>";

    document.body.appendChild(panel);

    const compactPanel = document.createElement("button");
    compactPanel.type = "button";
    compactPanel.id = `${PANEL_ID}-compact`;
    compactPanel.style.cssText =
      "display:none;position:fixed;right:12px;bottom:12px;z-index:2147483647;width:220px;max-width:calc(100vw - 24px);padding:10px 12px;border:1px solid #d2d8e5;border-radius:14px;background:#fff;box-shadow:0 10px 24px rgba(15,23,42,.14);cursor:pointer;text-align:left;font-family:Arial,sans-serif;";
    compactPanel.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span data-role="witch-mow-ar-compact-indicator" style="flex:0 0 auto;width:10px;height:10px;border-radius:999px;background:#2563eb;"></span>' +
      '<div style="min-width:0;display:grid;gap:2px;flex:1;">' +
      '<div data-role="witch-mow-ar-compact-status" style="font-size:12px;font-weight:700;color:#1d2b44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Init...</div>' +
      '<div data-role="witch-mow-ar-compact-action" style="font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">-</div>' +
      "</div>" +
      '<span style="flex:0 0 auto;font-size:14px;line-height:1;color:#64748b;">&gt;</span>' +
      "</div>";
    document.body.appendChild(compactPanel);

    panelEl = panel;
    compactPanelEl = compactPanel;
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
    feedbackBtnEl = panel.querySelector('[data-role="witch-mow-ar-feedback"]');
    minimizeBtnEl = panel.querySelector('[data-role="witch-mow-ar-minimize"]');
    filterPanelEl = panel.querySelector('[data-role="witch-mow-ar-filter-panel"]');
    filterSlotsEl = panel.querySelector('[data-role="witch-mow-ar-filter-slots"]');
    prioritiesGridEl = panel.querySelector('[data-role="witch-mow-ar-priority-grid"]');
    complexitiesGridEl = panel.querySelector('[data-role="witch-mow-ar-complexity-grid"]');
    deliverablesGridEl = panel.querySelector('[data-role="witch-mow-ar-deliverable-grid"]');
    noComplexityEl = panel.querySelector('[data-role="witch-mow-ar-no-complexity"]');
    filterMetaEl = panel.querySelector('[data-role="witch-mow-ar-filter-meta"]');

    panel.querySelector('[data-role="witch-mow-ar-close"]').addEventListener("click", () => {
      if (state.enabled) {
        stopAuto("Автолок зупинено: панель закрито", "Зупинено", "Стоп: панель закрито", "warn", "manual");
      }
      state.settingsOpen = false;
      state.changelogOpen = false;
      renderSettingsPanel();
      renderChangelogPanel();
      panel.style.display = "none";
      if (compactPanelEl) {
        compactPanelEl.style.display = "none";
      }
    });

    if (minimizeBtnEl) {
      minimizeBtnEl.addEventListener("click", () => {
        setPanelMinimized(true);
      });
    }

    if (compactPanelEl) {
      compactPanelEl.addEventListener("click", () => {
        setPanelMinimized(false);
      });
    }

    panel.querySelector('[data-role="witch-mow-ar-refresh"]').addEventListener("click", () => {
      if (state.enabled) {
        state.runMetrics.manualRefreshCount += 1;
        stopAuto("Автолок зупинено: ручне оновлення", "Зупинено", "Стоп: ручне оновлення", "warn", "manual_refresh");
      }
      refreshNow("manual", true);
    });

    const roleWarningCloseBtn = panel.querySelector('[data-role="witch-mow-ar-role-warning-close"]');
    if (roleWarningCloseBtn) {
      roleWarningCloseBtn.addEventListener("click", () => {
        dismissRoleWarning();
      });
    }

    renderVisualHighlightButton();
    renderSettingsButton();
    renderChangelogButton();
    renderDryRunToggle();
    renderCompactPanel();
    renderPanelMode();

    if (visualToggleBtnEl) {
      visualToggleBtnEl.addEventListener("click", () => {
        state.visualHighlightEnabled = !state.visualHighlightEnabled;
        persistVisualHighlightState();
        renderVisualHighlightButton();
        syncAssignmentsVisualState(parseRowsFromCurrentTable(), createEmptyCascadeInfo(), false);
      });
    }

    if (debugBtnEl) {
      debugBtnEl.addEventListener("click", () => {
        void runNotificationDebugTest();
      });
    }

    feedbackBtnEl.addEventListener("click", () => {
      void sendFeedbackToTelegram();
    });

    if (settingsBtnEl) {
      settingsBtnEl.addEventListener("click", () => {
        state.settingsOpen = !state.settingsOpen;
        if (state.settingsOpen) {
          state.changelogOpen = false;
        }
        renderSettingsPanel();
        renderChangelogPanel();
      });
    }

    if (changelogBtnEl) {
      changelogBtnEl.addEventListener("click", () => {
        state.changelogOpen = !state.changelogOpen;
        if (state.changelogOpen) {
          state.settingsOpen = false;
        }
        renderSettingsPanel();
        renderChangelogPanel();
      });
    }

    const settingsCloseBtn = panel.querySelector('[data-role="witch-mow-ar-settings-close"]');
    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener("click", () => {
        state.settingsOpen = false;
        renderSettingsPanel();
      });
    }

    const changelogCloseBtn = panel.querySelector('[data-role="witch-mow-ar-changelog-close"]');
    if (changelogCloseBtn) {
      changelogCloseBtn.addEventListener("click", () => {
        state.changelogOpen = false;
        renderChangelogPanel();
      });
    }

    if (settingsPanelEl) {
      settingsPanelEl.addEventListener("change", (event) => {
        const target = event.target;
        if (!target) return;
        if (target.getAttribute("data-role") !== "witch-mow-ar-dry-run-toggle") return;

        state.dryRunEnabled = Boolean(target.checked);
        persistDryRunState();
        renderDryRunToggle();
        if (state.enabled) {
          stopAuto(
            "Автолок зупинено: змінено dry run",
            "Зупинено",
            state.dryRunEnabled ? "Стоп: увімкнено dry run" : "Стоп: вимкнено dry run",
            "warn",
            "manual"
          );
        } else {
          setAction(state.dryRunEnabled ? "Dry run увімкнено" : "Dry run вимкнено", "ok");
        }
      });
    }

    autoBtnEl.addEventListener("click", () => {
      toggleAuto();
    });

    filterBtnEl.addEventListener("click", () => {
      state.filterOpen = !state.filterOpen;
      if (state.filterOpen) {
        markFiltersReviewed();
        setAction("Фільтри автолоку перевірено", "ok");
      }
      renderFilterPanel();
    });

    if (priorityRulesBtnEl) {
      priorityRulesBtnEl.addEventListener("click", () => {
        state.priorityRulesOpen = !state.priorityRulesOpen;
        if (state.priorityRulesOpen) {
          markFiltersReviewed();
          setAction("Правила пріоритетів перевірено", "ok");
        }
        renderFilterPanel();
      });
    }

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
          const confirmed =
            typeof window.confirm === "function" ? window.confirm(ruleDef.confirmText) : true;
          if (!confirmed) {
            target.checked = true;
            return;
          }
        }

        state.priorityRules[ruleKey] = nextValue;
        persistPriorityRules();
        renderFilterPanel();
        markFiltersReviewed();
        setAction("Правила пріоритетів збережено", "ok");
        if (state.enabled) {
          stopAuto("Автолок зупинено: змінено правила пріоритетів", "Зупинено", "Стоп: змінено правила пріоритетів", "warn", "filter_changed");
        }
      });
    }

    if (noComplexityEl) {
      noComplexityEl.addEventListener("change", () => {
        if (state.maintenance) return;
        state.noComplexityMode = Boolean(noComplexityEl.checked);
        persistFilterState();
        renderFilterPanel();
        markFiltersReviewed();
        setAction("Фільтри автолоку перевірено", "ok");
        if (state.enabled) {
          stopAuto("Автолок зупинено: змінено фільтри", "Зупинено", "Стоп: змінено фільтри", "warn", "filter_changed");
        }
      });
    }

    filterPanelEl.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;

      let changed = false;
      const role = target.getAttribute("data-role") || "";
      if (role === "witch-mow-ar-filter-slot") {
        const slotId = Number(target.getAttribute("data-slot") || "");
        if (switchFilterSlot(slotId)) {
          changed = true;
          setAction(`${getFilterSlotSummary(slotId)} активовано`, "ok");
        }
      }
      if (role === "witch-mow-ar-prio-all") {
        setPriorityFilter(true);
        changed = true;
      }
      if (role === "witch-mow-ar-prio-none") {
        setPriorityFilter(false);
        changed = true;
      }
      if (role === "witch-mow-ar-prio-occ") {
        setPriorityRange(1, 2);
        changed = true;
      }
      if (role === "witch-mow-ar-prio-color") {
        setPriorityRange(1, 19);
        changed = true;
      }
      if (role === "witch-mow-ar-comp-all") {
        setComplexityFilter(true);
        changed = true;
      }
      if (role === "witch-mow-ar-comp-none") {
        setComplexityFilter(false);
        changed = true;
      }
      if (role === "witch-mow-ar-deliv-all") {
        setDeliverableFilter(true);
        changed = true;
      }
      if (role === "witch-mow-ar-deliv-none") {
        setDeliverableFilter(false);
        changed = true;
      }

      const chipRole = target.getAttribute("data-role");
      if (chipRole === "witch-mow-ar-chip") {
        const kind = target.getAttribute("data-kind");
        const rawValue = target.getAttribute("data-value") || "";
        if (kind === "priority") {
          const value = Number(rawValue);
          if (Number.isFinite(value)) {
            togglePriority(value);
            changed = true;
          }
        }
        if (kind === "complexity" && rawValue) {
          toggleComplexity(rawValue);
          changed = true;
        }
        if (kind === "deliverable" && rawValue) {
          toggleDeliverable(rawValue);
          changed = true;
        }
      }

      if (changed) {
        persistFilterState();
      }

      renderFilterPanel();
      if (state.filterOpen) {
        markFiltersReviewed();
      }
      if (changed && state.enabled) {
        stopAuto("Автолок зупинено: змінено фільтри", "Зупинено", "Стоп: змінено фільтри", "warn", "filter_changed");
      }
      if (!state.enabled) return;
      const parsed = parseRowsFromCurrentTable();
      if (!ensureCompatibleCurrentTable(parsed, "assignments_grid schema mismatch while applying filters")) return;
      runAutoLockAction(parsed);
    });

    return panel;
  }

  // Показує панель і ініціалізує поточний стан UI.
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
    if (state.maintenance) {
      setBrowserIndicator("warn");
    } else if (state.enabled) {
      setBrowserIndicator("run");
    } else if (!state.locked) {
      setStatus("Готово", "info");
      setAction("Готово до запуску автолоку", "info");
      setBrowserIndicator("idle");
    }
    setLast(state.lastUpdatedAt);
    updateAutoButtonLabel(nowMs());
    if (!state.lastUpdatedAt) {
      void refreshNow("manual", true);
    }
  }

  state.installId = loadOrCreateInstallId();
  restorePersistedFilters();
  restorePersistedPriorityRules();
  restorePersistedDryRunState();
  restorePersistedVisualHighlightState();
  restorePersistedRoleWarningDismissedState();
  attachActivityListeners();
  void bootstrapTelegramPersistence();
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