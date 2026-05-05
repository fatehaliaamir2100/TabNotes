const STORAGE_KEY = "tabnotes_sessions";
const FEATURE_OPTIONS_KEY = "tabnotes_feature_options";

const DEFAULT_FEATURE_OPTIONS = {
  showAutoGroupTabs: true,
  showSessionIntelligence: true
};

export async function saveSession(session) {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const sessions = data[STORAGE_KEY] || [];

  sessions.unshift(session);

  await chrome.storage.local.set({
    [STORAGE_KEY]: sessions
  });
}

export async function getSessions() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || [];
}

export async function deleteSession(id) {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const sessions = (data[STORAGE_KEY] || []).filter(s => s.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: sessions });
}

export async function getFeatureOptions() {
  const data = await chrome.storage.local.get([FEATURE_OPTIONS_KEY]);
  return {
    ...DEFAULT_FEATURE_OPTIONS,
    ...(data[FEATURE_OPTIONS_KEY] || {})
  };
}

export async function updateFeatureOption(key, value) {
  const current = await getFeatureOptions();
  const next = {
    ...current,
    [key]: Boolean(value)
  };
  await chrome.storage.local.set({ [FEATURE_OPTIONS_KEY]: next });
  return next;
}
