import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "2m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const baseUrl = __ENV.BASE_URL || "https://api.mikroserver.ci";

export default function () {
  const live = http.get(`${baseUrl}/api/v1/health/live`);
  check(live, {
    "health/live status is 200": (r) => r.status === 200,
  });

  const docs = http.get(`${baseUrl}/docs-json`);
  check(docs, {
    "docs endpoint responds": (r) => r.status === 200 || r.status === 404,
  });

  sleep(1);
}
