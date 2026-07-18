# Loop9 mainsite (front website)

Multi-page SEO marketing site for SME-first AI voice agents. Railway service **mainsite** (production), separate from `loop9`.

## CTAs

| Action | URL |
|--------|-----|
| Sign in | https://app.loop9.ai/login |
| Get started | https://app.loop9.ai/register |

## Site map

| Section | Path |
|---------|------|
| Home | `/` |
| Features hub | `/features/` |
| 12 feature pages | `/features/{slug}/` |
| Industries hub | `/industries/` |
| 8 industry pages | `/industries/{slug}/` |
| Use cases hub | `/use-cases/` |
| 8 use-case pages | `/use-cases/{slug}/` |
| Sitemap | `/sitemap.xml` |
| Robots | `/robots.txt` |

### Features
Build, Call Transfer, Book Appointments, Knowledge Base, Navigate IVR, Deploy, Batch Call, Branded Call ID, Verified Phone Numbers, Monitor, Post Call Analysis, AI Quality Assurance

### Industries
Healthcare, Financial Services, Insurance, Logistics, Home Services, Retail & Consumer, Travel & Hospitality, Debt Collection

### Use cases
Inbound Sales, Customer Support, Appointment Booking, After Hours, Lead Qualification, Outbound Campaigns, Department Routing, Quality Coaching

## Regenerate SEO pages

```bash
node mainsite/scripts/generate-pages.mjs
```

## Local preview

```bash
cd mainsite && node server.js
```

## Deploy (isolated upload)

```bash
DEPLOY_DIR=$(mktemp -d)
rsync -a ./mainsite/ "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
railway link  # Loop9 → production → mainsite
railway up -y -d --service mainsite --environment production
```
