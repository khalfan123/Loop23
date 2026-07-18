# Loop9 mainsite (corporate marketing)

Multi-page, content-driven SEO site for SME / mid-market AI voice agents. Railway service **mainsite** (production).

## CTAs

| Action | URL |
|--------|-----|
| Start free trial | https://app.loop9.ai/register |
| Contact sales | mailto:sales@loop9.ai |
| Sign in | https://app.loop9.ai/login |

## Site map

| Section | Path |
|---------|------|
| Home (corporate narrative) | `/` |
| Features (12) | `/features/`, `/features/{slug}/` |
| Industries (8) | `/industries/`, `/industries/{slug}/` |
| Use cases (8) | `/use-cases/`, `/use-cases/{slug}/` |
| FAQ | `/faq/` |
| Security & controls | `/security/` |
| Sitemap / robots | `/sitemap.xml`, `/robots.txt` |

## Regenerate pages

```bash
node mainsite/scripts/generate-pages.mjs
```

## Local preview

```bash
cd mainsite && node server.js
```

## Deploy (isolated)

```bash
DEPLOY_DIR=$(mktemp -d)
rsync -a ./mainsite/ "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
railway link  # Loop9 → production → mainsite
railway up -y -d --service mainsite --environment production
```
