import axios, { AxiosInstance, AxiosError } from "axios";

export interface LanConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  timeoutMs?: number;
}

export interface SystemResource {
  uptime: string;
  version: string;
  "build-time": string;
  "cpu-load": string;
  "free-memory": string;
  "total-memory": string;
  "architecture-name": string;
  "board-name": string;
  platform: string;
  [key: string]: string;
}

export class LanAuthFailedError extends Error {
  constructor(message = "Identifiants incorrects") {
    super(message);
    this.name = "LanAuthFailedError";
  }
}

export class LanUnreachableError extends Error {
  constructor(message = "Routeur injoignable") {
    super(message);
    this.name = "LanUnreachableError";
  }
}

export class LanApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LanApiError";
  }
}

/**
 * REST client from the phone to a MikroTik router on the local network.
 * HTTP only (port 80) — self-signed HTTPS requires native SSL pinning (phase 2).
 */
export class MikroTikLanClient {
  private readonly http: AxiosInstance;

  constructor(private readonly params: LanConnectionParams) {
    const protocol = params.port === 443 ? "https" : "http";
    this.http = axios.create({
      baseURL: `${protocol}://${params.host}:${params.port}/rest`,
      auth: { username: params.username, password: params.password },
      timeout: params.timeoutMs ?? 8000,
    });
  }

  async systemResource(): Promise<SystemResource> {
    return this.get<SystemResource>("/system/resource");
  }

  async systemIdentity(): Promise<{ name: string }> {
    return this.get<{ name: string }>("/system/identity");
  }

  async list<T = Record<string, unknown>>(path: string): Promise<T[]> {
    return this.get<T[]>(path);
  }

  async add(
    path: string,
    data: Record<string, unknown>,
  ): Promise<{ ".id": string }> {
    try {
      const res = await this.http.put<{ ".id": string }>(path, data);
      return res.data;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async set(
    path: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.http.patch(
        `${path}/${encodeURIComponent(id)}`,
        data,
      );
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async remove(path: string, id: string): Promise<void> {
    try {
      await this.http.delete(`${path}/${encodeURIComponent(id)}`);
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const res = await this.http.get<T>(path);
      return res.data;
    } catch (err) {
      throw this.mapError(err);
    }
  }

  private mapError(err: unknown): Error {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        return new LanAuthFailedError();
      }
      if (
        axiosErr.code === "ECONNABORTED" ||
        axiosErr.code === "ETIMEDOUT"
      ) {
        return new LanUnreachableError("Routeur injoignable (timeout)");
      }
      if (
        axiosErr.code === "ECONNREFUSED" ||
        axiosErr.code === "ENETUNREACH"
      ) {
        return new LanUnreachableError("Routeur injoignable (connexion refusée)");
      }
      if (axiosErr.response) {
        return new LanApiError(
          `Erreur API ${axiosErr.response.status}`,
          axiosErr.response.status,
        );
      }
      return new LanUnreachableError();
    }
    return err instanceof Error ? err : new Error("Erreur inconnue");
  }
}
