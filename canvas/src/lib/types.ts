export interface AnnotationReply {
  id: string;
  author: string;
  authorType: 'human' | 'agent';
  text: string;
  createdAt: string;
}

export interface Annotation {
  id: string;
  type: 'sidebar' | 'pin';
  author: string;
  authorType: 'human' | 'agent';
  versionPath: string;
  text: string;
  createdAt: string;
  x?: number; // percentage 0-100 (pin only)
  y?: number; // percentage 0-100 (pin only)
  pinNumber?: number;
  replies?: AnnotationReply[];
}

export type VersionStatus = 'winner' | 'rejected' | 'final' | 'unmarked';

export interface IterationContext {
  winnerHtml: string;
  annotations: Annotation[];
  statuses: Record<string, VersionStatus>;
  currentRound: number;
  originalPrompt: string;
}

export const CREATION_DIMENSIONS: Record<string, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1080 },
  'linkedin-landscape': { width: 1200, height: 627 },
  'linkedin-wide': { width: 1340, height: 630 },
  'one-pager': { width: 816, height: 1056 }, // letter at 96dpi
};
