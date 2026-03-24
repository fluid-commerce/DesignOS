# quote-testimonial

## Purpose

Pull quote layout centered on a single powerful statement from a real person. The portrait establishes credibility and humanity; the large italic quote body dominates the frame; name and title provide attribution context.

## When to Use

- Client or customer testimonials
- Industry expert quotes that endorse your approach
- Team member or founder quotes for culture/values posts
- Conference speaker highlights
- Any post where a person's words carry the message

## Slots

| Selector | Type | Description |
|----------|------|-------------|
| `.quote-text` | text | The full quote (rendered in italic, large) |
| `.attribution` | text | Person's name (bold) |
| `.title` | text | Job title and company |
| `.portrait img` | image | Headshot photo, rendered as circle (200 x 200px) |
| `.category span` | text | Vertical side label (e.g. `TESTIMONIAL`, `CASE STUDY`) |

## Example Topics

- Client win: "Working with this team was the single best investment we made this year."
- Industry leader: "The brands that survive the next decade will be the ones that systemized their storytelling."
- Founder reflection: "We didn't set out to build a marketing platform. We set out to solve our own problem."

## Layout Notes

- Portrait: circular, 200x200px, top-left at 120px — face humanizes the quote
- Quote text: 48px italic, starts at 380px — large enough to read as a scroll-stop
- Attribution + title: bottom-anchored — name bold, title muted
- Category: vertical text, upper-right corner
- Background: #111 — brand color + decorative layer applied at generation time
