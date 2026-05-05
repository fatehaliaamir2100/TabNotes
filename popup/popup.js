import { getCurrentTabs } from "../utils/tabs.js";
import { analyzeTabs, summarizeFocusMetrics } from "../utils/intelligence.js";
import { saveSession, getSessions, deleteSession, getFeatureOptions, updateFeatureOption } from "../utils/storage.js";

const noteInput     = document.getElementById("note");
const tagsInput     = document.getElementById("tags");
const saveBtn       = document.getElementById("saveBtn");
const sessionsDiv   = document.getElementById("sessions");
const countBadge    = document.getElementById("sessionsCount");
const tabListDiv    = document.getElementById("tabList");
const selectAllBtn  = document.getElementById("selectAll");
const selectNoneBtn = document.getElementById("selectNone");
const insightsPanel = document.getElementById("insightsPanel");
const autoGroupBar = document.querySelector(".auto-group-bar");
const toggleAutoGroupTabs = document.getElementById("toggleAutoGroupTabs");
const toggleSessionIntelligence = document.getElementById("toggleSessionIntelligence");

let currentTabs = [];
let featureOptions = {
  showAutoGroupTabs: true,
  showSessionIntelligence: true
};

function applyFeatureVisibility() {
  if (autoGroupBar) {
    autoGroupBar.hidden = !featureOptions.showAutoGroupTabs;
    autoGroupBar.style.display = featureOptions.showAutoGroupTabs ? "flex" : "none";
  }
  if (insightsPanel) {
    insightsPanel.hidden = !featureOptions.showSessionIntelligence;
    insightsPanel.style.display = featureOptions.showSessionIntelligence ? "flex" : "none";
  }
}

function getSelectedItems() {
  const checkboxes = [...tabListDiv.querySelectorAll(".tab-checkbox")];
  return checkboxes
    .map((checkbox, index) => checkbox.checked ? currentTabs[index] : null)
    .filter(tab => tab && tab.url && tab.url.startsWith("http"));
}

function formatFocusLine(focusSummary) {
  if (!focusSummary?.topDomain) {
    return "No focus history yet";
  }

  const ignored = focusSummary.ignoredDomains?.length
    ? ` • ignored: ${focusSummary.ignoredDomains.join(", ")}`
    : "";

  return `${focusSummary.topSharePct}% focus on ${focusSummary.topDomain}${ignored}`;
}

async function updateInsights() {
  if (!featureOptions.showSessionIntelligence) {
    return;
  }

  const selectedItems = getSelectedItems();
  if (selectedItems.length === 0) {
    insightsPanel.innerHTML = `
      <div class="insight-empty">Select tabs to see inferred intent, domains, and focus signals.</div>
    `;
    return;
  }

  const analysis = analyzeTabs(selectedItems);
  const focusMetrics = await chrome.runtime.sendMessage({ action: "getFocusMetrics" }).catch(() => ({ byUrl: {} }));
  const focusSummary = summarizeFocusMetrics(selectedItems.map(tab => tab.url), focusMetrics || {});

  insightsPanel.innerHTML = `
    <div class="insights-head">
      <span class="insight-eyebrow">Session Intelligence</span>
      <span class="insight-label">${analysis.sessionLabel}</span>
    </div>
    <div class="insight-row">
      <span class="insight-key">Top domains</span>
      <span class="insight-value">${analysis.topDomains.map(item => item.domain).join(" • ") || "mixed"}</span>
    </div>
    <div class="insight-row">
      <span class="insight-key">Clusters</span>
      <span class="insight-value">${analysis.clusterBreakdown.map(item => `${item.label} ${item.count}`).join(" • ")}</span>
    </div>
    <div class="insight-row">
      <span class="insight-key">Focus</span>
      <span class="insight-value">${formatFocusLine(focusSummary)}</span>
    </div>
  `;
}

async function initFeatureOptions() {
  featureOptions = await getFeatureOptions();
  toggleAutoGroupTabs.checked = featureOptions.showAutoGroupTabs;
  toggleSessionIntelligence.checked = featureOptions.showSessionIntelligence;
  applyFeatureVisibility();

  toggleAutoGroupTabs.addEventListener("change", async () => {
    featureOptions = await updateFeatureOption("showAutoGroupTabs", toggleAutoGroupTabs.checked);
    applyFeatureVisibility();
  });

  toggleSessionIntelligence.addEventListener("change", async () => {
    featureOptions = await updateFeatureOption("showSessionIntelligence", toggleSessionIntelligence.checked);
    applyFeatureVisibility();
    if (featureOptions.showSessionIntelligence) {
      await updateInsights();
    }
  });
}

