import { normalizeAuthEmail } from "./auth.utils";

describe("auth.utils", () => {
  it("normalizes auth email by trimming and lowercasing it", () => {
    expect(normalizeAuthEmail("  Admin@MikroServer.Local  ")).toBe(
      "admin@mikroserver.local",
    );
  });
});
