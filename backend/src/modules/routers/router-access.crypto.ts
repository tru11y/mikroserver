import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ROUTER_ACCESS_ALGO = "aes-256-gcm";
const ROUTER_ACCESS_KEY_SALT = "mikroserver-router-access-salt";
const ENCRYPTED_PARTS_COUNT = 3;

export function deriveRouterAccessKey(rawKey: string): Buffer {
  return scryptSync(rawKey, ROUTER_ACCESS_KEY_SALT, 32);
}

export function isRouterAccessPasswordEncrypted(value: string): boolean {
  return value.split(":").length === ENCRYPTED_PARTS_COUNT;
}

export function encryptRouterAccessPassword(
  plaintext: string,
  key: Buffer,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ROUTER_ACCESS_ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((part) => part.toString("base64"))
    .join(":");
}

export function decryptRouterAccessPassword(
  encryptedValue: string,
  key: Buffer,
): string {
  const parts = encryptedValue.split(":");
  if (parts.length !== ENCRYPTED_PARTS_COUNT) {
    throw new Error("Invalid encrypted router access password format");
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  const decipher = createDecipheriv(ROUTER_ACCESS_ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function decryptRouterAccessPasswordCompat(
  storedValue: string,
  key: Buffer,
): { password: string; wasLegacyPlaintext: boolean } {
  if (!isRouterAccessPasswordEncrypted(storedValue)) {
    return {
      password: storedValue,
      wasLegacyPlaintext: true,
    };
  }

  return {
    password: decryptRouterAccessPassword(storedValue, key),
    wasLegacyPlaintext: false,
  };
}
