import React from 'react';
import { useLocation, Routes } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { createSpanId, createTraceId } from '@do-epub-studio/shared';
import { logClientEvent } from '../lib/client-logger';

export function ViewTransitionRoutes({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = React.useState(location);

  React.useEffect(() => {
    if (location.key === displayLocation.key) return;

    const applyTransition = () => {
      flushSync(() => {
        setDisplayLocation(location);
      });
    };

    if (!document.startViewTransition) {
      applyTransition();
      return;
    }

    const transition = document.startViewTransition(applyTransition);

    // A transition that is superseded by a newer one rejects `ready` with an
    // AbortError ("Transition was skipped. New ViewTransition started"). That
    // is the expected outcome of rapid navigation, not an application
    // failure, so the rejection is consumed here instead of surfacing as an
    // unhandled promise rejection in the page.
    transition.ready.catch(() => {});
    transition.finished.catch(() => {});

    // A failing update callback is a real defect (the new route never
    // renders), so it is reported rather than swallowed.
    transition.updateCallbackDone.catch((error: unknown) => {
      const failure = error instanceof Error ? error : new Error(String(error));
      logClientEvent({
        level: 'error',
        event: 'view_transition.update_failed',
        traceId: createTraceId(),
        spanId: createSpanId(),
        error: { name: failure.name, message: failure.message, stack: failure.stack },
      });
    });
  }, [location, displayLocation]);

  return <Routes location={displayLocation}>{children}</Routes>;
}
