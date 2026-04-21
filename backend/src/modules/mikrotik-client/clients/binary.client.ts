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
} from "../exceptions/mikrotik.exceptions";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const MikroNode = require("mikrotik");

/**
 * RouterOS binary API client (legacy, for RouterOS < 7.1).
 * Uses the `mikrotik` npm package.
 */
export class BinaryClient implements IMikroTikClient {
  readonly transport = "binary" as const;
  private connection: ReturnType<typeof MikroNode.prototype.connect> | null =
    null;
  private device: InstanceType<typeof MikroNode> | null = null;

  constructor(private readonly params: ConnectionParams) {}

  private async ensureConnection(): Promise<void> {
    if (this.connection) return;
    try {
      this.device = new MikroNode(this.params.host, this.params.port, {
        timeout: this.params.timeoutMs ?? 10_000,
        closeOnDone: false,
      });
      const [login] = await this.device.connect();
      this.connection = login;
      await this.connection.login(this.params.username, this.params.password);
    } catch (err) {
      this.connection = null;
      this.device = null;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("cannot log in") || msg.includes("invalid user")) {
        throw new AuthFailedException();
      }
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENETUNREACH")
      ) {
        throw new UnreachableException();
      }
      throw new ApiException(`Binary API connection failed: ${msg}`);
    }
  }

  private async exec<T>(command: string, args?: string[]): Promise<T[]> {
    await this.ensureConnection();
    try {
      const chan = this.connection.openChannel();
      chan.write(command, args);
      const data = await chan.read();
      chan.close();
      return MikroNode.parseItems(data) as T[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ApiException(`Binary API error: ${msg}`);
    }
  }

  async systemResource(): Promise<SystemResource> {
    const items = await this.exec<SystemResource>("/system/resource/print");
    return items[0];
  }

  async systemIdentity(): Promise<SystemIdentity> {
    const items = await this.exec<SystemIdentity>("/system/identity/print");
    return items[0];
  }

  async list<T = Record<string, unknown>>(
    path: string,
    filters?: Record<string, string>,
  ): Promise<T[]> {
    const args = filters
      ? Object.entries(filters).map(([k, v]) => `?${k}=${v}`)
      : undefined;
    return this.exec<T>(`${path}/print`, args);
  }

  async add(
    path: string,
    data: Record<string, unknown>,
  ): Promise<{ ".id": string }> {
    const args = Object.entries(data).map(([k, v]) => `=${k}=${String(v)}`);
    const items = await this.exec<{ ret: string }>(`${path}/add`, args);
    return { ".id": items[0]?.ret ?? "" };
  }

  async set(
    path: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const args = [
      `=.id=${id}`,
      ...Object.entries(data).map(([k, v]) => `=${k}=${String(v)}`),
    ];
    await this.exec(`${path}/set`, args);
  }

  async remove(path: string, id: string): Promise<void> {
    await this.exec(`${path}/remove`, [`=.id=${id}`]);
  }

  async close(): Promise<void> {
    try {
      if (this.connection) {
        this.connection.close();
      }
      if (this.device) {
        this.device.close();
      }
    } catch {
      // swallow
    }
    this.connection = null;
    this.device = null;
  }
}