// ── Tab Picker ────────────────────────────────────────────────────
async function initTabPicker() {
  const allTabs = await getCurrentTabs();
  currentTabs = allTabs.filter(t => t.url && t.url.startsWith("http"));
  tabListDiv.innerHTML = "";

  if (currentTabs.length === 0) {
    const msg = document.createElement("p");
    msg.style.cssText = "font-size:11px;color:rgba(148,163,184,0.35);text-align:center;padding:10px 0;";
    msg.textContent = "No capturable tabs open";
    tabListDiv.appendChild(msg);
    await updateInsights();
    return;
  }

  currentTabs.forEach(tab => {
    const item = document.createElement("label");
    item.className = "tab-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.className = "tab-checkbox";

    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.width = 14;
    favicon.height = 14;
    if (tab.favIconUrl) {
      favicon.src = tab.favIconUrl;
      favicon.onerror = () => { favicon.style.display = "none"; };
    } else {
      favicon.style.display = "none";
    }

    const text = document.createElement("span");
    text.className = "tab-label";
    text.textContent = tab.title || tab.url;

    item.appendChild(checkbox);
    item.appendChild(favicon);
    item.appendChild(text);
    tabListDiv.appendChild(item);
  });

  await updateInsights();
}

selectAllBtn.addEventListener("click", () => {
  tabListDiv.querySelectorAll(".tab-checkbox").forEach(cb => { cb.checked = true; });
  updateInsights();
});
selectNoneBtn.addEventListener("click", () => {
  tabListDiv.querySelectorAll(".tab-checkbox").forEach(cb => { cb.checked = false; });
  updateInsights();
});
tabListDiv.addEventListener("change", () => {
  updateInsights();
});

// ── Save Session ──────────────────────────────────────────────────
saveBtn.addEventListener("click", async () => {
  const selectedItems = getSelectedItems();

  if (selectedItems.length === 0) {
    saveBtn.textContent = "⚠ Select tabs first!";
    setTimeout(() => { saveBtn.textContent = "⚡ Save Context"; }, 1600);
    return;
  }

  const selectedUrls   = selectedItems.map(t => t.url);
  const selectedTabIds = selectedItems.map(t => t.id);
  const analysis = analyzeTabs(selectedItems);
  const focusMetrics = await chrome.runtime.sendMessage({ action: "getFocusMetrics" }).catch(() => ({ byUrl: {} }));
  const focusSummary = summarizeFocusMetrics(selectedUrls, focusMetrics || {});

  const rawTags = tagsInput.value.trim();
  const userTags = rawTags ? rawTags.split(",").map(tag => tag.trim()).filter(Boolean) : [];
  const tags = userTags.length > 0 ? userTags : analysis.suggestedTags;
  const groupName = userTags[0] || analysis.sessionLabel || noteInput.value.trim() || "TabNotes Session";

  // Create the tab group immediately (tabs are open right now)
  const response = await chrome.runtime.sendMessage({
    action: "createGroup",
    tabIds: selectedTabIds,
    groupName
  });
  const groupId = response?.groupId ?? null;

  const session = {
    id: Date.now(),
    note: noteInput.value.trim(),
    timestamp: new Date().toISOString(),
    tabs: selectedUrls,
    tags,
    groupId,
    autoLabel: analysis.sessionLabel,
    domainSummary: analysis.topDomains,
    clusterBreakdown: analysis.clusterBreakdown,
    focusSummary
  };

  await saveSession(session);
  noteInput.value = "";
  tagsInput.value = "";
  tabListDiv.querySelectorAll(".tab-checkbox").forEach(cb => { cb.checked = true; });

  saveBtn.textContent = "✓ Saved!";
  saveBtn.classList.add("saved");
  setTimeout(() => {
    saveBtn.textContent = "⚡ Save Context";
    saveBtn.classList.remove("saved");
  }, 1500);

  await updateInsights();
  loadSessions();
});

