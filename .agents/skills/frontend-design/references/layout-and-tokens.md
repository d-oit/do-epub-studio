# Layout Planning & Design Tokens

## Layout Planning Methodology

Before implementing UI components, establish layout structure based on editorial minimalism:

1. **Hierarchy & Grid**:
   - Establish a clear visual hierarchy with generous whitespace.
   - Use CSS Grid for overall page layouts and Flexbox for linear component flows.
   - Avoid fixed widths; use fluid sizing (`clamp()`, `%`, `minmax()`, `auto-fit`).

2. **Viewport Adaptation**:
   - Mobile-first structure with fluid padding and layout shifts.
   - Use container queries (`@container`) over viewport queries (`@media`) for component-level responsiveness.

## OKLCH Design Tokens

All colors MUST reference semantic OKLCH tokens defined in `apps/web/src/styles/globals.css`.

### Primary Color Tokens

- `--color-background`: Main application background
- `--color-foreground`: Primary text color
- `--color-surface`: Card/panel surface background
- `--color-surface-hover`: Hover state for interactive surfaces
- `--color-border`: Standard border and divider color
- `--color-accent`: Intentional primary accent color
- `--color-accent-error`: Error and destructive action state
- `--color-muted`: De-emphasized text and subtle UI elements

### Rules

- Never use hardcoded hex (`#ffffff`), `rgb()`, or `hsl()` values in component code.
- Avoid redundant `dark:` Tailwind prefixes when using semantic CSS variables, as themes automatically adapt via `[data-theme]` / `.dark` classes in `globals.css`.
- Avoid pure black (`oklch(0% 0 0)`) or pure white (`oklch(100% 0 0)`) — always use semantic surface and foreground tokens.
