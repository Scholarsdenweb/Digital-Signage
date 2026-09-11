import { useEffect, useRef } from 'react';
import type { WsMessage } from '@dsm/shared';
import { api } from './client.js';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:4000';
type Handler = (msg: WsMessage) => void;

/**
 * Single shared management WebSocket. Connects as `type=mgmt` with the current
 * access token, joins the backend's dashboard room, and fans out live events
 * (heartbeats, screen status, publishes, pairing requests) to subscribers.
 * Auto-reconnects with backoff.
 */
class MgmtSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private backoff = 1000;
  private closed = false;

  private ensureConnected() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.connect();
  }

  private connect() {
    const token = api.tokens.get()?.accessToken;
    if (!token) return; // not logged in
    this.closed = false;
    try {
      this.ws = new WebSocket(`${WS_URL}/ws?type=mgmt&token=${encodeURIComponent(token)}`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => (this.backoff = 1000);
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        /* ignore */
      }
    };
    this.ws.onclose = () => {
      if (!this.closed) this.scheduleReconnect();
    };
    this.ws.onerror = () => this.ws?.close();
  }

  private scheduleReconnect() {
    setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30000);
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    this.ensureConnected();
    return () => {
      this.handlers.delete(handler);
    };
  }

  disconnect() {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }
}

export const mgmtSocket = new MgmtSocket();

/** Subscribe a component to live management events (stable across renders). */
export function useLive(onMessage: Handler) {
  const ref = useRef(onMessage);
  ref.current = onMessage;
  useEffect(() => mgmtSocket.subscribe((m) => ref.current(m)), []);
}
