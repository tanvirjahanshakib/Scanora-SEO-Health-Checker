const RING_CIRCUMFERENCE = 2 * Math.PI * 52;
let currentData = null;

function statusClass(ok, warnOk) {
  if (ok) return "good";
  if (warnOk) return "warn";
  return "bad";
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function esc(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setRing(score) {
  const circle = document.getElementById("ringProgress");
  const offset = RING_CIRCUMFERENCE - (score / 100) * RING_CIRCUMFERENCE;
  circle.style.strokeDashoffset = offset;
  circle.style.stroke = score >= 80 ? "#00D9A3" : score >= 50 ? "#FFB020" : "#FF5C5C";
  document.getElementById("scoreValue").textContent = score;
}

/* ---------------- Core checks & score (shared by live scan + compare) ---------------- */

function buildChecks(data) {
  const checks = [];

  checks.push({
    title: "Title tag",
    ok: data.titleLength >= 30 && data.titleLength <= 60,
    warn: data.titleLength > 0,
    detail: data.title ? `${data.titleLength} characters — ideal range is 30–60` : "Missing a <title> tag"
  });

  checks.push({
    title: "Meta description",
    ok: data.descriptionLength >= 70 && data.descriptionLength <= 160,
    warn: data.descriptionLength > 0,
    detail: data.description ? `${data.descriptionLength} characters — ideal range is 70–160` : "Missing a meta description"
  });

  const h1Count = data.headings.h1.length;
  checks.push({
    title: "Single H1",
    ok: h1Count === 1,
    warn: h1Count > 1,
    detail: h1Count === 0 ? "No H1 found" : h1Count === 1 ? "Exactly one H1 — good" : `${h1Count} H1 tags found — use only one`
  });

  const altOk = data.images.total === 0 || data.images.missingAlt === 0;
  checks.push({
    title: "Image alt text",
    ok: altOk,
    warn: data.images.missingAlt < data.images.total * 0.3,
    detail: data.images.total === 0 ? "No images on this page" : `${data.images.missingAlt} of ${data.images.total} images missing alt text`
  });

  checks.push({
    title: "Canonical tag",
    ok: !!data.canonical,
    warn: false,
    detail: data.canonical ? "Canonical URL is set" : "No canonical tag found"
  });

  checks.push({
    title: "HTTPS",
    ok: data.protocol === "https:",
    warn: false,
    detail: data.protocol === "https:" ? "Page is served securely" : "Page is not using HTTPS"
  });

  checks.push({
    title: "Mobile viewport",
    ok: !!data.viewport,
    warn: false,
    detail: data.viewport ? "Viewport meta tag present" : "No viewport meta tag — may not be mobile-friendly"
  });

  checks.push({
    title: "Structured data",
    ok: data.structuredData.count > 0,
    warn: false,
    detail: data.structuredData.count > 0
      ? `${data.structuredData.count} JSON-LD block(s): ${data.structuredData.types.join(", ") || "types unknown"}`
      : "No schema.org structured data found"
  });

  checks.push({
    title: "Readability",
    ok: data.readability.score !== null && data.readability.score >= 50,
    warn: data.readability.score !== null && data.readability.score >= 30,
    detail: data.readability.score !== null ? `${data.readability.grade} (score ${data.readability.score})` : "Not enough text to measure"
  });

  return checks;
}

function computeScore(checks) {
  const weight = 100 / checks.length;
  let score = 0;
  checks.forEach((c) => {
    if (c.ok) score += weight;
    else if (c.warn) score += weight * 0.5;
  });
  return Math.round(score);
}

function badge(ok, warn) {
  const cls = statusClass(ok, warn);
  const label = ok ? "Good" : warn ? "Fix soon" : "Issue";
  return `<span class="status-badge ${cls}">${label}</span>`;
}

/* ---------------- Overview ---------------- */

function renderOverview(checks) {
  const wrap = document.getElementById("overviewChecklist");
  wrap.innerHTML = "";
  checks.forEach((c) => {
    const cls = statusClass(c.ok, c.warn);
    const item = el("div", "check-item");
    item.appendChild(el("div", `check-dot ${cls}`));
    const textWrap = el("div", "check-text");
    textWrap.appendChild(el("div", "check-title", esc(c.title)));
    textWrap.appendChild(el("div", "check-detail", esc(c.detail)));
    item.appendChild(textWrap);
    wrap.appendChild(item);
  });
}

function renderChips(data) {
  const row = document.getElementById("chipRow");
  row.innerHTML = "";
  const words = data.keywords.wordCount;
  const links = data.links.total;
  const imgs = data.images.total;
  [
    { label: `${words} words`, cls: words >= 300 ? "good" : "warn" },
    { label: `${links} links`, cls: "good" },
    { label: `${imgs} images`, cls: "good" }
  ].forEach((c) => row.appendChild(el("span", `chip ${c.cls}`, c.label)));
}

/* ---------------- On-Page (incl. SERP preview) ---------------- */

function renderSerpPreview(data) {
  let host = "example.com";
  try { host = new URL(data.url).hostname; } catch (e) { /* keep default */ }
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
  const displayTitle = data.title || "Untitled page";
  const displayDesc = data.description || "No meta description — Google will auto-generate a snippet from page content.";

  document.getElementById("serpPreview").innerHTML = `
    <div class="serp-favicon-row">
      <img src="${favicon}" alt="" />
      <div>
        <div class="serp-site">${esc(host)}</div>
        <div class="serp-url">${esc(data.url.length > 60 ? data.url.slice(0, 57) + "…" : data.url)}</div>
      </div>
    </div>
    <div class="serp-title">${esc(displayTitle.slice(0, 65))}${displayTitle.length > 65 ? "…" : ""}</div>
    <div class="serp-desc">${esc(displayDesc.slice(0, 155))}${displayDesc.length > 155 ? "…" : ""}</div>`;
}

function renderOnPage(data) {
  renderSerpPreview(data);

  document.getElementById("titleCard").innerHTML = `
    <h3>Title tag ${badge(data.titleLength >= 30 && data.titleLength <= 60, data.titleLength > 0)}</h3>
    <div class="snippet">${data.title ? esc(data.title) : "<em>No title found</em>"}</div>
    <div class="row"><span>Length</span><span class="value">${data.titleLength} chars</span></div>`;

  document.getElementById("descCard").innerHTML = `
    <h3>Meta description ${badge(data.descriptionLength >= 70 && data.descriptionLength <= 160, data.descriptionLength > 0)}</h3>
    <div class="snippet">${data.description ? esc(data.description) : "<em>No meta description found</em>"}</div>
    <div class="row"><span>Length</span><span class="value">${data.descriptionLength} chars</span></div>`;

  const h = data.headings;
  const headingRows = [1, 2, 3, 4, 5, 6].map((n) =>
    `<div class="row"><span>H${n}</span><span class="value">${h["h" + n].length}</span></div>`
  ).join("");
  document.getElementById("headingCard").innerHTML = `
    <h3>Heading structure ${badge(h.h1.length === 1, h.h1.length > 1)}</h3>
    ${headingRows}`;

  document.getElementById("imageCard").innerHTML = `
    <h3>Images ${badge(data.images.total === 0 || data.images.missingAlt === 0, data.images.missingAlt < data.images.total * 0.3)}</h3>
    <div class="row"><span>Total images</span><span class="value">${data.images.total}</span></div>
    <div class="row"><span>Missing alt text</span><span class="value">${data.images.missingAlt}</span></div>`;
}

/* ---------------- Technical ---------------- */

function renderTechnical(data) {
  document.getElementById("canonicalCard").innerHTML = `
    <h3>Canonical tag ${badge(!!data.canonical, false)}</h3>
    <div class="snippet">${data.canonical ? esc(data.canonical) : "<em>Not set</em>"}</div>`;

  document.getElementById("robotsCard").innerHTML = `
    <h3>Robots meta ${badge(true, false)}</h3>
    <div class="snippet">${esc(data.robotsMeta) || "Not set (defaults to index, follow)"}</div>`;

  document.getElementById("viewportCard").innerHTML = `
    <h3>Mobile viewport ${badge(!!data.viewport, false)}</h3>
    <div class="snippet">${data.viewport ? esc(data.viewport) : "<em>No viewport tag</em>"}</div>`;

  document.getElementById("httpsCard").innerHTML = `
    <h3>HTTPS ${badge(data.protocol === "https:", false)}</h3>
    <div class="row"><span>Protocol</span><span class="value">${data.protocol.replace(":", "")}</span></div>`;

  document.getElementById("schemaCard").innerHTML = `
    <h3>Structured data ${badge(data.structuredData.count > 0, false)}</h3>
    <div class="row"><span>JSON-LD blocks</span><span class="value">${data.structuredData.count}</span></div>
    <div class="snippet">${esc(data.structuredData.types.join(", ")) || "None detected"}</div>`;

  const loadMs = data.performance.loadMs;
  document.getElementById("perfCard").innerHTML = `
    <h3>Page load ${badge(loadMs !== null && loadMs < 3000, loadMs !== null && loadMs < 6000)}</h3>
    <div class="row"><span>Load time</span><span class="value">${loadMs !== null ? loadMs + " ms" : "Unavailable"}</span></div>`;
}

/* ---------------- Content (incl. readability) ---------------- */

function renderReadability(data) {
  const r = data.readability;
  const card = document.getElementById("readabilityCard");
  if (r.score === null) {
    card.innerHTML = `<h3>Readability</h3><p class="muted-note">Not enough visible text on this page to measure.</p>`;
    return;
  }
  card.innerHTML = `
    <h3>Readability ${badge(r.score >= 50, r.score >= 30)}</h3>
    <div class="row"><span>${esc(r.grade)}</span><span class="value">${r.score}/100</span></div>
    <div class="readability-scale"><div class="readability-marker" style="left:${r.score}%"></div></div>
    <div class="row"><span>Sentences analyzed</span><span class="value">${r.sentences}</span></div>`;
}

function renderContent(data) {
  document.getElementById("wordCountCard").innerHTML = `
    <h3>Word count ${badge(data.keywords.wordCount >= 300, data.keywords.wordCount >= 150)}</h3>
    <div class="row"><span>Visible text</span><span class="value">${data.keywords.wordCount} words</span></div>`;

  renderReadability(data);

  const tbody = document.getElementById("kwTable");
  tbody.innerHTML = data.keywords.top.map((k) =>
    `<tr><td>${esc(k.word)}</td><td>${k.count}×</td><td>${k.density}%</td></tr>`
  ).join("") || "<tr><td colspan='3'>No significant keywords found</td></tr>";
}

/* ---------------- Links ---------------- */

function renderLinks(data) {
  const l = data.links;
  document.getElementById("linkSummaryCard").innerHTML = `
    <h3>Link profile ${badge(true, false)}</h3>
    <div class="row"><span>Total links</span><span class="value">${l.total}</span></div>
    <div class="row"><span>Internal</span><span class="value">${l.internal}</span></div>
    <div class="row"><span>External</span><span class="value">${l.external}</span></div>
    <div class="row"><span>Nofollow</span><span class="value">${l.nofollow}</span></div>
    <div class="row"><span>Empty anchor text</span><span class="value">${l.noAnchorText}</span></div>`;

  const s = data.social;
  document.getElementById("socialCard").innerHTML = `
    <h3>Social tags ${badge(!!s.ogTitle && !!s.ogImage, !!s.ogTitle)}</h3>
    <div class="row"><span>og:title</span><span class="value">${s.ogTitle ? "Set" : "Missing"}</span></div>
    <div class="row"><span>og:description</span><span class="value">${s.ogDescription ? "Set" : "Missing"}</span></div>
    <div class="row"><span>og:image</span><span class="value">${s.ogImage ? "Set" : "Missing"}</span></div>
    <div class="row"><span>twitter:card</span><span class="value">${s.twitterCard ? "Set" : "Missing"}</span></div>`;

  document.getElementById("brokenLinksResults").innerHTML = "";
}

async function fetchWithTimeout(url, opts, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkOneLink(url) {
  try {
    let res = await fetchWithTimeout(url, { method: "HEAD" }, 6000);
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(url, { method: "GET" }, 6000);
    }
    return { url, status: res.status };
  } catch (err) {
    return { url, status: "error" };
  }
}

async function runBrokenLinkScan() {
  if (!currentData) return;
  const btn = document.getElementById("checkBrokenBtn");
  const resultsEl = document.getElementById("brokenLinksResults");
  const candidates = currentData.links.list.slice(0, 25);
  if (candidates.length === 0) {
    resultsEl.innerHTML = `<p class="scan-progress">No links found to check.</p>`;
    return;
  }
  btn.disabled = true;
  btn.textContent = `Checking ${candidates.length} links…`;
  resultsEl.innerHTML = "";

  const settled = await Promise.allSettled(candidates.map((l) => checkOneLink(l.href)));
  const results = settled.map((r) => (r.status === "fulfilled" ? r.value : { url: "", status: "error" }));
  const broken = results.filter((r) => r.status === "error" || (typeof r.status === "number" && r.status >= 400));

  btn.disabled = false;
  btn.textContent = "Scan links for errors";

  if (broken.length === 0) {
    resultsEl.innerHTML = `<div class="broken-summary">Checked ${results.length} links — none came back broken. ✅</div>`;
  } else {
    const rows = broken.map((r) =>
      `<div class="broken-row"><span class="url">${esc(r.url)}</span><span class="status" style="color:var(--bad)">${r.status === "error" ? "Failed" : r.status}</span></div>`
    ).join("");
    resultsEl.innerHTML = rows + `<div class="broken-summary">Checked ${results.length} links — ${broken.length} broken or unreachable.</div>`;
  }
}

/* ---------------- Focus keyword checker ---------------- */

function runFocusKeywordCheck() {
  if (!currentData) return;
  const kw = document.getElementById("focusKeywordInput").value.trim().toLowerCase();
  const resultsEl = document.getElementById("focusKeywordResults");
  if (!kw) {
    resultsEl.innerHTML = `<p class="muted-note">Type a target keyword or phrase above, then hit Check.</p>`;
    return;
  }

  const data = currentData;
  const title = (data.title || "").toLowerCase();
  const desc = (data.description || "").toLowerCase();
  const h1s = data.headings.h1.join(" ").toLowerCase();
  const bodyText = (data.bodyTextSample || "").toLowerCase();
  const firstWords = bodyText.split(/\s+/).slice(0, 100).join(" ");
  const urlLower = data.url.toLowerCase();
  const altTexts = (data.images.altTexts || []).join(" ").toLowerCase();

  const occurrences = bodyText.split(kw).length - 1;
  const totalWords = data.keywords.wordCount || 1;
  const density = +((occurrences / totalWords) * 100).toFixed(2);

  const checks = [
    { title: "In title tag", ok: title.includes(kw), warn: false, detail: title.includes(kw) ? "Found in title" : "Not found in title" },
    { title: "In meta description", ok: desc.includes(kw), warn: false, detail: desc.includes(kw) ? "Found in description" : "Not found in description" },
    { title: "In an H1", ok: h1s.includes(kw), warn: false, detail: h1s.includes(kw) ? "Found in an H1" : "Not found in any H1" },
    { title: "In URL", ok: urlLower.includes(kw.replace(/\s+/g, "-")) || urlLower.includes(kw.replace(/\s+/g, "")), warn: false, detail: "Checks for a hyphenated or joined version of the phrase in the URL" },
    { title: "In first 100 words", ok: firstWords.includes(kw), warn: false, detail: firstWords.includes(kw) ? "Appears early in the content" : "Doesn't appear early — search engines weight this" },
    { title: "In an image alt text", ok: altTexts.includes(kw), warn: data.images.total === 0, detail: data.images.total === 0 ? "No images on this page" : altTexts.includes(kw) ? "Found in alt text" : "Not found in any alt text" },
    { title: "Keyword density", ok: density >= 0.5 && density <= 2.5, warn: density > 0 && density < 0.5, detail: `${density}% (${occurrences}× in body text) — ideal is roughly 0.5–2.5%` }
  ];

  const wrap = resultsEl;
  wrap.innerHTML = "";
  wrap.className = "checklist";
  checks.forEach((c) => {
    const cls = statusClass(c.ok, c.warn);
    const item = el("div", "check-item");
    item.appendChild(el("div", `check-dot ${cls}`));
    const textWrap = el("div", "check-text");
    textWrap.appendChild(el("div", "check-title", esc(c.title)));
    textWrap.appendChild(el("div", "check-detail", esc(c.detail)));
    item.appendChild(textWrap);
    wrap.appendChild(item);
  });
}

/* ---------------- Compare mode ---------------- */

function metricRow(label, mine, theirs, higherIsBetter) {
  const mineWins = higherIsBetter ? mine >= theirs : mine <= theirs;
  return `<tr>
    <td>${esc(label)}</td>
    <td class="${mineWins ? "win" : "lose"}">${mine}</td>
    <td class="${!mineWins ? "win" : "lose"}">${theirs}</td>
  </tr>`;
}

async function runCompare() {
  if (!currentData) return;
  const urlInput = document.getElementById("compareUrlInput");
  const resultsEl = document.getElementById("compareResults");
  const btn = document.getElementById("compareBtn");
  let targetUrl = urlInput.value.trim();
  if (!targetUrl) return;
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = "https://" + targetUrl;

  btn.disabled = true;
  btn.textContent = "Fetching…";
  resultsEl.innerHTML = "";

  try {
    const res = await fetchWithTimeout(targetUrl, { method: "GET" }, 10000);
    const html = await res.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const otherData = window.ScanoraAnalyzer.analyze(parsed, targetUrl);
    otherData.performance = { loadMs: null };

    const myChecks = buildChecks(currentData);
    const otherChecks = buildChecks(otherData);
    const myScore = computeScore(myChecks);
    const otherScore = computeScore(otherChecks);

    resultsEl.innerHTML = `
      <table class="compare-table">
        <tr><th>Metric</th><th>This page</th><th>Compared page</th></tr>
        ${metricRow("Health score", myScore, otherScore, true)}
        ${metricRow("Title length", currentData.titleLength, otherData.titleLength, false)}
        ${metricRow("Word count", currentData.keywords.wordCount, otherData.keywords.wordCount, true)}
        ${metricRow("Total links", currentData.links.total, otherData.links.total, true)}
        ${metricRow("Images missing alt", currentData.images.missingAlt, otherData.images.missingAlt, false)}
        ${metricRow("Readability", currentData.readability.score ?? 0, otherData.readability.score ?? 0, true)}
      </table>`;
  } catch (err) {
    resultsEl.innerHTML = `<p class="muted-note">Couldn't fetch that URL directly (the site may block cross-origin requests). Try a different page.</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Compare";
  }
}

/* ---------------- robots.txt / sitemap.xml check ---------------- */

async function runRobotsSitemapCheck() {
  if (!currentData) return;
  const btn = document.getElementById("checkRobotsSitemapBtn");
  const resultsEl = document.getElementById("robotsSitemapResults");
  let origin;
  try { origin = new URL(currentData.url).origin; } catch (e) {
    resultsEl.innerHTML = `<p class="muted-note">Couldn't work out the site's domain.</p>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Checking…";
  resultsEl.innerHTML = "";

  const [robotsRes, sitemapRes] = await Promise.allSettled([
    fetchWithTimeout(origin + "/robots.txt", { method: "GET" }, 7000),
    fetchWithTimeout(origin + "/sitemap.xml", { method: "GET" }, 7000)
  ]);

  let robotsHtml, sitemapHtml;

  if (robotsRes.status === "fulfilled" && robotsRes.value.ok) {
    const body = await robotsRes.value.text();
    const hasSitemapLine = /sitemap:/i.test(body);
    const hasDisallowAll = /disallow:\s*\/\s*$/im.test(body);
    robotsHtml = `
      <div class="file-check-row">
        <div><div class="file-name">/robots.txt</div>
        <div class="file-detail">${body.length} bytes${hasSitemapLine ? " · lists a sitemap" : " · no sitemap listed"}${hasDisallowAll ? " · ⚠ blocks all crawlers" : ""}</div></div>
        <span class="status-badge ${hasDisallowAll ? "bad" : "good"}">${hasDisallowAll ? "Blocks all" : "Found"}</span>
      </div>`;
  } else {
    robotsHtml = `
      <div class="file-check-row">
        <div><div class="file-name">/robots.txt</div><div class="file-detail">Not found at the root — search engines default to crawling everything</div></div>
        <span class="status-badge warn">Missing</span>
      </div>`;
  }

  if (sitemapRes.status === "fulfilled" && sitemapRes.value.ok) {
    const body = await sitemapRes.value.text();
    const urlCount = (body.match(/<loc>/gi) || []).length;
    sitemapHtml = `
      <div class="file-check-row">
        <div><div class="file-name">/sitemap.xml</div><div class="file-detail">${urlCount > 0 ? `${urlCount} URL(s) listed` : "Found, but no <loc> entries detected"}</div></div>
        <span class="status-badge good">Found</span>
      </div>`;
  } else {
    sitemapHtml = `
      <div class="file-check-row">
        <div><div class="file-name">/sitemap.xml</div><div class="file-detail">Not found at the default path — it may be named differently or listed in robots.txt</div></div>
        <span class="status-badge warn">Missing</span>
      </div>`;
  }

  resultsEl.innerHTML = robotsHtml + sitemapHtml;
  btn.disabled = false;
  btn.textContent = "Check robots.txt & sitemap";
}

/* ---------------- Bounded quick site crawl (max 20 pages) ---------------- */

const CRAWL_LIMIT = 20;
const CRAWL_DELAY_MS = 400;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function runSiteCrawl() {
  if (!currentData) return;
  const btn = document.getElementById("startCrawlBtn");
  const progressWrap = document.getElementById("crawlProgress");
  const progressFill = document.getElementById("crawlProgressFill");
  const progressLabel = document.getElementById("crawlProgressLabel");
  const resultsEl = document.getElementById("crawlResults");

  let origin;
  try { origin = new URL(currentData.url).origin; } catch (e) {
    resultsEl.innerHTML = `<p class="muted-note">Couldn't work out the site's domain.</p>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Scanning…";
  progressWrap.style.display = "block";
  resultsEl.innerHTML = "";
  progressFill.style.width = "0%";
  progressLabel.textContent = `Scanning 0 / ${CRAWL_LIMIT}…`;

  const visited = new Set();
  const queue = [currentData.url];
  const pageResults = [];

  while (queue.length > 0 && visited.size < CRAWL_LIMIT) {
    const url = queue.shift();
    const clean = url.split("#")[0];
    if (visited.has(clean)) continue;
    visited.add(clean);

    progressLabel.textContent = `Scanning ${visited.size} / ${CRAWL_LIMIT}… (${clean.replace(origin, "")})`;
    progressFill.style.width = Math.round((visited.size / CRAWL_LIMIT) * 100) + "%";

    try {
      const res = await fetchWithTimeout(clean, { method: "GET" }, 8000);
      if (!res.ok) {
        pageResults.push({ url: clean, ok: false, status: res.status });
      } else {
        const html = await res.text();
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const pageData = window.ScanoraAnalyzer.analyze(parsed, clean);
        const checks = buildChecks(pageData);
        const score = computeScore(checks);
        pageResults.push({ url: clean, ok: true, score, titleLength: pageData.titleLength, h1Count: pageData.headings.h1.length });

        if (visited.size < CRAWL_LIMIT) {
          Array.from(parsed.querySelectorAll("a[href]")).forEach((a) => {
            try {
              const href = new URL(a.getAttribute("href"), clean);
              const hrefClean = href.href.split("#")[0];
              if (href.origin === origin && !visited.has(hrefClean) && !queue.includes(hrefClean)) {
                queue.push(hrefClean);
              }
            } catch (e) { /* skip malformed links */ }
          });
        }
      }
    } catch (err) {
      pageResults.push({ url: clean, ok: false, status: "error" });
    }

    await sleep(CRAWL_DELAY_MS);
  }

  progressWrap.style.display = "none";
  btn.disabled = false;
  btn.textContent = "Scan this site";

  const ok = pageResults.filter((p) => p.ok);
  const failed = pageResults.filter((p) => !p.ok);
  const avgScore = ok.length ? Math.round(ok.reduce((s, p) => s + p.score, 0) / ok.length) : 0;
  const lowScoring = ok.filter((p) => p.score < 60).length;

  const summaryHtml = `
    <div class="crawl-summary-grid">
      <div class="crawl-stat"><span class="n">${pageResults.length}</span><span class="l">Pages scanned</span></div>
      <div class="crawl-stat"><span class="n">${avgScore}</span><span class="l">Avg health score</span></div>
      <div class="crawl-stat"><span class="n">${failed.length + lowScoring}</span><span class="l">Need attention</span></div>
    </div>`;

  const rows = pageResults.map((p) => {
    let dotClass, scoreLabel;
    if (!p.ok) { dotClass = "bad"; scoreLabel = p.status === "error" ? "Failed" : p.status; }
    else if (p.score >= 80) { dotClass = "good"; scoreLabel = p.score; }
    else if (p.score >= 60) { dotClass = "warn"; scoreLabel = p.score; }
    else { dotClass = "bad"; scoreLabel = p.score; }
    let path;
    try { path = new URL(p.url).pathname || "/"; } catch (e) { path = p.url; }
    return `<div class="crawl-row"><span class="dot ${dotClass}"></span><span class="path" title="${esc(p.url)}">${esc(path)}</span><span class="score">${scoreLabel}</span></div>`;
  }).join("");

  resultsEl.innerHTML = summaryHtml + rows;
}

/* ---------------- Score history ---------------- */

async function recordHistory(url, score) {
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch (e) { /* keep raw */ }
  const key = "scanora_history_" + hostname;
  const stored = await chrome.storage.local.get(key);
  const list = stored[key] || [];
  list.push({ ts: Date.now(), score });
  const trimmed = list.slice(-12);
  await chrome.storage.local.set({ [key]: trimmed });
  return trimmed;
}

function renderHistorySparkline(history) {
  const wrap = document.getElementById("historyRow");
  if (!history || history.length < 2) {
    wrap.innerHTML = `<span class="history-empty">First scan logged — come back later to see your trend</span>`;
    return;
  }
  const w = 160, h = 20, pad = 2;
  const scores = history.map((p) => p.score);
  const min = Math.min(...scores), max = Math.max(...scores);
  const range = max - min || 1;
  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = scores[scores.length - 1];
  const first = scores[0];
  const trendColor = last >= first ? "#00D9A3" : "#FF5C5C";
  wrap.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${points}" fill="none" stroke="${trendColor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <span class="history-empty">last ${history.length} scans of this site</span>`;
}

/* ---------------- Export report card ---------------- */

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function exportReportCard(data, score) {
  const cw = 480, ch = 600;
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, "#0B1120");
  grad.addColorStop(1, "#141B2D");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = "#00D9A3";
  ctx.font = "600 20px Arial";
  ctx.fillText("Scanora", 32, 50);
  ctx.fillStyle = "#8A93A6";
  ctx.font = "12px Arial";
  ctx.fillText("SEO Health Report", 32, 70);

  const cx = cw / 2, cy = 190, r = 80;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#1B2437";
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
  ctx.strokeStyle = score >= 80 ? "#00D9A3" : score >= 50 ? "#FFB020" : "#FF5C5C";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.fillStyle = "#E8ECF3";
  ctx.font = "700 44px Arial";
  ctx.textAlign = "center";
  ctx.fillText(String(score), cx, cy + 16);
  ctx.font = "11px Arial";
  ctx.fillStyle = "#8A93A6";
  ctx.fillText("HEALTH SCORE", cx, cy + 38);
  ctx.textAlign = "left";

  let host = data.url;
  try { host = new URL(data.url).hostname; } catch (e) { /* keep raw */ }
  ctx.fillStyle = "#E8ECF3";
  ctx.font = "600 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText(host.length > 40 ? host.slice(0, 37) + "…" : host, cx, cy + 100);
  ctx.textAlign = "left";

  const stats = [
    ["Word count", `${data.keywords.wordCount}`],
    ["Total links", `${data.links.total}`],
    ["Images missing alt", `${data.images.missingAlt}/${data.images.total}`],
    ["Readability", data.readability.score !== null ? `${data.readability.score}/100` : "n/a"],
    ["Structured data", data.structuredData.count > 0 ? `${data.structuredData.count} block(s)` : "None"]
  ];
  let sy = 340;
  stats.forEach(([label, value]) => {
    drawRoundedRect(ctx, 32, sy, cw - 64, 40, 8);
    ctx.fillStyle = "#141B2D";
    ctx.fill();
    ctx.strokeStyle = "#232E45";
    ctx.stroke();
    ctx.fillStyle = "#8A93A6";
    ctx.font = "13px Arial";
    ctx.fillText(label, 48, sy + 25);
    ctx.fillStyle = "#E8ECF3";
    ctx.font = "600 13px Arial";
    ctx.textAlign = "right";
    ctx.fillText(value, cw - 48, sy + 25);
    ctx.textAlign = "left";
    sy += 48;
  });

  ctx.fillStyle = "#8A93A6";
  ctx.font = "11px Arial";
  ctx.fillText("Generated with Scanora — free SEO extension", 32, ch - 20);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scanora-report.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}

/* ---------------- Orchestration ---------------- */

async function renderAll(data) {
  currentData = data;
  document.getElementById("pageUrl").textContent = data.url;
  document.getElementById("pageUrl").title = data.url;

  const checks = buildChecks(data);
  const score = computeScore(checks);
  setRing(score);
  renderOverview(checks);
  renderChips(data);
  renderOnPage(data);
  renderTechnical(data);
  renderContent(data);
  renderLinks(data);

  document.getElementById("focusKeywordResults").innerHTML = `<p class="muted-note">Type a target keyword or phrase above, then hit Check.</p>`;
  document.getElementById("compareResults").innerHTML = "";

  try {
    const history = await recordHistory(data.url, score);
    renderHistorySparkline(history);
  } catch (e) {
    document.getElementById("historyRow").innerHTML = "";
  }
}

function showError(message) {
  document.getElementById("pageUrl").textContent = message;
  document.getElementById("scoreValue").textContent = "—";
  currentData = null;
}

async function runScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url || !/^https?:/.test(tab.url)) {
    showError("Open a normal web page to scan it");
    return;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["analyzer.js", "content.js"] });
    chrome.tabs.sendMessage(tab.id, { type: "SCANORA_SCAN" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.ok) {
        showError("Could not scan this page");
        return;
      }
      renderAll(response.data);
    });
  } catch (err) {
    showError("This page can't be scanned");
  }
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.querySelector(`.panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
      tab.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
    });
  });

  const tabBar = document.getElementById("tabs");
  if (tabBar) {
    tabBar.addEventListener("wheel", (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      tabBar.scrollLeft += e.deltaY;
    }, { passive: false });
  }
}

function setupActions() {
  document.getElementById("rateBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://chromewebstore.google.com/detail/scanora" });
  });
  document.getElementById("rescanBtn").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    btn.classList.add("spinning");
    runScan().finally(() => btn.classList.remove("spinning"));
  });
  document.getElementById("exportBtn").addEventListener("click", () => {
    if (!currentData) return;
    const checks = buildChecks(currentData);
    exportReportCard(currentData, computeScore(checks));
  });
  document.getElementById("checkKeywordBtn").addEventListener("click", runFocusKeywordCheck);
  document.getElementById("focusKeywordInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runFocusKeywordCheck();
  });
  document.getElementById("checkBrokenBtn").addEventListener("click", runBrokenLinkScan);
  document.getElementById("compareBtn").addEventListener("click", runCompare);
  document.getElementById("compareUrlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runCompare();
  });
  document.getElementById("checkRobotsSitemapBtn").addEventListener("click", runRobotsSitemapCheck);
  document.getElementById("startCrawlBtn").addEventListener("click", runSiteCrawl);
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupActions();
  runScan();
});
