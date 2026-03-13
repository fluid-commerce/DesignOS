import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useCampaignStore } from '../store/campaign';
import { AppShell } from '../components/AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    useCampaignStore.setState({
      activeNavTab: 'create',
      chatSidebarOpen: true,
      rightSidebarOpen: false,
    } as Parameters<typeof useCampaignStore.setState>[0]);
  });

  it('renders templates iframe when activeNavTab is templates', () => {
    useCampaignStore.setState({ activeNavTab: 'templates' } as Parameters<typeof useCampaignStore.setState>[0]);
    render(<AppShell><div>children</div></AppShell>);
    const iframe = screen.getByTitle('Template Library') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain('/templates/');
  });

  it('renders patterns iframe when activeNavTab is patterns', () => {
    useCampaignStore.setState({ activeNavTab: 'patterns' } as Parameters<typeof useCampaignStore.setState>[0]);
    render(<AppShell><div>children</div></AppShell>);
    const iframe = screen.getByTitle('Pattern Library') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain('/patterns/');
  });

  it('chat sidebar has zero width when chatSidebarOpen is false', () => {
    useCampaignStore.setState({ chatSidebarOpen: false } as Parameters<typeof useCampaignStore.setState>[0]);
    render(<AppShell><div>children</div></AppShell>);
    // ChatSidebar renders with width 0 when chatSidebarOpen is false
    // Find the sidebar div by checking for the style transition (width: 0)
    const allDivs = document.querySelectorAll('div');
    const chatSidebarDiv = Array.from(allDivs).find(
      (el) => el.style.width === '0px' && el.style.transition.includes('width')
    );
    expect(chatSidebarDiv).toBeTruthy();
  });
});
