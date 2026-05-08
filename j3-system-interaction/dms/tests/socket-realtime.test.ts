import { beforeEach, describe, expect, it, vi } from 'vitest';
import { socketService } from '@/lib/socket-stub';

describe('WebSocket testing - socketService realtime behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('connect() logs successful realtime connection setup', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    socketService.connect();

    expect(logSpy).toHaveBeenCalledWith('[Socket Stub] Connected to real-time stream');
  });

  it('pushes updates to all subscribers for same event', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const payload = { reportId: 'REP-001', verificationStatus: 'VERIFIED' };

    socketService.on(socketService.EVENTS.NEW_REPORT, listenerA);
    socketService.on(socketService.EVENTS.NEW_REPORT, listenerB);
    socketService.emitToClients(socketService.EVENTS.NEW_REPORT, payload);

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerA).toHaveBeenCalledWith(payload);
    expect(listenerB).toHaveBeenCalledWith(payload);
  });

  it('does not call removed listeners after off()', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    const payload = { incidentId: 'INC-456', status: 'UNDER_RESPONSE' };

    socketService.on(socketService.EVENTS.INCIDENT_UPDATED, listenerA);
    socketService.on(socketService.EVENTS.INCIDENT_UPDATED, listenerB);
    socketService.off(socketService.EVENTS.INCIDENT_UPDATED, listenerA);
    socketService.emitToClients(socketService.EVENTS.INCIDENT_UPDATED, payload);

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledWith(payload);
  });
});
