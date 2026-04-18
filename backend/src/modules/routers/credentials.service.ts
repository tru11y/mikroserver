import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * AES-256-GCM encryption for router agent credentials.
 * Master key from env ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Random 12-byte IV per encryption. AuthTag for tamper detection.
 */
@Injectable()
export class CredentialsService {
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    const hex = config.getOrThrow<string>("ENCRYPTION_KEY");
    this.masterKey = Buffer.from(hex, "hex");
    if (this.masterKey.length !== 32) {
      throw new Error(
        "ENCRYPTION_KEY must be 64 hex characters (32 bytes for AES-256-GCM)",
      );
    }
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString("hex"),
      iv: iv.toString("hex"),
      authTag: authTag.toString("hex"),
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.masterKey,
      Buffer.from(payload.iv, "hex"),
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}
