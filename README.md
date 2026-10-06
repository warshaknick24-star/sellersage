# SellerSage

*Data-Driven Growth for Your Shop.*

SellerSage is a human-first marketing and automation service for small Etsy and Fiverr sellers. AI and data work behind the scenes, and the seller's own voice and real photos stay up front. This repo contains the customer website and the internal operator desk. See [brand/BRAND.md](brand/BRAND.md) for the name, positioning, colors, voice, offer ladder and funnel.

**Live site:** https://warshaknick24-star.github.io/sellersage/

## Publishing changes

The live site is the static `docs/` folder, served by GitHub Pages from the `main` branch. After editing anything in `public/`, rebuild and push:

```powershell
node scripts/build-pages.mjs
git add -A; git commit -m "Update site"; git push
```

On the live site, the listing check runs in the visitor's browser, and audit requests are emailed to warshaknick24@gmail.com through FormSubmit. The operator desk is local only and isn't published.

## Run locally

Requires Node.js 22.9+. There are no runtime packages to install.

```powershell
cd C:\Users\Warsh\MarketingProj
npm.cmd start
```

- Customer website: http://localhost:3000
- Operator desk: http://localhost:3000/operator
- Backend tests: `npm.cmd test` (15 tests)

The server binds to 127.0.0.1. Public hosting and authenticated operator access are not implemented yet.

## Customer site

- **Hero:** "More sales. Less guesswork." with a free-shop-audit CTA and an illustrative before/after listing that echoes the Facebook ad.
- **Promise:** "Your voice up front. AI behind the scenes." Your words, your real photos, you approve everything.
- **Services:** listing and gig SEO, photo and shop visuals, replies and follow-up, each with "You receive" and "You provide" lists.
- **Instant listing check:** a free, no-signup completeness score that uses the `/api/audit` checklist. Nothing is stored.
- **Sample deliverables:** switchable Etsy and Fiverr examples, clearly labelled as fictional.
- **Pricing:** a $1,500 Full Brand Build anchor, then $300 Refresh, $550 Refresh + 1 month, and $600 Refresh + 3 months (best value).
- **How it works:** free audit, one recommendation, approval, then 30/60/90-day numbers.
- **About Nick:** the authority story (Siemens, Paychex, UC, a dealership AI saving about 2,500 hours a year) and the positioning statement.
- **FAQ:** answers the interview objections (AI images/text, side-gig affordability, contracts, guarantees, data).
- **Audit request form:** emailed via FormSubmit on the live site. When running locally, it saves to `data/leads.jsonl` for the operator desk.

## Operator desk

- Live inbox of audit and package requests, filterable by package.
- Stats and marketing funnel (awareness → consideration → conversion → loyalty) computed from real requests.
- Listing workbench: score a seller's listing and produce a local or AI draft for review. AI drafting needs `OPENAI_API_KEY` and explicit consent.
- Offer and unit-economics table driven by `lib/packages.mjs` (Week 5 cost model).

## Browser test

```powershell
$env:PLAYWRIGHT_MODULE='file:///absolute/path/to/playwright-core/index.mjs'
$env:CHROMIUM_PATH='C:/absolute/path/to/chrome.exe'
node scripts/browser-smoke.mjs
```

This test covers the listing check, request → inbox → operator stats, the brief download, the duplicate-submit guard, failure recovery, no-JS rendering, reduced motion, the skip link, and layouts at 320–1440px. Captures go to `artifacts/`.

## Still to do

- Optional: a custom domain, and protected hosting if the operator desk ever goes online.
- Genuine proof from delivered work. No testimonials or results have been invented here.
- Earlier review history for the previous "Growth Studio" version is kept in [advisory-board-review.md](advisory-board-review.md).
