import { createTabGroup, expandOrRestoreGroup, autoGroupTabs, undoAutoGroup } from "./utils/tabs.js";
import { classifyUrl } from "./utils/intelligence.js";

const SUGGESTION_KEY = "tabnotes_suggestion_shown";
const TAB_THRESHOLD = 5;
const CHAOS_STARTED_KEY = "tabnotes_chaos_started_at";
const CHAOS_NOTIFIED_KEY = "tabnotes_chaos_notified";
const CHAOS_THRESHOLD = 12;
const CHAOS_DURATION_MS = 2 * 60 * 60 * 1000;
const CHAOS_ALARM = "tabnotes-chaos-check";
const FOCUS_METRICS_KEY = "tabnotes_focus_metrics";
const ACTIVE_STATE_KEY = "tabnotes_focus_active_state";

function createEmptyMetrics() {
  return {
    totalMs: 0,
    byUrl: {}
  };
}

async function ensureAlarms() {
  await chrome.alarms.create(CHAOS_ALARM, { periodInMinutes: 5 });
}

async function showOpenPopupHint(notificationId, title, message) {
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message,
    buttons: [{ title: "Open TabNotes" }],
    priority: 1
  });
}

async function maybeSuggestSave() {
  const data = await chrome.storage.local.get([SUGGESTION_KEY]);
  if (data[SUGGESTION_KEY]) return;

  const tabs = await chrome.tabs.query({ windowType: "normal" });
  const capturableTabs = tabs.filter(tab => tab.url && tab.url.startsWith("http"));
  if (capturableTabs.length < TAB_THRESHOLD) return;

  await chrome.storage.local.set({ [SUGGESTION_KEY]: true });
  await showOpenPopupHint(
    "tabnotes-suggest",
    "Save your context? ⚡",
    `You have ${capturableTabs.length} tabs open. Save them as a TabNotes session so you can restore your flow instantly later.`
  );
}

async function evaluateChaosState() {
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  const capturableTabs = tabs.filter(tab => tab.url && tab.url.startsWith("http"));
  const data = await chrome.storage.local.get([CHAOS_STARTED_KEY, CHAOS_NOTIFIED_KEY]);
  const startedAt = data[CHAOS_STARTED_KEY] || null;
  const notified = Boolean(data[CHAOS_NOTIFIED_KEY]);

  if (capturableTabs.length < CHAOS_THRESHOLD) {
    await chrome.storage.local.set({
      [CHAOS_STARTED_KEY]: null,
      [CHAOS_NOTIFIED_KEY]: false
    });
    return;
  }

  if (!startedAt) {
    await chrome.storage.local.set({
      [CHAOS_STARTED_KEY]: Date.now(),
      [CHAOS_NOTIFIED_KEY]: false
    });
    return;
  }

  if (!notified && Date.now() - startedAt >= CHAOS_DURATION_MS) {
    await chrome.storage.local.set({ [CHAOS_NOTIFIED_KEY]: true });
    await showOpenPopupHint(
      "tabnotes-chaos",
      "12-tab chaos detected",
      "You have been in tab chaos for 2 hours. Want to save this session before it gets messier?"
    );
  }
}

async function loadMetricsState() {
  const data = await chrome.storage.local.get([FOCUS_METRICS_KEY, ACTIVE_STATE_KEY]);
  return {
    metrics: data[FOCUS_METRICS_KEY] || createEmptyMetrics(),
    activeState: data[ACTIVE_STATE_KEY] || null
  };
}

async function persistMetricsState(metrics, activeState) {
  await chrome.storage.local.set({
    [FOCUS_METRICS_KEY]: metrics,
    [ACTIVE_STATE_KEY]: activeState
  });
}

