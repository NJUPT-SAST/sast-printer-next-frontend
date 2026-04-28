// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DocumentPreview } from './DocumentPreview';
import '@testing-library/jest-dom/vitest';

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string, values?: any) => key + (values ? JSON.stringify(values) : '') })
}));

afterEach(() => {
  cleanup();
});

describe('DocumentPreview', () => {
  it('renders an empty state if no images', () => {
    const { container } = render(
      <DocumentPreview images={[]} fallbackNode={<div data-testid="fallback">Fallback</div>} />
    );
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('renders multiple img tags if images array has items', () => {
    const images = ['image1.png', 'image2.png'];
    const { container } = render(
      <DocumentPreview images={images} />
    );
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.getByText('printer.previewPage{"page":1}')).toBeInTheDocument();
    expect(screen.getByText('printer.previewPage{"page":2}')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<DocumentPreview images={[]} loading={true} loadingText="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders error state', () => {
    render(<DocumentPreview images={[]} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders N-up grid layout for 4-up', () => {
    const images = ['p1.png', 'p2.png', 'p3.png', 'p4.png'];
    const { container } = render(
      <DocumentPreview images={images} nup={4} nupDirection="horizontal" />
    );
    expect(container.querySelectorAll('img')).toHaveLength(4);
    expect(screen.getByText('printer.nupSheet{"sheet":1,"start":1,"end":4}')).toBeInTheDocument();
  });

  it('renders blank slots for odd pages in N-up', () => {
    const images = ['p1.png', 'p2.png', 'p3.png'];
    const { container } = render(
      <DocumentPreview images={images} nup={4} nupDirection="horizontal" />
    );
    expect(container.querySelectorAll('img')).toHaveLength(3);
  });

  it('does not render N-up grid when nup is 1', () => {
    const images = ['p1.png', 'p2.png'];
    const { container } = render(
      <DocumentPreview images={images} nup={1} />
    );
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.queryByText(/printer\.nupSheet/)).not.toBeInTheDocument();
  });
});
