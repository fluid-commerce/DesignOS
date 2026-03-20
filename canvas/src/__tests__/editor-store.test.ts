/**
 * Editor store unit tests.
 * Tests state management for iteration selection, slot value updates,
 * dirty tracking, user state persistence, and state reset.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useEditorStore, SLOT_TRANSFORM_PREFIX } from '../store/editor';
import { HISTORY_DEBOUNCE_MS } from '../lib/editor-history';

// Reset store to initial state before each test
beforeEach(() => {
  useEditorStore.getState().clearSelection();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── Initial state ──────────────────────────────────────────────────────── */
describe('initial state', () => {
  it('has no selection and isDirty=false', () => {
    const state = useEditorStore.getState();
    expect(state.selectedIterationId).toBeNull();
    expect(state.slotSchema).toBeNull();
    expect(state.slotValues).toEqual({});
    expect(state.baselineSlotValues).toEqual({});
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.isDirty).toBe(false);
    expect(state.iframeRef).toBeNull();
    expect(state.pickedTransform).toBeNull();
  });
});

/* ── selectIteration ────────────────────────────────────────────────────── */
describe('selectIteration', () => {
  it('sets selectedIterationId and slotSchema on success', async () => {
    const mockIteration = {
      id: 'iter_001',
      frameId: 'frame_001',
      iterationIndex: 0,
      htmlPath: '/path/to/file.html',
      slotSchema: {
        width: 1080,
        height: 1080,
        fields: [
          { type: 'text', sel: '.headline', label: 'Headline', mode: 'text', rows: 2 },
        ],
        brush: null,
      },
      aiBaseline: { '.headline': 'Hello World' },
      userState: null,
      status: 'unmarked',
      source: 'ai',
      templateId: null,
      createdAt: Date.now(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIteration,
    }));

    await useEditorStore.getState().selectIteration('iter_001');

    const state = useEditorStore.getState();
    expect(state.selectedIterationId).toBe('iter_001');
    expect(state.slotSchema).toEqual(mockIteration.slotSchema);
    expect(state.baselineSlotValues).toEqual({ '.headline': 'Hello World' });
    expect(state.undoStack).toEqual([]);
    expect(state.isDirty).toBe(false);
  });

  it('extracts slot values from aiBaseline when userState is null', async () => {
    const mockIteration = {
      id: 'iter_002',
      frameId: 'frame_001',
      iterationIndex: 0,
      htmlPath: '/path/to/file.html',
      slotSchema: { width: 1080, height: 1080, fields: [], brush: null },
      aiBaseline: { '.headline': 'AI Generated Text', '.tagline': 'Tagline here' },
      userState: null,
      status: 'unmarked',
      source: 'ai',
      templateId: null,
      createdAt: Date.now(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIteration,
    }));

    await useEditorStore.getState().selectIteration('iter_002');

    const state = useEditorStore.getState();
    expect(state.slotValues['.headline']).toBe('AI Generated Text');
    expect(state.slotValues['.tagline']).toBe('Tagline here');
  });

  it('prefers userState over aiBaseline for slot values', async () => {
    const mockIteration = {
      id: 'iter_003',
      frameId: 'frame_001',
      iterationIndex: 0,
      htmlPath: '/path/to/file.html',
      slotSchema: { width: 1080, height: 1080, fields: [], brush: null },
      aiBaseline: { '.headline': 'Original' },
      userState: { '.headline': 'User Edited' },
      status: 'unmarked',
      source: 'ai',
      templateId: null,
      createdAt: Date.now(),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIteration,
    }));

    await useEditorStore.getState().selectIteration('iter_003');

    const state = useEditorStore.getState();
    expect(state.slotValues['.headline']).toBe('User Edited');
  });

  it('does not throw when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    // Should not throw
    await expect(useEditorStore.getState().selectIteration('iter_bad')).resolves.toBeUndefined();
    expect(useEditorStore.getState().selectedIterationId).toBeNull();
  });

  it('does not update state when API returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    await useEditorStore.getState().selectIteration('iter_404');

    const state = useEditorStore.getState();
    expect(state.selectedIterationId).toBeNull();
  });
});

