# Operations Runbook

## Unified entrypoint

Use `infrastructure/scripts/ops.sh` for routine operations:

```bash
bash infrastructure/scripts/ops.sh deploy:prod
bash infrastructure/scripts/ops.sh deploy:staging
bash infrastructure/scripts/ops.sh certbot:renew
```

## Staging

- Compose override: `infrastructure/docker/docker-compose.staging.yml`
- Env template: `infrastructure/environments/staging/.env.example`
- Deploy script: `infrastructure/scripts/deploy_staging.sh`

## TLS / Certbot

- Renewal script: `infrastructure/scripts/certbot_renew.sh`
- Systemd units:
  - `infrastructure/systemd/certbot-renew.service`
  - `infrastructure/systemd/certbot-renew.timer`

Installation on VPS:

```bash
cp infrastructure/systemd/certbot-renew.service /etc/systemd/system/
cp infrastructure/systemd/certbot-renew.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now certbot-renew.timer
```

## GitOps deploy workflow

- Manual dispatch workflow: `.github/workflows/deploy.yml`
- Requires repository secrets:
  - `SSH_HOST`
  - `SSH_USER`
  - `SSH_PRIVATE_KEY`
