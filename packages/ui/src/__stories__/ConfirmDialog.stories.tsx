import type { Meta, StoryObj } from '@storybook/react';
import { ConfirmDialog } from '../confirm-dialog';

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'danger'],
    },
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Action',
    description: 'Are you sure you want to proceed?',
    onConfirm: () => {},
    onCancel: () => {},
  },
};

export const Danger: Story = {
  args: {
    isOpen: true,
    title: 'Delete Book',
    description:
      'This will permanently delete the book and all associated annotations. This action cannot be undone.',
    variant: 'danger',
    confirmLabel: 'Delete',
    onConfirm: () => {},
    onCancel: () => {},
  },
};

export const CustomLabels: Story = {
  args: {
    isOpen: true,
    title: 'Unsaved Changes',
    description: 'You have unsaved changes. Would you like to save before leaving?',
    confirmLabel: 'Save',
    cancelLabel: 'Discard',
    onConfirm: () => {},
    onCancel: () => {},
  },
};
