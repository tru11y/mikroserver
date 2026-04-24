export interface SystemResource {
  uptime: string;
  version: string;
  "build-time": string;
  cpu: string;
  "cpu-count": string;
  "cpu-load": string;
  "free-memory": string;
  "total-memory": string;
  "free-hdd-space": string;
  "total-hdd-space": string;
  "architecture-name": string;
  "board-name": string;
  platform: string;
  [key: string]: string;
}

export interface SystemIdentity {
  name: string;
}

export interface ConnectionParams {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  timeoutMs?: number;
}

export interface IMikroTikClient {
  systemResource(): Promise<SystemResource>;
  systemIdentity(): Promise<SystemIdentity>;
  list<T = Record<string, unknown>>(
    path: string,
    filters?: Record<string, string>,
  ): Promise<T[]>;
  add(path: string, data: Record<string, unknown>): Promise<{ ".id": string }>;
  set(path: string, id: string, data: Record<string, unknown>): Promise<void>;
  remove(path: string, id: string): Promise<void>;
  close(): Promise<void>;
  readonly transport: "rest" | "binary";
}
