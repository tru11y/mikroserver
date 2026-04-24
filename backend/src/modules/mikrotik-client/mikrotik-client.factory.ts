import { Injectable, Logger } from "@nestjs/common";
import {
  IMikroTikClient,
  ConnectionParams,
} from "./interfaces/mikrotik-client.interface";
import { RestClient } from "./clients/rest.client";
import { BinaryClient } from "./clients/binary.client";
import {
  AuthFailedException,
  UnreachableException,
} from "./exceptions/mikrotik.exceptions";

@Injectable()
export class MikroTikClientFactory {
  private readonly logger = new Logger(MikroTikClientFactory.name);

  /**
   * Create a MikroTik client with REST-first, binary fallback strategy.
   * - REST fails with AuthFailed or Unreachable → propagate (no fallback)
   * - REST fails with RestNotSupported → fall through to binary
   */
  async create(params: ConnectionParams): Promise<IMikroTikClient> {
    // Try REST first (RouterOS 7.1+)
    try {
      const rest = new RestClient(params);
      await rest.systemResource(); // probe
      this.logger.debug(`REST client connected to ${params.host}`);
      return rest;
    } catch (err) {
      if (err instanceof AuthFailedException) throw err;
      if (err instanceof UnreachableException) throw err;
      // RestNotSupportedException or other → try binary
      this.logger.debug(
        `REST probe failed for ${params.host}, falling back to binary API`,
      );
    }

    // Binary fallback — try SSL port 8729 first
    const binaryParams: ConnectionParams = {
      ...params,
      port: 8729,
      useTls: true,
    };
    try {
      const binary = new BinaryClient(binaryParams);
      await binary.systemResource(); // probe
      this.logger.debug(`Binary client (SSL) connected to ${params.host}`);
      return binary;
    } catch (err) {
      if (err instanceof AuthFailedException) throw err;
      // Try plaintext port 8728 as last resort
      this.logger.debug(
        `Binary SSL failed for ${params.host}, trying plaintext 8728`,
      );
    }

    const plaintextParams: ConnectionParams = {
      ...params,
      port: 8728,
      useTls: false,
    };
    const binary = new BinaryClient(plaintextParams);
    await binary.systemResource(); // probe — will throw if unreachable
    this.logger.debug(`Binary client (plaintext) connected to ${params.host}`);
    return binary;
  }
}
