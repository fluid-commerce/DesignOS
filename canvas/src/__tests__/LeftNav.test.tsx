import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useCampaignStore } from '../store/campaign';
import { LeftNav } from '../components/LeftNav';

describe('LeftNav', () => {
  beforeEach(() => {
    useCampaignStore.setState({
      activeNavTab: 'create',
      chatSidebarOpen: true,
    } as Parameters<typeof useCampaignStore.setState>[0]);
  });

  it('renders 4 nav tab buttons', () => {
    const { container } = render(<LeftNav />);
    // Query buttons with title attributes (nav items)
    const tabButtons = Array.from(container.querySelectorAll('button[title]')).filter(
      (b) => b.getAttribute('title') !== 'AI Chat'
    );
    expect(tabButtons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders chat toggle button at bottom', () => {
    const { container } = render(<LeftNav />);
    const chatBtn = container.querySelector('button[title="AI Chat"]');
    expect(chatBtn).not.toBeNull();
  });

  it('clicking a nav tab updates activeNavTab in store', () => {
    const { container } = render(<LeftNav />);
    const templatesBtn = container.querySelector('button[title="Templates"]') as HTMLButtonElement;
    expect(templatesBtn).not.toBeNull();
    fireEvent.click(templatesBtn);
    expect(useCampaignStore.getState().activeNavTab).toBe('templates');
  });

  it('clicking chat toggle flips chatSidebarOpen in store', () => {
    const { container } = render(<LeftNav />);
    const chatBtn = container.querySelector('button[title="AI Chat"]') as HTMLButtonElement;
    expect(useCampaignStore.getState().chatSidebarOpen).toBe(true);
    fireEvent.click(chatBtn);
    expect(useCampaignStore.getState().chatSidebarOpen).toBe(false);
  });
});
