import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages is 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders page numbers', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 5')).toBeInTheDocument();
  });

  it('calls onPageChange when a page is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByLabelText('Page 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('marks current page with aria-current', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    { edge: 'Previous', currentPage: 1, totalPages: 5 },
    { edge: 'Next', currentPage: 5, totalPages: 5 },
  ])('disables $edge at the $currentPage boundary', ({ edge, currentPage, totalPages }) => {
    render(
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={() => {}} />,
    );
    expect(screen.getByLabelText(`${edge} page`)).toBeDisabled();
  });

  it.each([{ edge: 'Previous' }, { edge: 'Next' }])(
    'gives the $edge control an aria-hidden icon',
    ({ edge }) => {
      render(<Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />);
      const control = screen.getByLabelText(`${edge} page`);
      // The icon is decorative: the control's aria-label is the accessible name,
      // so the svg must stay out of the accessibility tree or it is announced
      // as an unlabelled graphic (regression guard for the icon swap).
      expect(control.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(control).toHaveAccessibleName(`${edge} page`);
    },
  );
});
