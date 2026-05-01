# Evaraos Architecture Stability Rules

## Current Stabilization Direction

Evaraos is being cleaned up into a scalable SaaS/PWA structure for multi-company operations.

## Rules Going Forward

1. Do not load the same JS file directly in HTML and dynamically through bootstrap.
2. Patch files must be temporary only.
3. Visual patches should be merged into the real component CSS.
4. Install/PWA logic belongs in the install system.
5. Navigation logic belongs in the nav system.
6. Theme loading should not own unrelated app features.
7. Page-specific modules should load only on their matching page.
8. Firestore rules, functions, and frontend permissions must stay aligned.
9. Every multi-company object must keep companyId/state/role access in mind.
10. Offline features must require a trusted authenticated device first.
11. Before adding features, consolidate duplicate loading and patch files.

## Current Known Source Files

- assets/js/theme-css-loader.js currently acts as the global app bootstrap.
- assets/css/install-nav.css is now the single install UI stylesheet.
- assets/js/install.js owns install interaction logic.
- assets/js/nav/ owns navigation modules.

## Next Refactor Target

Rename theme-css-loader.js to app-bootstrap.js after all HTML pages point to one shared bootstrap.
