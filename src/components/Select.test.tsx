// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import Select from './Select';
import type { SelectOption } from './Select';
import '@testing-library/jest-dom/vitest';

const options: SelectOption[] = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C', disabled: true },
];

afterEach(() => {
  cleanup();
});

describe('Select', () => {
  it('renders the selected option label in the trigger', () => {
    render(<Select options={options} value="a" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Option A/ })).toBeInTheDocument();
  });

  it('shows placeholder when value does not match any option', () => {
    render(
      <Select options={options} value="" onChange={() => {}} placeholder="Pick one" />
    );
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('shows placeholder when value is not found in options', () => {
    render(
      <Select options={options} value="nonexistent" onChange={() => {}} placeholder="Pick one" />
    );
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('applies className to the trigger button', () => {
    render(
      <Select options={options} value="a" onChange={() => {}} className="w-full rounded-xl" />
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('w-full');
    expect(btn).toHaveClass('rounded-xl');
  });

  it('opens dropdown on trigger click', () => {
    render(<Select options={options} value="a" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('closes dropdown on second trigger click', () => {
    render(<Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByText('Option B')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
  });

  it('calls onChange with selected value', () => {
    const onChange = vi.fn();
    render(<Select options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Option B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('closes dropdown after selecting an option', () => {
    const onChange = vi.fn();
    render(<Select options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Option B'));
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    render(<Select options={options} value="a" onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: /Option A/ });
    fireEvent.click(trigger);
    expect(screen.getByText('Option B')).toBeInTheDocument();
    fireEvent.keyDown(trigger.parentElement!, { key: 'Escape' });
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
  });

  it('selects option with keyboard navigation', () => {
    const onChange = vi.fn();
    render(<Select options={options} value="a" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Option A/ });
    const container = trigger.parentElement!;
    // Open with Enter
    fireEvent.keyDown(container, { key: 'Enter' });
    // Navigate to Option B
    fireEvent.keyDown(container, { key: 'ArrowDown' });
    // Select
    fireEvent.keyDown(container, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not select disabled options on click', () => {
    const onChange = vi.fn();
    render(<Select options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Option C'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders empty state when options is empty', () => {
    render(<Select options={[]} value="" onChange={() => {}} placeholder="Nothing here" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByText('Nothing here')).toHaveLength(2);
  });

  it('does not open when disabled', () => {
    render(<Select options={options} value="a" onChange={() => {}} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
  });

  it('marks the selected option as active in dropdown', () => {
    render(<Select options={options} value="b" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    const matches = screen.getAllByText('Option B');
    const dropdownItem = matches.find((el) => el.tagName === 'BUTTON');
    expect(dropdownItem).toHaveClass('bg-blue-50');
  });

  it('closes on click outside', () => {
    const { container: outer } = render(
      <div>
        <Select options={options} value="a" onChange={() => {}} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Option A/ }));
    expect(screen.getByText('Option B')).toBeInTheDocument();
    fireEvent.mouseDown(outer.querySelector('[data-testid="outside"]')!);
    expect(screen.queryByText('Option B')).not.toBeInTheDocument();
  });
});
