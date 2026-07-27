import type { Meta, StoryObj } from '@storybook/react';
import { AppLogo } from '../AppLogo';

const meta = {
  title: 'Components/AppLogo',
  component: AppLogo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'number', min: 16, max: 128, step: 4 },
    },
  },
} satisfies Meta<typeof AppLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 48,
  },
};

export const Small: Story = {
  args: {
    size: 24,
  },
};

export const Large: Story = {
  args: {
    size: 80,
  },
};

export const DarkBackground: Story = {
  args: {
    size: 64,
  },
  decorators: [
    (Story) => (
      <div style={{ backgroundColor: '#1a1a2e', padding: '2rem', borderRadius: '8px' }}>
        <Story />
      </div>
    ),
  ],
};
