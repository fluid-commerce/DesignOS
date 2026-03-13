/**
 * Campaign hierarchy TypeScript interfaces.
 * Maps to the SQLite schema: campaigns > assets > frames > iterations > annotations.
 * HTML files stay on disk; paths are stored in SQLite.
 */

import type { VariationStatus } from './types';

/** Top-level organizing unit. A campaign groups all assets generated for a brief. */
export interface Campaign {
  id: string;                  // nanoid, e.g. 'cmp_abc123'
  title: string;
  channels: string[];          // e.g. ['instagram', 'linkedin'] — JSON in SQLite
  createdAt: number;           // Unix ms
  updatedAt: number;           // Unix ms
}

/** A single deliverable within a campaign (e.g. one Instagram post, one one-pager). */
export interface Asset {
  id: string;                  // nanoid
  campaignId: string;          // FK -> campaigns.id
  title: string;
  assetType: string;           // 'instagram' | 'linkedin-landscape' | 'one-pager' etc.
  frameCount: number;          // 1 for single-frame, N for carousel
  createdAt: number;           // Unix ms
}

/** One frame (slide) within an asset. Single-frame assets have exactly one frame. */
export interface Frame {
  id: string;                  // nanoid
  assetId: string;             // FK -> assets.id
  frameIndex: number;          // 0-based slide index
  createdAt: number;           // Unix ms
}

/** One generated version (variation) within a frame. Only AI generations create new iterations; manual edits modify in-place. */
export interface Iteration {
  id: string;                  // nanoid
  frameId: string;             // FK -> frames.id
  iterationIndex: number;      // display order
  htmlPath: string;            // relative path to HTML file on disk
  slotSchema: object | null;   // JSON field definition schema from layout subagent
  aiBaseline: object | null;   // JSON original AI-generated slot values (for diff tracking)
  userState: object | null;    // JSON current user-modified slot values
  status: VariationStatus;     // 'winner' | 'rejected' | 'final' | 'unmarked'
  source: 'ai' | 'template';  // how iteration was created
  templateId: string | null;   // set when source='template'
  generationStatus?: 'pending' | 'generating' | 'complete';  // AI generation lifecycle; defaults to 'complete'
  createdAt: number;           // Unix ms
}

/** Annotation on a specific iteration (pin on canvas or sidebar note). */
export interface CampaignAnnotation {
  id: string;                  // nanoid
  iterationId: string;         // FK -> iterations.id
  type: 'pin' | 'sidebar';
  author: string;              // 'human' | 'agent'
  text: string;
  x?: number;                  // percentage 0-100 (pin only)
  y?: number;                  // percentage 0-100 (pin only)
  createdAt: number;           // Unix ms
}
