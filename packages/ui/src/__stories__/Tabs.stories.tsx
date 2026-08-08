import type { Meta, StoryObj } from '@storybook/react';
import { Tabs } from '../tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoTabs: Story = {
  args: {
    items: [
      { id: 'overview', label: 'Overview', content: 'Book overview and metadata.' },
      { id: 'notes', label: 'Notes', content: 'Your annotations and highlights.' },
    ],
  },
};

export const ThreeTabs: Story = {
  args: {
    items: [
      { id: 'toc', label: 'Table of Contents', content: 'Chapter list and navigation.' },
      { id: 'bookmarks', label: 'Bookmarks', content: 'Saved bookmarks.' },
      { id: 'settings', label: 'Settings', content: 'Reader preferences.' },
    ],
  },
};

export const DefaultActive: Story = {
  args: {
    items: [
      { id: 'first', label: 'First', content: 'First tab content.' },
      { id: 'second', label: 'Second', content: 'Second tab content.' },
      { id: 'third', label: 'Third', content: 'Third tab content.' },
    ],
    defaultActiveId: 'second',
  },
};
