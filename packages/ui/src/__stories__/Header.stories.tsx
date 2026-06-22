import type { Meta, StoryObj } from '@storybook/react';
import { Header } from '../header';

const meta = {
  title: 'Components/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="flex items-center justify-between px-6 h-14">
        <span className="font-semibold text-foreground">d.o.EPUB Studio</span>
        <nav className="flex items-center gap-4">
          <span className="text-sm text-foreground-muted">Library</span>
          <span className="text-sm text-foreground-muted">Settings</span>
        </nav>
      </div>
    ),
  },
};

export const NonSticky: Story = {
  args: {
    sticky: false,
    children: (
      <div className="flex items-center justify-between px-6 h-14">
        <span className="font-semibold text-foreground">d.o.EPUB Studio</span>
      </div>
    ),
  },
};
