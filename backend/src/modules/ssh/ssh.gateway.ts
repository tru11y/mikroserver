import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Server, WebSocket, RawData } from "ws";
import { Client as SshClient } from "ssh2";
import { IncomingMessage } from "http";
import { PrismaService } from "../prisma/prisma.service";

interface SshSession {
  ws: WebSocket;
  ssh: SshClient;
}

@WebSocketGateway(3003, {
  cors: { origin: "*" },
  path: "/ws/ssh",
})
export class SshGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(SshGateway.name);
  private readonly sessions = new Map<WebSocket, SshSession>();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const token = url.searchParams.get("token");
    const routerId = url.searchParams.get("routerId");

    if (!token || !routerId) {
      this.send(ws, "\r\n\x1b[31mErreur : token et routerId requis.\x1b[0m\r\n");
      ws.close(4001, "Missing token or routerId");
      return;
    }

    // Verify JWT
    let userId: string;
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET"),
      });
      userId = payload.sub;
    } catch {
      this.send(ws, "\r\n\x1b[31mErreur : token invalide ou expiré.\x1b[0m\r\n");
      ws.close(4003, "Invalid token");
      return;
    }

    // Load router (check ownership via ownerId)
    const router = await this.prisma.router.findFirst({
      where: { id: routerId, deletedAt: null },
      select: {
        id: true,
        wireguardIp: true,
        apiUsername: true,
        apiPasswordHash: true,
        ownerId: true,
      },
    });

    if (!router || !router.wireguardIp) {
      this.send(ws, "\r\n\x1b[31mErreur : routeur introuvable.\x1b[0m\r\n");
      ws.close(4004, "Router not found");
      return;
    }

    // Check user has access (owner or super admin)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    if (!isSuperAdmin && router.ownerId !== userId) {
      this.send(ws, "\r\n\x1b[31mErreur : accès refusé.\x1b[0m\r\n");
      ws.close(4003, "Access denied");
      return;
    }

    this.send(ws, `\r\n\x1b[36mConnexion SSH vers ${router.wireguardIp}...\x1b[0m\r\n`);

    const ssh = new SshClient();

    ssh.on("ready", () => {
      this.logger.log(`SSH ready: router ${routerId} (${router.wireguardIp})`);
      this.send(ws, "\x1b[32mConnecté.\x1b[0m\r\n");

      ssh.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) {
          this.send(ws, `\r\n\x1b[31mErreur shell: ${err.message}\x1b[0m\r\n`);
          ws.close();
          return;
        }

        this.sessions.set(ws, { ws, ssh });

        // SSH → WebSocket
        stream.on("data", (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });
        stream.stderr.on("data", (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });
        stream.on("close", () => {
          this.send(ws, "\r\n\x1b[33mSession SSH fermée.\x1b[0m\r\n");
          ws.close();
        });

        // WebSocket → SSH
        ws.on("message", (data: RawData) => {
          if (stream.writable) {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            // Handle terminal resize message: JSON {"type":"resize","cols":N,"rows":N}
            try {
              const msg = JSON.parse(buf.toString());
              if (msg.type === "resize" && msg.cols && msg.rows) {
                stream.setWindow(msg.rows, msg.cols, 0, 0);
                return;
              }
            } catch { /* not JSON, treat as raw input */ }
            stream.write(buf);
          }
        });
      });
    });

    ssh.on("error", (err) => {
      this.logger.warn(`SSH error for router ${routerId}: ${err.message}`);
      this.send(ws, `\r\n\x1b[31mErreur SSH: ${err.message}\x1b[0m\r\n`);
      ws.close();
    });

    ssh.connect({
      host: router.wireguardIp,
      port: 22,
      username: router.apiUsername,
      password: router.apiPasswordHash,
      readyTimeout: 10000,
      keepaliveInterval: 30000,
    });
  }

  handleDisconnect(ws: WebSocket) {
    const session = this.sessions.get(ws);
    if (session) {
      try { session.ssh.end(); } catch { /* ignore */ }
      this.sessions.delete(ws);
    }
  }

  private send(ws: WebSocket, text: string) {
    if (ws.readyState === WebSocket.OPEN) ws.send(Buffer.from(text));
  }
}
