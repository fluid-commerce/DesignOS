/**
 * Unit tests for campaign store navigation logic.
 * Tests state transitions, sidebar toggles, and fetch actions.
 * Also covers getCreationDimensions and preview render logic (Task 08-03).
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { useCampaignStore } from '../store/campaign';
import {
  getCreationDimensions,
  buildCreationPreview,
  buildSlidePreview,
} from '../lib/preview-utils';
import type { Campaign, Creation, Slide, Iteration } from '../lib/campaign-types';

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
    activeCreationId: null,
    activeSlideId: null,
    activeIterationId: null,
    campaigns: [],
    creations: [],
    slides: [],
    iterations: [],
    latestIterationByCreationId: {},
    loading: false,
    leftSidebarOpen: true,
    rightSidebarOpen: false,
    activeNavTab: 'create',
    chatSidebarOpen: true,
    _requestId: 0,
  });
});

// ---- Sample data ----
const sampleCampaigns: Campaign[] = [
  {
    id: 'cmp_1',
    title: 'Spring Campaign',
    channels: ['instagram'],
    createdAt: 1000,
    updatedAt: 1000,
  },
];
const sampleCreations: Creation[] = [
  {
    id: 'crt_1',
    campaignId: 'cmp_1',
    title: 'Hero Post',
    creationType: 'instagram',
    slideCount: 1,
    createdAt: 1000,
  },
];
const sampleSlides: Slide[] = [
  { id: 'sld_1', creationId: 'crt_1', slideIndex: 0, createdAt: 1000 },
];
const sampleIterations: Iteration[] = [
  {
    id: 'itr_1',
    slideId: 'sld_1',
    iterationIndex: 0,
    htmlPath: '/path/to/file.html',
    slotSchema: null,
    aiBaseline: null,
    userState: null,
    status: 'unmarked',
    source: 'ai',
    templateId: null,
    createdAt: 1000,
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
    expect(state.activeCreationId).toBeNull();
    expect(state.activeSlideId).toBeNull();
    expect(state.activeIterationId).toBeNull();
  });
});

describe('navigateToCampaign', () => {
  it('sets currentView to campaign and activeCampaignId', async () => {
    // fetchCreations + fetchLatestIterations (empty slides -> no further calls)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleCreations))
      .mockResolvedValueOnce(makeJsonResponse([])); // slides for crt_1 (empty -> no iteration fetch)

    await useCampaignStore.getState().navigateToCampaign('cmp_1');

    const state = useCampaignStore.getState();
    expect(state.currentView).toBe('campaign');
    expect(state.activeCampaignId).toBe('cmp_1');
    expect(state.activeCreationId).toBeNull();
    expect(state.activeSlideId).toBeNull();
  });

  it('fetches creations for the campaign', async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleCreations))
      .mockResolvedValueOnce(makeJsonResponse([])); // slides for fetchLatestIterations

    await useCampaignStore.getState().navigateToCampaign('cmp_1');

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/cmp_1/creations');
    expect(useCampaignStore.getState().creations).toEqual(sampleCreations);
  });
});

describe('navigateToCreation', () => {
  it('sets currentView to creation and auto-selects first slide', async () => {
    // fetchSlides returns slides, then fetchIterations for each slide
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleSlides)) // fetchSlides
      .mockResolvedValueOnce(makeJsonResponse(sampleIterations)); // iterations for sld_1

    await useCampaignStore.getState().navigateToCreation('crt_1');

    const state = useCampaignStore.getState();
    expect(state.currentView).toBe('creation');
    expect(state.activeCreationId).toBe('crt_1');
    expect(state.activeSlideId).toBe('sld_1');
    expect(state.activeIterationId).toBe('itr_1');
  });

  it('fetches slides and all iterations for the creation', async () => {
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleSlides))
      .mockResolvedValueOnce(makeJsonResponse(sampleIterations));

    await useCampaignStore.getState().navigateToCreation('crt_1');

    expect(mockFetch).toHaveBeenCalledWith('/api/creations/crt_1/slides');
    expect(mockFetch).toHaveBeenCalledWith('/api/slides/sld_1/iterations');
    expect(useCampaignStore.getState().slides).toEqual(sampleSlides);
    expect(useCampaignStore.getState().iterations).toEqual(sampleIterations);
  });
});

describe('setActiveSlide', () => {
  it('sets activeSlideId and picks best iteration', async () => {
    // Setup: pre-populate slides and iterations
    useCampaignStore.setState({
      slides: sampleSlides,
      iterations: sampleIterations,
      activeSlideId: null,
    });

    useCampaignStore.getState().setActiveSlide('sld_1');

    const state = useCampaignStore.getState();
    expect(state.activeSlideId).toBe('sld_1');
    expect(state.activeIterationId).toBe('itr_1');
  });

  it('prefers winner iteration over latest', () => {
    const winnerIter: Iteration = {
      ...sampleIterations[0],
      id: 'itr_winner',
      iterationIndex: 0,
      status: 'winner',
    };
    const laterIter: Iteration = {
      ...sampleIterations[0],
      id: 'itr_later',
      iterationIndex: 1,
      status: 'unmarked',
    };
    useCampaignStore.setState({
      slides: sampleSlides,
      iterations: [winnerIter, laterIter],
    });

    useCampaignStore.getState().setActiveSlide('sld_1');

    expect(useCampaignStore.getState().activeIterationId).toBe('itr_winner');
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
  it('from creation goes to campaign level', async () => {
    useCampaignStore.setState({ activeCampaignId: 'cmp_1' });
    // navigateToCreation: fetchSlides + fetch iterations for each slide
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleSlides))
      .mockResolvedValueOnce(makeJsonResponse(sampleIterations));

    await useCampaignStore.getState().navigateToCreation('crt_1');
    // navigateBack -> navigateToCampaign -> fetchCreations + fetchLatestIterations (empty slides)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleCreations))
      .mockResolvedValueOnce(makeJsonResponse([]));

    await useCampaignStore.getState().navigateBack();

    expect(useCampaignStore.getState().currentView).toBe('campaign');
  });

  it('from campaign goes to dashboard', async () => {
    // navigateToCampaign: fetchCreations + fetchLatestIterations (empty slides)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleCreations))
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

  it('fetchCreations handles non-ok response gracefully', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse(null, false));
    await useCampaignStore.getState().fetchCreations('cmp_1');
    expect(useCampaignStore.getState().loading).toBe(false);
  });
});

// ============================================================
// getCreationDimensions (08-03)
// ============================================================

describe('getCreationDimensions', () => {
  it('returns 1080x1080 for instagram', () => {
    expect(getCreationDimensions('instagram')).toEqual({ width: 1080, height: 1080 });
  });

  it('returns 1200x627 for linkedin', () => {
    expect(getCreationDimensions('linkedin')).toEqual({ width: 1200, height: 627 });
  });

  it('returns 816x1056 for one-pager', () => {
    expect(getCreationDimensions('one-pager')).toEqual({ width: 816, height: 1056 });
  });

  it('defaults to 1080x1080 for unknown creation type', () => {
    expect(getCreationDimensions('tiktok')).toEqual({ width: 1080, height: 1080 });
    expect(getCreationDimensions('')).toEqual({ width: 1080, height: 1080 });
  });
});

// ============================================================
// buildCreationPreview (08-03)
// ============================================================

const baseCreation: Creation = {
  id: 'crt_1',
  campaignId: 'cmp_1',
  title: 'Hero Post',
  creationType: 'instagram',
  slideCount: 1,
  createdAt: 1000,
};

const completeIteration: Iteration = {
  id: 'itr_complete',
  slideId: 'sld_1',
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

describe('buildCreationPreview', () => {
  it('returns iframe src when iteration is complete', () => {
    const preview = buildCreationPreview(baseCreation, completeIteration);
    expect(preview.src).toBe('/api/iterations/itr_complete/html');
    expect(preview.meta).toBeUndefined();
  });

  it('uses correct dimensions for instagram creation', () => {
    const preview = buildCreationPreview(baseCreation, completeIteration);
    expect(preview.width).toBe(1080);
    expect(preview.height).toBe(1080);
  });

  it('uses correct dimensions for linkedin creation', () => {
    const linkedinCreation = { ...baseCreation, creationType: 'linkedin' };
    const preview = buildCreationPreview(linkedinCreation, completeIteration);
    expect(preview.width).toBe(1200);
    expect(preview.height).toBe(627);
  });

  it('returns metadata fallback when iteration is pending', () => {
    const preview = buildCreationPreview(baseCreation, pendingIteration);
    expect(preview.src).toBeUndefined();
    expect(preview.meta).toBeDefined();
    expect(preview.meta?.badges).toContain('pending');
  });

  it('returns metadata fallback when iteration is generating', () => {
    const preview = buildCreationPreview(baseCreation, generatingIteration);
    expect(preview.src).toBeUndefined();
    expect(preview.meta?.badges).toContain('generating');
  });

  it('returns metadata fallback with "pending" badge when no iteration', () => {
    const preview = buildCreationPreview(baseCreation, undefined);
    expect(preview.src).toBeUndefined();
    expect(preview.meta?.badges).toContain('pending');
  });
});

// ============================================================
// buildSlidePreview (08-03)
// ============================================================

const baseSlide: Slide = {
  id: 'sld_1',
  creationId: 'crt_1',
  slideIndex: 0,
  createdAt: 1000,
};

describe('buildSlidePreview', () => {
  it('returns iframe src for latest complete iteration', () => {
    const olderComplete: Iteration = { ...completeIteration, id: 'itr_old', iterationIndex: 0 };
    const newerComplete: Iteration = { ...completeIteration, id: 'itr_new', iterationIndex: 1 };
    const preview = buildSlidePreview(baseSlide, [olderComplete, newerComplete], baseCreation);
    expect(preview.src).toBe('/api/iterations/itr_new/html');
    expect(preview.meta).toBeUndefined();
  });

  it('returns metadata fallback when only pending iterations exist', () => {
    const preview = buildSlidePreview(baseSlide, [pendingIteration], baseCreation);
    expect(preview.src).toBeUndefined();
    expect(preview.meta).toBeDefined();
    expect(preview.meta?.badges).toContain('Slide 1');
  });

  it('returns metadata fallback with "No iterations" when empty', () => {
    const preview = buildSlidePreview(baseSlide, [], baseCreation);
    expect(preview.src).toBeUndefined();
    expect(preview.meta?.detail).toBe('No iterations');
  });

  it('uses parent creation dimensions for slide preview', () => {
    const linkedinCreation = { ...baseCreation, creationType: 'linkedin' };
    const preview = buildSlidePreview(baseSlide, [completeIteration], linkedinCreation);
    expect(preview.width).toBe(1200);
    expect(preview.height).toBe(627);
  });

  it('defaults to instagram dimensions when parent creation is undefined', () => {
    const preview = buildSlidePreview(baseSlide, [completeIteration], undefined);
    expect(preview.width).toBe(1080);
    expect(preview.height).toBe(1080);
  });
});

// ============================================================
// fetchLatestIterations (08-03)
// ============================================================

describe('fetchLatestIterations', () => {
  it('populates latestIterationByCreationId with latest iteration per creation', async () => {
    useCampaignStore.setState({ creations: sampleCreations });

    const slides: Slide[] = [{ id: 'sld_1', creationId: 'crt_1', slideIndex: 0, createdAt: 1000 }];
    const iterations: Iteration[] = [
      { ...completeIteration, id: 'itr_1', iterationIndex: 0 },
      { ...completeIteration, id: 'itr_2', iterationIndex: 1 },
    ];

    // fetchLatestIterations fetches /api/creations/{id}/slides then /api/slides/{slideId}/iterations
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(slides)) // slides for crt_1
      .mockResolvedValueOnce(makeJsonResponse(iterations)); // iterations for sld_1

    await useCampaignStore.getState().fetchLatestIterations('cmp_1');

    const state = useCampaignStore.getState();
    expect(state.latestIterationByCreationId['crt_1']).toBeDefined();
    expect(state.latestIterationByCreationId['crt_1'].id).toBe('itr_2'); // latest by iterationIndex
  });

  it('handles creation with no slides gracefully', async () => {
    useCampaignStore.setState({ creations: sampleCreations });

    mockFetch.mockResolvedValueOnce(makeJsonResponse([])); // empty slides

    await useCampaignStore.getState().fetchLatestIterations('cmp_1');

    expect(useCampaignStore.getState().latestIterationByCreationId['crt_1']).toBeUndefined();
  });

  it('handles creation with no iterations gracefully', async () => {
    useCampaignStore.setState({ creations: sampleCreations });

    const slides: Slide[] = [{ id: 'sld_1', creationId: 'crt_1', slideIndex: 0, createdAt: 1000 }];
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(slides)) // slides
      .mockResolvedValueOnce(makeJsonResponse([])); // empty iterations

    await useCampaignStore.getState().fetchLatestIterations('cmp_1');

    expect(useCampaignStore.getState().latestIterationByCreationId['crt_1']).toBeUndefined();
  });

  it('is called automatically on navigateToCampaign', async () => {
    const slides: Slide[] = [{ id: 'sld_1', creationId: 'crt_1', slideIndex: 0, createdAt: 1000 }];
    const iterations: Iteration[] = [{ ...completeIteration, id: 'itr_1', iterationIndex: 0 }];

    // navigateToCampaign calls: 1) fetchCreations, 2) fetchLatestIterations (slides + iterations per creation)
    mockFetch
      .mockResolvedValueOnce(makeJsonResponse(sampleCreations)) // fetchCreations
      .mockResolvedValueOnce(makeJsonResponse(slides)) // fetchLatestIterations -> slides for crt_1
      .mockResolvedValueOnce(makeJsonResponse(iterations)); // fetchLatestIterations -> iterations for sld_1

    await useCampaignStore.getState().navigateToCampaign('cmp_1');

    expect(useCampaignStore.getState().latestIterationByCreationId['crt_1']).toBeDefined();
  });
});

// ============================================================
// Phase 10: Top-level navigation tab and chat sidebar state
// ============================================================

describe('activeNavTab (Phase 10)', () => {
  it('defaults to create', () => {
    const state = useCampaignStore.getState();
    expect(state.activeNavTab).toBe('create');
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