/* ── updateSlotValue ────────────────────────────────────────────────────── */
describe('updateSlotValue', () => {
  it('updates slotValues and sets isDirty=true', () => {
    useEditorStore.getState().updateSlotValue('.headline', 'New Headline');

    const state = useEditorStore.getState();
    expect(state.slotValues['.headline']).toBe('New Headline');
    expect(state.isDirty).toBe(true);
  });

  it('sends postMessage to iframe when iframeRef is set', () => {
    const mockPostMessage = vi.fn();
    const mockIframe = {
      contentWindow: { postMessage: mockPostMessage },
    } as unknown as HTMLIFrameElement;

    useEditorStore.getState().setIframeRef(mockIframe);
    useEditorStore.getState().updateSlotValue('.tagline', 'Hello', 'pre');

    expect(mockPostMessage).toHaveBeenCalledWith(
      { type: 'tmpl', sel: '.tagline', value: 'Hello', mode: 'pre' },
      '*'
    );
  });

  it('skipIframeEcho does not postMessage (artboard typing sync)', () => {
    const mockPostMessage = vi.fn();
    const mockIframe = {
      contentWindow: { postMessage: mockPostMessage },
    } as unknown as HTMLIFrameElement;
    useEditorStore.getState().setIframeRef(mockIframe);
    useEditorStore.getState().updateSlotValue('.headline', 'Hi', 'text', { skipIframeEcho: true });
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(useEditorStore.getState().slotValues['.headline']).toBe('Hi');
  });

  it('does not throw when iframeRef is null', () => {
    // iframeRef is null by default after clearSelection
    expect(() => {
      useEditorStore.getState().updateSlotValue('.name', 'Test');
    }).not.toThrow();
  });

  it('updates multiple slot values independently', () => {
    useEditorStore.getState().updateSlotValue('.headline', 'Headline');
    useEditorStore.getState().updateSlotValue('.tagline', 'Tagline');

    const state = useEditorStore.getState();
    expect(state.slotValues['.headline']).toBe('Headline');
    expect(state.slotValues['.tagline']).toBe('Tagline');
  });

  it('pushes undo snapshot after debounce', () => {
    vi.useFakeTimers();
    useEditorStore.getState().updateSlotValue('.headline', 'X');
    expect(useEditorStore.getState().undoStack.length).toBe(0);
    vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS + 50);
    expect(useEditorStore.getState().undoStack.length).toBe(1);
    expect(useEditorStore.getState().undoStack[0]).toEqual({});
    vi.useRealTimers();
  });

  it('undo restores slot value and uses iframe re-apply when schema + iframe set', () => {
    vi.useFakeTimers();
    const mockPostMessage = vi.fn();
    const mockIframe = {
      contentWindow: { postMessage: mockPostMessage },
    } as unknown as HTMLIFrameElement;
    const schema = {
      width: 1080,
      height: 1080,
      fields: [{ type: 'text' as const, sel: '.h', label: 'H', mode: 'text' as const }],
      brush: null,
    };
    useEditorStore.setState({
      selectedIterationId: 'iter_x',
      slotSchema: schema,
      slotValues: { '.h': 'old' },
      baselineSlotValues: { '.h': 'old' },
      iframeRef: mockIframe,
    });
    useEditorStore.getState().updateSlotValue('.h', 'new');
    vi.advanceTimersByTime(HISTORY_DEBOUNCE_MS + 50);
    mockPostMessage.mockClear();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().slotValues['.h']).toBe('old');
    expect(mockPostMessage).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

/* ── updateElementTransform ─────────────────────────────────────────────── */
describe('updateElementTransform', () => {
  it('stores transform under prefixed key and sets isDirty', () => {
    const tf = 'translate(10px, 20px) rotate(5deg) scale(1.1, 1.2)';
    useEditorStore.getState().updateElementTransform('.hero-img', tf);

    const state = useEditorStore.getState();
    expect(state.slotValues[`${SLOT_TRANSFORM_PREFIX}.hero-img`]).toBe(tf);
    expect(state.isDirty).toBe(true);
  });

  it('sends tmpl transform postMessage when iframeRef is set', () => {
    const mockPostMessage = vi.fn();
    const mockIframe = {
      contentWindow: { postMessage: mockPostMessage },
    } as unknown as HTMLIFrameElement;

    useEditorStore.getState().setIframeRef(mockIframe);
    useEditorStore.getState().updateElementTransform('.brush', 'translate(0px, 0px) rotate(0deg) scale(1, 1)');

    expect(mockPostMessage).toHaveBeenCalledWith(
      {
        type: 'tmpl',
        sel: '.brush',
        action: 'transform',
        transform: 'translate(0px, 0px) rotate(0deg) scale(1, 1)',
      },
      '*'
    );
  });
});

/* ── clearSelection ─────────────────────────────────────────────────────── */
describe('clearSelection', () => {
  it('resets all state to initial values', () => {
    // Set up some state first
    useEditorStore.setState({
      selectedIterationId: 'iter_001',
      slotSchema: { width: 1080, height: 1080, fields: [] },
      slotValues: { '.headline': 'Hello' },
      baselineSlotValues: { '.headline': '' },
      undoStack: [{}],
      redoStack: [{}],
      isDirty: true,
      pickedTransform: { sel: '.headline', label: 'Headline', kind: 'text' },
    });

    useEditorStore.getState().clearSelection();

    const state = useEditorStore.getState();
    expect(state.selectedIterationId).toBeNull();
    expect(state.slotSchema).toBeNull();
    expect(state.slotValues).toEqual({});
    expect(state.baselineSlotValues).toEqual({});
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.isDirty).toBe(false);
    expect(state.iframeRef).toBeNull();
    expect(state.pickedTransform).toBeNull();
  });
});

/* ── saveUserState ──────────────────────────────────────────────────────── */
describe('saveUserState', () => {
  it('calls PATCH API and resets isDirty on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    useEditorStore.setState({
      selectedIterationId: 'iter_001',
      slotValues: { '.headline': 'Saved Headline' },
      isDirty: true,
    });

    await useEditorStore.getState().saveUserState();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/iterations/iter_001/user-state',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userState: { '.headline': 'Saved Headline' } }),
      })
    );
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it('does not reset isDirty when API returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    useEditorStore.setState({
      selectedIterationId: 'iter_001',
      slotValues: { '.headline': 'Text' },
      isDirty: true,
    });

    await useEditorStore.getState().saveUserState();

    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('does nothing when selectedIterationId is null', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await useEditorStore.getState().saveUserState();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not throw when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    useEditorStore.setState({ selectedIterationId: 'iter_001', isDirty: true });

    await expect(useEditorStore.getState().saveUserState()).resolves.toBeUndefined();
  });
});

/* ── setIframeRef ───────────────────────────────────────────────────────── */
describe('setIframeRef', () => {
  it('stores the iframe reference', () => {
    const mockIframe = { contentWindow: {} } as HTMLIFrameElement;
    useEditorStore.getState().setIframeRef(mockIframe);
    expect(useEditorStore.getState().iframeRef).toBe(mockIframe);
  });

  it('accepts null to clear the reference', () => {
    useEditorStore.getState().setIframeRef(null);
    expect(useEditorStore.getState().iframeRef).toBeNull();
  });
});