// Load sessions
async function loadSessions() {
  const sessions = await getSessions();

  sessionsDiv.innerHTML = "";
  if (countBadge) countBadge.textContent = sessions.length;

  if (sessions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.textContent = "🚀";
    const msg = document.createElement("p");
    msg.textContent = "No sessions saved yet";
    empty.appendChild(icon);
    empty.appendChild(msg);
    sessionsDiv.appendChild(empty);
    return;
  }

  sessions.forEach(session => {
    const div = document.createElement("div");
    div.className = "session";

    const title = document.createElement("span");
    title.className = "session-title";
    title.textContent = session.note || session.autoLabel || "Untitled Session";
    div.appendChild(title);

    if (session.tags && session.tags.length > 0) {
      const tagsRow = document.createElement("div");
      tagsRow.className = "session-tags";
      session.tags.forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.textContent = tag;
        tagsRow.appendChild(pill);
      });
      div.appendChild(tagsRow);
    }

    if (session.autoLabel || session.focusSummary?.topDomain) {
      const summary = document.createElement("div");
      summary.className = "session-summary";
      const focusText = session.focusSummary?.topDomain
        ? `${session.focusSummary.topSharePct}% on ${session.focusSummary.topDomain}`
        : "No focus data";
      summary.textContent = `${session.autoLabel || "Mixed Focus"} • ${focusText}`;
      div.appendChild(summary);
    }

    const meta = document.createElement("div");
    meta.className = "session-meta";

    const time = document.createElement("span");
    time.className = "session-time";
    time.textContent = new Date(session.timestamp).toLocaleString();

    const tabsBadge = document.createElement("span");
    tabsBadge.className = "session-tabs";
    tabsBadge.textContent = `${session.tabs.length} tab${session.tabs.length !== 1 ? "s" : ""}`;

    meta.appendChild(time);
    meta.appendChild(tabsBadge);
    div.appendChild(meta);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.title = "Delete session";
    delBtn.textContent = "\u00d7";
    delBtn.addEventListener("click", async e => {
      e.stopPropagation();
      div.style.transition = "opacity 0.25s";
      div.style.opacity = "0";
      setTimeout(async () => {
        await deleteSession(session.id);
        loadSessions();
      }, 220);
    });
    div.appendChild(delBtn);

    const groupName = (session.tags && session.tags.length > 0)
      ? session.tags[0]
      : (session.autoLabel || session.note || "TabNotes Session");
    div.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        action: "expandGroup",
        groupId: session.groupId ?? null,
        urls: session.tabs,
        groupName
      });
    });
    sessionsDiv.appendChild(div);
  });
}

await initFeatureOptions();
await initTabPicker();
await loadSessions();

// ── Auto-Group Tabs ────────────────────────────────────────────────
const autoGroupBtn = document.getElementById("autoGroupBtn");
const undoGroupBtn = document.getElementById("undoGroupBtn");
let lastAutoGroupSnapshot = null;

autoGroupBtn.addEventListener("click", async () => {
  autoGroupBtn.disabled = true;
  autoGroupBtn.textContent = "⏳ Grouping...";

  const result = await chrome.runtime.sendMessage({ action: "autoGroup" }).catch(() => null);

  if (!result?.ok) {
    autoGroupBtn.textContent = "⚠ Couldn't group";
    setTimeout(() => {
      autoGroupBtn.textContent = "🧲 Auto-Group Tabs";
      autoGroupBtn.disabled = false;
    }, 2000);
    return;
  }

  lastAutoGroupSnapshot = result.snapshot;
  const groupCount = result.createdGroups?.length ?? 0;
  autoGroupBtn.textContent = `✓ Grouped (${groupCount} groups)`;
  undoGroupBtn.hidden = false;

  setTimeout(() => {
    autoGroupBtn.textContent = "🧲 Auto-Group Tabs";
    autoGroupBtn.disabled = false;
  }, 2500);
});

undoGroupBtn.addEventListener("click", async () => {
  if (!lastAutoGroupSnapshot) return;
  undoGroupBtn.disabled = true;
  undoGroupBtn.textContent = "⏳ Undoing...";

  await chrome.runtime.sendMessage({ action: "undoGroup", snapshot: lastAutoGroupSnapshot }).catch(() => null);

  lastAutoGroupSnapshot = null;
  undoGroupBtn.hidden = true;
  undoGroupBtn.disabled = false;
  undoGroupBtn.textContent = "↩ Undo";
});
