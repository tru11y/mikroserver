import type {
  HotspotActiveClient,
  MikroTikConnection,
  MikroTikModule,
} from "./router-api.types";
import { runParsedCommand } from "./router-api.commands";

interface RouterTransportParams {
  mikroNode: MikroTikModule;
  wireguardIp: string;
  apiPort: number;
  username: string;
  password: string;
  timeoutMs: number;
}

export async function connectToRouter(
  params: RouterTransportParams,
): Promise<MikroTikConnection> {
  const connection = params.mikroNode.getConnection(
    params.wireguardIp,
    params.username,
    params.password,
    {
      port: params.apiPort,
      timeout: params.timeoutMs / 1000,
      closeOnDone: false,
      closeOnTimeout: true,
    },
  );

  return connection.getConnectPromise();
}

function withHardTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`RouterOS operation timed out after ${ms}ms (${label})`),
          ),
        ms,
      ),
    ),
  ]);
}

export async function executeRouterOperationResult<T>(
  params: RouterTransportParams & {
    operation: (conn: MikroTikConnection) => Promise<T>;
  },
): Promise<T> {
  const run = async () => {
    const conn = await connectToRouter(params);
    try {
      return await params.operation(conn);
    } finally {
      conn.close();
    }
  };
  return withHardTimeout(
    run(),
    params.timeoutMs,
    "executeRouterOperationResult",
  );
}

export async function executeRouterOperation(
  params: RouterTransportParams & {
    operation: (conn: MikroTikConnection) => Promise<void>;
  },
): Promise<void> {
  const run = async () => {
    const conn = await connectToRouter(params);
    try {
      await params.operation(conn);
    } finally {
      conn.close();
    }
  };
  await withHardTimeout(run(), params.timeoutMs, "executeRouterOperation");
}

export async function fetchRouterHotspotActiveClients(
  params: RouterTransportParams & {
    hotspotServer: string | null;
  },
): Promise<HotspotActiveClient[]> {
  return executeRouterOperationResult({
    ...params,
    operation: async (conn) =>
      runParsedCommand<HotspotActiveClient>(
        conn,
        params.mikroNode.parseItems,
        "/ip/hotspot/active/print",
        params.hotspotServer ? [`?server=${params.hotspotServer}`] : [],
      ),
  });
}

export async function runRouterIdentityCheck(
  params: RouterTransportParams,
): Promise<void> {
  await executeRouterOperation({
    ...params,
    operation: async (conn) => {
      const channel = conn.openChannel();
      await new Promise<void>((resolve, reject) => {
        channel.write(["/system/identity/print"]);
        channel.on("trap", reject);
        channel.once("done", () => resolve());
      });
    },
  });
}
