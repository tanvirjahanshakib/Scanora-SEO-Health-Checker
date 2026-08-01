# Scanora — Chrome Web Store Listing Copy

Paste these directly into the Web Store Developer Dashboard when you submit.

---

## Extension name
Scanora — SEO Health Checker

## Short description (max 132 characters — shown in search results)
Instant on-page & technical SEO audit for any page — title, headings, alt text, links, and speed, scored in one click.
(119 characters)

## Category
Productivity  →  (alternative: Developer Tools)

## Detailed description (Store listing body)

See how any page scores on SEO — the moment you land on it.

Scanora scans the page you're viewing and turns it into a clear,
color-coded health report. No sign-up, no API key, nothing sent
anywhere — everything runs locally in your browser.

**What it checks**
✓ Title tag & meta description length
✓ Heading structure (H1–H6) — catches duplicate or missing H1s
✓ Image alt-text coverage
✓ Canonical tag, robots meta, mobile viewport, HTTPS
✓ Structured data (JSON-LD / schema.org)
✓ Word count & top keyword density
✓ Internal / external / nofollow link counts
✓ Open Graph & Twitter Card tags
✓ Page load time
✓ robots.txt & sitemap.xml presence
✓ Bounded 20-page site scan (follows internal links, rate-limited)
✓ Focus-keyword checker, competitor page compare, broken-link scanner

**Who it's for**
Bloggers, indie site owners, freelance SEOs, and developers who want
a fast sanity check before they publish — without opening a heavyweight
paid dashboard for a two-minute check.

**Privacy first**
Scanora never phones home. Every check runs inside your browser on
the page you're already looking at, and nothing is logged, stored, or
transmitted. Full privacy policy: [link to your hosted privacy-policy.html]

## Suggested screenshots (1280×800 or 640×400, need at least 1, ideally 3–5)
1. Popup open on a real blog post, showing the health score ring + Overview tab checklist
2. On-Page tab showing the title/description length cards
3. Content tab showing the keyword density table
4. Links tab showing the link profile breakdown
5. A "before/after" style shot: a page with a red/warn score vs. a page with a green score

## Single purpose description (required field in the dashboard)
"Scanora analyzes the currently active tab's HTML to generate an
on-page and technical SEO report, entirely client-side."

## Permission justifications (required field in the dashboard)
- **activeTab / scripting**: "Used to read the DOM of the tab the user
  is currently viewing, only when the user clicks the extension icon,
  in order to generate the SEO report."
- **host_permissions (`<all_urls>`)**: "Scanora is a general-purpose
  SEO checker meant to work on any website the user chooses to
  inspect, not a fixed list of domains. It's also used, only when the
  user explicitly clicks 'Compare' or 'Scan this site', to fetch a
  competitor URL or a small, rate-limited set of same-site pages for
  the optional Site Audit feature."

## Keywords / search terms to weave into the description
SEO checker, on-page SEO, meta tag checker, SEO audit, technical SEO,
keyword density, site speed, SEO score, webmaster tools
