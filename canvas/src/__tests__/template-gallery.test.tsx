import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplateGallery } from '../components/TemplateGallery';
import { TemplateCustomizer } from '../components/TemplateCustomizer';
import type { TemplateMetadata } from '../lib/template-configs';
import { TEMPLATE_METADATA } from '../lib/template-configs';

/**
 * TemplateGallery now uses static TEMPLATE_METADATA from template-configs.ts
 * (no fetch). TemplateCustomizer now creates creation+slide+iteration via API.
 */

describe('TemplateGallery', () => {
  it('renders a card for each template in TEMPLATE_METADATA', () => {
    const onSelect = vi.fn();
    render(<TemplateGallery onSelectTemplate={onSelect} />);

    // Each template in the metadata should appear
    for (const tmpl of TEMPLATE_METADATA) {
      expect(screen.getByText(tmpl.name)).toBeInTheDocument();
    }
  });

  it('clicking a template card calls onSelectTemplate with TemplateMetadata', () => {
    const onSelect = vi.fn();
    render(<TemplateGallery onSelectTemplate={onSelect} />);

    const firstTemplate = TEMPLATE_METADATA[0];
    fireEvent.click(screen.getByText(firstTemplate.name));
    expect(onSelect).toHaveBeenCalledWith(firstTemplate);
  });

  it('renders no "Create with AI" card (AI flow moved to ChatSidebar)', () => {
    const onSelect = vi.fn();
    render(<TemplateGallery onSelectTemplate={onSelect} />);

    // The old "Create with AI" card is removed — template gallery only shows templates
    expect(screen.queryByText(/Create with AI/)).toBeNull();
  });
});

describe('TemplateCustomizer', () => {
  const template: TemplateMetadata = {
    templateId: 't1-quote',
    name: 'Client Testimonial / Quote',
    description: 'Portrait photo with name, title, handle, and pull quote',
    thumbnailPath: 'templates/thumbnails/template_1.png',
    platform: 'instagram-square',
    dimensions: { width: 1080, height: 1080 },
  };

  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('renders the template name and description', () => {
    render(
      <TemplateCustomizer
        template={template}
        campaignId="cmp_test"
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    expect(screen.getByText('Client Testimonial / Quote')).toBeInTheDocument();
    expect(screen.getByText(/portrait photo/i)).toBeInTheDocument();
  });

  it('renders the Creation Title input with template name as default', () => {
    render(
      <TemplateCustomizer
        template={template}
        campaignId="cmp_test"
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText(/creation title/i);
    expect(titleInput).toBeInTheDocument();
    expect((titleInput as HTMLInputElement).value).toBe('Client Testimonial / Quote');
  });

  it('"Back to Templates" calls onBack', () => {
    const onBack = vi.fn();
    render(
      <TemplateCustomizer
        template={template}
        campaignId="cmp_test"
        onBack={onBack}
        onCreated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText(/back to templates/i));
    expect(onBack).toHaveBeenCalled();
  });

  it('"Create Creation" calls the API and then onCreated', async () => {
    const onCreated = vi.fn();

    // Mock the three POST requests: creation, slide, iteration
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'crt_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'sld_1' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'itr_1' }) });

    render(
      <TemplateCustomizer
        template={template}
        campaignId="cmp_test"
        onBack={vi.fn()}
        onCreated={onCreated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /create creation/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('cmp_test');
    });

    // Should have made 3 API calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0][0]).toContain('/api/campaigns/cmp_test/creations');
    expect(mockFetch.mock.calls[1][0]).toContain('/api/creations/crt_1/slides');
    expect(mockFetch.mock.calls[2][0]).toContain('/api/slides/sld_1/iterations');
  });

  it('shows error message when API call fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(
      <TemplateCustomizer
        template={template}
        campaignId="cmp_test"
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /create creation/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create creation: 500/i)).toBeInTheDocument();
    });
  });
});
