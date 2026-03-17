/**
 * Unit tests for VoiceGuide component.
 * NAV-07: Side-tabs allow switching between Voice Guide documents.
 * NAV-08: Markdown docs render as rich text (headings, not raw # syntax).
 *
 * VoiceGuide now fetches from /api/voice-guide instead of using ?raw imports.
 * Tests mock global.fetch to provide controlled doc data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { VoiceGuide } from '../components/VoiceGuide';

// Mock doc data matching the API response shape
const MOCK_DOCS = [
  { id: 'id-1', slug: 'what-is-fluid', label: 'What Is Fluid', content: '# What Is Fluid\n\nFluid is a commerce platform.', sortOrder: 0, updatedAt: 1 },
  { id: 'id-2', slug: 'the-problem', label: "The Problem We're Solving", content: '# The Problem\n\nRetailers struggle with fragmented tools.', sortOrder: 1, updatedAt: 2 },
  { id: 'id-3', slug: 'why-wecommerce', label: 'Why WeCommerce Exists', content: '# Why WeCommerce Exists\n\nWeCommerce was built to unify.', sortOrder: 2, updatedAt: 3 },
  { id: 'id-4', slug: 'voice-and-style', label: 'Voice and Style Guide', content: '# Voice and Style Guide\n\nOur tone is direct and confident.', sortOrder: 3, updatedAt: 4 },
  { id: 'id-5', slug: 'builder', label: 'Builder', content: '# Builder\n\n## Section One\n\nBuilder overview content here.', sortOrder: 4, updatedAt: 5 },
  { id: 'id-6', slug: 'checkout', label: 'Checkout', content: '# Checkout\n\nCheckout documentation.', sortOrder: 5, updatedAt: 6 },
  { id: 'id-7', slug: 'droplets', label: 'Droplets', content: '# Droplets\n\nDroplets documentation.', sortOrder: 6, updatedAt: 7 },
  { id: 'id-8', slug: 'fluid-connect', label: 'Fluid Connect', content: '# Fluid Connect\n\nFluid Connect documentation.', sortOrder: 7, updatedAt: 8 },
  { id: 'id-9', slug: 'fluid-payments', label: 'Fluid Payments', content: '# Fluid Payments\n\nFluid Payments documentation.', sortOrder: 8, updatedAt: 9 },
  { id: 'id-10', slug: 'fair-share', label: 'FairShare', content: '# FairShare\n\nFairShare documentation.', sortOrder: 9, updatedAt: 10 },
  { id: 'id-11', slug: 'corporate-tools', label: 'Corporate Tools', content: '# Corporate Tools\n\nCorporate Tools documentation.', sortOrder: 10, updatedAt: 11 },
  { id: 'id-12', slug: 'app-rep-tools', label: 'App Rep Tools', content: '# App Rep Tools\n\nApp Rep Tools documentation.', sortOrder: 11, updatedAt: 12 },
  { id: 'id-13', slug: 'blitz-week', label: 'What Is Blitz Week', content: '# What Is Blitz Week\n\nBlitz Week documentation.', sortOrder: 12, updatedAt: 13 },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve(MOCK_DOCS),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VoiceGuide', () => {
  it('renders side-tabs for all 13 documents (NAV-07)', async () => {
    render(<VoiceGuide />);
    const nav = document.querySelector('nav[aria-label="Voice Guide documents"]');
    expect(nav).toBeTruthy();
    // Wait for fetch to complete and docs to render
    await waitFor(() => {
      const buttons = nav!.querySelectorAll('button');
      expect(buttons).toHaveLength(13);
    });
  });

  it('clicking a side-tab switches displayed document (NAV-07)', async () => {
    render(<VoiceGuide />);
    // Wait for fetch to complete — first doc content appears
    await waitFor(() => {
      expect(screen.getByText(/Fluid is a commerce platform/)).toBeTruthy();
    });

    // Click "Builder" tab
    const builderTab = screen.getByRole('button', { name: 'Builder' });
    await act(async () => {
      fireEvent.click(builderTab);
    });

    // Now Builder content should be visible
    expect(screen.getByText(/Builder overview content here/)).toBeTruthy();
  });

  it('renders markdown as rich text — headings as h1/h2 elements not raw # syntax (NAV-08)', async () => {
    render(<VoiceGuide />);
    // Wait for default doc (What Is Fluid) to render
    await waitFor(() => {
      const h1 = document.querySelector('h1');
      expect(h1).toBeTruthy();
    });

    const h1 = document.querySelector('h1');
    expect(h1!.textContent).toBe('What Is Fluid');

    // Switch to Builder which has an h2
    const builderTab = screen.getByRole('button', { name: 'Builder' });
    await act(async () => {
      fireEvent.click(builderTab);
    });

    await waitFor(() => {
      const h2 = document.querySelector('h2');
      expect(h2).toBeTruthy();
    });

    const h2 = document.querySelector('h2');
    expect(h2!.textContent).toBe('Section One');

    // Raw # syntax should not appear in the DOM text content
    const allText = document.body.textContent ?? '';
    expect(allText).not.toContain('# Builder');
    expect(allText).not.toContain('## Section One');
  });

  it('first tab is active by default with correct highlight', async () => {
    render(<VoiceGuide />);
    const nav = document.querySelector('nav[aria-label="Voice Guide documents"]');
    // Wait for both docs to load AND the second useEffect to set activeDocSlug.
    // The component has two async steps: (1) fetch resolves -> docs state set,
    // (2) useEffect on docs fires -> activeDocSlug set to docs[0].slug.
    // We must wait for aria-current to appear, not just for buttons to exist.
    await waitFor(() => {
      const buttons = nav!.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      const first = buttons[0] as HTMLElement;
      expect(first.getAttribute('aria-current')).toBe('page');
    });
  });

  it('shows Loading... while fetch is pending', () => {
    // Provide a never-resolving promise to keep loading state active
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<VoiceGuide />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('fetches /api/voice-guide on mount', async () => {
    render(<VoiceGuide />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/voice-guide');
    });
  });
});
