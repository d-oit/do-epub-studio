import React from 'react';
import { useLocation, Routes } from 'react-router-dom';
import { flushSync } from 'react-dom';

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

    if (document.startViewTransition) {
      document.startViewTransition(applyTransition);
    } else {
      applyTransition();
    }
  }, [location, displayLocation]);

  return <Routes location={displayLocation}>{children}</Routes>;
}
