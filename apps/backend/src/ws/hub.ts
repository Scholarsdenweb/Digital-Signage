import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { URL } from 'node:url';
import { WS, type WsMessage, type WsEventName } from '@dsm/shared';
import { verifyAccessToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { hashDeviceToken } from '../lib/tokens.js';
import { logger } from '../lib/logger.js';
import { recordHeartbeat } from '../modules/devices/heartbeat.service.js';
import { markCommandAcked } from '../modules/commands/commands.service.js';

const DASHBOARD_ROOM = 'dashboard';

interface Client {
  socket: WebSocket;
  kind: 'device' | 'mgmt';
  screenId?: string;
  userId?: string;
  alive: boolean;
}

class WsHub {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, Client>();
  /** screenId -> set of device sockets */
  private screenRooms = new Map<string, Set<WebSocket>>();
  private dashboard = new Set<WebSocket>();

  init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket, req) => this.onConnection(socket, req.url ?? ''));

    // heartbeat ping/pong to detect dead sockets
    setInterval(() => {
      for (const [socket, client] of this.clients) {
        if (!client.alive) {
          socket.terminate();
          this.cleanup(socket);
          continue;
        }
        client.alive = false;
        socket.ping();
      }
    }, 30_000).unref();

    logger.info('WebSocket hub initialised at /ws');
  }

  private async onConnection(socket: WebSocket, url: string) {
    const parsed = new URL(url, 'http://localhost');
    const type = parsed.searchParams.get('type'); // 'device' | 'mgmt'
    const client: Client = { socket, kind: type === 'mgmt' ? 'mgmt' : 'device', alive: true };
    this.clients.set(socket, client);

    socket.on('pong', () => {
      const c = this.clients.get(socket);
      if (c) c.alive = true;
    });

    // Management sockets authenticate via ?token=<jwt>
    if (client.kind === 'mgmt') {
      const token = parsed.searchParams.get('token') ?? '';
      try {
        verifyAccessToken(token);
        this.dashboard.add(socket);
        this.send(socket, { event: WS.ACK, data: { room: 'dashboard' } });
      } catch {
        this.send(socket, { event: WS.ERROR, data: { message: 'auth failed' } });
        socket.close();
        return;
      }
    }

    socket.on('message', (raw) => this.onMessage(socket, raw.toString()));
    socket.on('close', () => this.cleanup(socket));
    socket.on('error', () => this.cleanup(socket));
  }

  private async onMessage(socket: WebSocket, raw: string) {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const client = this.clients.get(socket);
    if (!client) return;

    // Guard every handler: a transient DB error must not become an unhandledRejection
    // or crash the process — just log it and keep the socket alive.
    try {
      switch (msg.event) {
        case WS.HELLO: {
          // device authenticates over the socket
          const { deviceToken } = (msg.data ?? {}) as { deviceToken?: string };
          if (!deviceToken) return this.rejectDevice(socket);
          const cred = await prisma.deviceCredential.findUnique({
            where: { tokenHash: hashDeviceToken(deviceToken) },
            include: { screen: true },
          });
          if (!cred || cred.revokedAt) return this.rejectDevice(socket, WS.DEVICE_REVOKED);
          if (cred.screen.status === 'DISABLED') return this.rejectDevice(socket, WS.DEVICE_DISABLED);

          client.screenId = cred.screenId;
          this.joinScreen(socket, cred.screenId);
          this.send(socket, { event: WS.ACK, data: { screenId: cred.screenId } });
          this.notifyDashboardStatus(cred.screenId, true);
          break;
        }
        case WS.HEARTBEAT: {
          if (!client.screenId) return;
          await recordHeartbeat(client.screenId, { ...(msg.data as object), wsConnected: true } as never);
          break;
        }
        case WS.COMMAND_ACK: {
          const { commandId } = (msg.data ?? {}) as { commandId?: string };
          if (commandId) await markCommandAcked(commandId);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      logger.warn({ err, event: msg.event }, 'WS message handler failed');
    }
  }

  private rejectDevice(socket: WebSocket, reason: WsEventName = WS.ERROR) {
    this.send(socket, { event: reason });
    socket.close();
  }

  private joinScreen(socket: WebSocket, screenId: string) {
    let room = this.screenRooms.get(screenId);
    if (!room) {
      room = new Set();
      this.screenRooms.set(screenId, room);
    }
    room.add(socket);
  }

  private cleanup(socket: WebSocket) {
    const client = this.clients.get(socket);
    if (client?.screenId) {
      this.screenRooms.get(client.screenId)?.delete(socket);
      this.notifyDashboardStatus(client.screenId, false);
    }
    this.dashboard.delete(socket);
    this.clients.delete(socket);
  }

  private send(socket: WebSocket, msg: WsMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ ...msg, ts: Date.now() }));
    }
  }

  // ── Public broadcast API (used by services) ──
  broadcastToScreen(screenId: string, msg: WsMessage) {
    const room = this.screenRooms.get(screenId);
    if (!room) return;
    for (const s of room) this.send(s, msg);
  }

  broadcastToDashboard(msg: WsMessage) {
    for (const s of this.dashboard) this.send(s, msg);
  }

  isScreenConnected(screenId: string): boolean {
    const room = this.screenRooms.get(screenId);
    return !!room && room.size > 0;
  }

  private notifyDashboardStatus(screenId: string, connected: boolean) {
    this.broadcastToDashboard({
      event: WS.SCREEN_STATUS_CHANGED,
      data: { screenId, wsConnected: connected },
    });
  }
}

export const wsHub = new WsHub();
