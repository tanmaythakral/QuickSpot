import { extractYoE, extractDegrees } from "./yoe_degree_extractor";

const DESCRIPTION_SELECTOR =
  '.jobs-description-content__text, .jobs-box__html-content, [aria-label*="description"]';

const TARGET_SELECTOR =
  ".job-details-jobs-unified-top-card__primary-description-container," +
  ' [class*="job-details-top-card__primary-description"]';

const BADGE_ID_HEADER = {
  yoe: "yoe-finder-display",
  deg: "deg-finder-display",
};

const COLORS = {
  light: {
    yoe: { bg: "#f2e8ff", fg: "#7b2cbf" },
    deg: { bg: "#ffe8f1", fg: "#ff3b81" },
  },
  dark: {
    yoe: { bg: "#413b54", fg: "#c7b1f4" },
    deg: { bg: "#5a3a46", fg: "#ffa0c5" },
  },
};

const theme = (): "light" | "dark" =>
  document.documentElement.classList.contains("theme--dark") ? "dark" : "light";

const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
};

let lastHash = "";

function upsertBadge(
  id: string,
  text: string | null,
  tooltip: string,
  host: HTMLElement | null,
  type: "yoe" | "deg"
) {
  if (!host || !text) {
    document.getElementById(id)?.remove();
    return;
  }

  const el =
    host.querySelector<HTMLSpanElement>(`#${id}`) ??
    document.getElementById(id) ??
    Object.assign(document.createElement("span"), { id });

  if (!el.parentElement) host.appendChild(el);

  const { fg, bg } = COLORS[theme()][type];
  el.textContent = text;
  el.title = tooltip;
  el.style.cssText = `
  display: inline-block;
  margin: 0 4px 4px 0;      
  padding: 3px 10px;        
  border-radius: 9999px;     
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  background: ${bg};
  color: ${fg};
  vertical-align: middle;
  white-space: nowrap;
  transition: background-color 0.3s ease, color 0.3s ease;
`;
}

function renderHeaderBadges(description: string) {
  const target = document.querySelector<HTMLElement>(TARGET_SELECTOR);
  if (!target) return;

  const y = extractYoE(description);
  upsertBadge(
    BADGE_ID_HEADER.yoe,
    y.status === "found"
      ? `YoE: ${y.value}${
          y.context === "required"
            ? " (Req.)"
            : y.context === "preferred"
            ? " (Pref.)"
            : ""
        }`
      : null,
    y.status === "found" ? `Detected Years of Experience: ${y.value}` : "",
    target,
    "yoe"
  );

  const d = extractDegrees(description);
  upsertBadge(
    BADGE_ID_HEADER.deg,
    d.status === "found"
      ? `Degree: ${d.values!.join(", ")}${d.equiv ? " (or equiv.)" : ""}`
      : null,
    d.status === "found"
      ? `Detected Degree Requirement${
          d.values!.length > 1 ? "s" : ""
        }: ${d.values!.join(", ")}`
      : "",
    target,
    "deg"
  );
}

function updateIfNeeded() {
  const el = document.querySelector<HTMLElement>(DESCRIPTION_SELECTOR);
  if (!el) return;
  const txt = el.innerText.trim();
  const hash = fnv(txt);
  if (hash !== lastHash) {
    lastHash = hash;
    renderHeaderBadges(txt);
  }
}

function onJobsPage() {
  return /^\/jobs\//.test(location.pathname);
}

const debounced = (() => {
  let t = 0;
  return () => {
    clearTimeout(t);
    t = window.setTimeout(run, 250);
  };
})();

function run() {
  if (!onJobsPage()) return;
  updateIfNeeded();
}

["popstate", "hashchange"].forEach((e) => addEventListener(e, debounced));
new MutationObserver(debounced).observe(document.body, {
  childList: true,
  subtree: true,
});

setTimeout(run, 1200);
