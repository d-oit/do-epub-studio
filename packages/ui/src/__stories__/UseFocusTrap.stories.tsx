import type { Meta, StoryObj } from '@storybook/react';
import { useState, useRef } from 'react';
import { useFocusTrap } from '../useFocusTrap';

function FocusTrapDemo() {
  const [active, setActive] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(active, containerRef, triggerRef);

  return (
    <div style={{ padding: '2rem', maxWidth: '400px' }}>
      <button ref={triggerRef} type="button" onClick={() => { setActive(!active); }}>
        {active ? 'Deactivate Trap' : 'Activate Trap'}
      </button>
      <div ref={containerRef} role="dialog" aria-label="Focus trap demo"
        style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <p>Tab cycles through these elements:</p>
        <button type="button">Button 1</button>
        <input placeholder="Text input" style={{ margin: '0 0.5rem' }} />
        <button type="button">Button 2</button>
      </div>
    </div>
  );
}

const meta = {
  title: 'Hooks/useFocusTrap',
  component: FocusTrapDemo,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof FocusTrapDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
