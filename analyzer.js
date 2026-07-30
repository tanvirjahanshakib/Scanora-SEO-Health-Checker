// ScanoraAnalyzer — pure functions, no chrome.* calls, so the exact same
// scoring logic can run against the live page (content.js) AND against a
// fetched+parsed competitor page (popup.js "Compare" tab).
(function (global) {
  const STOPWORDS = new Set([
    "the","a","an","and","or","but","if","of","to","in","on","for","with",
    "is","are","was","were","be","been","being","this","that","these",
    "those","it","its","as","at","by","from","into","than","then","so",
    "such","not","no","do","does","did","has","have","had","will","would",
    "can","could","should","may","might","we","you","your","our","i",
    "he","she","they","them","his","her","their"
  ]);

  function text(elm) {
    return elm ? elm.textContent.trim().replace(/\s+/g, " ") : "";
  }

  function getMeta(doc, name, attr) {
    attr = attr || "name";
    const node = doc.querySelector(`meta[${attr}="${name}"]`);
    return node ? node.getAttribute("content") || "" : "";
  }

  // textContent works on detached (fetched+parsed) documents; innerText does not,
  // since innerText depends on layout. We strip script/style so it stays clean.
  function visibleText(doc) {
    const clone = doc.body ? doc.body.cloneNode(true) : null;
    if (!clone) return "";
    clone.querySelectorAll("script, style, noscript, template").forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  }

  function analyzeHeadings(doc) {
    const levels = {};
    for (let i = 1; i <= 6; i++) {
      levels[`h${i}`] = Array.from(doc.querySelectorAll(`h${i}`)).map(text).filter(Boolean);
    }
    return levels;
  }

  function analyzeImages(doc) {
    const imgs = Array.from(doc.querySelectorAll("img"));
    const missing = imgs.filter((img) => !img.getAttribute("alt") || img.getAttribute("alt").trim() === "");
    const altTexts = imgs.map((img) => (img.getAttribute("alt") || "").trim()).filter(Boolean);
    return {
      total: imgs.length,
      missingAlt: missing.length,
      examples: missing.slice(0, 5).map((img) => img.getAttribute("src") || "(inline)"),
      altTexts: altTexts.slice(0, 60)
    };
  }

  function analyzeLinks(doc, baseUrl) {
    let origin;
    try { origin = new URL(baseUrl).origin; } catch (e) { origin = ""; }
    const anchors = Array.from(doc.querySelectorAll("a[href]"));
    let internal = 0, external = 0, nofollow = 0, noAnchorText = 0;
    const list = [];
    anchors.forEach((a) => {
      let href;
      try { href = new URL(a.getAttribute("href"), baseUrl); } catch (e) { return; }
      if (href.protocol !== "http:" && href.protocol !== "https:") return;
      const isInternal = href.origin === origin;
      if (isInternal) internal++; else external++;
      const rel = a.getAttribute("rel") || "";
      if (rel.includes("nofollow")) nofollow++;
      if (!text(a)) noAnchorText++;
      if (list.length < 150) {
        list.push({ href: href.href, anchor: text(a).slice(0, 60), internal: isInternal, nofollow: rel.includes("nofollow") });
      }
    });
    return { total: anchors.length, internal, external, nofollow, noAnchorText, list };
  }

  function analyzeKeywords(bodyText) {
    const words = bodyText
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

    const freq = {};
    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    const total = words.length || 1;
    const top = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count, density: +((count / total) * 100).toFixed(2) }));

    return { wordCount: words.length, top };
  }

  // Approximate Flesch Reading Ease — counts syllables via vowel-group heuristic.
  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return 0;
    const groups = word.match(/[aeiouy]+/g);
    let count = groups ? groups.length : 1;
    if (word.endsWith("e") && count > 1) count--;
    return Math.max(count, 1);
  }

  function analyzeReadability(bodyText) {
    const sentences = bodyText.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const words = bodyText.split(/\s+/).filter(Boolean);
    if (words.length < 30 || sentences.length === 0) {
      return { score: null, grade: "Not enough text", words: words.length, sentences: sentences.length };
    }
    const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const asl = words.length / sentences.length;       // avg sentence length
    const asw = syllables / words.length;                // avg syllables per word
    let score = 206.835 - 1.015 * asl - 84.6 * asw;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let grade;
    if (score >= 80) grade = "Very easy";
    else if (score >= 60) grade = "Easy — general audience";
    else if (score >= 40) grade = "Fairly difficult";
    else grade = "Difficult — expert / academic";

    return { score, grade, words: words.length, sentences: sentences.length };
  }

  function analyzeStructuredData(doc) {
    const nodes = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    const types = [];
    nodes.forEach((n) => {
      try {
        const data = JSON.parse(n.textContent);
        (Array.isArray(data) ? data : [data]).forEach((item) => {
          if (item && item["@type"]) types.push(item["@type"]);
        });
      } catch (e) { /* malformed JSON-LD, skip */ }
    });
    return { count: nodes.length, types };
  }

  function analyzeSocial(doc) {
    return {
      ogTitle: getMeta(doc, "og:title", "property"),
      ogDescription: getMeta(doc, "og:description", "property"),
      ogImage: getMeta(doc, "og:image", "property"),
      twitterCard: getMeta(doc, "twitter:card")
    };
  }

  // Main entry point. `doc` can be the live `document` or a DOMParser result.
  function analyze(doc, url) {
    const canonical = doc.querySelector('link[rel="canonical"]');
    const title = text(doc.querySelector("title"));
    const description = getMeta(doc, "description");
    const body = visibleText(doc);
    let protocol = "https:";
    try { protocol = new URL(url).protocol; } catch (e) { /* keep default */ }

    return {
      url,
      protocol,
      title,
      titleLength: title.length,
      description,
      descriptionLength: description.length,
      canonical: canonical ? canonical.getAttribute("href") : "",
      robotsMeta: getMeta(doc, "robots"),
      viewport: getMeta(doc, "viewport"),
      lang: doc.documentElement ? doc.documentElement.getAttribute("lang") || "" : "",
      headings: analyzeHeadings(doc),
      images: analyzeImages(doc),
      links: analyzeLinks(doc, url),
      keywords: analyzeKeywords(body),
      readability: analyzeReadability(body),
      structuredData: analyzeStructuredData(doc),
      social: analyzeSocial(doc),
      bodyTextSample: body.slice(0, 6000),
      performance: { loadMs: null }
    };
  }

  global.ScanoraAnalyzer = { analyze };
})(typeof self !== "undefined" ? self : this);
