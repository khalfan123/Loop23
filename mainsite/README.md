# Loop9 mainsite (front website)

Static marketing site for SME-first AI voice agents. Deployed as Railway service **mainsite** (production canvas), separate from the `loop9` app.

## CTAs

| Action | URL |
|--------|-----|
| Sign in | https://app.loop9.ai/login |
| Get started / Start free trial | https://app.loop9.ai/register |
| Privacy / Terms | https://app.loop9.ai/privacy · https://app.loop9.ai/terms |

## Page map (`index.html`)

1. Nav — Features, Use cases, How it works, Sign in, Get started  
2. Hero — SME value + live booking/transfer card  
3. Platform pillars — Build / Deploy / Monitor  
4. Capabilities — 12 feature cards  
5. Telephony — verified numbers, business caller ID, batch calling  
6. Quality loop — post-call analysis + AI QA  
7. Use cases — sales, support, clinics, home services, real estate, after-hours  
8. How it works — 3 steps  
9. Final CTA + footer  

## Local preview

```bash
cd mainsite && node server.js
```

Open http://localhost:3000

## Deploy (isolated upload)

Deploy from a clean copy of this folder only — never from the monorepo root (avoids uploading `rest-express`).

```bash
DEPLOY_DIR=$(mktemp -d)
rsync -a ./mainsite/ "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
railway link  # Loop9 → production → mainsite
railway up -y -d --service mainsite --environment production
```
