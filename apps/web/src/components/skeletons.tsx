/**
 * Page-level skeleton screens for route Suspense boundaries.
 * Each skeleton matches the approximate layout of its target page
 * so the transition from loading to loaded feels stable.
 */

import type { ReactNode } from 'react';

const LABEL_LIBRARY = 'Loading library';
const LABEL_CATALOG = 'Loading catalog';
const LABEL_ADMIN = 'Loading page';
const LABEL_READER = 'Loading reader';
const LABEL_SETTINGS = 'Loading settings';

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-surface/60 ${className}`} aria-hidden="true" />;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4 flex flex-col gap-3">
      <SkeletonBlock className="h-36 w-full rounded-lg" />
      <SkeletonBlock className="h-4 w-3/4" />
      <SkeletonBlock className="h-3 w-1/2" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-4 items-center py-3 border-b border-border/50">
      <SkeletonBlock className="h-4 w-1/4" />
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-4 w-1/5" />
    </div>
  );
}

function SkeletonShell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="min-h-dvh bg-background"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="h-14 border-b border-border bg-background-secondary flex items-center px-6 gap-4" aria-hidden="true">
        <SkeletonBlock className="h-5 w-24" />
        <div className="flex-1" />
        <SkeletonBlock className="h-8 w-8 rounded-full" />
      </div>
      {children}
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <SkeletonShell label={LABEL_LIBRARY}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" aria-hidden="true">
        <SkeletonBlock className="h-7 w-40 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </SkeletonShell>
  );
}

export function CatalogSkeleton() {
  return (
    <SkeletonShell label={LABEL_CATALOG}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" aria-hidden="true">
        <SkeletonBlock className="h-7 w-32 mb-4" />
        <SkeletonBlock className="h-10 w-full max-w-sm mb-6 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </SkeletonShell>
  );
}

export function AdminSkeleton() {
  return (
    <SkeletonShell label={LABEL_ADMIN}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" aria-hidden="true">
        <SkeletonBlock className="h-7 w-48 mb-6" />
        <div className="rounded-xl border border-border bg-surface/40 p-4">
          {Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    </SkeletonShell>
  );
}

export function ReaderSkeleton() {
  return (
    <div
      className="min-h-dvh bg-background flex flex-col"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={LABEL_READER}
    >
      <div className="h-14 border-b border-border bg-background-secondary" aria-hidden="true" />
      <div className="flex-1 flex items-start justify-center pt-12 px-6" aria-hidden="true">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <SkeletonBlock className="h-5 w-full" />
          <SkeletonBlock className="h-5 w-11/12" />
          <SkeletonBlock className="h-5 w-full" />
          <SkeletonBlock className="h-5 w-10/12" />
          <SkeletonBlock className="h-5 w-full" />
          <div className="mt-2" />
          <SkeletonBlock className="h-5 w-full" />
          <SkeletonBlock className="h-5 w-9/12" />
          <SkeletonBlock className="h-5 w-full" />
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <SkeletonShell label={LABEL_SETTINGS}>
      <div className="max-w-2xl mx-auto px-4 py-8" aria-hidden="true">
        <SkeletonBlock className="h-7 w-32 mb-6" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mb-4 p-4 rounded-xl border border-border bg-surface/40 flex flex-col gap-3">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </SkeletonShell>
  );
}
