# Scanora — SEO Health Checker (Chrome Extension, free)

![Scanora banner](banner.png)

![Manifest V3](https://img.shields.io/badge/Manifest-V3-00D9A3?style=flat-square)
![Cost](https://img.shields.io/badge/Cost-Free-7C6CFF?style=flat-square)
![Server calls](https://img.shields.io/badge/Your%20data-Never%20leaves%20your%20browser-141B2D?style=flat-square)

A one-click SEO auditor that scores any page you're on and breaks the
result down across 8 tabs — a premium-looking dark dashboard, 100%
free, no sign-up, no API key required for the core features.

## What it does (all local, nothing sent to any server)

- **Health score ring** — weighted score across 9 core SEO checks, with a small trend sparkline showing your last 12 scans of that same site
- **Overview** — plain-language checklist of what's good/needs fixing
- **On-Page** — live **Google search result preview**, title & meta description length checks, heading structure (H1-H6), image alt-text audit
- **Technical** — canonical tag, robots meta, mobile viewport, HTTPS, structured data (JSON-LD), page load time
- **Content** — word count, **Flesch readability score** with a visual scale, top keyword density table
- **Keyword** — a **focus-keyword checker** (Yoast-style, but works on any site): type a target phrase and see whether it's in the title, meta description, an H1, the URL, the first 100 words, image alt text, and whether density is healthy
- **Links** — internal/external/nofollow counts, Open Graph & Twitter Card tags, plus an on-demand **broken-link scanner**
- **Compare** — paste a competitor's URL and get a live side-by-side table (score, title length, word count, links, alt coverage, readability)
- **Export** — one click renders a shareable PNG "report card" (score ring + key stats)
- **Site Audit** — checks `/robots.txt` and `/sitemap.xml` on the domain, plus an on-demand **bounded site scan**: follows internal links from the current page and audits up to 20 pages, with a 400ms pause between requests so it never hammers the target site. Shows a live progress bar, then an average score and a per-page list. This is a fast sanity check, not a full crawler replacement (see limitations below).

Backlink graphs, keyword search volume, and competitor rank tracking
were deliberately left out — they only exist inside paid third-party
indexes (Ahrefs/Moz/SEMrush/DataForSEO), and faking those numbers
would make the tool actively misleading.

### Honest limitations
- The broken-link scanner, Compare tab, and Site Audit crawl all do
  live fetch() calls from the popup. Sites protected by bot-detection
  (Cloudflare challenges, login walls) may return unexpected statuses.
- Readability and keyword density use standard English heuristics.
- The site crawl is capped at 20 pages and only runs while the popup
  stays open (closing the popup stops it) — this is a Manifest V3
  popup limitation, not a bug. For unlimited crawling of large sites,
  a desktop crawler (Screaming Frog) is the right tool, not a browser
  extension.
- The crawl doesn't currently read `Disallow` rules from robots.txt
  before following links — it's polite (rate-limited, same-origin
  only) but not robots.txt-aware yet.

## Install locally (for testing)

1. Unzip `scanora-seo-extension.zip` somewhere you'll remember (e.g. Desktop) — you should see `manifest.json` directly inside the folder, not inside another sub-folder.
2. Open Chrome, type `chrome://extensions` in the address bar, press Enter.
3. Turn on **Developer mode** (toggle, top-right corner).
4. Click **Load unpacked** (top-left) → select the unzipped folder.
5. Scanora's icon appears in the extensions list. Click the puzzle-piece icon in Chrome's toolbar → click the pin next to Scanora so it stays visible.
6. Open any normal website (not a `chrome://` page) → click the Scanora icon → it scans automatically.

If you edit any file afterward, go back to `chrome://extensions` and click the refresh icon on Scanora's card to reload your changes.

## Put it on GitHub

This isn't required to use or publish the extension — Chrome only
needs the zip. But GitHub is the easiest free place to (a) back up
the code, (b) host `privacy-policy.html` for free via GitHub Pages,
and (c) let other people see/star/fork it.

**1. Create the repo**
- Go to https://github.com/new
- Name it (e.g. `scanora-seo-extension`), keep it **Public**, don't
  add a README/gitignore/license yet (you already have files locally)
- Click **Create repository** — GitHub shows you a remote URL, keep
  that tab open

**2. Push your local folder**
Run these from inside the `scanora-seo-extension` folder:
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/scanora-seo-extension.git
git push -u origin main
```
(Replace `<your-username>` with your actual GitHub username.)

**3. Add a `.gitignore`** so junk never gets committed:
```
node_modules/
*.zip
.DS_Store
```

**4. Host the privacy policy for free with GitHub Pages**
- In the repo, go to **Settings → Pages**
- Under "Build and deployment", set Source = **Deploy from a branch**,
  Branch = `main`, folder = `/ (root)` → Save
- After a minute, your policy is live at:
  `https://<your-username>.github.io/scanora-seo-extension/privacy-policy.html`
- Paste that exact URL into the Chrome Web Store dashboard's Privacy
  tab (step 3 below)

**5. (Optional) Attach the zip as a GitHub Release**
So people can download a ready-to-load zip without cloning:
- Repo page → **Releases** (right sidebar) → **Create a new release**
- Tag it `v1.0.0`, title "Scanora v1.0.0", drag in
  `scanora-seo-extension.zip` as a binary attachment → **Publish release**
- Every time you update the extension, bump `version` in
  `manifest.json` and cut a new release with a new tag (`v1.1.0`, etc.)

**6. Write a short top-of-README description** (GitHub shows this on
the repo page) — the opening two paragraphs of this file already work
for that.

**7. (Optional) Set the repo's social preview image** — this is the
image people see when your repo link is shared on Twitter/LinkedIn:
- **Settings → General → scroll to "Social preview" → Upload an image**
- Upload `banner.png` (already in this folder, sized right for it)

## Publish to the Chrome Web Store (free listing)

1. Zip the folder contents (manifest.json at the zip root). privacy-policy.html, store-listing.md, banner.png, and make_banner.py don't need to ship inside the extension zip.
2. Create a one-time $5 developer account: https://chrome.google.com/webstore/devconsole
3. Paste your GitHub Pages privacy policy URL (from the GitHub section above) into the dashboard's Privacy tab.
4. Upload the zip, then paste the copy from store-listing.md into the dashboard.
5. Add 1-5 screenshots.
6. Submit for review.

## File structure

manifest.json          Manifest V3 config
popup.html/.css/.js    The toolbar dashboard (8 tabs, incl. Site Audit)
analyzer.js            Shared, pure scoring library - used by content.js
                        (live page) and popup.js (Compare tab + Site crawl)
content.js             Runs analyzer.js against the live page
background.js          Minimal service worker (badge color only)
icons/                 16/32/48/128 px icons
privacy-policy.html    Host this publicly (see GitHub Pages steps above)
store-listing.md       Pre-written Store listing copy
banner.png              GitHub README banner / social preview image

## Naming
"Scanora" is short and reads as premium - do a quick search on the
Chrome Web Store before publishing to make sure the name is free.
