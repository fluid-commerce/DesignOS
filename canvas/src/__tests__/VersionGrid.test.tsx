import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionGrid } from '../components/VersionGrid';
import type { VersionFile } from '../lib/types';

const noop = vi.fn();

const defaultProps = {
  platform: 'instagram' as const,
  statuses: {},
  annotations: [],
  activePin: null,
  onPinClick: noop,
  onAddPin: noop,
  onReply: noop,
  onStatusChange: noop,
};

describe('VersionGrid', () => {
  it('renders the correct number of CreationFrame components for given versions', () => {
    const versions: VersionFile[] = [
      { path: 'v1/styled.html', html: '<h1>Version 1</h1>', name: 'v1' },
      { path: 'v2/styled.html', html: '<h1>Version 2</h1>', name: 'v2' },
      { path: 'v3/styled.html', html: '<h1>Version 3</h1>', name: 'v3' },
    ];

    const { container } = render(
      <VersionGrid versions={versions} {...defaultProps} />
    );

    const frames = container.querySelectorAll('[data-testid="creation-frame"]');
    expect(frames).toHaveLength(3);
  });

  it('shows empty state message when no versions are provided', () => {
    render(
      <VersionGrid versions={[]} {...defaultProps} />
    );

    expect(screen.getByText(/no versions/i)).toBeInTheDocument();
  });
});
