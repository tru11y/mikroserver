import type {
  HotspotActiveClient,
  HotspotUserConfig,
  HotspotUserRecord,
  MikroTikConnection,
} from "./router-api.types";

type ParseItemsFn = <T>(data: unknown) => T[];

type FindFieldName = "name" | "user";

type RemoveCommand =
  | "/ip/hotspot/user/remove"
  | "/ip/hotspot/active/remove"
  | "/ip/hotspot/ip-binding/remove"
  | "/ip/hotspot/user/profile/remove";

export async function addHotspotUser(
  conn: MikroTikConnection,
  config: HotspotUserConfig,
): Promise<void> {
  const channel = conn.openChannel();

  await new Promise<void>((resolve, reject) => {
    const commands = [
      "/ip/hotspot/user/add",
      `=name=${config.username}`,
      `=password=${config.password}`,
      `=profile=${config.profile}`,
      `=comment=${config.comment}`,
      `=limit-uptime=${config.limitUptime}`,
    ];

    if (config.limitBytesIn) {
      commands.push(`=limit-bytes-in=${config.limitBytesIn}`);
    }
    if (config.limitBytesOut) {
      commands.push(`=limit-bytes-out=${config.limitBytesOut}`);
    }

    channel.write(commands);
    channel.on("trap", (err: unknown) => {
      const msg =
        typeof err === "object" && err !== null
          ? JSON.stringify(err)
          : String(err);
      reject(new Error(`RouterOS trap: ${msg}`));
    });
    channel.once("done", () => resolve());
  });
}

export async function updateHotspotUserProfileById(
  conn: MikroTikConnection,
  userId: string,
  profile: string,
): Promise<void> {
  const channel = conn.openChannel();

  await new Promise<void>((resolve, reject) => {
    channel.write([
      "/ip/hotspot/user/set",
      `=.id=${userId}`,
      `=profile=${profile}`,
    ]);
    channel.on("trap", (err: unknown) => {
      const msg =
        typeof err === "object" && err !== null
          ? JSON.stringify(err)
          : String(err);
      reject(new Error(`RouterOS trap: ${msg}`));
    });
    channel.once("done", () => resolve());
  });
}

export async function runCommand(
  conn: MikroTikConnection,
  commands: string[],
): Promise<void> {
  const channel = conn.openChannel();

  await new Promise<void>((resolve, reject) => {
    channel.write(commands);
    channel.on("trap", (err: unknown) => {
      const msg =
        typeof err === "object" && err !== null
          ? JSON.stringify(err)
          : String(err);
      reject(new Error(`RouterOS trap: ${msg}`));
    });
    channel.once("done", () => resolve());
  });
}

export async function runParsedCommand<T>(
  conn: MikroTikConnection,
  parseItems: ParseItemsFn,
  command: string,
  parameters: string[] = [],
): Promise<T[]> {
  const channel = conn.openChannel();

  return new Promise<T[]>((resolve, reject) => {
    channel.write([command, ...parameters]);
    channel.on("trap", reject);
    channel.once("done", (data: unknown) => {
      try {
        resolve(parseItems<T>(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function removeById(
  conn: MikroTikConnection,
  command: RemoveCommand,
  id: string,
): Promise<void> {
  return runCommand(conn, [command, `=.id=${id}`]);
}

export async function findIds(
  conn: MikroTikConnection,
  parseItems: ParseItemsFn,
  command: string,
  fieldName: FindFieldName,
  value?: string,
): Promise<string[]> {
  const commands = value ? [`?${fieldName}=${value}`] : [];
  const rows = await runParsedCommand<{ ".id"?: string }>(
    conn,
    parseItems,
    command,
    commands,
  );

  return rows
    .map((row) => row[".id"])
    .filter((id): id is string => Boolean(id));
}

export function findHotspotUserIds(
  conn: MikroTikConnection,
  parseItems: ParseItemsFn,
  username: string,
): Promise<string[]> {
  return findIds(conn, parseItems, "/ip/hotspot/user/print", "name", username);
}

export async function updateHotspotUserRateLimit(
  conn: MikroTikConnection,
  parseItems: ParseItemsFn,
  username: string,
  rateLimit: string,
): Promise<void> {
  const userIds = await findHotspotUserIds(conn, parseItems, username);
  if (userIds.length === 0) {
    throw new Error(`Hotspot user "${username}" introuvable sur le routeur`);
  }
  await runCommand(conn, [
    "/ip/hotspot/user/set",
    `=.id=${userIds[0]}`,
    `=rate-limit=${rateLimit}`,
  ]);
}

export function findActiveSessionIds(
  conn: MikroTikConnection,
  parseItems: ParseItemsFn,
  username: string,
): Promise<string[]> {
  return findIds(
    conn,
    parseItems,
    "/ip/hotspot/active/print",
    "user",
    username,
  );
}

export function findLegacyHotspotUsers(
  conn: MikroTikConnection,
  parseItems: ParseItemsFn,
  username: string,
): Promise<HotspotUserRecord[]> {
  return runParsedCommand<HotspotUserRecord>(
    conn,
    parseItems,
    "/ip/hotspot/user/print",
    [`?name=${username}`],
  );
}

export function findLegacyActiveClients(
  conn: MikroTikConnection,
  parseItems: ParseItemsFn,
  hotspotServer: string | null,
  username: string,
): Promise<HotspotActiveClient[]> {
  return runParsedCommand<HotspotActiveClient>(
    conn,
    parseItems,
    "/ip/hotspot/active/print",
    hotspotServer
      ? [`?server=${hotspotServer}`, `?user=${username}`]
      : [`?user=${username}`],
  );
}
