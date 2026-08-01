function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function statusOf(ok, warn) { return ok ? "good" : warn ? "warn" : "bad"; }
function scoreWord(s) { return s >= 80 ? "Good" : s >= 50 ? "Needs work" : "Poor"; }

function checkRow(title, detail, status) {
  const tagLabel = status === "good" ? "Good" : status === "warn" ? "Fix soon" : "Issue";
  return `<div class="check-row">
    <span class="check-dot ${status}"></span>
    <div class="check-body">
      <div class="check-title">${esc(title)}</div>
      <div class="check-detail">${esc(detail)}</div>
    </div>
    <span class="check-tag ${status}">${tagLabel}</span>
  </div>`;
}

function section(title, sub, bodyHtml) {
  return `<div class="section">
    <h2 class="section-title">${esc(title)}</h2>
    ${sub ? `<p class="section-sub">${esc(sub)}</p>` : ""}
    ${bodyHtml}
  </div>`;
}

function statGrid(items) {
  return `<div class="stat-grid">${items.map(([n, l]) =>
    `<div class="stat-box"><span class="n">${esc(n)}</span><span class="l">${esc(l)}</span></div>`
  ).join("")}</div>`;
}

function dataTable(headers, rows) {
  if (rows.length === 0) return `<p class="empty-note">No data collected for this section.</p>`;
  return `<table class="data-table">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) =>
      `<td class="${i > 0 ? "num" : ""}">${c}</td>`
    ).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

function heroRingSvg(score) {
  const r = 46, c = 2 * Math.PI * r;
  const color = score >= 80 ? "#0E9F72" : score >= 50 ? "#B45309" : "#B91C1C";
  const offset = c - (score / 100) * c;
  return `<svg viewBox="0 0 108 108">
    <circle cx="54" cy="54" r="${r}" fill="none" stroke="#E2E8F0" stroke-width="10" />
    <circle cx="54" cy="54" r="${r}" fill="none" stroke="${color}" stroke-width="10"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}" />
  </svg>`;
}

function buildExecSummary(data, checks, score, host) {
  const bad = checks.filter((c) => !c.ok && !c.warn);
  const warn = checks.filter((c) => c.warn);
  const good = checks.filter((c) => c.ok);
  let verdict;
  if (score >= 80) verdict = "in strong shape";
  else if (score >= 50) verdict = "workable, with a handful of fixes worth prioritizing";
  else verdict = "carrying several issues search engines will notice";

  const topIssues = bad.slice(0, 3).map((c) => c.title.toLowerCase());
  const issueText = topIssues.length > 0
    ? ` The highest-priority items are <strong>${topIssues.join(", ")}</strong>.`
    : "";

  return `<strong>${esc(host)}</strong> scored <strong>${score}/100</strong> on this audit — ${verdict}.
    Out of ${checks.length} core checks, <strong>${good.length} passed</strong>,
    ${warn.length} need attention, and ${bad.length} are flagged as issues.${issueText}
    Full detail for every check is broken out by category below.`;
}

function buildReport(payload) {
  const { data, checks, score } = payload;
  let host = data.url;
  try { host = new URL(data.url).hostname; } catch (e) { /* keep raw */ }

  const generated = new Date(payload.generatedAt || Date.now());
  const dateStr = generated.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const overviewRows = checks.map((c) => checkRow(c.title, c.detail, statusOf(c.ok, c.warn))).join("");

  const onPageRows =
    checkRow("Title tag", `"${data.title || "Missing"}" — ${data.titleLength} characters (ideal: 30–60)`,
      statusOf(data.titleLength >= 30 && data.titleLength <= 60, data.titleLength > 0)) +
    checkRow("Meta description", `"${data.description || "Missing"}" — ${data.descriptionLength} characters (ideal: 70–160)`,
      statusOf(data.descriptionLength >= 70 && data.descriptionLength <= 160, data.descriptionLength > 0)) +
    checkRow("H1 tags", data.headings.h1.length ? data.headings.h1.join(" | ") : "None found",
      statusOf(data.headings.h1.length === 1, data.headings.h1.length > 1)) +
    checkRow("Heading breakdown", [2, 3, 4, 5, 6].map((n) => `H${n}: ${data.headings["h" + n].length}`).join("  ·  "), "good") +
    checkRow("Images", `${data.images.total} total, ${data.images.missingAlt} missing alt text`,
      statusOf(data.images.total === 0 || data.images.missingAlt === 0, data.images.missingAlt < data.images.total * 0.3));

  const technicalRows =
    checkRow("Protocol", data.protocol.replace(":", "").toUpperCase(), statusOf(data.protocol === "https:", false)) +
    checkRow("Canonical tag", data.canonical || "Not set", statusOf(!!data.canonical, false)) +
    checkRow("Robots meta", data.robotsMeta || "Not set (defaults to index, follow)", "good") +
    checkRow("Mobile viewport", data.viewport || "Not set", statusOf(!!data.viewport, false)) +
    checkRow("Structured data (JSON-LD)", data.structuredData.count > 0
      ? `${data.structuredData.count} block(s): ${data.structuredData.types.join(", ") || "unknown type"}`
      : "None found", statusOf(data.structuredData.count > 0, false)) +
    checkRow("Page load time", data.performance.loadMs !== null ? `${data.performance.loadMs} ms` : "Unavailable — measured from the popup, not this report", "good");

  const contentStats = statGrid([
    [data.keywords.wordCount, "Words"],
    [data.readability.score !== null ? data.readability.score : "—", "Readability"],
    [data.links.total, "Links"],
    [data.images.total, "Images"]
  ]);
  const readabilityRow = checkRow("Readability (Flesch reading ease)",
    data.readability.score !== null ? `${data.readability.score}/100 — ${data.readability.grade}` : "Not enough text on this page to score",
    data.readability.score === null ? "warn" : data.readability.score >= 40 ? "good" : "warn");
  const kwTable = dataTable(["Keyword", "Occurrences", "Density"],
    data.keywords.top.map((k) => [esc(k.word), `${k.count}×`, `${k.density}%`]));

  const linkStats = statGrid([
    [data.links.total, "Total links"],
    [data.links.internal, "Internal"],
    [data.links.external, "External"],
    [data.links.nofollow, "Nofollow"]
  ]);
  const socialRows =
    checkRow("og:title", data.social.ogTitle || "Missing", statusOf(!!data.social.ogTitle, false)) +
    checkRow("og:description", data.social.ogDescription || "Missing", statusOf(!!data.social.ogDescription, false)) +
    checkRow("og:image", data.social.ogImage || "Missing", statusOf(!!data.social.ogImage, false)) +
    checkRow("twitter:card", data.social.twitterCard || "Missing", statusOf(!!data.social.twitterCard, false));

  let optional = "";

  if (payload.focusKeyword) {
    const rows = payload.focusKeyword.checks.map((c) => checkRow(c.title, c.detail, statusOf(c.ok, c.warn))).join("");
    optional += section(`Focus keyword check — "${payload.focusKeyword.keyword}"`, null, rows);
  }

  if (payload.brokenLinks) {
    const b = payload.brokenLinks;
    const rows = b.broken.length === 0
      ? checkRow("Result", `Checked ${b.checkedCount} links on this page — none broken`, "good")
      : dataTable(["Broken URL", "Status"], b.broken.map((x) => [esc(x.url), String(x.status)]));
    optional += section("Broken link scan", `${b.checkedCount} links checked on this page`, rows);
  }

  if (payload.robotsSitemap) {
    const r = payload.robotsSitemap;
    const rows = checkRow("/robots.txt", r.robots.detail, r.robots.found ? "good" : "warn") +
      checkRow("/sitemap.xml", r.sitemap.detail, r.sitemap.found ? "good" : "warn");
    optional += section("robots.txt & sitemap.xml", null, rows);
  }

  if (payload.siteCrawl) {
    const r = payload.siteCrawl;
    const rows = dataTable(["Page", "Score"], r.pages.map((p) => {
      let path; try { path = new URL(p.url).pathname || "/"; } catch (e) { path = p.url; }
      const label = p.ok ? String(p.score) : (p.status === "error" ? "Failed" : String(p.status));
      return [esc(path), label];
    }));
    optional += section(`Quick site scan — ${r.pages.length} pages`,
      `Average health score ${r.avgScore}/100 · ${r.failedCount} page(s) need attention`,
      statGrid([[r.pages.length, "Scanned"], [r.avgScore, "Avg score"], [r.failedCount, "Flagged"]]) + rows);
  }

  return `
    <div class="cover">
      <div class="cover-brand">
        <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#E2E8F0" stroke-width="3" fill="none"/><path d="M12 3 A9 9 0 0 1 20 16.8" stroke="#0E9F72" stroke-width="3" fill="none" stroke-linecap="round"/></svg>
        <span class="cover-brand-name">Scanora</span>
      </div>
      <div class="cover-meta">
        <div class="doc-title">SEO audit report</div>
        <div class="doc-date">${esc(host)} · Generated ${dateStr}</div>
      </div>
    </div>

    <div class="hero">
      <div class="hero-ring-wrap">
        ${heroRingSvg(score)}
        <div class="hero-ring-center">
          <span class="hero-score">${score}</span>
          <span class="hero-score-label">/ 100</span>
        </div>
      </div>
      <div class="hero-info">
        <div class="hero-url">${esc(data.url)}</div>
        <div class="hero-verdict">Overall health: <strong>${scoreWord(score)}</strong>. This audit covers on-page tags, technical setup, content, and links — captured directly from the live page in your browser.</div>
      </div>
    </div>

    ${section("Executive summary", null, `<div class="exec-summary">${buildExecSummary(data, checks, score, host)}</div>`)}
    ${section("Overview checklist", `${checks.length} core SEO checks`, overviewRows)}
    ${section("On-page SEO", null, onPageRows)}
    ${section("Technical SEO", null, technicalRows)}
    ${section("Content", null, contentStats + readabilityRow)}
    ${section("Top keywords in body text", "By frequency, stopwords excluded", kwTable)}
    ${section("Link profile", null, linkStats)}
    ${section("Social tags", "Open Graph & Twitter Card", socialRows)}
    ${optional}

    <div class="report-footer">
      <span>This report reflects only what's present in the page's HTML at scan time. It does not include backlink counts, keyword search volume, competitor rankings, or Google Search Console data — those live inside paid third-party indexes, not the page itself, so no tool can pull them for free.</span>
      <span>Generated with Scanora</span>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("reportRoot");
  try {
    const stored = await chrome.storage.local.get("scanora_report_payload");
    const payload = stored.scanora_report_payload;
    if (!payload) {
      root.innerHTML = `<p class="loading-note">No scan data found. Open the Scanora popup, scan a page, then click Export again.</p>`;
      return;
    }
    root.innerHTML = buildReport(payload);
  } catch (err) {
    root.innerHTML = `<p class="loading-note">Couldn't load the report data. Try exporting again from the Scanora popup.</p>`;
  }

  document.getElementById("printBtn").addEventListener("click", () => window.print());
});
