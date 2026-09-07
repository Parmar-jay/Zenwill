/**
 * ZenWill Real-Time WebSocket Client
 * High-performance, lightweight persistent WebSocket connection for sub-second event propagation.
 * Instantly synchronizes Spartan Cells, Direct Messages, Check-ins, and Live Battles.
 */
import { BASE_URL, TokenStorage } from './api';
import { useSpartanStore } from '../store/spartan-store';
import { useUnreadStore } from '../store/unread-store';

export type RealtimeEventCallback = (payload: any) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private isConnecting: boolean = false;
  private isExplicitlyClosed: boolean = false;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private reconnectAttempts: number = 0;
  private activeSubscriptions: Set<string> = new Set();
  private eventListeners: Map<string, Set<RealtimeEventCallback>> = new Map();

  /**
   * Translates HTTP BASE_URL to WebSocket URL
   * e.g. https://zenwill.onrender.com/api/v1 -> wss://zenwill.onrender.com/api/v1/ws
   */
  private getWsUrl(token: string): string {
    const wsBase = BASE_URL.replace(/^http(s?):/i, 'ws$1:');
    const separator = wsBase.includes('?') ? '&' : '?';
    return `${wsBase}/ws${separator}token=${encodeURIComponent(token)}`;
  }

  /**
   * Connect to the WebSocket server using the active access token
   */
  public async connect(): Promise<void> {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = await TokenStorage.getAccessToken();
    if (!token) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.isConnecting = true;
    this.clearTimers();

    try {
      const url = this.getWsUrl(token);
      const ws = new WebSocket(url);
      this.socket = ws;

      ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Resubscribe to all active channels
        for (const channel of this.activeSubscriptions) {
          this.sendRaw({ action: 'subscribe', channel });
        }

        // Auto-subscribe to current cell if user is in one
        const currentCell = useSpartanStore.getState().myCell;
        if (currentCell?.id) {
          this.subscribe(`cell:${currentCell.id}`);
        }

        // Start 25-second heartbeat ping to prevent connection timeout
        this.pingInterval = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.sendRaw({ action: 'ping' });
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : '';
          if (!raw) return;
          const msg = JSON.parse(raw);
          this.handleIncomingMessage(msg);
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        // Handled in onclose
      };

      ws.onclose = () => {
        this.isConnecting = false;
        this.clearTimers();
        this.socket = null;

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect cleanly on signout or app termination
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearTimers();
    this.activeSubscriptions.clear();
    this.eventListeners.clear();

    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }

  /**
   * Subscribe to a specific real-time channel (e.g. 'cell:<cell_id>', 'battlefield')
   */
  public subscribe(channel: string): void {
    if (!channel) return;
    this.activeSubscriptions.add(channel);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendRaw({ action: 'subscribe', channel });
    }
  }

  /**
   * Unsubscribe from a channel
   */
  public unsubscribe(channel: string): void {
    if (!channel) return;
    this.activeSubscriptions.delete(channel);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendRaw({ action: 'unsubscribe', channel });
    }
  }

  /**
   * Add a listener for a specific event type
   */
  public on(eventType: string, cb: RealtimeEventCallback): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(cb);

    return () => {
      this.eventListeners.get(eventType)?.delete(cb);
    };
  }

  private sendRaw(data: any): void {
    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(data));
      }
    } catch {}
  }

  private handleIncomingMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;
    const type = msg.type;
    if (!type) return;

    // 1. Dispatch to Spartan Store for instant sub-second UI updates
    if (type === 'CELL_UPDATED' && msg.data) {
      const spartan = useSpartanStore.getState();
      const myCell = spartan.myCell;
      if (myCell && (myCell.id === msg.cell_id || myCell.id === msg.data.id || myCell.join_code === msg.data.join_code)) {
        useSpartanStore.setState({ myCell: msg.data });
      }
      // Update cell in leaderboard if visible
      if (spartan.cellLeaderboard.some((c) => c.id === msg.cell_id || c.id === msg.data.id)) {
        useSpartanStore.setState({
          cellLeaderboard: spartan.cellLeaderboard.map((c) =>
            c.id === msg.cell_id || c.id === msg.data.id ? msg.data : c
          ),
        });
      }
    } else if (type === 'CELL_DELETED') {
      const myCell = useSpartanStore.getState().myCell;
      if (myCell && myCell.id === msg.cell_id) {
        useSpartanStore.setState({ myCell: null });
      }
    } else if (type === 'PUBLIC_CELLS_CHANGED') {
      useSpartanStore.getState().fetchPublicCells().catch(() => {});
    } else if (type === 'LEADERBOARD_UPDATED') {
      useSpartanStore.getState().fetchCellLeaderboard().catch(() => {});
    } else if (type === 'DM_RECEIVED' || type === 'UNREAD_COUNT_CHANGED') {
      useUnreadStore.getState().fetchUnreadCount().catch(() => {});
    } else if (type === 'BATTLE_UPDATED' && msg.data) {
      useSpartanStore.setState({ activeBattle: msg.data });
    }

    // 2. Notify custom registered listeners
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      for (const cb of listeners) {
        try {
          cb(msg);
        } catch {}
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed || this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 12000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const realtimeClient = new RealtimeClient();
