import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const SECRET_ALGO = "aes-256-gcm";
const ROUTER_ACCESS_KEY_SALT = "mikroserver-router-access-salt";
const ROUTER_API_KEY_SALT = "mikroserver-router-api-salt";
const ENCRYPTED_PARTS_COUNT = 3;

function deriveKey(rawKey: string, salt: string): Buffer {
  return scryptSync(rawKey, salt, 32);
}

function isEncrypted(value: string): boolean {
  return value.split(":").length === ENCRYPTED_PARTS_COUNT;
}

function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(SECRET_ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((part) => part.toString("base64"))
    .join(":");
}

function decryptSecret(encryptedValue: string, key: Buffer): string {
  const parts = encryptedValue.split(":");
  if (parts.length !== ENCRYPTED_PARTS_COUNT) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  const decipher = createDecipheriv(SECRET_ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

function decryptSecretCompat(
  storedValue: string,
  key: Buffer,
): { password: string; wasLegacyPlaintext: boolean } {
  if (!isEncrypted(storedValue)) {
    return {
      password: storedValue,
      wasLegacyPlaintext: true,
    };
  }

  return {
    password: decryptSecret(storedValue, key),
    wasLegacyPlaintext: false,
  };
}

// ── Router access password (Winbox/Webfig/SSH) ─────────────────────────────

export function deriveRouterAccessKey(rawKey: string): Buffer {
  return deriveKey(rawKey, ROUTER_ACCESS_KEY_SALT);
}

export function isRouterAccessPasswordEncrypted(value: string): boolean {
  return isEncrypted(value);
}

export function encryptRouterAccessPassword(
  plaintext: string,
  key: Buffer,
): string {
  return encryptSecret(plaintext, key);
}

export function decryptRouterAccessPassword(
  encryptedValue: string,
  key: Buffer,
): string {
  return decryptSecret(encryptedValue, key);
}

export function decryptRouterAccessPasswordCompat(
  storedValue: string,
  key: Buffer,
): { password: string; wasLegacyPlaintext: boolean } {
  return decryptSecretCompat(storedValue, key);
}

// ── Router RouterOS API password (apiPasswordHash) ─────────────────────────

export function deriveRouterApiKey(rawKey: string): Buffer {
  return deriveKey(rawKey, ROUTER_API_KEY_SALT);
}

export function isRouterApiPasswordEncrypted(value: string): boolean {
  return isEncrypted(value);
}

export function encryptRouterApiPassword(plaintext: string, key: Buffer): string {
  return encryptSecret(plaintext, key);
}

export function decryptRouterApiPassword(
  encryptedValue: string,
  key: Buffer,
): string {
  return decryptSecret(encryptedValue, key);
}

export function decryptRouterApiPasswordCompat(
  storedValue: string,
  key: Buffer,
): { password: string; wasLegacyPlaintext: boolean } {
  return decryptSecretCompat(storedValue, key);
}
