const DOMAIN_BUCKETS = {
  coding: [
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "stackoverflow.com",
    "vercel.com",
    "netlify.com",
    "npmjs.com",
    "developer.mozilla.org",
    "docs."
  ],
  research: [
    "scholar.google.com",
    "wikipedia.org",
    "arxiv.org",
    "medium.com",
    "substack.com"
  ],
  learning: [
    "youtube.com",
    "coursera.org",
    "udemy.com",
    "freecodecamp.org",
    "frontendmasters.com"
  ],
  shopping: [
    "amazon.",
    "ebay.",
    "etsy.com",
    "shopify.com",
    "aliexpress.com"
  ],
  docs: [
    "docs.",
    "readthedocs.io",
    "developer.",
    "reference"
  ],
  distraction: [
    "twitter.com",
    "x.com",
    "reddit.com",
    "instagram.com",
    "facebook.com",
    "tiktok.com"
  ]
};

const CATEGORY_LABELS = {
  coding: "Coding",
  research: "Research",
  learning: "Learning",
  shopping: "Shopping",
  docs: "Docs",
  distraction: "Distraction-heavy",
  mixed: "Mixed Focus"
};

function safeHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function matchesPattern(hostname, pattern) {
  return hostname === pattern || hostname.endsWith(`.${pattern}`) || hostname.includes(pattern);
}

export function classifyUrl(url = "", title = "") {
  const hostname = safeHostname(url);
  const normalizedTitle = title.toLowerCase();

  for (const [category, patterns] of Object.entries(DOMAIN_BUCKETS)) {
    if (patterns.some(pattern => matchesPattern(hostname, pattern))) {
      return { category, hostname };
    }
  }

  if (normalizedTitle.includes("docs") || normalizedTitle.includes("reference")) {
    return { category: "docs", hostname };
  }

  return { category: "mixed", hostname };
}

export function analyzeTabs(tabs = []) {
  const counts = new Map();
  const domains = new Map();
  const classifiedTabs = tabs.map(tab => {
    const { category, hostname } = classifyUrl(tab.url, tab.title);
    counts.set(category, (counts.get(category) || 0) + 1);
    if (hostname) {
      domains.set(hostname, (domains.get(hostname) || 0) + 1);
    }
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title || tab.url,
      category,
      hostname
    };
  });

  const sortedCounts = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const primaryCategory = sortedCounts[0]?.[0] || "mixed";
  const totalTabs = tabs.length || 1;
  const distractionRatio = (counts.get("distraction") || 0) / totalTabs;

  let sessionLabel = CATEGORY_LABELS[primaryCategory] || CATEGORY_LABELS.mixed;
  if (distractionRatio >= 0.4) {
    sessionLabel = "Distraction-heavy Session";
  } else if ((counts.get("coding") || 0) > 0 && (counts.get("docs") || 0) > 0) {
    sessionLabel = "Coding Sprint";
  } else if ((counts.get("research") || 0) > 0 && (counts.get("learning") || 0) > 0) {
    sessionLabel = "Learning Session";
  }

  const suggestedTags = [primaryCategory]
    .concat(distractionRatio >= 0.4 ? ["distraction"] : [])
    .concat((counts.get("docs") || 0) > 0 ? ["docs"] : [])
    .filter(Boolean);

  const topDomains = [...domains.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([domain, count]) => ({ domain, count }));

  return {
    classifiedTabs,
    sessionLabel,
    primaryCategory,
    suggestedTags: [...new Set(suggestedTags)],
    topDomains,
    totalTabs,
    distractionRatio,
    clusterBreakdown: sortedCounts.map(([category, count]) => ({
      category,
      count,
      label: CATEGORY_LABELS[category] || CATEGORY_LABELS.mixed
    }))
  };
}

export function summarizeFocusMetrics(urls = [], focusMetrics = {}) {
  const byUrl = focusMetrics.byUrl || {};
  const selectedMetrics = urls
    .map(url => byUrl[url])
    .filter(Boolean);

  const totalMs = selectedMetrics.reduce((sum, item) => sum + (item.ms || 0), 0);
  if (selectedMetrics.length === 0 || totalMs <= 0) {
    return {
      topDomain: null,
      topSharePct: 0,
      ignoredDomains: []
    };
  }

  const byDomain = new Map();
  selectedMetrics.forEach(item => {
    const domain = item.hostname || safeHostname(item.url);
    if (!domain) return;
    byDomain.set(domain, (byDomain.get(domain) || 0) + (item.ms || 0));
  });

  const sorted = [...byDomain.entries()].sort((left, right) => right[1] - left[1]);
  const [topDomain, topMs] = sorted[0] || [null, 0];
  const ignoredDomains = sorted
    .filter(([, ms]) => ms / totalMs < 0.1)
    .slice(0, 3)
    .map(([domain]) => domain);

  return {
    topDomain,
    topSharePct: Math.round((topMs / totalMs) * 100),
    ignoredDomains
  };
}
