# AgentLabs AI Calling Platform

Production-grade multilingual AI voice calling platform with:

- Twilio telephony
- OpenAI and AWS Bedrock LLM support
- ElevenLabs and AWS Polly voice synthesis
- Knowledge-base grounded call flows
- Real-time monitoring and QA benchmark tooling

This repository is now documented for an **AWS-first** runtime path.

## Tech stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React + Vite
- **Database**: PostgreSQL (Drizzle ORM)
- **Voice/LLM**: OpenAI, AWS Bedrock, ElevenLabs, Polly

## Quick start (local development)

```bash
npm ci
npm run check
npm run dev
```

Default app port: `5000`.

## Local production smoke test

```bash
npm ci
npm run check
npm run build
npm start
```

Health endpoint:

- `GET /health`

## AWS deployment (recommended)

See `aws/README.md` for the full guide. Included assets:

- `Dockerfile`
- `.dockerignore`
- `aws/task-definition.template.json`
- `.env.aws.example`

Recommended target:

- **ECS Fargate + ALB + ECR**

## Environment variables

Set these at minimum in production:

- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL`
- `JWT_SECRET`
- `APP_DOMAIN` and/or `APP_BASE_URL`
- `OPENAI_API_KEY`
- `AWS_REGION`

### Callback/OAuth domain behavior

OAuth callback URL generation now prioritizes:

1. `APP_BASE_URL`
2. `APP_DOMAIN`
3. `PUBLIC_BASE_URL` / `PUBLIC_URL` / `BASE_URL`
4. legacy Replit variables (fallback only)
5. `http://localhost:5000`

This allows clean operation behind AWS ALB / custom domains without Replit assumptions.

## Quality and verification commands

- Type check: `npm run check`
- Production build: `npm run build`
- Retell readiness gate: `npm run quality:retell-gate`

## License

See source headers and project licensing terms in repository files.
