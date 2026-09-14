# EC05 frontend design system

This document is the source of truth for new UI work in `apps/web`. Preserve the existing React, Next.js and Tailwind architecture. Add dependencies only when a real interaction requires them.

## Product personality

- Confident, energetic and commerce-oriented.
- Clear and restrained instead of corporate SaaS.
- Vietnamese-first copy that is concise and actionable.
- Orange is the brand signal. Green, yellow and red are reserved for semantic states.

Avoid purple or blue AI gradients, glassmorphism, gradient text, emoji icons, decorative blobs without purpose, oversized headings, excessive pills and identical dashboard KPI cards.

## Visual contexts

### Customer

Prioritize imagery, merchant, discount, location, expiry, scarcity and the primary action. Customer pages should feel like a commerce and local-experience product, not a dashboard.

### Partner and partner staff

Prefer information density, strong alignment, typography, whitespace and separators. Use cards only when content needs containment. Redemption status and operational actions must be immediately scannable.

### Admin

Prefer functional, dense tables and filters. Status, role, date and actions must remain visible without decorative containers competing for attention.

## Tokens

All source values live in `styles/tokens.css` and are exposed to Tailwind in `app/globals.css`.

- Surfaces: `bg-background`, `bg-surface`, `bg-surface-subtle`, `bg-surface-inverse`.
- Text: `text-foreground`, `text-muted-foreground`.
- Brand: `bg-brand`, `text-brand`, `bg-brand-subtle`.
- States: `success`, `warning`, `danger` and their `-subtle` variants.
- Borders: `border-border`.
- Radius: `rounded-ui-sm` (6px), `rounded-ui-md` (10px), `rounded-ui-lg` (14px).
- Elevation: `shadow-ui` and `shadow-ui-raised`.
- Motion: 120ms, 180ms or 220ms from the CSS duration tokens.

Do not add arbitrary color, radius or shadow values when a semantic token fits. Existing legacy classes can be migrated incrementally; new UI must use the token vocabulary.

## Layout rules

- Card is not the default layout mechanism.
- First try whitespace, alignment, typography, dividers or a background section.
- Use a card when content needs containment, independent interaction or a distinct state.
- Maintain clear left alignment on operational pages.
- Center content only when the reading flow benefits from it, such as a landing-page CTA or an empty state.
- Preserve useful information density on partner and admin pages.

## Typography

- Manrope is the UI font and remains the default.
- Do not introduce another font until a specific marketing surface needs a display face.
- Prefer hierarchy through size, weight and spacing instead of muted text everywhere.
- Do not use giant headings without a content reason.

## Components

- `components/ui`: accessible, domain-neutral primitives only.
- `components/customer`, `components/voucher`, `components/partner`, `components/admin`: domain components.
- Lucide is the only icon library. Standard UI icon sizes are 16, 18 and 20px.
- shadcn/Base UI provides behavior-heavy primitives. The installed baseline includes button, dialog, select, tooltip and sheet. Its default visual theme must not replace these tokens.
- TanStack Table may be introduced when an admin or partner table needs sorting, filtering, selection or pagination.

## Motion

- Motion must communicate state or spatial change.
- Good uses: claim processing to success, reordered voucher results and QR scan success.
- Avoid identical entrance animation on every element.
- Use spring motion only for meaningful state changes.

## Review checklist

- Does this need a card?
- Does every color have a brand or semantic purpose?
- Are radius, shadow and icon size using approved tokens?
- Is the primary action obvious?
- Is the information density correct for customer, partner or admin context?
- Is motion explaining a state change rather than decorating the page?
