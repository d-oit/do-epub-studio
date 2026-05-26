import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/auth';
import { Skeleton } from './ui';

export const AppShell: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, bookSlug, isAdmin } = useAuthStore();
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    // Simulate a brief moment to resolve auth state / hydrate store
    const timer = setTimeout(() => {
      setIsResolving(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isResolving) {
      const options = { replace: true };
      if (isAuthenticated) {
        if (isAdmin) {
          void navigate('/admin/books', options);
        } else if (bookSlug) {
          void navigate(`/read/${bookSlug}`, options);
        } else {
          void navigate('/login', options);
        }
      } else {
        void navigate('/login', options);
      }
    }
  }, [isResolving, isAuthenticated, bookSlug, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {isResolving && (
          <motion.div
            key="app-shell-loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-8 w-full max-w-md"
            role="status"
            aria-live="polite"
            aria-label="Loading application"
          >
            {/* Branded Logo Placeholder */}
            <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center shadow-glass-lg animate-pulse" aria-hidden="true">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>

            <div className="space-y-4 w-full">
              <Skeleton className="h-8 w-3/4 mx-auto rounded-lg" />
              <Skeleton className="h-4 w-1/2 mx-auto rounded-md" />
            </div>

            <div className="flex gap-2 mt-4" aria-hidden="true">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                className="w-2 h-2 rounded-full bg-accent"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                className="w-2 h-2 rounded-full bg-accent/60"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                className="w-2 h-2 rounded-full bg-accent/30"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
