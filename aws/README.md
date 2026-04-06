# AWS Deployment Guide

This repository is now prepared for AWS-first deployment.

## Included assets

- `Dockerfile` - multi-stage production build and runtime image.
- `.dockerignore` - excludes local and development-only files from image context.
- `aws/task-definition.template.json` - baseline ECS Fargate task definition template.
- `.env.aws.example` - minimum production environment variable template.

## Recommended target: ECS Fargate + ALB + ECR

1. **Build and push image to ECR**
   - Build: `docker build -t agentlabs-app:latest .`
   - Tag/push to your ECR repo.
2. **Register task definition**
   - Start from `aws/task-definition.template.json`.
   - Replace placeholders:
     - `<account-id>`
     - `<region>`
     - image URI
3. **Create ECS service**
   - Launch type: Fargate
   - Network mode: `awsvpc`
   - Attach to ALB target group (port 5000)
4. **Configure health checks**
   - Target path: `/health`
   - Expected response: `200`
5. **Set secrets with SSM Parameter Store or Secrets Manager**
   - Wire to `containerDefinitions[].secrets`.

## Required runtime environment

At minimum:

- `NODE_ENV=production`
- `PORT=5000`
- `APP_DOMAIN=https://<your-public-domain>`
- `APP_BASE_URL=https://<your-public-domain>`
- `DATABASE_URL=<postgres-connection>`
- `JWT_SECRET=<strong-random-secret>`
- `OPENAI_API_KEY=<key>`
- `AWS_REGION=<region>`

## Important callback/webhook note

OAuth and callback URLs are built from `APP_BASE_URL` / `APP_DOMAIN` first, so set one of them to your public AWS domain. This avoids Replit-specific host assumptions.

## Local production smoke test

```bash
npm ci
npm run check
npm run build
npm start
```

Then open:

- `http://localhost:5000/health`

