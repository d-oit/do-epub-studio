import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../search-input';

describe('SearchInput', () => {
  it('renders with the given value', () => {
    render(<SearchInput value="hello" onChange={() => {}} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('calls onChange when user types', () => {
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('shows clear button when value is non-empty', () => {
    render(<SearchInput value="x" onChange={() => {}} />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('clears value when clear button clicked', () => {
    const onChange = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clears value when Escape key is pressed in the search input', () => {
    const onChange = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} />);
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('calls custom onClear when Escape key is pressed if onClear is provided', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} onClear={onClear} />);
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClear).toHaveBeenCalled();
  });
});
