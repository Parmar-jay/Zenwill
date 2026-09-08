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
  private subscribedChannels: Set<string> = new Set(['public_cells', 'battlefield']);
  private isExplicitlyClosed: boolean = false;
  private debouncedPublicCellsTimer: any = null;

  constructor() {
    // Dynamically react whenever active squad changes in SpartanStore
    useSpartanStore.subscribe((state, prevState) => {
      const currentCellId = state.myCell?.id;
      const prevCellId = prevState?.myCell?.id;
      if (currentCellId !== prevCellId) {
        if (prevCellId) {
          this.unsubscribe(`cell:${prevCellId}`);
        }
        if (currentCellId) {
          this.subscribe(`cell:${currentCellId}`);
        }
      }
    });
  }

  public isSocketConnected(): boolean {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  private getWsUrl(token: string): string {
    const isHttps = BASE_URL.startsWith('https://');
    const hostAndPath = BASE_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
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

        // Subscribe to public channels
        this.subscribe('public_cells');
        this.subscribe('battlefield');

        // Subscribe to current active cell channel if present in store
        const activeCellId = useSpartanStore.getState().myCell?.id;
        if (activeCellId) {
          this.subscribe(`cell:${activeCellId}`);
        }

        // Re-subscribe to all registered channels
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

  private schedulePublicCellsFetch(): void {
    if (this.debouncedPublicCellsTimer) return;
    this.debouncedPublicCellsTimer = setTimeout(() => {
      this.debouncedPublicCellsTimer = null;
      useSpartanStore.getState().fetchPublicCells().catch(() => {});
    }, 400);
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
          const authUser = useAuthStore.getState().user;
          const uid = authUser?.id ? String(authUser.id).toLowerCase() : null;
          const email = authUser?.email ? authUser.email.toLowerCase() : null;

          const isUserInUpdatedCell = Boolean(
            (currentCell && String(currentCell.id) === String(data.cell_id)) ||
            (data.data.leader_id && (data.data.leader_id === uid || (email && data.data.leader_id.toLowerCase() === email))) ||
            (Array.isArray(data.data.members) && data.data.members.some((m: any) => {
              const mUid = String(m.user_id || '').toLowerCase();
              const mEmail = String(m.email || '').toLowerCase();
              return (uid && mUid === uid) || (email && mEmail === email);
            }))
          );

          if (isUserInUpdatedCell) {
            useSpartanStore.setState({ myCell: data.data });
          }

          // Seamless in-memory state update for publicCells without hammering the server
          useSpartanStore.setState((state) => ({
            publicCells: state.publicCells.map((c) =>
              String(c.id) === String(data.cell_id) ? { ...c, ...data.data } : c
            ),
          }));
        }
        break;
      }
      case 'JOIN_REQUEST_RECEIVED': {
        if (data.data) {
          const currentCell = useSpartanStore.getState().myCell;
          if (currentCell && String(currentCell.id) === String(data.cell_id)) {
            useSpartanStore.setState({ myCell: data.data });
          }
          useSpartanStore.setState((state) => ({
            publicCells: state.publicCells.map((c) =>
              String(c.id) === String(data.cell_id) ? { ...c, ...data.data } : c
            ),
          }));
        }
        break;
      }
      case 'JOIN_REQUEST_APPROVED': {
        // Applicant was approved by leadership! Immediately sync active cell and mark initial load ready
        if (data.data) {
          useSpartanStore.setState({ myCell: data.data, myPendingRequests: [], hasLoadedInitialCell: true });
        }
        if (data.cell_id) {
          this.subscribe(`cell:${data.cell_id}`);
        }
        useSpartanStore.getState().fetchMyCell({ showLoading: false }).then((c) => {
          if (c?.id) {
            this.subscribe(`cell:${c.id}`);
          }
        }).catch(() => {});
        this.schedulePublicCellsFetch();
        useSpartanStore.getState().fetchMyJoinRequests().catch(() => {});
        break;
      }
      case 'JOIN_REQUEST_REJECTED': {
        const rejectedCellId = data.cell_id ? String(data.cell_id).trim().toLowerCase() : null;
        const rawCode = data.join_code ? String(data.join_code).trim().toLowerCase() : '';
        const pureCode = rawCode.replace('sp-', '').replace('sp ', '').replace('sp', '').trim();

        useSpartanStore.setState((state) => {
          const nextPending = state.myPendingRequests.filter((k) => {
            if (!k) return false;
            const cleanK = String(k).trim().toLowerCase();
            if (rejectedCellId && cleanK === rejectedCellId) return false;
            if (rawCode && (cleanK === rawCode || cleanK === `sp-${pureCode}` || cleanK === pureCode)) return false;
            if (pureCode && cleanK.includes(pureCode)) return false;
            return true;
          });

          const authUser = useAuthStore.getState().user;
          const uid = String(authUser?.id || '').toLowerCase();
          const email = String(authUser?.email || '').toLowerCase();

          const nextPublic = state.publicCells.map((cell) => {
            const matchesId = rejectedCellId && String(cell.id).toLowerCase() === rejectedCellId;
            const matchesCode = rawCode && String(cell.join_code || '').toLowerCase() === rawCode;
            if (matchesId || matchesCode) {
              return {
                ...cell,
                join_requests: (cell.join_requests || []).filter((req: any) => {
                  const rUid = String(req.user_id || '').toLowerCase();
                  const rEmail = String(req.user_email || req.email || '').toLowerCase();
                  return rUid !== uid && rEmail !== email;
                }),
              };
            }
            return cell;
          });

          return { myPendingRequests: nextPending, publicCells: nextPublic };
        });
        useSpartanStore.getState().fetchMyJoinRequests().catch(() => {});
        this.schedulePublicCellsFetch();
        break;
      }
      case 'MEMBER_KICKED': {
        // Current user was kicked from the cell
        const currentCell = useSpartanStore.getState().myCell;
        if (currentCell && (!data.cell_id || String(currentCell.id) === String(data.cell_id))) {
          if (currentCell.id) this.unsubscribe(`cell:${currentCell.id}`);
          useSpartanStore.setState({ myCell: null });
        }
        this.schedulePublicCellsFetch();
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
        this.schedulePublicCellsFetch();
        break;
      }
      case 'PUBLIC_CELLS_CHANGED': {
        this.schedulePublicCellsFetch();
        break;
      }
      case 'BATTLE_UPDATED': {
        if (data.data) {
          useSpartanStore.setState({ activeBattle: data.data });
        }
        break;
      }
      case 'DM_RECEIVED':
      case 'UNREAD_COUNT_CHANGED': {
        try {
          const { useUnreadStore } = require('../store/unread-store');
          useUnreadStore.getState().fetchUnreadCount().catch(() => {});
        } catch {}
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
