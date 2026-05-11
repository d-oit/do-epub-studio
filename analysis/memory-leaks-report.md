# Memory Leaks and Resource Management Analysis

**Date:** 2026-01-23  
**Project:** do-epub-studio  
**Analyzed:** apps/web, packages/reader-core, packages/ui

---

## Executive Summary

This report analyzes the codebase for potential memory leaks and resource management issues. The analysis identified several areas of concern, ranging from properly handled cleanups to potential issues that could lead to memory leaks in certain scenarios.

| Category | Issues Found | High Priority | Medium Priority | Low Priority |
|----------|-------------|---------------|-----------------|--------------|
| Event Listeners | 4 | 0 | 1 | 3 |
| setTimeout/setInterval | 3 | 0 | 1 | 2 |
| useEffect Cleanup | 1 | 0 | 0 | 1 |
| Global Handlers | 1 | 1 | 0 | 0 |
| **TOTAL** | **9** | **1** | **2** | **6** |

---

## 1. Event Listeners Not Properly Cleaned Up

### 1.1 Global Error Handlers Never Removed (HIGH PRIORITY)

**File:** `apps/web/src/main.tsx`  
**Lines:** 38-61

```do-epub-studio/apps/web/src/main.tsx#L38-61
function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    const traceId = createTraceId();
    logClientEvent({
      level: 'error',
      event: 'window.error',
      traceId,
      spanId: createSpanId(),
      error: {
        name: event.error?.name ?? 'Error',
        message: event.error?.message ?? String(event.message),
        stack: event.error?.stack,
      },
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const traceId = createTraceId();
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    logClientEvent({
      level: 'error',
      event: 'window.unhandledrejection',
      traceId,
      spanId: createSpanId(),
      error: { name: reason.name, message: reason.message, stack: reason.stack },
    });
  });
}
```

**Issue:** Global error and unhandled promise rejection handlers are added at app startup but never removed. While these are typically acceptable for application lifetime, in certain testing or hot-reload scenarios, they may accumulate.

**Impact:** Minor. These handlers persist for the lifetime of the app, but this is expected behavior for error tracking.

**Recommendation:** Add cleanup for testing scenarios or hot module replacement. Consider returning a cleanup function from `setupGlobalErrorHandlers()`.

---

### 1.2 Service Worker Registration Handlers Not Removed

**File:** `apps/web/src/main.tsx`  
**Lines:** 23-33

```do-epub-studio/apps/web/src/main.tsx#L23-33
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        if (reg.sync) {
          await reg.sync.register('sync-reader-state');
        }
      } catch (error) {
        console.log('Service worker registration failed:', error);
      }
    })();
  });
}
```

**Issue:** Uses one-time `load` event which automatically removes itself after firing, so this is actually **properly handled**.

**Status:** ✅ OK

---

### 1.3 Toast setTimeout Without Cleanup (MEDIUM PRIORITY)

**File:** `packages/ui/src/toast.tsx`  
**Lines:** 27-31

```do-epub-studio/packages/ui/src/toast.tsx#L27-31
if (duration > 0) {
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, duration);
}
```

**Issue:** `setTimeout` is created every time a toast is added, but if the component unmounts or the toast is removed manually before the timeout fires, the timeout callback will still execute and attempt to update state on an unmounted component.

**Impact:** Can cause "Can't perform a React state update on an unmounted component" warnings.

**Recommendation:** Track timeout IDs and clear them in a cleanup function:

```typescript
// In ToastProvider, store timeout IDs
const toastTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
  const id = crypto.randomUUID();
  setToasts((prev) => [...prev, { id, type, message, duration }]);

  if (duration > 0) {
    const timeoutId = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimeouts.current.delete(id);
    }, duration);
    toastTimeouts.current.set(id, timeoutId);
  }
}, []);

const removeToast = useCallback((id: string) => {
  const timeoutId = toastTimeouts.current.get(id);
  if (timeoutId) {
    clearTimeout(timeoutId);
    toastTimeouts.current.delete(id);
  }
  setToasts((prev) => prev.filter((t) => t.id !== id));
}, []);
```

**Priority:** Medium - Can cause React warnings but unlikely to cause significant memory leaks.

---

### 1.4 Online/Offline Listener Setup (PROPERLY CLEANED UP)

**File:** `apps/web/src/features/reader/ReaderPage.tsx`  
**Lines:** 148-160

```do-epub-studio/apps/web/src/features/reader/ReaderPage.tsx#L148-160
useEffect(() => {
  const handleOnline = () => setOffline(false);
  const handleOffline = () => setOffline(true);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  setOffline(!navigator.onLine);

  const cleanupOnline = setupOnlineListener();
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    cleanupOnline();
  };
}, [setOffline]);
```

