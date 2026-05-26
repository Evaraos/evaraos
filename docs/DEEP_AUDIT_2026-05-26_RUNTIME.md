# Evaraos Runtime Deep Audit — Theme Toggle / Stale Assets

## Date
2026-05-26

## Executive Summary
Primary failure was **runtime version drift** across entry HTML files. Different pages loaded mixed nav/theme/loader builds (`nav-v1`, `nav-v2`, `nav-v3`; `theme.js?v=37` vs `v38`; `loader.js?v=35` vs `v36`).

This produced inconsistent behavior where the theme button worked on some pages but appeared stale or non-functional on others.

## Evidence
- `node tools/repo-audit.js` still reports 563/603 with 20 known page consistency flags.
- Script tag scan showed mixed versions across pages before fix:
  - `nav.js?v=nav-v1` on many pages
  - `nav.js?v=nav-v2` on `ai_command.html`
  - `nav.js?v=nav-v3` on index only
  - `theme.js?v=37` on most pages
  - `loader.js?v=35` on most pages

## Root Cause
1. **Cross-page asset version fragmentation** in static HTML entries.
2. **Cache persistence** amplified fragmentation because older query strings continued to resolve old behavior.
3. **Nav/theme coupling** means stale nav build can ignore/override updated theme flow.

## Surgical Fix Applied
Standardized runtime script versions across public/settings entry pages:
- `nav.js` -> `?v=nav-v3`
- `theme.js` -> `?v=38`
- `loader.js` -> `?v=36`

No service worker or cache logic rewrites were made.

## Next Recommended Passes
1. Standardize CSS version tags similarly for key shared styles where needed.
2. Resolve the 20 repo-audit flagged pages (`universal nav mount present`, `repo absolute asset paths`).
3. Add a CI checker for mixed runtime versions in HTML script tags.

