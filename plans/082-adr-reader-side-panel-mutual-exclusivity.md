# ADR-082: Reader Side-Panel Mutual Exclusivity

> **Status:** Accepted (2026-06-15)
> **Supersedes:** none
> **Related:** AGENTS.md TIER-3 "Enforce mutual exclusivity for
> reader side-panels (TOC, Settings, etc.)",
> `analysis/SWARM_ANALYSIS.md` G28
> **Deciders:** maintainers
> **Tags:** ux, reader-ui, policy

## Context

`apps/web/src/features/reader/hooks/useReaderUi.ts:27-29`
tracks a single `activePanel` value, but
`ReaderPage.tsx:341-413` renders `TableOfContents`,
`BookmarksPanel`, `CommentsPanel`, `SearchPanel`,
`InfoPanel`, and `ReaderSettingsPanel` each with their own
`isOpen` checks. Opening one panel does **not** close the
others. AGENTS.md TIER-3 mandates mutual exclusivity.

On mobile, stacking panels obscures the reader. The
architectural intent is single-panel-at-a-time.

## Decision

We drive every side-panel's `isOpen` from a single
`activePanel` source in the reader store, and add a Playwright
test that asserts opening one panel closes the others.

### Implementation sketch

```ts
// apps/web/src/features/reader/hooks/useReaderUi.ts (modified)
type ReaderPanel = 'toc' | 'search' | 'comments' | 'bookmarks' | 'info' | 'settings';
const setActivePanel = (panel: ReaderPanel | null) => {
  if (activePanel === panel) setActivePanel(null);
  else setActivePanel(panel);
};
```

```tsx
// ReaderPage.tsx (modified)
<TableOfContents isOpen={activePanel === 'toc'} onClose={() => setActivePanel(null)} />
<BookmarksPanel isOpen={activePanel === 'bookmarks'} onClose={() => setActivePanel(null)} />
<CommentsPanel isOpen={activePanel === 'comments'} onClose={() => setActivePanel(null)} />
<SearchPanel isOpen={activePanel === 'search'} onClose={() => setActivePanel(null)} />
<InfoPanel isOpen={activePanel === 'info'} onClose={() => setActivePanel(null)} />
<ReaderSettingsPanel isOpen={activePanel === 'settings'} onClose={() => setActivePanel(null)} />
```

The `InfoPanel` and `ReaderSettingsPanel` currently use their
own `isOpen` props; they are refactored to read from
`useReaderStore((s) => s.activePanel)`.

### Test

```ts
// apps/web/src/features/reader/components/ReaderPage.test.tsx (extend)
it('opening one panel closes the others', async () => {
  render(<ReaderPage />);
  await userEvent.click(screen.getByTestId('open-toc'));
  expect(screen.getByTestId('toc-panel')).toBeVisible();
  await userEvent.click(screen.getByTestId('open-search'));
  expect(screen.getByTestId('toc-panel')).not.toBeVisible();
  expect(screen.getByTestId('search-panel')).toBeVisible();
});
```

## Consequences

### Positive

- Closes the AGENTS.md TIER-3 policy violation.
- Mobile UX is consistent (one panel at a time).
- Reader store is the single source of truth for panel state.

### Negative

- Refactor touches six panel components. Each is small
  (~50–200 LOC).

### Neutral

- No state-shape change; only the source of the `isOpen` prop.

## Compliance

- AGENTS.md TIER-3 — enforced.
- AGENTS.md TIER-2 rule 8 — documented as a GOAP plan + ADR.
