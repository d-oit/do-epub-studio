import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLogo } from '../AppLogo';
import { LiveRegion } from '../LiveRegion';
import { Badge } from '../badge';
import { Card } from '../card';
import { Header } from '../header';
import { IconButton } from '../icon-button';
import { PageContainer } from '../page-container';
import { Skeleton } from '../skeleton';

describe('AppLogo', () => {
  it('renders with default size', () => {
    render(<AppLogo />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  it('renders with custom size', () => {
    render(<AppLogo size={64} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '64');
  });

  it('applies custom className', () => {
    render(<AppLogo className="text-primary" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveClass('text-primary');
  });

  it('has correct aria-label', () => {
    render(<AppLogo />);
    expect(screen.getByLabelText('do EPUB Studio logo')).toBeInTheDocument();
  });
});

describe('LiveRegion', () => {
  it('renders children with polite aria-live', () => {
    render(<LiveRegion>Hello</LiveRegion>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Hello');
  });

  it('renders with assertive aria-live when polite=false', () => {
    render(<LiveRegion polite={false}>Alert</LiveRegion>);
    const region = screen.getByRole('alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
    expect(region).toHaveTextContent('Alert');
  });

  it('returns null when children is empty', () => {
    const { container } = render(<LiveRegion>{null}</LiveRegion>);
    expect(container.firstChild).toBeNull();
  });

  it('has sr-only class', () => {
    render(<LiveRegion>Content</LiveRegion>);
    const region = screen.getByRole('status');
    expect(region).toHaveClass('sr-only');
  });

  it('has aria-atomic attribute', () => {
    render(<LiveRegion>Atomic</LiveRegion>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });
});

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Test</Badge>);
    const badge = screen.getByText('Test');
    expect(badge).toHaveClass('inline-flex');
    expect(badge).toHaveClass('rounded-full');
  });

  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge).toHaveClass('bg-accent-success/10');
  });

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge).toHaveClass('bg-accent-warning/10');
  });

  it('renders with error variant', () => {
    render(<Badge variant="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge).toHaveClass('bg-accent-error/10');
  });

  it('renders with info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-accent-info/10');
  });

  it('applies custom className', () => {
    render(<Badge className="custom">Test</Badge>);
    expect(screen.getByText('Test')).toHaveClass('custom');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(<Badge ref={ref}>Test</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});

describe('Card', () => {
  it('renders with default variant', () => {
    render(<Card>Content</Card>);
    const card = screen.getByText('Content');
    expect(card).toHaveClass('bg-background-secondary');
  });

  it('renders with glass variant', () => {
    render(<Card variant="glass">Content</Card>);
    const card = screen.getByText('Content');
    expect(card).toHaveClass('glass-card');
  });

  it('renders with elevated variant', () => {
    render(<Card variant="elevated">Content</Card>);
    const card = screen.getByText('Content');
    expect(card).toHaveClass('bg-background');
    expect(card).toHaveClass('shadow-lg');
  });

  it('renders without hover when hover=false', () => {
    render(<Card hover={false}>Content</Card>);
    const card = screen.getByText('Content');
    expect(card).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Card className="custom">Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('custom');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(<Card ref={ref}>Content</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('Header', () => {
  it('renders with sticky and glass by default', () => {
    render(<Header>Header Content</Header>);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('fixed');
    expect(header).toHaveClass('glass-panel');
  });

  it('renders without sticky when sticky=false', () => {
    render(<Header sticky={false}>Header</Header>);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('relative');
  });

  it('renders without glass when glass=false', () => {
    render(<Header glass={false}>Header</Header>);
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-background');
  });

  it('applies custom className', () => {
    render(<Header className="custom">Header</Header>);
    expect(screen.getByRole('banner')).toHaveClass('custom');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(<Header ref={ref}>Header</Header>);
    expect(ref.current).toBeInstanceOf(HTMLElement);
  });
});

describe('IconButton', () => {
  it('renders with default size and variant', () => {
    render(<IconButton>Click</IconButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('p-2');
    expect(button).toHaveClass('text-foreground');
  });

  it('renders with sm size', () => {
    render(<IconButton size="sm">Click</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('p-1.5');
  });

  it('renders with lg size', () => {
    render(<IconButton size="lg">Click</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('p-3');
  });

  it('renders with ghost variant', () => {
    render(<IconButton variant="ghost">Click</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('text-foreground/70');
  });

  it('renders with primary variant', () => {
    render(<IconButton variant="primary">Click</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('text-accent');
  });

  it('applies custom className', () => {
    render(<IconButton className="custom">Click</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('custom');
  });

  it('forwards ref', () => {
    const ref = { current: null };
    render(<IconButton ref={ref}>Click</IconButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('PageContainer', () => {
  it('renders with animation by default', () => {
    render(<PageContainer>Content</PageContainer>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders without animation when animate=false', () => {
    render(<PageContainer animate={false}>Content</PageContainer>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<PageContainer className="custom">Content</PageContainer>);
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('custom');
  });
});

describe('Skeleton', () => {
  it('renders with skeleton class', () => {
    render(<Skeleton />);
    const skeleton = document.querySelector('.skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('rounded');
  });

  it('applies custom className', () => {
    render(<Skeleton className="w-full h-8" />);
    const skeleton = document.querySelector('.skeleton');
    expect(skeleton).toHaveClass('w-full');
    expect(skeleton).toHaveClass('h-8');
  });
});
