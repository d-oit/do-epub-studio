import type { Meta } from '@storybook/react';
import { useState } from 'react';
import { Modal } from '../modal';
import { Button } from '../button';

const meta = {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>;

export default meta;

function DefaultModal() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => { setIsOpen(true); }}>Open Modal</Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Confirm Action"
        description="Are you sure you want to proceed?"
      >
        <p className="text-foreground-muted text-sm">This action cannot be undone.</p>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
          <Button variant="ghost" size="sm">Cancel</Button>
          <Button size="sm">Confirm</Button>
        </div>
      </Modal>
    </div>
  );
}

function SuccessModal() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Success"
      >
        <p className="text-foreground-muted text-sm">Your changes have been saved.</p>
      </Modal>
    </div>
  );
}

export const Default = {
  render: () => <DefaultModal />,
};

export const WithoutDescription = {
  render: () => <SuccessModal />,
};
