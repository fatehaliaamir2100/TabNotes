export async function getCurrentTabs() {
  return await chrome.tabs.query({ currentWindow: true, windowType: "normal" });
}

// Deterministically pick a group color from the name string
const GROUP_COLORS = ["purple", "cyan", "blue", "pink", "green", "orange", "red", "yellow"];
function pickColor(name) {
  const hash = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}

// Called on SAVE: takes real tab IDs and groups them immediately
export async function createTabGroup(tabIds, groupName) {
  if (!tabIds || tabIds.length === 0) return null;
  if (!chrome.tabs.group || !chrome.tabGroups) return null;

  try {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: (groupName || "TabNotes Session").slice(0, 32),
      color: pickColor(groupName)
    });
    return groupId;
  } catch (err) {
    console.warn("TabNotes: createTabGroup failed:", err.message);
    return null;
  }
}

// Called on RESTORE: expand existing group if still alive, else recreate tabs + regroup
export async function expandOrRestoreGroup(groupId, urls, groupName) {
  // Try to expand the saved group
  if (groupId != null) {
    try {
      const tabsInGroup = await chrome.tabs.query({ groupId });
      if (tabsInGroup.length > 0) {
        await chrome.tabGroups.update(groupId, { collapsed: false });
        await chrome.tabs.update(tabsInGroup[0].id, { active: true });
        await chrome.windows.update(tabsInGroup[0].windowId, { focused: true });
        return;
      }
    } catch (e) {
      // Group is gone (browser restarted), fall through to recreate
    }
  }

  // Fallback: tabs/group no longer exist — recreate them
  const validUrls = urls.filter(url => url && url.startsWith("http"));
  if (validUrls.length === 0) return;

  const targetWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (!targetWindow) return;

  const allTabs  = await chrome.tabs.query({});
  const urlToTab = new Map(allTabs.map(t => [t.url, t]));
  const tabIds   = [];

  for (const url of validUrls) {
    const existing = urlToTab.get(url);
    if (existing) {
      if (existing.windowId !== targetWindow.id) {
        const moved = await chrome.tabs.move(existing.id, { windowId: targetWindow.id, index: -1 });
        const movedId = Array.isArray(moved) ? moved[0].id : moved.id;
        tabIds.push(movedId);
      } else {
        tabIds.push(existing.id);
      }
    } else {
      const newTab = await chrome.tabs.create({ url, windowId: targetWindow.id });
      tabIds.push(newTab.id);
    }
  }

  await chrome.windows.update(targetWindow.id, { focused: true });
  await createTabGroup(tabIds, groupName);
}

// Auto-group all current window tabs by category using intelligence classifier
// Returns a snapshot for undo: array of { tabId, originalGroupId }
export async function autoGroupTabs(classifyFn) {
  if (!chrome.tabs.group || !chrome.tabGroups) return { ok: false, reason: "tabGroups API unavailable" };

  const targetWindow = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (!targetWindow) return { ok: false, reason: "No normal window found" };

  const tabs = await chrome.tabs.query({ windowId: targetWindow.id, windowType: "normal" });
  const httpTabs = tabs.filter(t => t.url && t.url.startsWith("http"));
  if (httpTabs.length === 0) return { ok: false, reason: "No HTTP tabs" };

  // Save snapshot before grouping for undo
  const snapshot = httpTabs.map(t => ({ tabId: t.id, originalGroupId: t.groupId }));

  // Bucket tabs by category
  const buckets = new Map();
  for (const tab of httpTabs) {
    const { category } = classifyFn(tab.url, tab.title || "");
    if (!buckets.has(category)) buckets.set(category, []);
    buckets.get(category).push(tab.id);
  }

  const CATEGORY_EMOJI = {
    coding: "💻 Coding",
    research: "🔬 Research",
    learning: "📚 Learning",
    shopping: "🛒 Shopping",
    docs: "📄 Docs",
    distraction: "🎮 Distraction",
    mixed: "🌐 Mixed"
  };

  const createdGroups = [];
  for (const [category, tabIds] of buckets.entries()) {
    if (tabIds.length < 2) continue; // Single tabs stay ungrouped
    try {
      const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId: targetWindow.id } });
      const label = CATEGORY_EMOJI[category] || category;
      await chrome.tabGroups.update(groupId, {
        title: label.slice(0, 32),
        color: pickColor(category)
      });
      createdGroups.push(groupId);
    } catch (err) {
      console.warn("TabNotes autoGroup error for", category, err.message);
    }
  }

  return { ok: true, snapshot, createdGroups };
}

// Undo auto-grouping: restore tabs to their previous group state
export async function undoAutoGroup(snapshot) {
  if (!snapshot || snapshot.length === 0) return;

  // Ungroup all tabs that are currently in a group (from auto-group)
  const tabIds = snapshot.map(s => s.tabId);
  try {
    await chrome.tabs.ungroup(tabIds);
  } catch (err) {
    console.warn("TabNotes undoAutoGroup ungroup error:", err.message);
  }

  // Re-apply original grouping for tabs that were already in groups
  const grouped = snapshot.filter(s => s.originalGroupId != null && s.originalGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE);
  const byOriginalGroup = new Map();
  for (const entry of grouped) {
    if (!byOriginalGroup.has(entry.originalGroupId)) byOriginalGroup.set(entry.originalGroupId, []);
    byOriginalGroup.get(entry.originalGroupId).push(entry.tabId);
  }

  for (const [, groupTabIds] of byOriginalGroup.entries()) {
    try {
      await chrome.tabs.group({ tabIds: groupTabIds });
    } catch (err) {
      console.warn("TabNotes undoAutoGroup re-group error:", err.message);
    }
  }
}
