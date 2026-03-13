/**
 * Unit tests for campaign store navigation logic.
 * Tests state transitions, sidebar toggles, and fetch actions.
 * Also covers getAssetDimensions and preview render logic (Task 08-03).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { useCampaignStore } from '../store/campaign';
import { getAssetDimensions, buildAssetPreview, buildFramePreview } from '../lib/preview-utils';
import type { Campaign, Asset, Frame, Iteration } from '../lib/campaign-types';

// ---- Mock fetch globally ----
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function makeJsonResponse<T>(data: T, ok = true): Response {
  return {
    ok,
    json: async () => data,
  } as unknown as Response;
}

// Reset the store between tests by reinitializing state
beforeEach(() => {
  mockFetch.mockReset();
  useCampaignStore.setState({
    currentView: 'dashboard',
    activeCampaignId: null,
    activeAssetId: null,
    activeFrameId: null,
    activeIterationId: null,
    campaigns: [],
    assets: [],
    frames: [],
    iterations: [],
    latestIterationByAssetId: {},
    loading: false,
    leftSidebarOpen: true,
    rightSidebarOpen: false,
    activeNavTab: 'campaigns',
    chatSidebarOpen: true,
    _requestId: 0,
  });
});

// ---- Sample data ----
const sampleCampaigns: Campaign[] = [
  { id: 'cmp_1', title: 'Spring Campaign', channels: ['instagram'], createdAt: 1000, updatedAt: 1000 },
];
const sampleAssets: Asset[] = [
  { id: 'ast_1', campaignId: 'cmp_1', title: 'Hero Post', assetType: 'instagram', frameCount: 1, createdAt: 1000 },
];
const sampleFrames: Frame[] = [
  { id: 'frm_1', assetId: 'ast_1', frameIndex: 0, createdAt: 1000 },
];
const sampleIterations: Iteration[] = [
  {
    id: 'itr_1', frameId: 'frm_1', iterationIndex: 0,
    htmlPath: '/path/to/file.html', slotSchema: null, aiBaseline: null,
    userState: null, status: 'unmarked', source: 'ai', templateId: null, createdAt: 1000,
  },
];

// ============================================================
// Navigation state transitions
// ============================================================

describe('navigateToDashboard', () => {
  it('sets currentView to dashboard and clears sub-ids', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleCampaigns));

    useCampaignStore.getState().navigateToDashboard();

    const state = useCampaignStore.getState();
    expect(state.currentView).toBe('dashboard');
    expect(state.activeCampaignId).toBeNull();
    expect(state.activeAssetId).toBeNull();
    expect(state.activeFrameId).toBeNull();
    expect(state.activeIterationId).toBeNull();
  });
});

describe('navigateToCampaign', () => {
  it('sets currentView to campaign and activeCampaignId', async () => {
    // fetchAssets + fetchLatestIterations (empty frames -> no further calls)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleAssets))
      .mockResolvedValueOnce(makeJsonResponse([])); // frames for ast_1 (empty -> no iteration fetch)

    await useCampaignStore.getState().navigateToCampaign('cmp_1');

    const state = useCampaignStore.getState();
    expect(state.currentView).toBe('campaign');
    expect(state.activeCampaignId).toBe('cmp_1');
    expect(state.activeAssetId).toBeNull();
    expect(state.activeFrameId).toBeNull();
  });

  it('fetches assets for the campaign', async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleAssets))
      .mockResolvedValueOnce(makeJsonResponse([])); // frames for fetchLatestIterations

    await useCampaignStore.getState().navigateToCampaign('cmp_1');

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/cmp_1/assets');
    expect(useCampaignStore.getState().assets).toEqual(sampleAssets);
  });
});

describe('navigateToAsset', () => {
  it('sets currentView to asset and activeAssetId', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleFrames));

    await useCampaignStore.getState().navigateToAsset('ast_1');

    const state = useCampaignStore.getState();
    expect(state.currentView).toBe('asset');
    expect(state.activeAssetId).toBe('ast_1');
    expect(state.activeFrameId).toBeNull();
  });

  it('fetches frames for the asset', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleFrames));

    await useCampaignStore.getState().navigateToAsset('ast_1');

    expect(mockFetch).toHaveBeenCalledWith('/api/assets/ast_1/frames');
    expect(useCampaignStore.getState().frames).toEqual(sampleFrames);
  });
});

describe('navigateToFrame', () => {
  it('sets currentView to frame and activeFrameId', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleIterations));

    await useCampaignStore.getState().navigateToFrame('frm_1');

    const state = useCampaignStore.getState();
    expect(state.currentView).toBe('frame');
    expect(state.activeFrameId).toBe('frm_1');
  });

  it('fetches iterations for the frame', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleIterations));

    await useCampaignStore.getState().navigateToFrame('frm_1');

    expect(mockFetch).toHaveBeenCalledWith('/api/frames/frm_1/iterations');
    expect(useCampaignStore.getState().iterations).toEqual(sampleIterations);
  });
});

// ============================================================
// selectIteration
// ============================================================

describe('selectIteration', () => {
  it('sets activeIterationId', () => {
    useCampaignStore.getState().selectIteration('itr_1');
    expect(useCampaignStore.getState().activeIterationId).toBe('itr_1');
  });

  it('can clear by selecting different id', () => {
    useCampaignStore.getState().selectIteration('itr_1');
    useCampaignStore.getState().selectIteration('itr_2');
    expect(useCampaignStore.getState().activeIterationId).toBe('itr_2');
  });
});

// ============================================================
// navigateBack
// ============================================================

describe('navigateBack', () => {
  it('from frame goes to asset level', async () => {
    // Setup asset and frame state
    useCampaignStore.setState({ activeCampaignId: 'cmp_1', activeAssetId: 'ast_1' });
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleFrames)); // frames for asset

    await useCampaignStore.getState().navigateToFrame('frm_1');
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleFrames)); // navigateBack -> navigateToAsset -> fetchFrames

    await useCampaignStore.getState().navigateBack();

    expect(useCampaignStore.getState().currentView).toBe('asset');
  });

  it('from asset goes to campaign level', async () => {
    useCampaignStore.setState({ activeCampaignId: 'cmp_1' });
    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleFrames));

    await useCampaignStore.getState().navigateToAsset('ast_1');
    // navigateBack -> navigateToCampaign -> fetchAssets + fetchLatestIterations (empty frames)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleAssets))
      .mockResolvedValueOnce(makeJsonResponse([]));

    await useCampaignStore.getState().navigateBack();

    expect(useCampaignStore.getState().currentView).toBe('campaign');
  });

  it('from campaign goes to dashboard', async () => {
    // navigateToCampaign: fetchAssets + fetchLatestIterations (empty frames)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleAssets))
      .mockResolvedValueOnce(makeJsonResponse([]));
    await useCampaignStore.getState().navigateToCampaign('cmp_1');

    mockFetch.mockResolvedValueOnce(makeJsonResponse(sampleCampaigns)); // navigateBack -> navigateToDashboard -> fetchCampaigns

    useCampaignStore.getState().navigateBack();
    // navigateToDashboard is synchronous for state change
    expect(useCampaignStore.getState().currentView).toBe('dashboard');
  });

  it('from dashboard is a no-op', () => {
    useCampaignStore.getState().navigateBack();
    expect(useCampaignStore.getState().currentView).toBe('dashboard');
  });
});

// ============================================================
// Sidebar toggles
// ============================================================

describe('sidebar state', () => {
  it('toggleLeftSidebar flips leftSidebarOpen', () => {
    expect(useCampaignStore.getState().leftSidebarOpen).toBe(true);
    useCampaignStore.getState().toggleLeftSidebar();
    expect(useCampaignStore.getState().leftSidebarOpen).toBe(false);
    useCampaignStore.getState().toggleLeftSidebar();
    expect(useCampaignStore.getState().leftSidebarOpen).toBe(true);
  });

  it('toggleRightSidebar flips rightSidebarOpen', () => {
    expect(useCampaignStore.getState().rightSidebarOpen).toBe(false);
    useCampaignStore.getState().toggleRightSidebar();
    expect(useCampaignStore.getState().rightSidebarOpen).toBe(true);
    useCampaignStore.getState().toggleRightSidebar();
    expect(useCampaignStore.getState().rightSidebarOpen).toBe(false);
  });

  it('setRightSidebarOpen sets explicit value', () => {
    useCampaignStore.getState().setRightSidebarOpen(true);
    expect(useCampaignStore.getState().rightSidebarOpen).toBe(true);

    useCampaignStore.getState().setRightSidebarOpen(false);
    expect(useCampaignStore.getState().rightSidebarOpen).toBe(false);
  });

  it('left sidebar defaults to open', () => {
    expect(useCampaignStore.getState().leftSidebarOpen).toBe(true);
  });

  it('right sidebar defaults to closed', () => {
    expect(useCampaignStore.getState().rightSidebarOpen).toBe(false);
  });
});

// ============================================================
// Fetch error handling
// ============================================================

describe('fetch error handling', () => {
  it('fetchCampaigns handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await useCampaignStore.getState().fetchCampaigns();
    const state = useCampaignStore.getState();
    expect(state.loading).toBe(false);
    expect(state.campaigns).toEqual([]);
  });

  it('fetchAssets handles non-ok response gracefully', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse(null, false));
    await useCampaignStore.getState().fetchAssets('cmp_1');
    expect(useCampaignStore.getState().loading).toBe(false);
  });
});

// ============================================================
// getAssetDimensions (08-03)
// ============================================================

describe('getAssetDimensions', () => {
  it('returns 1080x1080 for instagram', () => {
    expect(getAssetDimensions('instagram')).toEqual({ width: 1080, height: 1080 });
  });

  it('returns 1200x627 for linkedin', () => {
    expect(getAssetDimensions('linkedin')).toEqual({ width: 1200, height: 627 });
  });

  it('returns 816x1056 for one-pager', () => {
    expect(getAssetDimensions('one-pager')).toEqual({ width: 816, height: 1056 });
  });

  it('defaults to 1080x1080 for unknown asset type', () => {
    expect(getAssetDimensions('tiktok')).toEqual({ width: 1080, height: 1080 });
    expect(getAssetDimensions('')).toEqual({ width: 1080, height: 1080 });
  });
});

// ============================================================
// buildAssetPreview (08-03)
// ============================================================

const baseAsset: Asset = {
  id: 'ast_1',
  campaignId: 'cmp_1',
  title: 'Hero Post',
  assetType: 'instagram',
  frameCount: 1,
  createdAt: 1000,
};

const completeIteration: Iteration = {
  id: 'itr_complete',
  frameId: 'frm_1',
  iterationIndex: 0,
  htmlPath: '/path/to/file.html',
  slotSchema: null,
  aiBaseline: null,
  userState: null,
  status: 'unmarked',
  source: 'ai',
  templateId: null,
  createdAt: 1000,
  generationStatus: 'complete',
};

const pendingIteration: Iteration = {
  ...completeIteration,
  id: 'itr_pending',
  generationStatus: 'pending',
};

const generatingIteration: Iteration = {
  ...completeIteration,
  id: 'itr_generating',
  generationStatus: 'generating',
};

describe('buildAssetPreview', () => {
  it('returns iframe src when iteration is complete', () => {
    const preview = buildAssetPreview(baseAsset, completeIteration);
    expect(preview.src).toBe('/api/iterations/itr_complete/html');
    expect(preview.meta).toBeUndefined();
  });

  it('uses correct dimensions for instagram asset', () => {
    const preview = buildAssetPreview(baseAsset, completeIteration);
    expect(preview.width).toBe(1080);
    expect(preview.height).toBe(1080);
  });

  it('uses correct dimensions for linkedin asset', () => {
    const linkedinAsset = { ...baseAsset, assetType: 'linkedin' };
    const preview = buildAssetPreview(linkedinAsset, completeIteration);
    expect(preview.width).toBe(1200);
    expect(preview.height).toBe(627);
  });

  it('returns metadata fallback when iteration is pending', () => {
    const preview = buildAssetPreview(baseAsset, pendingIteration);
    expect(preview.src).toBeUndefined();
    expect(preview.meta).toBeDefined();
    expect(preview.meta?.badges).toContain('pending');
  });

  it('returns metadata fallback when iteration is generating', () => {
    const preview = buildAssetPreview(baseAsset, generatingIteration);
    expect(preview.src).toBeUndefined();
    expect(preview.meta?.badges).toContain('generating');
  });

  it('returns metadata fallback with "pending" badge when no iteration', () => {
    const preview = buildAssetPreview(baseAsset, undefined);
    expect(preview.src).toBeUndefined();
    expect(preview.meta?.badges).toContain('pending');
  });
});

// ============================================================
// buildFramePreview (08-03)
// ============================================================

const baseFrame: Frame = {
  id: 'frm_1',
  assetId: 'ast_1',
  frameIndex: 0,
  createdAt: 1000,
};

describe('buildFramePreview', () => {
  it('returns iframe src for latest complete iteration', () => {
    const olderComplete: Iteration = { ...completeIteration, id: 'itr_old', iterationIndex: 0 };
    const newerComplete: Iteration = { ...completeIteration, id: 'itr_new', iterationIndex: 1 };
    const preview = buildFramePreview(baseFrame, [olderComplete, newerComplete], baseAsset);
    expect(preview.src).toBe('/api/iterations/itr_new/html');
    expect(preview.meta).toBeUndefined();
  });

  it('returns metadata fallback when only pending iterations exist', () => {
    const preview = buildFramePreview(baseFrame, [pendingIteration], baseAsset);
    expect(preview.src).toBeUndefined();
    expect(preview.meta).toBeDefined();
    expect(preview.meta?.badges).toContain('Slide 1');
  });

  it('returns metadata fallback with "No iterations" when empty', () => {
    const preview = buildFramePreview(baseFrame, [], baseAsset);
    expect(preview.src).toBeUndefined();
    expect(preview.meta?.detail).toBe('No iterations');
  });

  it('uses parent asset dimensions for frame preview', () => {
    const linkedinAsset = { ...baseAsset, assetType: 'linkedin' };
    const preview = buildFramePreview(baseFrame, [completeIteration], linkedinAsset);
    expect(preview.width).toBe(1200);
    expect(preview.height).toBe(627);
  });

  it('defaults to instagram dimensions when parent asset is undefined', () => {
    const preview = buildFramePreview(baseFrame, [completeIteration], undefined);
    expect(preview.width).toBe(1080);
    expect(preview.height).toBe(1080);
  });
});

// ============================================================
// fetchLatestIterations (08-03)
// ============================================================

describe('fetchLatestIterations', () => {
  it('populates latestIterationByAssetId with latest iteration per asset', async () => {
    useCampaignStore.setState({ assets: sampleAssets });

    const frames: Frame[] = [{ id: 'frm_1', assetId: 'ast_1', frameIndex: 0, createdAt: 1000 }];
    const iterations: Iteration[] = [
      { ...completeIteration, id: 'itr_1', iterationIndex: 0 },
      { ...completeIteration, id: 'itr_2', iterationIndex: 1 },
    ];

    // fetchLatestIterations fetches /api/assets/{id}/frames then /api/frames/{frameId}/iterations
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(frames))     // frames for ast_1
      .mockResolvedValueOnce(makeJsonResponse(iterations)); // iterations for frm_1

    await useCampaignStore.getState().fetchLatestIterations('cmp_1');

    const state = useCampaignStore.getState();
    expect(state.latestIterationByAssetId['ast_1']).toBeDefined();
    expect(state.latestIterationByAssetId['ast_1'].id).toBe('itr_2'); // latest by iterationIndex
  });

  it('handles asset with no frames gracefully', async () => {
    useCampaignStore.setState({ assets: sampleAssets });

    mockFetch.mockResolvedValueOnce(makeJsonResponse([])); // empty frames

    await useCampaignStore.getState().fetchLatestIterations('cmp_1');

    expect(useCampaignStore.getState().latestIterationByAssetId['ast_1']).toBeUndefined();
  });

  it('handles asset with no iterations gracefully', async () => {
    useCampaignStore.setState({ assets: sampleAssets });

    const frames: Frame[] = [{ id: 'frm_1', assetId: 'ast_1', frameIndex: 0, createdAt: 1000 }];
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(frames))  // frames
      .mockResolvedValueOnce(makeJsonResponse([]));     // empty iterations

    await useCampaignStore.getState().fetchLatestIterations('cmp_1');

    expect(useCampaignStore.getState().latestIterationByAssetId['ast_1']).toBeUndefined();
  });

  it('is called automatically on navigateToCampaign', async () => {
    const frames: Frame[] = [{ id: 'frm_1', assetId: 'ast_1', frameIndex: 0, createdAt: 1000 }];
    const iterations: Iteration[] = [{ ...completeIteration, id: 'itr_1', iterationIndex: 0 }];

    // navigateToCampaign calls: 1) fetchAssets, 2) fetchLatestIterations (frames + iterations per asset)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleAssets))  // fetchAssets
      .mockResolvedValueOnce(makeJsonResponse(frames))         // fetchLatestIterations -> frames for ast_1
      .mockResolvedValueOnce(makeJsonResponse(iterations));    // fetchLatestIterations -> iterations for frm_1

    await useCampaignStore.getState().navigateToCampaign('cmp_1');

    expect(useCampaignStore.getState().latestIterationByAssetId['ast_1']).toBeDefined();
  });
});

// ============================================================
// Phase 10: Top-level navigation tab and chat sidebar state
// ============================================================

describe('activeNavTab (Phase 10)', () => {
  it('defaults to campaigns', () => {
    const state = useCampaignStore.getState();
    expect(state.activeNavTab).toBe('campaigns');
  });

  it('setActiveNavTab updates activeNavTab to templates', () => {
    useCampaignStore.getState().setActiveNavTab('templates');
    expect(useCampaignStore.getState().activeNavTab).toBe('templates');
  });

  it('setActiveNavTab updates activeNavTab to patterns', () => {
    useCampaignStore.getState().setActiveNavTab('patterns');
    expect(useCampaignStore.getState().activeNavTab).toBe('patterns');
  });

  it('setActiveNavTab updates activeNavTab to voice-guide', () => {
    useCampaignStore.getState().setActiveNavTab('voice-guide');
    expect(useCampaignStore.getState().activeNavTab).toBe('voice-guide');
  });
});

describe('chatSidebarOpen (Phase 10)', () => {
  it('defaults to true', () => {
    const state = useCampaignStore.getState();
    expect(state.chatSidebarOpen).toBe(true);
  });

  it('toggleChatSidebar flips chatSidebarOpen from true to false', () => {
    useCampaignStore.getState().toggleChatSidebar();
    expect(useCampaignStore.getState().chatSidebarOpen).toBe(false);
  });

  it('toggleChatSidebar flips chatSidebarOpen back to true', () => {
    useCampaignStore.getState().toggleChatSidebar();
    useCampaignStore.getState().toggleChatSidebar();
    expect(useCampaignStore.getState().chatSidebarOpen).toBe(true);
  });

  it('leftSidebarOpen stays in sync with chatSidebarOpen', () => {
    useCampaignStore.getState().toggleChatSidebar();
    const state = useCampaignStore.getState();
    expect(state.leftSidebarOpen).toBe(state.chatSidebarOpen);
  });
});
