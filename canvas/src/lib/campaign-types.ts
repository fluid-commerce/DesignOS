/**
 * Campaign hierarchy TypeScript interfaces.
 * Maps to the SQLite schema: campaigns > creations > slides > iterations > annotations.
 * HTML files stay on disk; paths are stored in SQLite.
 */

import type { VersionStatus } from './types';

/** Top-level organizing unit. A campaign groups all creations generated for a brief. */
export interface Campaign {
  id: string;                  // nanoid, e.g. 'cmp_abc123'
  title: string;
  channels: string[];          // e.g. ['instagram', 'linkedin'] — JSON in SQLite
  createdAt: number;           // Unix ms
  updatedAt: number;           // Unix ms
}

/** A single deliverable within a campaign (e.g. one Instagram post, one one-pager). */
export interface Creation {
  id: string;                  // nanoid
  campaignId: string;          // FK -> campaigns.id
  title: string;
  creationType: string;        // 'instagram' | 'linkedin-landscape' | 'one-pager' etc.
  slideCount: number;          // 1 for single-slide, N for carousel
  createdAt: number;           // Unix ms
}

/** One slide within a creation. Single-slide creations have exactly one slide. */
export interface Slide {
  id: string;                  // nanoid
  creationId: string;          // FK -> creations.id
  slideIndex: number;          // 0-based slide index
  createdAt: number;           // Unix ms
}

/** One generated version within a slide. Only AI generations create new iterations; manual edits modify in-place. */
export interface Iteration {
  id: string;                  // nanoid
  slideId: string;             // FK -> slides.id
  iterationIndex: number;      // display order
  htmlPath: string;            // relative path to HTML file on disk
  slotSchema: object | null;   // JSON field definition schema from layout subagent
  aiBaseline: object | null;   // JSON original AI-generated slot values (for diff tracking)
  userState: object | null;    // JSON current user-modified slot values
  status: VersionStatus;       // 'winner' | 'rejected' | 'final' | 'unmarked'
  source: 'ai' | 'template';  // how iteration was created
  templateId: string | null;   // set when source='template'
  generationStatus?: 'pending' | 'generating' | 'complete';  // AI generation lifecycle; defaults to 'complete'
  createdAt: number;           // Unix ms
}

export interface Chat {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string | null;
  toolCalls: string | null;
  toolResults: string | null;
  uiContext: string | null;
  createdAt: number;
}

/** Annotation on a specific iteration (pin on canvas or sidebar note). */
export interface CampaignAnnotation {
  id: string;                  // nanoid
  iterationId: string;         // FK -> iterations.id (kept as iterationId — iterations not renamed)
  type: 'pin' | 'sidebar';
  author: string;              // 'human' | 'agent'
  text: string;
  x?: number;                  // percentage 0-100 (pin only)
  y?: number;                  // percentage 0-100 (pin only)
  createdAt: number;           // Unix ms
}
