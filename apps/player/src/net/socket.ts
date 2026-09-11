import { config } from '../config.js';
import { WS, type WsMessage } from '@dsm/shared';

type Handler = (msg: WsMessage) => void;

/** Resilient device socket: authenticates via HELLO, auto-reconnects with backoff. */
export class DeviceSocket {
  private ws: WebSocket | null = null;
  private token: string;
  private handler: Handler;
  private backoff = 1000;
  private closed = false;
  private heartbeatTimer?: number;
  private onConnChange?: (connected: boolean) => void;

  constructor(token: string, handler: Handler, onConnChange?: (c: boolean) => void) {
    this.token = token;
    this.handler = handler;
    this.onConnChange = onConnChange;
  }

  connect() {
    this.closed = false;
    try {
      this.ws = new WebSocket(`${config.wsUrl}/ws?type=device`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.backoff = 1000;
      this.send({ event: WS.HELLO, data: { deviceToken: this.token, playerVersion: config.playerVersion } });
      this.onConnChange?.(true);
    };
    this.ws.onmessage = (e) => {
      try {
        this.handler(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    this.ws.onclose = () => {
      this.onConnChange?.(false);
      if (!this.closed) this.scheduleReconnect();
    };
    this.ws.onerror = () => this.ws?.close();
  }

  private scheduleReconnect() {
    window.setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }

  send(msg: WsMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.closed = true;
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.ws?.close();
  }
}
