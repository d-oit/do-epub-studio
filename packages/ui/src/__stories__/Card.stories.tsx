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
    variant: {
      control: 'select',
      options: ['default', 'glass', 'elevated'],
    },
    hover: {
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

export const Glass: Story = {
  args: {
    variant: 'glass',
    children: (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground">Glass Card</h3>
        <p className="text-foreground-muted text-sm mt-2">Frosted glass effect with blur backdrop.</p>
      </div>
    ),
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-foreground">Elevated</h3>
        <p className="text-foreground-muted text-sm mt-2">With shadow depth for emphasis.</p>
      </div>
    ),
  },
};
