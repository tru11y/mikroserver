import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import argon2 from "argon2";

/**
 * Handles all password hashing and verification logic.
 *
 * Supports two algorithms:
 * - bcrypt  — current default
 * - argon2id — legacy (imported from old admin scripts); auto-upgraded on next login
 *
 * A junior adding a new algorithm only needs to add detection + verification here.
 */
@Injectable()
export class AuthPasswordService {
  constructor(private readonly configService: ConfigService) {}

  /** Hash a plain-text password with bcrypt using the configured round count. */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get<number>(
      "security.bcryptRounds",
      12,
    );
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a plain-text password against a stored hash.
   *
   * Returns `shouldUpgradeToBcrypt = true` when the hash is argon2 so the
   * caller can transparently re-hash to bcrypt on the next successful login.
   */
  async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<{ valid: boolean; shouldUpgradeToBcrypt: boolean }> {
    if (!storedHash) return { valid: false, shouldUpgradeToBcrypt: false };

    if (this.isBcryptHash(storedHash)) {
      return {
        valid: await bcrypt.compare(password, storedHash),
        shouldUpgradeToBcrypt: false,
      };
    }

    if (this.isArgon2Hash(storedHash)) {
      return {
        valid: await argon2.verify(storedHash, password),
        shouldUpgradeToBcrypt: true,
      };
    }

    // Unknown format — try both to handle edge cases from early migration scripts.
    try {
      const bcryptValid = await bcrypt.compare(password, storedHash);
      if (bcryptValid) return { valid: true, shouldUpgradeToBcrypt: false };
    } catch {
      /* ignore */
    }

    try {
      const argonValid = await argon2.verify(storedHash, password);
      if (argonValid) return { valid: true, shouldUpgradeToBcrypt: true };
    } catch {
      /* ignore */
    }

    return { valid: false, shouldUpgradeToBcrypt: false };
  }

  /**
   * Performs a dummy bcrypt hash to ensure constant-time response when a user
   * is not found. Without this, an attacker could detect non-existent accounts
   * by measuring response time.
   */
  async constantTimeDummy(): Promise<void> {
    await bcrypt.hash("dummy_constant_time_check", 1);
  }

  private isBcryptHash(hash: string): boolean {
    return /^\$2[aby]\$\d{2}\$/.test(hash);
  }

  private isArgon2Hash(hash: string): boolean {
    return hash.startsWith("$argon2");
  }
}
