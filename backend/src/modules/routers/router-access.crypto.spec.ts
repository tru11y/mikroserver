import {
  decryptRouterAccessPassword,
  decryptRouterAccessPasswordCompat,
  deriveRouterAccessKey,
  encryptRouterAccessPassword,
  isRouterAccessPasswordEncrypted,
} from "./router-access.crypto";

describe("router-access.crypto", () => {
  const rawKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const key = deriveRouterAccessKey(rawKey);

  it("encrypts and decrypts access passwords", () => {
    const encrypted = encryptRouterAccessPassword("super-secret", key);
    const decrypted = decryptRouterAccessPassword(encrypted, key);

    expect(decrypted).toBe("super-secret");
  });

  it("detects encrypted payload shape", () => {
    const encrypted = encryptRouterAccessPassword("abc", key);

    expect(isRouterAccessPasswordEncrypted(encrypted)).toBe(true);
    expect(isRouterAccessPasswordEncrypted("plaintext-password")).toBe(false);
  });

  it("supports plaintext compatibility mode", () => {
    const legacy = decryptRouterAccessPasswordCompat("legacy-plain", key);
    expect(legacy).toEqual({
      password: "legacy-plain",
      wasLegacyPlaintext: true,
    });

    const encrypted = encryptRouterAccessPassword("new-pass", key);
    const secure = decryptRouterAccessPasswordCompat(encrypted, key);
    expect(secure).toEqual({
      password: "new-pass",
      wasLegacyPlaintext: false,
    });
  });
});
