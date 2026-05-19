import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from '../skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextLine: Story = {
  args: {
    className: 'h-4 w-64',
  },
};

export const Avatar: Story = {
  args: {
    className: 'h-12 w-12 rounded-full',
  },
};

export const CardPlaceholder: Story = {
  args: {
    className: 'h-32 w-80',
  },
};

export const MultipleLines: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-80">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  ),
};
