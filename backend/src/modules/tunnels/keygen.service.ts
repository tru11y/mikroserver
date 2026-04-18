import { Injectable } from "@nestjs/common";
import { generateKeyPairSync } from "crypto";

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

@Injectable()
export class KeygenService {
  /**
   * Generate a WireGuard-compatible X25519 keypair using Node.js native crypto.
   * Both keys are returned as base64-encoded 32-byte raw values.
   */
  generateKeypair(): WireGuardKeyPair {
    const { privateKey: privDer, publicKey: pubDer } = generateKeyPairSync(
      "x25519",
      {
        privateKeyEncoding: { type: "pkcs8", format: "der" },
        publicKeyEncoding: { type: "spki", format: "der" },
      },
    );
    // PKCS8 DER for x25519: raw 32-byte key starts at offset 16
    // SPKI  DER for x25519: raw 32-byte key starts at offset 12
    const privateKey = (privDer as Buffer).subarray(16).toString("base64");
    const publicKey = (pubDer as Buffer).subarray(12).toString("base64");
    return { privateKey, publicKey };
  }
}
