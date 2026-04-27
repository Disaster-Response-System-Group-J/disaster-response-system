// ============================================================
// J3 Socket.IO Real-time Layer Stub
// ============================================================
// This service will push real-time updates to the browser clients
// when the backend receives new Kafka events or DB updates.

type SocketEventHandler = (data: any) => void;

class SocketServiceStub {
  private listeners: Map<string, SocketEventHandler[]> = new Map();

  // Socket Events
  public readonly EVENTS = {
    NEW_REPORT: 'dashboard:new-report',
    INCIDENT_UPDATED: 'dashboard:incident-updated',
    NEW_ALERT: 'dashboard:new-alert',
    RESOURCE_CHANGED: 'dashboard:resource-changed',
  };

  /**
   * Connect to Socket server (Client side)
   */
  public connect() {
    console.log('[Socket Stub] Connected to real-time stream');
  }

  /**
   * Listen for real-time events (Client side)
   */
  public on(event: string, handler: SocketEventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(handler);
  }

  /**
   * Unsubscribe (Client side)
   */
  public off(event: string, handler: SocketEventHandler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      this.listeners.set(event, handlers.filter(h => h !== handler));
    }
  }

  /**
   * Emit event to clients (Server side)
   */
  public emitToClients(event: string, data: any) {
    console.log(`[Socket Stub] Broadcasting event ${event} to clients`);
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(h => h(data));
  }
}

export const socketService = new SocketServiceStub();
