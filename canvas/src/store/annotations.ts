import { create } from 'zustand';
import type { Annotation, AnnotationReply, AnnotationFile, VersionStatus } from '../lib/types';

interface AnnotationStore {
  annotations: Annotation[];
  statuses: Record<string, VersionStatus>;
  activePin: string | null;
  _saveTimer: ReturnType<typeof setTimeout> | null;
  _sessionId: string | null;

  loadAnnotations: (sessionId: string) => Promise<void>;
  addAnnotation: (annotation: Annotation) => void;
  addReply: (annotationId: string, reply: AnnotationReply) => void;
  setStatus: (versionPath: string, status: VersionStatus) => void;
  saveAnnotations: (sessionId: string) => Promise<void>;
  setActivePin: (id: string | null) => void;
  _debouncedSave: () => void;
}

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  statuses: {},
  activePin: null,
  _saveTimer: null,
  _sessionId: null,

  loadAnnotations: async (sessionId: string) => {
    set({ _sessionId: sessionId });
    try {
      const res = await fetch(`/api/annotations/${sessionId}`);
      if (!res.ok) {
        // No annotations yet -- start fresh
        set({ annotations: [], statuses: {} });
        return;
      }
      const data: AnnotationFile = await res.json();
      set({
        annotations: data.annotations ?? [],
        statuses: data.statuses ?? {},
      });
    } catch {
      set({ annotations: [], statuses: {} });
    }
  },

  addAnnotation: (annotation: Annotation) => {
    set((state) => ({
      annotations: [...state.annotations, annotation],
    }));
    get()._debouncedSave();
  },

  addReply: (annotationId: string, reply: AnnotationReply) => {
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === annotationId
          ? { ...a, replies: [...(a.replies ?? []), reply] }
          : a
      ),
    }));
    get()._debouncedSave();
  },

  setStatus: (versionPath: string, status: VersionStatus) => {
    set((state) => ({
      statuses: { ...state.statuses, [versionPath]: status },
    }));
    get()._debouncedSave();
  },

  saveAnnotations: async (sessionId: string) => {
    const { annotations, statuses } = get();
    const body: AnnotationFile = { sessionId, annotations, statuses };
    try {
      await fetch(`/api/annotations/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // Silently fail -- will retry on next debounced save
    }
  },

  setActivePin: (id: string | null) => {
    set({ activePin: id });
  },

  _debouncedSave: () => {
    const state = get();
    if (state._saveTimer) clearTimeout(state._saveTimer);
    const timer = setTimeout(() => {
      const sessionId = get()._sessionId;
      if (sessionId) {
        get().saveAnnotations(sessionId);
      }
    }, 300);
    set({ _saveTimer: timer });
  },
}));
