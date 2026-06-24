import type { Meta } from '@storybook/react';
import { useId, useState } from 'react';
import { Tooltip } from '../tooltip';
import { Button } from '../button';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'V9 migration: tooltip uses the native HTML `popover` attribute (Baseline 2024) with a JS fallback gated by `@supports not (selector(:popover-open))`. The trigger is a non-button wrapper that respects `pointerenter`/`pointerleave` and keyboard focus. `prefers-reduced-motion` is honored via the global reduced-motion CSS overrides.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tooltip>;

export default meta;

export const Default = {
  render: () => (
    <Tooltip content="This is a tooltip">
      <Button variant="ghost">Hover me</Button>
    </Tooltip>
  ),
};

export const LongText = {
  render: () => (
    <Tooltip content="A longer tooltip message with more detailed information">
      <Button variant="ghost">Hover for details</Button>
    </Tooltip>
  ),
};

export const BottomSide = {
  render: () => (
    <Tooltip content="Tooltip below" side="bottom">
      <Button variant="ghost">Hover for below</Button>
    </Tooltip>
  ),
};

export const StringChildren = {
  render: () => (
    <div className="p-8">
      <Tooltip content="Plain string children also work">
        <span className="underline cursor-help">Hover this text</span>
      </Tooltip>
    </div>
  ),
};

function FocusManagementDemo() {
  useId();
  const [lastEvent, setLastEvent] = useState<string>('none');
  return (
    <div className="p-8 space-y-4">
      <p className="text-sm text-foreground-muted">
        Tab to focus the button — the tooltip should open via focus. Tab away to
        close. In a native popover browser, `aria-describedby` is set on the
        focusable wrapper.
      </p>
      <Tooltip content="Opens on focus">
        <button
          type="button"
          className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 px-4 py-2 text-sm bg-background-secondary text-foreground border border-border hover:bg-background-tertiary"
          onFocus={() => setLastEvent('focus')}
          onBlur={() => setLastEvent('blur')}
        >
          Focus me (last event: {lastEvent})
        </button>
      </Tooltip>
    </div>
  );
}

export const FocusManagement = {
  render: () => <FocusManagementDemo />,
};

export const NativePopoverMarker = {
  render: () => (
    <div className="p-8 space-y-2">
      <p className="text-xs uppercase tracking-wider text-foreground-muted">
        Inspect the tooltip element to see <code>popover=&quot;auto&quot;</code> +
        <code>data-fallback=&quot;js&quot;</code> (or omitted in native browsers).
      </p>
      <Tooltip content="popover=auto element">
        <Button variant="primary">Inspect me</Button>
      </Tooltip>
    </div>
  ),
};
