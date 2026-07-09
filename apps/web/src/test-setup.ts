import 'fake-indexeddb/auto';
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Clean up DOM after each test to prevent memory leaks
afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  // Reset data-cache module-level caches so each test fetches fresh
  // data from the mocked apiRequest. We dynamically import to avoid
  // forcing the module to load in tests that don't need it.
  try {
    const dataCache = await import('./lib/data-cache');
    dataCache._resetAllCaches();
  } catch {
    // Module not loaded in this test; nothing to reset.
  }
});

// Reset data-cache before each test too, to handle test isolation
// issues when multiple test files share the same module instance.
beforeEach(async () => {
  try {
    const dataCache = await import('./lib/data-cache');
    dataCache._resetAllCaches();
  } catch {
    // Module not loaded yet.
  }
});

// Reset module cache after all tests to help with garbage collection
afterAll(() => {
  vi.resetModules();
});
