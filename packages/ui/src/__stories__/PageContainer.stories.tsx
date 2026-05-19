import type { Meta, StoryObj } from '@storybook/react';
import { PageContainer } from '../page-container';
import { Button } from '../button';

const meta = {
  title: 'Components/PageContainer',
  component: PageContainer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PageContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-8">
        <h1 className="text-title text-foreground mb-4">Welcome</h1>
        <p className="text-foreground-muted">Page content with fade-in animation.</p>
        <div className="mt-4">
          <Button>Get Started</Button>
        </div>
      </div>
    ),
  },
};

export const WithoutAnimation: Story = {
  args: {
    animate: false,
    children: (
      <div className="p-8">
        <h1 className="text-title text-foreground mb-4">Static Page</h1>
        <p className="text-foreground-muted">No animation on this page.</p>
      </div>
    ),
  },
};
