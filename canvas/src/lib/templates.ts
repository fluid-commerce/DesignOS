/**
 * Template type definitions for the canvas template gallery.
 */

export interface TemplateInfo {
  id: string;
  name: string;
  category: 'social' | 'one-pager';
  html: string;
  dimensions: { width: number; height: number };
}

export interface TemplateCustomization {
  headline: string;
  accentColor: 'orange' | 'blue' | 'green' | 'purple';
  topic: string;
  platform?: string;
  variations: number;
}
