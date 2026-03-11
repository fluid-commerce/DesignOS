import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VariationGrid } from '../components/VariationGrid';
import type { VariationFile } from '../lib/types';

describe('VariationGrid', () => {
  it('renders the correct number of AssetFrame components for given variations', () => {
    const variations: VariationFile[] = [
      { path: 'v1/styled.html', html: '<h1>Variation 1</h1>', name: 'v1' },
      { path: 'v2/styled.html', html: '<h1>Variation 2</h1>', name: 'v2' },
      { path: 'v3/styled.html', html: '<h1>Variation 3</h1>', name: 'v3' },
    ];

    const { container } = render(
      <VariationGrid variations={variations} platform="instagram" statuses={{}} />
    );

    const frames = container.querySelectorAll('[data-testid="asset-frame"]');
    expect(frames).toHaveLength(3);
  });

  it('shows empty state message when no variations are provided', () => {
    render(
      <VariationGrid variations={[]} platform="instagram" statuses={{}} />
    );

    expect(screen.getByText(/no variations/i)).toBeInTheDocument();
  });
});
