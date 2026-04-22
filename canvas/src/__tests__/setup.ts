import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

// jsdom's default location is about:blank, which makes relative URLs in
// fetch() throw "Invalid URL". Give it a real origin so `fetch('/api/...')`
// resolves instead of crashing any test that mounts components which fire
// boot-time fetches (ChatSidebar, TemplatesScreen, etc.).
if (typeof window !== 'undefined' && window.location.href === 'about:blank') {
  try {
    window.history.replaceState(null, '', 'http://localhost/');
  } catch {
    // ignore — some envs don't allow this
  }
}

// Default fetch stub: components that mount in tests without their own
// fetch mock get a benign empty response instead of crashing jsdom.
// Individual tests that assign `global.fetch = vi.fn()` override this.
const defaultFetch = vi.fn(async () =>
  new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
);
if (typeof global.fetch === 'undefined' || !('mock' in (global.fetch as unknown as object))) {
  global.fetch = defaultFetch as unknown as typeof fetch;
}

afterEach(() => {
  // Reset any per-test overrides back to the default stub.
  if ('mockClear' in (global.fetch as unknown as { mockClear?: () => void })) {
    (global.fetch as unknown as { mockClear: () => void }).mockClear();
  }
});
