/**
 * Unit tests for VoiceGuide component.
 * NAV-07: Side-tabs allow switching between Voice Guide documents.
 * NAV-08: Markdown docs render as rich text (headings, not raw # syntax).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock all 13 ?raw markdown imports with minimal representative content
vi.mock('../../../voice-guide/What_Is_Fluid.md?raw', () => ({
  default: '# What Is Fluid\n\nFluid is a commerce platform.',
}));
vi.mock('../../../voice-guide/The_Problem_Were_Solving.md?raw', () => ({
  default: '# The Problem\n\nRetailers struggle with fragmented tools.',
}));
vi.mock('../../../voice-guide/Why_WeCommerce_Exists.md?raw', () => ({
  default: '# Why WeCommerce Exists\n\nWeCommerce was built to unify.',
}));
vi.mock('../../../voice-guide/Voice_and_Style_Guide.md?raw', () => ({
  default: '# Voice and Style Guide\n\nOur tone is direct and confident.',
}));
vi.mock('../../../voice-guide/Builder.md?raw', () => ({
  default: '# Builder\n\n## Section One\n\nBuilder overview content here.',
}));
vi.mock('../../../voice-guide/Checkout.md?raw', () => ({
  default: '# Checkout\n\nCheckout documentation.',
}));
vi.mock('../../../voice-guide/Droplets.md?raw', () => ({
  default: '# Droplets\n\nDroplets documentation.',
}));
vi.mock('../../../voice-guide/Fluid_Connect.md?raw', () => ({
  default: '# Fluid Connect\n\nFluid Connect documentation.',
}));
vi.mock('../../../voice-guide/Fluid_Payments.md?raw', () => ({
  default: '# Fluid Payments\n\nFluid Payments documentation.',
}));
vi.mock('../../../voice-guide/FairShare.md?raw', () => ({
  default: '# FairShare\n\nFairShare documentation.',
}));
vi.mock('../../../voice-guide/Corporate_Tools.md?raw', () => ({
  default: '# Corporate Tools\n\nCorporate Tools documentation.',
}));
vi.mock('../../../voice-guide/App_Rep_Tools.md?raw', () => ({
  default: '# App Rep Tools\n\nApp Rep Tools documentation.',
}));
vi.mock('../../../voice-guide/What_is_Blitz_Week.md?raw', () => ({
  default: '# What Is Blitz Week\n\nBlitz Week documentation.',
}));

import { VoiceGuide } from '../components/VoiceGuide';

describe('VoiceGuide', () => {
  it('renders side-tabs for all 13 documents (NAV-07)', () => {
    render(<VoiceGuide />);
    // Each doc has an aria-label matching its label; query all nav buttons
    const nav = document.querySelector('nav[aria-label="Voice Guide documents"]');
    expect(nav).toBeTruthy();
    const buttons = nav!.querySelectorAll('button');
    expect(buttons).toHaveLength(13);
  });

  it('clicking a side-tab switches displayed document (NAV-07)', () => {
    render(<VoiceGuide />);
    // Default shows "What Is Fluid" content
    expect(screen.getByText(/Fluid is a commerce platform/)).toBeTruthy();

    // Click "Builder" tab
    const builderTab = screen.getByRole('button', { name: 'Builder' });
    fireEvent.click(builderTab);

    // Now Builder content should be visible
    expect(screen.getByText(/Builder overview content here/)).toBeTruthy();
  });

  it('renders markdown as rich text — headings as h1/h2 elements not raw # syntax (NAV-08)', () => {
    render(<VoiceGuide />);
    // Default doc: What Is Fluid — has "# What Is Fluid" heading
    const h1 = document.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1!.textContent).toBe('What Is Fluid');

    // Switch to Builder which has an h2
    const builderTab = screen.getByRole('button', { name: 'Builder' });
    fireEvent.click(builderTab);

    const h2 = document.querySelector('h2');
    expect(h2).toBeTruthy();
    expect(h2!.textContent).toBe('Section One');

    // Raw # syntax should not appear in the DOM text content
    const allText = document.body.textContent ?? '';
    expect(allText).not.toContain('# Builder');
    expect(allText).not.toContain('## Section One');
  });

  it('first tab is active by default with correct highlight', () => {
    render(<VoiceGuide />);
    const nav = document.querySelector('nav[aria-label="Voice Guide documents"]');
    const firstButton = nav!.querySelectorAll('button')[0] as HTMLElement;
    // Active tab has aria-current="page"
    expect(firstButton.getAttribute('aria-current')).toBe('page');
  });
});
