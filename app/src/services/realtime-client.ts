/**
 * ZenWill Real-Time WebSocket Client
 * Connects to the backend Real-Time Bus for instantaneous Spartan Cell synchronization,
 * join request updates, member role promotions/removals, and live DM reminders.
 */
import { BASE_URL, TokenStorage } from './api';
import { useSpartanStore } from '../store/spartan-store';
import { useAuthStore } from '../store/auth-store';

type EventListener = (data: any) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private isConnecting: boolean = false;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private subscribedChannels: Set<string> = new Set();
  private isExplicitlyClosed: boolean = false;

  private getWsUrl(token: string): string {
    const isHttps = BASE_URL.startsWith('https://');
    const hostAndPath = BASE_URL.replace(/^https?:\/\//, '');
    const protocol = isHttps ? 'wss://' : 'ws://';
    return `${protocol}${hostAndPath}/ws?token=${encodeURIComponent(token)}`;
  }

  public async connect(): Promise<void> {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.isConnecting) return;

    this.isConnecting = true;
    this.isExplicitlyClosed = false;

    try {
      const token = await TokenStorage.getAccessToken();
      if (!token) {
        this.isConnecting = false;
        return;
      }

      const wsUrl = this.getWsUrl(token);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnecting = false;
        // Start ping heartbeat every 20s
        this.startHeartbeat();

        // Resubscribe to public_cells and active cell channel
        this.subscribe('public_cells');
        const activeCellId = useSpartanStore.getState().myCell?.id;
        if (activeCellId) {
          this.subscribe(`cell:${activeCellId}`);
        }

        // Re-subscribe to any previously subscribed channels
        this.subscribedChannels.forEach((ch) => {
          this.send({ action: 'subscribe', channel: ch });
        });
      };

      this.socket.onmessage = (event: WebSocketMessageEvent) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
        } catch {}
      };

      this.socket.onerror = () => {
        this.isConnecting = false;
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.stopHeartbeat();
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
  }

  public subscribe(channel: string): void {
    if (!channel) return;
    this.subscribedChannels.add(channel);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({ action: 'subscribe', channel });
    }
  }

  public unsubscribe(channel: string): void {
    if (!channel) return;
    this.subscribedChannels.delete(channel);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({ action: 'unsubscribe', channel });
    }
  }

  public send(payload: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(payload));
      } catch {}
    }
  }

  public on(eventType: string, callback: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  private handleIncomingEvent(data: any): void {
    const type = data?.type;
    if (!type) return;

    // Dispatch to registered custom event listeners
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(data);
        } catch {}
      });
    }

    // Default global synchronization handlers
    switch (type) {
      case 'CELL_UPDATED': {
        if (data.data) {
          const currentCell = useSpartanStore.getState().myCell;
          if (currentCell && String(currentCell.id) === String(data.cell_id)) {
            useSpartanStore.setState({ myCell: data.data });
          }
        }
        useSpartanStore.getState().fetchPublicCells().catch(() => {});
        break;
      }
      case 'JOIN_REQUEST_RECEIVED': {
        if (data.data) {
          const currentCell = useSpartanStore.getState().myCell;
          if (currentCell && String(currentCell.id) === String(data.cell_id)) {
            useSpartanStore.setState({ myCell: data.data });
          }
        }
        useSpartanStore.getState().fetchMyCell({ showLoading: false }).catch(() => {});
        break;
      }
      case 'JOIN_REQUEST_APPROVED': {
        // Applicant was approved by leadership! Immediately sync active cell
        useSpartanStore.getState().fetchMyCell({ showLoading: false }).then((c) => {
          if (c?.id) {
            this.subscribe(`cell:${c.id}`);
          }
        }).catch(() => {});
        useSpartanStore.getState().fetchPublicCells().catch(() => {});
        useSpartanStore.getState().fetchMyJoinRequests().catch(() => {});
        break;
      }
      case 'JOIN_REQUEST_REJECTED': {
        const rejectedCellId = data.cell_id ? String(data.cell_id).trim().toLowerCase() : null;
        if (rejectedCellId) {
          useSpartanStore.setState((state) => ({
            myPendingRequests: state.myPendingRequests.filter(
              (k) => k && k.trim().toLowerCase() !== rejectedCellId
            ),
          }));
        }
        useSpartanStore.getState().fetchMyJoinRequests().catch(() => {});
        useSpartanStore.getState().fetchPublicCells().catch(() => {});
        break;
      }
      case 'MEMBER_KICKED': {
        // Current user was kicked from the cell
        const currentCell = useSpartanStore.getState().myCell;
        if (currentCell && String(currentCell.id) === String(data.cell_id)) {
          this.unsubscribe(`cell:${currentCell.id}`);
          useSpartanStore.setState({ myCell: null });
        }
        useSpartanStore.getState().fetchPublicCells().catch(() => {});
        useSpartanStore.getState().fetchMyJoinRequests().catch(() => {});
        break;
      }
      case 'PROMOTED_TO_CO_LEADER':
      case 'DEMOTED_FROM_CO_LEADER': {
        if (data.data) {
          useSpartanStore.setState({ myCell: data.data });
        } else {
          useSpartanStore.getState().fetchMyCell({ showLoading: false }).catch(() => {});
        }
        break;
      }
      case 'CELL_LEFT':
      case 'CELL_DELETED': {
        const currentCell = useSpartanStore.getState().myCell;
        if (!data.cell_id || (currentCell && String(currentCell.id) === String(data.cell_id))) {
          if (currentCell?.id) this.unsubscribe(`cell:${currentCell.id}`);
          useSpartanStore.setState({ myCell: null });
        }
        useSpartanStore.getState().fetchPublicCells().catch(() => {});
        break;
      }
      case 'PUBLIC_CELLS_CHANGED': {
        useSpartanStore.getState().fetchPublicCells().catch(() => {});
        break;
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      this.send({ action: 'ping' });
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }
}

export const realtimeClient = new RealtimeClient();
