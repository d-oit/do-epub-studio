import type { Meta, StoryObj } from '@storybook/react';
import { SearchInput } from '../search-input';

const meta = {
  title: 'Components/SearchInput',
  component: SearchInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    debounceMs: { control: 'number' },
  },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: '',
    onChange: () => {},
    placeholder: 'Search books…',
  },
};

export const WithValue: Story = {
  args: {
    value: 'epub reader',
    onChange: () => {},
    placeholder: 'Search books…',
  },
};

export const WithDebounce: Story = {
  args: {
    value: '',
    onChange: () => {},
    placeholder: 'Search with debounce…',
    debounceMs: 300,
  },
};
