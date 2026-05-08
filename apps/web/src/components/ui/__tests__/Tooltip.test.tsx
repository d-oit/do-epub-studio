import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../index';

describe('Tooltip', () => {
  it('should show tooltip on hover and focus', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Trigger</button>
      </Tooltip>
    );

    const trigger = screen.getByRole('button', { name: /trigger/i });

    // Verify aria-describedby is present and points to something
    const ariaDescribedBy = trigger.getAttribute('aria-describedby');
    expect(ariaDescribedBy).toMatch(/^tooltip-/);

    // Should not be visible initially
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Show on hover
    fireEvent.mouseEnter(trigger);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Tooltip content');
    expect(tooltip.id).toBe(ariaDescribedBy);

    // Hide on mouse leave
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Show on focus
    fireEvent.focus(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    // Hide on blur
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
