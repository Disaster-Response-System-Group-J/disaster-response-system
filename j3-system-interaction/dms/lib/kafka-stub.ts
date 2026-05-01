// ============================================================
// J3 Kafka Event Consumer/Producer Stubs
// ============================================================
// This file serves as the contract and stub for integration with J4.
// When actual Kafka is deployed, this will be replaced with kafkajs implementation.

import { KafkaEvent, SOSReportEvent, PublicReportEvent, RiskAlertEvent } from '@/types';

type EventHandler = (event: KafkaEvent) => Promise<void>;

class KafkaClientStub {
  private handlers: Map<string, EventHandler[]> = new Map();

  // Topics J3 needs to consume
  public readonly TOPICS = {
    RAW_SOS_REPORTS: 'j1.sos.raw-reports',
    RISK_ALERTS: 'j2.engine.risk-alerts',
    RESOURCE_REC: 'j2.engine.resource-recommendations',
  };

  // Topics J3 needs to produce to
  public readonly PRODUCE_TOPICS = {
    RAW_PUBLIC_REPORTS: 'j3.portal.raw-reports',
    INCIDENT_UPDATES: 'j3.dashboard.incident-updates',
    RESOURCE_UPDATES: 'j3.dashboard.resource-updates',
  };

  /**
   * Subscribe to a Kafka topic
   */
  public subscribe(topic: string, handler: EventHandler) {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)?.push(handler);
    console.log(`[Kafka Stub] Subscribed to topic: ${topic}`);
  }

  /**
   * Publish an event to a Kafka topic
   */
  public async publish(topic: string, event: KafkaEvent): Promise<void> {
    console.log(`[Kafka Stub] Published to ${topic}:`, event.eventId);
    // In a real scenario, this goes to the broker.
    // For mock testing, we can simulate local routing if needed.
  }

  // --- Mock Generators (To simulate incoming data for testing) ---

  public simulateIncomingSOS() {
    const mockEvent: SOSReportEvent = {
      eventId: `EVT-${Date.now()}`,
      eventType: 'raw-sos-report',
      timestamp: new Date().toISOString(),
      payload: {
        sosId: `SOS-${Math.floor(Math.random() * 1000)}`,
        source: 'J1_SOS_APP' as any,
        sosType: 'FLOOD',
        district: 'Ratnapura',
        latitude: 6.68,
        longitude: 80.4,
      }
    };
    this.triggerLocal(this.TOPICS.RAW_SOS_REPORTS, mockEvent);
  }

  private triggerLocal(topic: string, event: KafkaEvent) {
    const topicHandlers = this.handlers.get(topic) || [];
    topicHandlers.forEach(handler => handler(event));
  }
}

export const kafkaClient = new KafkaClientStub();
