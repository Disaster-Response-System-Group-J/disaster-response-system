import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import GlobalSocketListener from '@/components/auth/GlobalSocketListener';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

let socket: {
  handlers: Record<string, (payload: any) => void>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(mocks.toast, {
    error: mocks.toastError,
    info: mocks.toastInfo,
  }),
}));

vi.mock('@/context/SocketContext', () => ({
  useSocket: () => socket,
}));

describe('GlobalSocketListener', () => {
  function makeSocket() {
    socket = {
      handlers: {},
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        socket.handlers[event] = handler;
      }),
      off: vi.fn(),
    };
  }

  it('registers and removes dashboard socket listeners', () => {
    makeSocket();

    const { unmount } = render(<GlobalSocketListener />);

    expect(socket.on).toHaveBeenCalledWith('dashboard:risk-alert', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('dashboard:new-report', expect.any(Function));

    unmount();

    expect(socket.off).toHaveBeenCalledWith('dashboard:risk-alert', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('dashboard:new-report', expect.any(Function));
  });

  it('shows an error toast for high severity risk alerts', () => {
    makeSocket();
    render(<GlobalSocketListener />);

    socket.handlers['dashboard:risk-alert']({
      severity: 'CRITICAL',
      title: 'Flood Risk',
      district: 'Colombo',
      predictionCategory: 'FLOOD',
      predictionProbability: 0.91,
      considerationScore: 0.82,
      source: 'J2',
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      'CRITICAL ALERT: Flood Risk',
      expect.objectContaining({
        description: expect.stringContaining('Location: Colombo'),
        action: expect.objectContaining({ label: 'View Alert' }),
      }),
    );

    const options = mocks.toastError.mock.calls[0][1];
    options.action.onClick();
    expect(mocks.push).toHaveBeenCalledWith('/dashboard/alerts');
  });

  it('shows a review toast for new SOS reports', () => {
    makeSocket();
    render(<GlobalSocketListener />);

    socket.handlers['dashboard:new-report']({
      disasterType: 'LANDSLIDE',
      district: 'Kegalle',
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      'New SOS Report: LANDSLIDE',
      expect.objectContaining({
        description: 'Location: Kegalle | Pending Verification',
        action: expect.objectContaining({ label: 'Review' }),
      }),
    );
  });
});