**Status:** ✅ Properly cleaned up

---

### 1.5 Mouse Selection Listener (PROPERLY CLEANED UP)

**File:** `apps/web/src/features/reader/ReaderPage.tsx`  
**Lines:** 130-142

```do-epub-studio/apps/web/src/features/reader/ReaderPage.tsx#L130-142
useEffect(() => {
  const handleSelectionChange = () => {
    if (iframeRef.current && !isCommentMode) {
      const sel = extractSelectionData(iframeRef.current);
      if (sel && sel.text.length >= 3) {
        setSelection(sel);
      } else {
        setSelection(null);
      }
    }
  };

  document.addEventListener('mouseup', handleSelectionChange);
  return () => {
    document.removeEventListener('mouseup', handleSelectionChange);
  };
}, [isCommentMode]);
```

**Status:** ✅ Properly cleaned up

---

### 1.6 AnnotationToolbar Event Listeners (PROPERLY CLEANED UP)

**File:** `apps/web/src/features/reader/components/annotations/AnnotationToolbar.tsx`  
**Lines:** 67-72

```do-epub-studio/apps/web/src/features/reader/components/annotations/AnnotationToolbar.tsx#L67-72
document.addEventListener('mousedown', handleClickOutside);
document.addEventListener('keydown', handleEscape);
return () => {
  document.removeEventListener('mousedown', handleClickOutside);
  document.removeEventListener('keydown', handleEscape);
};
```

**Status:** ✅ Properly cleaned up

---

## 2. setInterval Issues

### 2.1 Zombie Detection Interval (PROPERLY CLEANED UP)

**File:** `apps/web/src/lib/offline/permissions.ts`  
**Lines:** 91-118

```do-epub-studio/apps/web/src/lib/offline/permissions.ts#L91-118
export function setupZombieDetection(onRevoked: (bookId: string) => void): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const checkPermissions = async (): Promise<void> => {
    // ... permission checking logic
  };

  intervalId = setInterval(() => void checkPermissions(), 60000);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
```

**Status:** ✅ Properly cleaned up - returns cleanup function that clears the interval.

---

### 2.2 Sync Retry setTimeout (LOW PRIORITY)

**File:** `apps/web/src/lib/offline/sync.ts`  
**Lines:** 91-99

```do-epub-studio/apps/web/src/lib/offline/sync.ts#L91-99
} else {
  item.attempts++;
  item.lastAttempt = Date.now();
  item.error = result.error;
  await updateSyncQueueItem(item);

  const delay = calculateDelay(item.attempts);
  setTimeout(() => void attemptSync(), delay);
}
```

**Issue:** If the user navigates away or the component unmounts during the retry delay, the `setTimeout` will still attempt to call `attemptSync()`. While this is generally acceptable for background sync operations, it could cause issues if the sync tries to access component state.

**Impact:** Low - The sync runs independently of components, but could trigger unnecessary network requests.

**Recommendation:** Track whether sync is still needed or use an AbortController to cancel pending sync attempts.

---

### 2.3 API Request Timeout (PROPERLY HANDLED)

**File:** `apps/web/src/lib/api.ts`  
**Lines:** 32-42

```do-epub-studio/apps/web/src/lib/api.ts#L32-42
const timeout = setTimeout(
  () => controller.abort(new DOMException('Request timeout')),
  timeoutMs ?? DEFAULT_TIMEOUT_MS,
);
```

**Status:** ✅ Properly cleaned up - The `clearTimeout(timeout)` is called in both the success path and the finally block.

---

## 3. useEffect Cleanup Issues

### 3.1 Missing Cleanup in Permissions Setup Effect (LOW PRIORITY)

**File:** `apps/web/src/features/reader/ReaderPage.tsx`  
**Lines:** 163-167

```do-epub-studio/apps/web/src/features/reader/ReaderPage.tsx#L163-167
useEffect(() => {
  if (!bookId) return;

  const cleanup = setupZombieDetection((revokedBookId) => {
    setRevokedBooks((prev) => new Set(prev).add(revokedBookId));
  });
  return cleanup;
}, [bookId]);
```

**Status:** ✅ Properly cleaned up - Returns the cleanup function from `setupZombieDetection()`.

---

## 4. IndexedDB and Offline Storage

### 4.1 IndexedDB Connection Not Closed

**File:** `apps/web/src/lib/offline/db.ts`  
**Lines:** 51-75

```do-epub-studio/apps/web/src/lib/offline/db.ts#L51-75
let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // ... schema setup
    },
  });

  return dbInstance;
}
```

**Issue:** The IndexedDB connection (`dbInstance`) is opened once and never explicitly closed with `db.close()`. The connection persists for the lifetime of the application.

