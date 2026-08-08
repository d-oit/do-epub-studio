import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from '../progress-bar';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'number' },
    max: { control: 'number' },
    label: { control: 'text' },
    showValue: { control: 'boolean' },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 50,
  },
};

export const WithLabel: Story = {
  args: {
    value: 75,
    label: 'Reading progress',
  },
};

export const WithValue: Story = {
  args: {
    value: 60,
    label: 'Upload',
    showValue: true,
  },
};

export const Complete: Story = {
  args: {
    value: 100,
    label: 'Complete',
    showValue: true,
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    label: 'Not started',
    showValue: true,
  },
};
