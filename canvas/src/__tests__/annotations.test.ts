import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAnnotationStore } from '../store/annotations';
import type { Annotation, AnnotationReply, AnnotationFile } from '../lib/types';

// Reset store between tests
beforeEach(() => {
  useAnnotationStore.setState({
    annotations: [],
    statuses: {},
    activePin: null,
    _saveTimer: null,
    _sessionId: null,
  });
  vi.restoreAllMocks();
});

describe('Annotation Store', () => {
  it('adds a pin annotation with correct x/y percentages', () => {
    const store = useAnnotationStore.getState();

    const annotation: Annotation = {
      id: 'pin-1',
      type: 'pin',
      author: 'Reviewer',
      authorType: 'human',
      versionPath: 'v1/styled.html',
      text: 'Fix spacing here',
      createdAt: '2026-03-10T12:00:00Z',
      x: 42.5,
      y: 73.2,
      pinNumber: 1,
      replies: [],
    };

    store.addAnnotation(annotation);

    const state = useAnnotationStore.getState();
    expect(state.annotations).toHaveLength(1);
    expect(state.annotations[0].x).toBe(42.5);
    expect(state.annotations[0].y).toBe(73.2);
    expect(state.annotations[0].type).toBe('pin');
    expect(state.annotations[0].pinNumber).toBe(1);
  });

  it('adds a reply to the correct annotation', () => {
    const store = useAnnotationStore.getState();

    // Add two annotations
    store.addAnnotation({
      id: 'a1',
      type: 'pin',
      author: 'Reviewer',
      authorType: 'human',
      versionPath: 'v1/styled.html',
      text: 'First',
      createdAt: '2026-03-10T12:00:00Z',
      x: 10,
      y: 20,
      pinNumber: 1,
      replies: [],
    });
    store.addAnnotation({
      id: 'a2',
      type: 'sidebar',
      author: 'Agent',
      authorType: 'agent',
      versionPath: 'v2/styled.html',
      text: 'Second',
      createdAt: '2026-03-10T12:01:00Z',
      replies: [],
    });

    const reply: AnnotationReply = {
      id: 'r1',
      author: 'Designer',
      authorType: 'human',
      text: 'Good catch',
      createdAt: '2026-03-10T12:05:00Z',
    };

    useAnnotationStore.getState().addReply('a1', reply);

    const state = useAnnotationStore.getState();
    const a1 = state.annotations.find((a) => a.id === 'a1');
    const a2 = state.annotations.find((a) => a.id === 'a2');
    expect(a1?.replies).toHaveLength(1);
    expect(a1?.replies?.[0].text).toBe('Good catch');
    expect(a2?.replies).toHaveLength(0);
  });

  it('sets variation status correctly', () => {
    const store = useAnnotationStore.getState();

    store.setStatus('v1/styled.html', 'winner');
    store.setStatus('v2/styled.html', 'rejected');

    const state = useAnnotationStore.getState();
    expect(state.statuses['v1/styled.html']).toBe('winner');
    expect(state.statuses['v2/styled.html']).toBe('rejected');
  });

  it('loads annotations from API (mock)', async () => {
    const mockData: AnnotationFile = {
      sessionId: 'test-session',
      annotations: [
        {
          id: 'loaded-1',
          type: 'pin',
          author: 'Agent',
          authorType: 'agent',
          versionPath: 'v1/styled.html',
          text: 'Loaded annotation',
          createdAt: '2026-03-10T10:00:00Z',
          x: 50,
          y: 50,
          pinNumber: 1,
          replies: [],
        },
      ],
      statuses: {
        'v1/styled.html': 'winner',
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    await useAnnotationStore.getState().loadAnnotations('test-session');

    const state = useAnnotationStore.getState();
    expect(state.annotations).toHaveLength(1);
    expect(state.annotations[0].id).toBe('loaded-1');
    expect(state.statuses['v1/styled.html']).toBe('winner');
  });

  it('persists annotations via save (mock)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    const store = useAnnotationStore.getState();
    store.addAnnotation({
      id: 'save-test',
      type: 'sidebar',
      author: 'Reviewer',
      authorType: 'human',
      versionPath: 'v1/styled.html',
      text: 'Save me',
      createdAt: '2026-03-10T14:00:00Z',
      replies: [],
    });

    await useAnnotationStore.getState().saveAnnotations('test-session');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/annotations/test-session',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"save-test"'),
      })
    );
  });

  it('manages active pin state', () => {
    const store = useAnnotationStore.getState();

    expect(store.activePin).toBeNull();

    store.setActivePin('pin-1');
    expect(useAnnotationStore.getState().activePin).toBe('pin-1');

    store.setActivePin(null);
    expect(useAnnotationStore.getState().activePin).toBeNull();
  });
});
