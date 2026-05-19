import type { Meta } from '@storybook/react';
import { Tooltip } from '../tooltip';
import { Button } from '../button';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tooltip>;

export default meta;

export const Default = {
  render: () => (
    <Tooltip content="This is a tooltip">
      <Button variant="ghost">Hover me</Button>
    </Tooltip>
  ),
};

export const LongText = {
  render: () => (
    <Tooltip content="A longer tooltip message with more detailed information">
      <Button variant="ghost">Hover for details</Button>
    </Tooltip>
  ),
};