async function flushActiveFocus() {
  const { metrics, activeState } = await loadMetricsState();
  if (!activeState?.tabId || !activeState?.startedAt) {
    return metrics;
  }

  const delta = Math.max(0, Date.now() - activeState.startedAt);
  if (delta === 0) {
    return metrics;
  }

  const tab = await chrome.tabs.get(activeState.tabId).catch(() => null);
  if (!tab?.url || !tab.url.startsWith("http")) {
    await persistMetricsState(metrics, null);
    return metrics;
  }

  const existing = metrics.byUrl[tab.url] || {
    url: tab.url,
    title: tab.title || tab.url,
    hostname: "",
    category: "mixed",
    ms: 0,
    activations: 0
  };
  const { category, hostname } = classifyUrl(tab.url, tab.title);
  existing.title = tab.title || tab.url;
  existing.hostname = hostname;
  existing.category = category;
  existing.ms += delta;

  metrics.byUrl[tab.url] = existing;
  metrics.totalMs += delta;

  await persistMetricsState(metrics, {
    tabId: activeState.tabId,
    startedAt: Date.now()
  });

  return metrics;
}

async function setActiveTab(tabId) {
  const metrics = await flushActiveFocus();
  const tab = await chrome.tabs.get(tabId).catch(() => null);

  if (!tab?.url || !tab.url.startsWith("http")) {
    await persistMetricsState(metrics, null);
    return;
  }

  const current = metrics.byUrl[tab.url] || {
    url: tab.url,
    title: tab.title || tab.url,
    hostname: "",
    category: "mixed",
    ms: 0,
    activations: 0
  };
  const { category, hostname } = classifyUrl(tab.url, tab.title);
  current.title = tab.title || tab.url;
  current.hostname = hostname;
  current.category = category;
  current.activations += 1;
  metrics.byUrl[tab.url] = current;

  await persistMetricsState(metrics, {
    tabId,
    startedAt: Date.now()
  });
}

async function syncCurrentActiveTab(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    const { metrics } = await loadMetricsState();
    await persistMetricsState(metrics, null);
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, windowId });
  if (activeTab?.id != null) {
    await setActiveTab(activeTab.id);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log("TabNotes installed");
  await ensureAlarms();
  await maybeSuggestSave();
  const lastFocused = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
  if (lastFocused?.id != null) {
    await syncCurrentActiveTab(lastFocused.id);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarms();
  const lastFocused = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
  if (lastFocused?.id != null) {
    await syncCurrentActiveTab(lastFocused.id);
  }
});

chrome.tabs.onCreated.addListener(async () => {
  await maybeSuggestSave();
  await evaluateChaosState();
});

chrome.tabs.onRemoved.addListener(async tabId => {
  const { metrics, activeState } = await loadMetricsState();
  if (activeState?.tabId === tabId) {
    await persistMetricsState(metrics, null);
  }
  await evaluateChaosState();
});

chrome.tabs.onUpdated.addListener(async () => {
  await evaluateChaosState();
});

chrome.tabs.onActivated.addListener(async activeInfo => {
  await setActiveTab(activeInfo.tabId);
});

chrome.windows.onFocusChanged.addListener(async windowId => {
  await syncCurrentActiveTab(windowId);
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === CHAOS_ALARM) {
    await evaluateChaosState();
  }
});

chrome.notifications.onButtonClicked.addListener(notificationId => {
  if (notificationId === "tabnotes-suggest" || notificationId === "tabnotes-chaos") {
    chrome.action.openPopup().catch(() => {});
  }
});

chrome.notifications.onClicked.addListener(notificationId => {
  if (notificationId === "tabnotes-suggest" || notificationId === "tabnotes-chaos") {
    chrome.action.openPopup().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "createGroup") {
    createTabGroup(message.tabIds, message.groupName)
      .then(groupId => sendResponse({ ok: true, groupId }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === "expandGroup") {
    expandOrRestoreGroup(message.groupId, message.urls, message.groupName)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (message.action === "getFocusMetrics") {
    flushActiveFocus()
      .then(metrics => sendResponse(metrics))
      .catch(() => sendResponse(createEmptyMetrics()));
    return true;
  }

  if (message.action === "autoGroup") {
    autoGroupTabs(classifyUrl)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, reason: err.message }));
    return true;
  }

  if (message.action === "undoGroup") {
    undoAutoGroup(message.snapshot)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, reason: err.message }));
    return true;
  }
});

