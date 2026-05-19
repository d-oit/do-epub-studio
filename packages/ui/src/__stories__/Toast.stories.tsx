import type { Meta } from '@storybook/react';
import { ToastProvider } from '../toast';
import { useToast } from '../toast';
import { Button } from '../button';

const meta = {
  title: 'Components/Toast',
  component: ToastProvider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ToastProvider>;

export default meta;

function ToastDemo() {
  const { addToast } = useToast();
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <Button onClick={() => addToast('success', 'Operation completed successfully')}>
          Success
        </Button>
        <Button variant="danger" onClick={() => { addToast('error', 'Something went wrong'); }}>
          Error
        </Button>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => addToast('info', 'New update available')}>
          Info
        </Button>
        <Button variant="secondary" onClick={() => addToast('warning', 'Session expiring soon')}>
          Warning
        </Button>
      </div>
    </div>
  );
}

export const Default = {
  render: () => (
    <ToastProvider>
      <ToastDemo />
    </ToastProvider>
  ),
};
