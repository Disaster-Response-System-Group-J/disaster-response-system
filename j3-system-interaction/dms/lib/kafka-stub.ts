// Real Kafka event client — connects to the j3-event-bridge Socket.IO server.
// The event bridge sits between Kafka and the Next.js frontend; this client
// subscribes to the bridge's WebSocket emissions and forwards UI actions back.

import { io, Socket } from "socket.io-client";
import { KafkaEvent } from "@/types";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:3001";

type EventHandler = (event: KafkaEvent) => void;

class KafkaEventClient {
  private socket: Socket;

  // Topics this client conceptually consumes (via the bridge)
  public readonly TOPICS = {
    RAW_SOS_REPORTS: "j1.sos.raw-reports",
    RISK_ALERTS: "j2.engine.risk-alerts",
    RESOURCE_REC: "j2.engine.resource-recommendations",
  };

  // Topics this client conceptually produces to (via the bridge)
  public readonly PRODUCE_TOPICS = {
    RAW_PUBLIC_REPORTS: "j3.portal.raw-reports",
    INCIDENT_UPDATES: "j3.dashboard.incident-updates",
    RESOURCE_UPDATES: "j3.dashboard.resource-updates",
  };

  constructor() {
    this.socket = io(BRIDGE_URL, { autoConnect: true, reconnection: true });

    this.socket.on("connect", () =>
      console.log(`[EventBridge] Connected (id=${this.socket.id})`)
    );
    this.socket.on("disconnect", (reason) =>
      console.warn(`[EventBridge] Disconnected: ${reason}`)
    );
    this.socket.on("connect_error", (err) =>
      console.error(`[EventBridge] Connection error: ${err.message}`)
    );
  }

  // ── Inbound event subscriptions ─────────────────────────────────────────

  public subscribe(socketEvent: string, handler: EventHandler): void {
    this.socket.on(socketEvent, handler);
    console.log(`[EventBridge] Subscribed to socket event: ${socketEvent}`);
  }

  public onRiskAlert(handler: EventHandler): void {
    this.socket.on("dashboard:risk-alert", handler);
  }

  public onNewReport(handler: EventHandler): void {
    this.socket.on("dashboard:new-report", handler);
  }

  public onSensorUpdate(handler: EventHandler): void {
    this.socket.on("sensor:telemetry-update", handler);
  }

  public onNewIncident(handler: EventHandler): void {
    this.socket.on("dashboard:new-incident", handler);
  }

  public onReportUpdated(handler: EventHandler): void {
    this.socket.on("dashboard:report-updated", handler);
  }

  public onResourceUpdated(handler: EventHandler): void {
    this.socket.on("dashboard:resource-updated", handler);
  }

  // ── Outbound actions (UI → bridge → Kafka) ───────────────────────────────

  public async publish(_topic: string, event: KafkaEvent): Promise<void> {
    // Generic publish — not used directly; use the typed helpers below.
    console.log(`[EventBridge] publish called for event ${event.eventId}`);
  }

  public updateReportStatus(reportId: string, status: string): void {
    this.socket.emit("client:update-report-status", { reportId, status });
  }

  public updateResourceStatus(
    resourceId: string,
    status: string,
    lastUpdated: string
  ): void {
    this.socket.emit("client:update-resource-status", {
      resourceId,
      status,
      lastUpdated,
    });
  }

  // ── Test helpers (kept for local dev simulation) ─────────────────────────

  public simulateIncomingSOS(): void {
    const mockEvent = {
      eventId: `EVT-${Date.now()}`,
      eventType: "raw-sos-report",
      timestamp: new Date().toISOString(),
      payload: {
        sosId: `SOS-${Math.floor(Math.random() * 1000)}`,
        source: "J1_SOS_APP",
        sosType: "FLOOD",
        district: "Ratnapura",
        latitude: 6.68,
        longitude: 80.4,
      },
    };
    // Emit locally so subscribed handlers still fire during dev without a live bridge
    this.socket.emit("dashboard:new-report", mockEvent);
  }
}

export const kafkaClient = new KafkaEventClient();
