# Phase 1 Deployment Notes

Phase 1 is designed for a future AWS deployment without requiring AWS-specific code in the MVP.

## Recommended AWS Shape

- Frontend: S3 + CloudFront or AWS Amplify.
- Backend: ECS Fargate or Elastic Beanstalk running the Express API.
- Database: Amazon RDS for MySQL.
- Secrets: AWS Secrets Manager or SSM Parameter Store.
- Scheduling: backend `node-cron` for MVP, later replaceable with EventBridge triggering a worker task.
- Observability: CloudWatch logs and alarms on failed ingestion runs.

## Required Secrets

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `CEO_EMAIL`
- `CEO_PASSWORD`
- `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_JSON`

## Operating Flow

1. Business users upload source files or update sheets.
2. Scheduled ingestion checks active data sources.
3. Processing logs capture success, skips, partial rows, or failures.
4. KPI snapshots are persisted.
5. The dashboard reads the latest persisted KPI values.

## Production Readiness Checklist

- Replace seeded placeholder Google folder and sheet IDs with real values.
- Confirm all source column mappings with sample production files.
- Rotate the default CEO password immediately after first deployment.
- Enable HTTPS and secure cookies.
- Add database backups and retention policy.
- Add monitoring for failed ingestion and stale KPI values.
- Use a managed secret store for MySQL and Google credentials.
