/**
 * ZenWill Real-Time WebSocket Client
 * High-performance, lightweight persistent WebSocket connection for sub-second event propagation.
 * Instantly synchronizes Spartan Cells, Direct Messages, Check-ins, and Live Battles.
 */
import { BASE_URL, TokenStorage } from './api';
import { useSpartanStore } from '../store/spartan-store';
import { useUnreadStore } from '../store/unread-store';
import { useAuthStore } from '../store/auth-store';

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
      const authUser = useAuthStore.getState().user;
      const currentUserId = authUser?.id ? String(authUser.id) : null;
      const currentUserEmail = authUser?.email ? authUser.email.trim().toLowerCase() : null;

      // Check if this event explicitly signifies that the current user departed
      const isCurrentUserDeparted = msg.event === 'member_left' && (
        (currentUserId && msg.user_id && String(msg.user_id) === currentUserId) ||
        (currentUserEmail && msg.user_email && String(msg.user_email).trim().toLowerCase() === currentUserEmail)
      );

      // Check if this event explicitly signifies that the current user joined
      const isCurrentUserJoined = msg.event === 'member_joined' && (
        (currentUserId && msg.user_id && String(msg.user_id) === currentUserId) ||
        (currentUserEmail && msg.user_email && String(msg.user_email).trim().toLowerCase() === currentUserEmail)
      );

      const myCell = spartan.myCell;
      const isTargetingMyCell = !!(myCell && (
        myCell.id === msg.cell_id ||
        myCell.id === msg.data?.id ||
        myCell.join_code === msg.data?.join_code
      ));

      if (isCurrentUserDeparted) {
        // ONLY clear myCell if this event targets the cell user is currently in!
        // Never wipe a newly joined cell due to prior cell departure broadcasts!
        if (isTargetingMyCell) {
          useSpartanStore.setState({ myCell: null });
          if (msg.cell_id) {
            this.unsubscribe(`cell:${msg.cell_id}`);
          }
        }
      } else if (isCurrentUserJoined) {
        // Current user joined this cell: immediately bind it to state
        useSpartanStore.setState({ myCell: msg.data });
        if (msg.cell_id || msg.data?.id) {
          this.subscribe(`cell:${msg.cell_id || msg.data?.id}`);
        }
      } else if (isTargetingMyCell) {
        // Seamlessly update live stats, members, streaks, and shields in real time
        useSpartanStore.setState({ myCell: msg.data });
      }

      // Update cell in leaderboard if visible
      if (spartan.cellLeaderboard.some((c) => c.id === msg.cell_id || c.id === msg.data?.id)) {
        useSpartanStore.setState({
          cellLeaderboard: spartan.cellLeaderboard.map((c) =>
            c.id === msg.cell_id || c.id === msg.data?.id ? msg.data : c
          ),
        });
      }
    } else if (type === 'JOIN_REQUEST_APPROVED' && msg.data) {
      // Applicant approved! Bind cell data and subscribe to cell channel
      const store = useSpartanStore.getState();
      const code = msg.join_code || msg.cell_id;
      useSpartanStore.setState({
        myCell: msg.data,
        myPendingRequests: store.myPendingRequests.filter((k) => k !== code && k !== msg.cell_id),
      });
      if (msg.cell_id || msg.data.id) {
        this.subscribe(`cell:${msg.cell_id || msg.data.id}`);
      }
    } else if (type === 'JOIN_REQUEST_REJECTED') {
      const store = useSpartanStore.getState();
      const code = msg.join_code || msg.cell_id;
      useSpartanStore.setState({
        myPendingRequests: store.myPendingRequests.filter((k) => k !== code && k !== msg.cell_id),
      });
    } else if (type === 'JOIN_REQUEST_SUBMITTED') {
      const store = useSpartanStore.getState();
      const key = msg.join_code || msg.cell_id;
      if (key && !store.myPendingRequests.includes(key)) {
        useSpartanStore.setState({
          myPendingRequests: [...store.myPendingRequests, key],
        });
      }
    } else if (type === 'MEMBER_KICKED') {
      const myCell = useSpartanStore.getState().myCell;
      if (myCell && (myCell.id === msg.cell_id || myCell.id === msg.data?.id)) {
        useSpartanStore.setState({ myCell: null });
        if (msg.cell_id) {
          this.unsubscribe(`cell:${msg.cell_id}`);
        }
      }
    } else if (type === 'PROMOTED_TO_CO_LEADER' && msg.data) {
      useSpartanStore.setState({ myCell: msg.data });
    } else if (type === 'CELL_DELETED') {
      const myCell = useSpartanStore.getState().myCell;
      if (!msg.cell_id || (myCell && (myCell.id === msg.cell_id || myCell.id === msg.data?.id))) {
        useSpartanStore.setState({ myCell: null });
        if (msg.cell_id) {
          this.unsubscribe(`cell:${msg.cell_id}`);
        }
      }
    } else if (type === 'CELL_LEFT') {
      const myCell = useSpartanStore.getState().myCell;
      if (myCell?.id) {
        this.unsubscribe(`cell:${myCell.id}`);
      }
      useSpartanStore.setState({ myCell: null });
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
