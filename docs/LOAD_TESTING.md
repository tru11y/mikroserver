# Load Testing

Baseline k6 smoke script:

```bash
k6 run infrastructure/load-testing/k6-smoke.js
```

Custom API target:

```bash
BASE_URL=https://staging-api.mikroserver.ci k6 run infrastructure/load-testing/k6-smoke.js
```

What it validates:

- `/api/v1/health/live` availability and latency threshold.
- OpenAPI endpoint availability (`/docs-json`).

Recommended next steps:

- Add authenticated journey scenarios (payment initiation, voucher verification).
- Add staged ramp-up profiles for capacity planning.
- Track regression thresholds in CI artifacts.