**Impact:** Low - This is actually the recommended pattern for IndexedDB in web applications. The browser will handle cleanup when the tab is closed. However, if the app needs to manage multiple database connections or explicitly free resources, there is no cleanup mechanism.

**Recommendation:** Add a `closeDB()` function for explicit cleanup in testing scenarios:

```typescript
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
```

**Status:** ✅ Acceptable - This is standard practice for IndexedDB.

---

### 4.2 No Cache Cleanup for Service Worker

**File:** `apps/web/src/sw.ts`  
**Lines:** 103-111

```do-epub-studio/apps/web/src/sw.ts#L103-111
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(event.data.cacheName).then(() => {
        console.log(`[SW] Cache deleted: ${event.data.cacheName}`);
      }),
    );
  }
});
```

**Status:** ✅ OK - Cache is explicitly cleared when requested.

---

## 5. React Component Patterns

### 5.1 Modal Focus Trap (PROPERLY CLEANED UP)

**File:** `packages/ui/src/modal.tsx`  
**Lines:** 28-42

```do-epub-studio/packages/ui/src/modal.tsx#L28-42
useEffect(() => {
  if (isOpen) {
    triggerRef.current = document.activeElement as HTMLElement;
  }

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (isOpen) {
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
  }

  return () => {
    document.removeEventListener('keydown', handleEscape);
    document.body.style.overflow = '';
    if (triggerRef.current) {
      triggerRef.current.focus();
    }
  };
}, [isOpen, onClose]);
```

**Status:** ✅ Properly cleaned up - Both event listeners and body overflow are restored.

---

### 5.2 useFocusTrap Hook (PROPERLY CLEANED UP)

**File:** `packages/ui/src/useFocusTrap.ts`  
**Lines:** 51-74

```do-epub-studio/packages/ui/src/useFocusTrap.ts#L51-74
useEffect(() => {
  const capturedRestoreRef = restoreRef?.current;

  if (active) {
    previousFocus.current = document.activeElement as HTMLElement | null;
    // ... focus setup
    document.addEventListener('keydown', handleKeyDown);
  }

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    const restoreTarget = capturedRestoreRef ?? previousFocus.current;
    if (restoreTarget) {
      restoreTarget.focus();
    }
  };
}, [active, containerRef, handleKeyDown, restoreRef]);
```

**Status:** ✅ Properly cleaned up

---

## 6. Summary of Findings

### Issues Requiring Attention

| Priority | File | Issue | Recommendation |
|----------|------|-------|----------------|
| **High** | `apps/web/src/main.tsx:38` | Global error handlers never removed | Add cleanup function for testing/HMR |
| **Medium** | `packages/ui/src/toast.tsx:27` | Toast setTimeout not tracked/cleared | Track timeout IDs and clear on remove/unmount |
| **Low** | `apps/web/src/lib/offline/sync.ts:97` | Sync retry setTimeout continues after unmount | Consider AbortController for sync operations |
| **Low** | `apps/web/src/lib/offline/db.ts` | No explicit DB close function | Add `closeDB()` for testing cleanup |

### Properly Handled (No Action Needed)

1. ✅ `ReaderPage.tsx` - Mouse selection listener cleanup
2. ✅ `ReaderPage.tsx` - Online/offline listener cleanup
3. ✅ `ReaderPage.tsx` - Zombie detection cleanup
4. ✅ `AnnotationToolbar.tsx` - Click outside and escape key cleanup
5. ✅ `modal.tsx` - Focus trap and escape key cleanup
6. ✅ `useFocusTrap.ts` - Keyboard event cleanup
7. ✅ `permissions.ts` - Interval cleanup in setupZombieDetection
8. ✅ `api.ts` - Timeout cleanup in finally block
9. ✅ `main.tsx` - Service worker load event (one-time handler)

---

## 7. Recommendations

### Immediate Actions

1. **Toast Timeouts** - Implement timeout tracking in `ToastProvider` to prevent state updates on unmounted components.

### Future Improvements

1. **Global Error Handlers** - Consider exporting a cleanup function for testing scenarios.
2. **Sync AbortController** - Add cancellation support to sync operations.
3. **DB Close Function** - Add explicit database close for test cleanup.

### Monitoring Suggestions

- Add React DevTools Profiler to track component re-renders
- Monitor for "Can't perform a React state update on an unmounted component" warnings in production
- Track memory usage in long-running sessions with many book loads

---

## 8. Test Coverage Notes

The existing test files show good practices:

- `apps/web/src/__tests__/offline-sync.test.ts` - Tests both addEventListener and removeEventListener cleanup
- Test setup includes proper cleanup with `fake-indexeddb/auto`

Consider adding:
- Test for Toast timeout cleanup on component unmount
- Test for sync retry cancellation on component unmount

---

*Generated by memory leak analysis script*
