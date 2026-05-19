import type { Meta } from '@storybook/react';
import { useState } from 'react';
import { LiveRegion } from '../LiveRegion';
import { Button } from '../button';

const meta = {
  title: 'Components/LiveRegion',
  component: LiveRegion,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LiveRegion>;

export default meta;

function PoliteExample() {
  const [message, setMessage] = useState('');
  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={() => setMessage('Update complete: 3 items synced.')}>
        Simulate update
      </Button>
      <LiveRegion polite>{message}</LiveRegion>
      <p className="text-sm text-foreground-muted">Message will be announced to screen readers politely.</p>
    </div>
  );
}

function AssertiveExample() {
  const [message, setMessage] = useState('');
  return (
    <div className="flex flex-col items-center gap-4">
      <Button onClick={() => setMessage('Error: Connection lost.')} variant="danger">
        Simulate error
      </Button>
      <LiveRegion polite={false}>{message}</LiveRegion>
      <p className="text-sm text-foreground-muted">Message will interrupt screen reader output.</p>
    </div>
  );
}

export const Polite = {
  render: () => <PoliteExample />,
};

export const Assertive = {
  render: () => <AssertiveExample />,
};
