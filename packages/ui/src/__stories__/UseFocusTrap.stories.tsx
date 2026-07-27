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
      <button ref={triggerRef} onClick={() => setActive(!active)}>
        {active ? 'Deactivate Trap' : 'Activate Trap'}
      </button>
      <div
        ref={containerRef}
        role="dialog"
        aria-label="Focus trap demo"
        style={{
          marginTop: '1rem',
          padding: '1rem',
          border: '1px solid #ccc',
          borderRadius: '8px',
        }}
      >
        <p>Tab cycles through these elements:</p>
        <button type="button">Button 1</button>
        <input placeholder="Text input" style={{ margin: '0 0.5rem' }} />
        <button type="button">Button 2</button>
        <select style={{ marginLeft: '0.5rem' }}>
          <option>Option A</option>
          <option>Option B</option>
        </select>
      </div>
      <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
        Focus is trapped inside the dialog. Shift+Tab wraps to the last element.
      </p>
    </div>
  );
}

const meta = {
  title: 'Hooks/useFocusTrap',
  component: FocusTrapDemo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FocusTrapDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
