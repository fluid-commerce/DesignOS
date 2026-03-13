import { useEffect, useCallback, useMemo } from 'react';
import { useAnnotationStore } from '../store/annotations';
import { useSessionStore } from '../store/sessions';
import type { Annotation, AnnotationReply } from '../lib/types';
import { nanoid } from 'nanoid';

/**
 * Convenience hook that loads annotations when the active session changes
 * and provides annotation CRUD helpers.
 */
export function useAnnotations() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const annotations = useAnnotationStore((s) => s.annotations);
  const statuses = useAnnotationStore((s) => s.statuses);
  const activePin = useAnnotationStore((s) => s.activePin);
  const loadAnnotations = useAnnotationStore((s) => s.loadAnnotations);
  const addAnnotationRaw = useAnnotationStore((s) => s.addAnnotation);
  const addReplyRaw = useAnnotationStore((s) => s.addReply);
  const setStatus = useAnnotationStore((s) => s.setStatus);
  const setActivePin = useAnnotationStore((s) => s.setActivePin);

  // Load annotations when session changes
  useEffect(() => {
    if (activeSessionId) {
      loadAnnotations(activeSessionId);
    }
  }, [activeSessionId, loadAnnotations]);

  // Filtered getter for annotations on a specific version
  const annotationsForVersion = useCallback(
    (versionPath: string) =>
      annotations.filter((a) => a.versionPath === versionPath),
    [annotations]
  );

  // Pins only for a version
  const pinsForVersion = useCallback(
    (versionPath: string) =>
      annotations.filter((a) => a.versionPath === versionPath && a.type === 'pin'),
    [annotations]
  );

  // Sidebar notes only
  const sidebarNotes = useMemo(
    () => annotations.filter((a) => a.type === 'sidebar'),
    [annotations]
  );

  // Add a pin annotation
  const addPin = useCallback(
    (versionPath: string, x: number, y: number, text: string) => {
      const existingPins = annotations.filter(
        (a) => a.versionPath === versionPath && a.type === 'pin'
      );
      const annotation: Annotation = {
        id: nanoid(),
        type: 'pin',
        author: 'Reviewer',
        authorType: 'human',
        versionPath,
        text,
        createdAt: new Date().toISOString(),
        x,
        y,
        pinNumber: existingPins.length + 1,
        replies: [],
      };
      addAnnotationRaw(annotation);
      return annotation;
    },
    [annotations, addAnnotationRaw]
  );

  // Add a sidebar note
  const addNote = useCallback(
    (versionPath: string, text: string) => {
      const annotation: Annotation = {
        id: nanoid(),
        type: 'sidebar',
        author: 'Reviewer',
        authorType: 'human',
        versionPath,
        text,
        createdAt: new Date().toISOString(),
        replies: [],
      };
      addAnnotationRaw(annotation);
      return annotation;
    },
    [addAnnotationRaw]
  );

  // Add a reply to an annotation
  const addReply = useCallback(
    (annotationId: string, text: string) => {
      const reply: AnnotationReply = {
        id: nanoid(),
        author: 'Reviewer',
        authorType: 'human',
        text,
        createdAt: new Date().toISOString(),
      };
      addReplyRaw(annotationId, reply);
      return reply;
    },
    [addReplyRaw]
  );

  return {
    annotations,
    statuses,
    activePin,
    setActivePin,
    setStatus,
    annotationsForVersion,
    pinsForVersion,
    sidebarNotes,
    addPin,
    addNote,
    addReply,
  };
}
