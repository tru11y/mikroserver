#!/usr/bin/env python3
"""Write .env for production deployment. Run once on VPS."""
import secrets, subprocess, pathlib

env_path = pathlib.Path(__file__).parent / ".env"

if env_path.exists():
    print(f".env already exists at {env_path} — delete it first to regenerate.")
    raise SystemExit(0)

pg_password   = secrets.token_urlsafe(24)
redis_password = secrets.token_urlsafe(24)
jwt_access    = secrets.token_hex(64)
jwt_refresh   = secrets.token_hex(64)

content = f"""POSTGRES_USER=mikroserver
POSTGRES_DB=mikroserver
POSTGRES_PASSWORD={pg_password}
REDIS_PASSWORD={redis_password}
JWT_ACCESS_SECRET={jwt_access}
JWT_REFRESH_SECRET={jwt_refresh}
WAVE_API_KEY=
WAVE_WEBHOOK_SECRET=
WAVE_SUCCESS_URL=http://139.84.241.27/portal
WAVE_ERROR_URL=http://139.84.241.27/portal
WAVE_ALLOWED_IPS=
CINETPAY_API_URL=
CINETPAY_SITE_ID=
CINETPAY_API_KEY=
CINETPAY_WEBHOOK_SECRET=
CINETPAY_CURRENCY=XOF
CINETPAY_DEFAULT_CHANNEL=MOBILE_MONEY
CINETPAY_NOTIFY_URL=
CINETPAY_RETURN_URL=
CINETPAY_ALLOWED_IPS=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=MikroServer <noreply@mikroserver.app>
"""

env_path.write_text(content)
print(f"Created: {env_path}")

print("Resetting postgres password...")
result = subprocess.run(
    ["docker", "exec", "docker-postgres-1", "psql", "-U", "mikroserver",
     "-c", f"ALTER USER mikroserver WITH PASSWORD '{pg_password}';"],
    capture_output=True, text=True
)
print("Postgres password reset: OK" if result.returncode == 0 else f"Warning: {result.stderr.strip()}")
print("Done. Now run: bash infrastructure/docker/deploy.sh")
