// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreationFrame } from '../components/CreationFrame';

const sharedProps = {
  name: 'test-variation',
  path: 'v1/styled.html',
  platform: 'instagram',
  status: 'unmarked' as const,
  pins: [],
  activePin: null,
  onPinClick: () => {},
  onAddPin: () => {},
  onReply: () => {},
  onStatusChange: () => {},
};

describe('CreationFrame src-based rendering (ASSET-04)', () => {
  it('renders iframe with src attribute when iterationId is provided', () => {
    const { container } = render(<CreationFrame {...sharedProps} iterationId="iter-abc123" />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('/api/iterations/iter-abc123/html');
    // Should NOT have srcDoc when in src mode
    expect(iframe?.getAttribute('srcdoc')).toBeNull();
  });

  it('sandbox includes allow-scripts for postMessage support', () => {
    const { container } = render(<CreationFrame {...sharedProps} iterationId="iter-abc123" />);
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts');
    expect(iframe?.getAttribute('sandbox')).toContain('allow-same-origin');
  });

  it('falls back to srcDoc when only html is provided (no iterationId)', () => {
    const { container } = render(<CreationFrame {...sharedProps} html="<h1>Fallback</h1>" />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('srcdoc')).toBe('<h1>Fallback</h1>');
    expect(iframe?.getAttribute('src')).toBeNull();
  });

  it('does not contain MAX_HTML_SIZE or htmlTooLarge references', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(__dirname, '../components/CreationFrame.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('MAX_HTML_SIZE');
    expect(source).not.toContain('htmlTooLarge');
  });

  it('shows empty state when neither iterationId nor html is provided', () => {
    const { container } = render(<CreationFrame {...sharedProps} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeNull();
    expect(container.textContent).toContain('No preview available');
  });
});
