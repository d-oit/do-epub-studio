import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrefetchManager } from '../lib/prefetch-manager';

describe('PrefetchManager', () => {
  let manager: PrefetchManager;
  let createdLinks: HTMLLinkElement[];

  beforeEach(() => {
    vi.useFakeTimers();
    createdLinks = [];
    manager = new PrefetchManager();

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'link') {
        const link = {
          rel: '',
          href: '',
          as: '',
          fetchPriority: '',
          crossOrigin: '',
          remove: vi.fn(),
        } as unknown as HTMLLinkElement;
        createdLinks.push(link);
        return link;
      }
      return document.createElement.call(document, tag);
    });
    vi.spyOn(document.head, 'appendChild').mockImplementation(() => ({} as Node));
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('spine tracking', () => {
    it('should set spine items', () => {
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
        { href: 'chapter3.html' },
      ]);
      expect(manager.getState().spineLength).toBe(3);
    });

    it('should track current index after chapter change', () => {
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter2.html');
      expect(manager.getState().currentIndex).toBe(1);
    });
  });

  describe('network constraints', () => {
    it('should skip prefetch on save-data mode', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(600);
      expect(manager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
    });

    it('should skip prefetch on 2g network', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '2g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(600);
      expect(manager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
    });

    it('should skip prefetch on slow-2g network', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: 'slow-2g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(600);
      expect(manager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
    });

    it('should allow prefetch on 4g network', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(manager.getState().hasPrefetchLink).toBe(true);
      expect(createdLinks.length).toBe(1);
    });
  });

  describe('storage constraints', () => {
    it('should skip prefetch when storage quota is low', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({ usage: 910, quota: 1000 }),
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(manager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
    });

    it('should allow prefetch when storage quota is sufficient', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({ usage: 500, quota: 1000 }),
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(manager.getState().hasPrefetchLink).toBe(true);
      expect(createdLinks.length).toBe(1);
    });

    it('should allow prefetch when storage estimate is unavailable', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(manager.getState().hasPrefetchLink).toBe(true);
      expect(createdLinks.length).toBe(1);
    });
  });

  describe('idle delay', () => {
    it('should not prefetch immediately after chapter change', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      expect(manager.getState().hasPendingPrefetch).toBe(true);
      expect(manager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
    });

    it('should prefetch after 500ms idle delay', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(manager.getState().hasPrefetchLink).toBe(true);
      expect(createdLinks.length).toBe(1);
    });

    it('should cancel pending prefetch on new chapter change', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
        { href: 'chapter3.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      vi.advanceTimersByTime(200);
      manager.onChapterChange('chapter2.html');
      await vi.advanceTimersByTimeAsync(200);
      expect(manager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
    });
  });

  describe('prefetch link properties', () => {
    it('should create link with fetchPriority low', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(createdLinks.length).toBe(1);
      expect(createdLinks[0].fetchPriority).toBe('low');
    });

    it('should create link with rel=prefetch', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(createdLinks.length).toBe(1);
      expect(createdLinks[0].rel).toBe('prefetch');
    });

    it('should create link with as=fetch', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(createdLinks.length).toBe(1);
      expect(createdLinks[0].as).toBe('fetch');
    });
  });

  describe('edge cases', () => {
    it('should not prefetch at end of spine', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter2.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(manager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
    });

    it('should not prefetch for unknown href', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('unknown.html');
      expect(manager.getState().currentIndex).toBe(-1);
      expect(createdLinks.length).toBe(0);
    });

    it('should clean up on destroy', () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      manager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      manager.onChapterChange('chapter1.html');
      manager.destroy();
      expect(manager.getState().spineLength).toBe(0);
      expect(manager.getState().currentIndex).toBe(-1);
      expect(manager.getState().hasPendingPrefetch).toBe(false);
    });
  });

  describe('custom configuration', () => {
    it('should respect custom idle delay', async () => {
      const customManager = new PrefetchManager({ idleDelayMs: 1000 });
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      customManager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      customManager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(customManager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
      await vi.advanceTimersByTimeAsync(500);
      expect(customManager.getState().hasPrefetchLink).toBe(true);
      expect(createdLinks.length).toBe(1);
      customManager.destroy();
    });

    it('should respect custom skip network types', async () => {
      const customManager = new PrefetchManager({ skipNetworkTypes: ['slow-2g', '2g', '3g'] });
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '3g' },
        writable: true,
        configurable: true,
      });
      customManager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      customManager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(customManager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
      customManager.destroy();
    });

    it('should respect custom min storage free percent', async () => {
      const customManager = new PrefetchManager({ minStorageFreePercent: 30 });
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({ usage: 800, quota: 1000 }),
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: false, effectiveType: '4g' },
        writable: true,
        configurable: true,
      });
      customManager.setSpine([
        { href: 'chapter1.html' },
        { href: 'chapter2.html' },
      ]);
      customManager.onChapterChange('chapter1.html');
      await vi.advanceTimersByTimeAsync(500);
      expect(customManager.getState().hasPrefetchLink).toBe(false);
      expect(createdLinks.length).toBe(0);
      customManager.destroy();
    });
  });
});
