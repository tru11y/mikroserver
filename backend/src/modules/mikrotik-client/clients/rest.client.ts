import axios, { AxiosInstance, AxiosError } from "axios";
import * as https from "https";
import {
  IMikroTikClient,
  SystemResource,
  SystemIdentity,
  ConnectionParams,
} from "../interfaces/mikrotik-client.interface";
import {
  AuthFailedException,
  UnreachableException,
  ApiException,
  RestNotSupportedException,
} from "../exceptions/mikrotik.exceptions";

/**
 * RouterOS REST API client (RouterOS 7.1+).
 * Connects via WireGuard tunnel with self-signed cert.
 */
export class RestClient implements IMikroTikClient {
  readonly transport = "rest" as const;
  private readonly http: AxiosInstance;

  constructor(private readonly params: ConnectionParams) {
    const protocol = params.useTls ? "https" : "http";
    this.http = axios.create({
      baseURL: `${protocol}://${params.host}:${params.port}/rest`,
      auth: { username: params.username, password: params.password },
      timeout: params.timeoutMs ?? 10_000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
  }

  async systemResource(): Promise<SystemResource> {
    return this.get<SystemResource>("/system/resource");
  }

  async systemIdentity(): Promise<SystemIdentity> {
    return this.get<SystemIdentity>("/system/identity");
  }

  async list<T = Record<string, unknown>>(
    path: string,
    filters?: Record<string, string>,
  ): Promise<T[]> {
    const params = filters
      ? Object.fromEntries(
          Object.entries(filters).map(([k, v]) => [`?.${k}`, v]),
        )
      : undefined;
    return this.get<T[]>(path, params);
  }

  async add(
    path: string,
    data: Record<string, unknown>,
  ): Promise<{ ".id": string }> {
    try {
      const res = await this.http.put<{ ".id": string }>(path, data);
      return res.data;
    } catch (err) {
      throw this.mapError(err, path);
    }
  }

  async set(
    path: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.http.patch(`${path}/${encodeURIComponent(id)}`, data);
    } catch (err) {
      throw this.mapError(err, path);
    }
  }

  async remove(path: string, id: string): Promise<void> {
    try {
      await this.http.delete(`${path}/${encodeURIComponent(id)}`);
    } catch (err) {
      throw this.mapError(err, path);
    }
  }

  async close(): Promise<void> {
    // REST is stateless — nothing to close
  }

  private async get<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    try {
      const res = await this.http.get<T>(path, { params });
      return res.data;
    } catch (err) {
      throw this.mapError(err, path);
    }
  }

  private mapError(err: unknown, path: string): Error {
    if (!axios.isAxiosError(err)) {
      return err instanceof Error ? err : new Error("Erreur inconnue");
    }
    const axiosErr = err as AxiosError;

    if (axiosErr.response?.status === 401) {
      return new AuthFailedException();
    }
    if (
      axiosErr.response?.status === 404 &&
      path === "/system/resource"
    ) {
      return new RestNotSupportedException();
    }
    if (
      axiosErr.code === "ECONNABORTED" ||
      axiosErr.code === "ETIMEDOUT"
    ) {
      return new UnreachableException("Routeur injoignable (timeout)");
    }
    if (
      axiosErr.code === "ECONNREFUSED" ||
      axiosErr.code === "ENETUNREACH"
    ) {
      return new UnreachableException("Routeur injoignable (connexion refusée)");
    }
    if (axiosErr.response) {
      return new ApiException(
        `Erreur API RouterOS ${axiosErr.response.status}: ${path}`,
        axiosErr.response.status,
      );
    }
    return new UnreachableException();
  }
}
