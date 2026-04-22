import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAssets } from '../hooks/useAssets';

function wrap(children: React.ReactNode, client: QueryClient) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

// ── Helper components ──────────────────────────────────────────────────────────

function AssetDisplay({ label }: { label?: string }) {
  const { assets, loading, error } = useAssets();
  if (loading) return <div>{label ?? 'consumer'}: loading</div>;
  if (error) return <div data-testid={`error-${label ?? 'consumer'}`}>{error}</div>;
  return <div data-testid={`assets-${label ?? 'consumer'}`}>{JSON.stringify(assets)}</div>;
}

function InvalidateButton() {
  const { invalidate } = useAssets();
  return <button onClick={invalidate}>invalidate</button>;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useAssets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates fetch across multiple consumers in the same tree', async () => {
    const mockAssets = [{ id: 'a', url: 'u', name: 'n' }];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockAssets), { status: 200 })
    );

    const client = makeClient();
    render(
      wrap(
        <>
          <AssetDisplay label="A" />
          <AssetDisplay label="B" />
        </>,
        client
      )
    );

    await waitFor(() => {
      expect(screen.getByTestId('assets-A')).toBeTruthy();
      expect(screen.getByTestId('assets-B')).toBeTruthy();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const data = JSON.parse(screen.getByTestId('assets-A').textContent ?? '[]');
    expect(data).toEqual(mockAssets);
  });

  it('invalidate() triggers a refetch', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      return Promise.resolve(
        new Response(JSON.stringify([{ id: `r${callCount}`, url: 'u', name: 'n' }]), {
          status: 200,
        })
      );
    });

    const client = makeClient();

    function TestTree() {
      const { assets, invalidate, loading } = useAssets();
      return (
        <div>
          <div data-testid="count">{loading ? 'loading' : assets.length}</div>
          <button onClick={invalidate}>invalidate</button>
        </div>
      );
    }

    render(wrap(<TestTree />, client));

    // Wait for initial load
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    expect(callCount).toBe(1);

    // Trigger invalidate
    await act(async () => {
      screen.getByText('invalidate').click();
    });

    await waitFor(() => expect(callCount).toBe(2));
  });

  it('serves cached result from the same QueryClient after unmount/remount', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ id: 'cached', url: 'u', name: 'n' }]), { status: 200 })
    );

    const client = makeClient();

    // Initial mount and load
    const { unmount } = render(wrap(<AssetDisplay label="X" />, client));
    await waitFor(() => expect(screen.queryByTestId('assets-X')).toBeTruthy());
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    unmount();

    // Remount a fresh instance sharing the same client — should use cache
    render(wrap(<AssetDisplay label="X" />, client));

    // Data should be available immediately (or very quickly) from cache
    await waitFor(() => expect(screen.queryByTestId('assets-X')).toBeTruthy());

    // fetch should NOT have been called again
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('surfaces fetch errors via error field and returns empty assets', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failure'));

    const client = makeClient();
    render(wrap(<AssetDisplay label="err" />, client));

    await waitFor(() => expect(screen.queryByTestId('error-err')).toBeTruthy());

    const errorEl = screen.getByTestId('error-err');
    expect(errorEl.textContent).toMatch(/network failure/);
  });
});
