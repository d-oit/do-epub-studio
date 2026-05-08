import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRender = vi.fn();
const mockCreateRoot = vi.fn(() => ({
  render: mockRender,
}));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: (el: HTMLElement) => mockCreateRoot(el),
  },
  createRoot: (el: HTMLElement) => mockCreateRoot(el),
}));

vi.mock('../lib/telemetry', () => ({
  createTraceId: () => 'test-trace',
  createSpanId: () => 'test-span',
  logClientEvent: vi.fn(),
}));

describe('main.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
  });

  it('renders without crashing', async () => {
    await import('../main');
    expect(mockCreateRoot).toHaveBeenCalled();
  });
});
