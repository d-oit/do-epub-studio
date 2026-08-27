import type { Meta, StoryObj } from '@storybook/react';
import { Card } from '../card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    elevated: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground">Card Title</h3>
        <p className="text-foreground-muted text-sm mt-2">This is the card content area.</p>
      </div>
    ),
  },
};

export const Elevated: Story = {
  args: {
    elevated: true,
    children: (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground">Elevated</h3>
        <p className="text-foreground-muted text-sm mt-2">With shadow depth for emphasis.</p>
      </div>
    ),
  },
};
