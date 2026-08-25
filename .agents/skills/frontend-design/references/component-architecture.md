# Component Architecture & Platform APIs

## Component Guidelines

1. **Reusability**:
   - Prefer primitives from `packages/ui` (`Button`, `Card`, `Input`, `Modal`, `Tabs`, `Tooltip`).
   - Keep components under 500 lines of code per project file limits.

2. **Container Queries (`@container`)**:
   - Mark root component wrapper with `@container`.
   - Apply container-based breakpoints (`@sm:`, `@md:`, `@lg:`) to ensure components adapt based on their parent container width, not just the full viewport.

3. **View Transitions & Motion**:
   - Use native View Transitions API (`viewTransition: true` in React Router v7).
   - Apply `view-transition-name: prevent-flicker` to fixed navigation elements (Sidebar, BottomTabBar).
   - Use subtle CSS transitions (`--ease-out-expo`) rather than heavy external JavaScript animation libraries.
   - Always respect `prefers-reduced-motion`.

4. **Semantic Structure & ARIA**:
   - Use standard semantic tags (`<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`).
   - Do NOT add redundant `role="list"` attributes to `<ul>` or `<ol>` elements (violates `jsx-a11y/no-redundant-roles`).
