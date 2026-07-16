# Daylight Ledger design

## Context and intent

Chi Dental staff use the product all day in a bright office and production lab, often returning
to it for a quick glance between physical tasks. The interface therefore defaults to a light,
high-contrast workspace. This is a new direction from the rejected Console and Light Studio work.

## Visual direction

**Daylight Ledger** combines the calm information density of Notion with Stripe's financial
clarity and ClickUp's operational scanability. It is a restrained product UI, not a decorative
brand surface.

- Restore the original sidebar fill exactly to `#766254`.
- Keep the sidebar flush, full-height, and structurally familiar. Do not float or inset it.
- Use a true neutral gray-white canvas rather than cream, parchment, or warm beige.
- Use white work surfaces, crisp 1px dividers, 8px corners, and almost no content shadows.
- Use the brand brown for primary actions and selected states. Reserve semantic colours for
  money and workflow meaning.
- Use Hanken Grotesk throughout with tabular figures for money, counts, dates, and identifiers.
- Retain optional dark mode, but move persistence to `chidental-theme-v2`; this intentionally
  starts existing users in light mode once after the redesign.

## App shell

The desktop sidebar remains 256px expanded / 80px collapsed. Its active item is an opaque white
surface with brown text; inactive items use high-contrast warm-white text. Search is a translucent
white control. The content area uses a neutral canvas and centered, consistent gutters. Mobile
retains the existing drawer behavior and top bar.

## Dashboard

Replace the repeated KPI-card grid with a financial ledger:

1. Page header and date controls.
2. One full-width money ledger where Outstanding leads by width, not by an oversized hero card.
3. A thin production pulse row for the four work states.
4. A two-column analysis area: sales/cash trend plus a concise collection-health summary.
5. One ranked-detail section containing products and clinics as readable lists with proportional
   bars, followed by a quiet operational footer.

The structure stacks in the same priority order on mobile. No data, permissions, routes, money
math, labels, or server fetching change.

## Accessibility and verification

Body text and controls meet WCAG AA; active navigation is signalled by fill, text, and
`aria-current`; focus rings remain visible; icons stay Lucide; loading skeletons match the final
layout; reduced motion remains supported. Verify at 375, 768, 1024, and 1440px when browser
preview is available, then run the full unit suite, production build, and Impeccable detector.

