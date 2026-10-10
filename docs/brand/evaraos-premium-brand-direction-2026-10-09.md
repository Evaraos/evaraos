# EvaraOS Premium Brand Direction v1.0
Date: October 9, 2026
Status: CONCEPT / APPROVAL REQUIRED. No live code, logo, company name, domain, or Google Business Profile changes.

## Decision
Keep **EvaraOS** as master brand and preserve the official glossy red sculpted E. Explore a more luminous, premium adaptive liquid-glass visual environment, influenced only by the general principles of the user-shared Lumina design reference: clarity, generous spacing, translucency, subtle colored light, elegant data presentation and calm typography. Do not copy Lumina assets/UI or publicly adopt "Lumina" as company/product/design-system name without trademark clearance.

## Canonical source of truth
- Official in-app logo: `public/assets/brand/evaraos-mark.png`.
- Official installed-app icon: `public/assets/brand/evaraos-app-icon.png`.
- Corporate tokens in `public/assets/css/theme.css`: red `#E30613`, black `#050506`, white `#FFFFFF`.
- Adaptive interface accent `#FF3B30`, atmospheric wallpapers, glass surfaces and typography: `public/assets/css/theme/adaptive-tokens.css`, `public/assets/css/base/variables.css`, `public/assets/css/theme/liquid-environments.css`.
- Homepage and product scope: `public/index.html`; icon root-cause history: `docs/audits/brand-icon-root-cause-2026-07-26.md`.

## Visual guidance
1. Red remains the identity signature; blue, violet and blush appear as controlled ambient background lighting, not a substitute logo/palette.
2. Use translucent, rounded surfaces with clear contrast; large legible headlines; disciplined hierarchy, whitespace, reliable dark/light themes and restrained highlights.
3. Show the real EvaraOS app with verified screenshots, privacy-safe demo data and documented product maturity. No imaginary revenues, customer counts or employee photos.
4. Honor reduced-motion preferences, accessibility and mobile rendering performance. Test actual screens before changes.
5. Proposed brand messaging: **Everything connected.** Supporting line: **One operating system. Every business connection.**
6. Current site supports multi-company operations, subsidiaries, leads, role-based staffing and field jobs; marketplace and other roadmap capabilities require explicit live readiness verification. Use "Available", "In development" and "Vision" labels.

## Google Business Profile and public imagery
Use the original logo, authorized photographs of actual staff and on-site work, and redacted real app screenshots. Do not present AI-generated headquarters, team meetings or fictional interfaces as factual company photos. Google eligibility and map pin / Street View imagery are independent tasks.

## Naming judgment
Retain EvaraOS until a proper comparison and legal clearance; its trademark is not presumed clear. "Lumina" is commercially used in related industries (e.g., RealPage's Lumina AI Suite), raising material confusion concerns. "Inc." or "LLC" does not independently resolve trademark conflicts. No legal name change authorized.

## Approval-gated roadmap
0. Freeze branding and production changes; save the decision.
1. Verify official assets, screen inventory and feature status.
2. Prepare review-only homepage, mobile dashboard and marketing concept designs using canonical mark.
3. Validate design tokens, accessibility, responsive behavior, performance and reduced motion.
4. Review with owner / product team; record approvals and corrections.
5. With explicit approval only, submit implementation PR, pass required CI checks, deploy an exact commit and verify production.

## Notes
Repository checkpoint of visual brand book delivered in chat as `EvaraOS_Premium_Brand_Direction_v1.pdf` and notes as `EvaraOS_Brand_Direction_Implementation_Notes.md`. This Markdown documents the decision and constraints, not product deployment or trademark advice.
